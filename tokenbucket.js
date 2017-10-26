var log4js = require('log4js');
var logger = log4js.getLogger();

var express = require('express');
var http = require('http');
var fs = require('fs');
var url = require('url');
var redis = require('redis');
var connect = require('connect');

var app = express();
var client_ids = ['10.99.157.244', '10.99.157.245'];
var apis = ['/api1', '/api2'];
var rpm = 20;
var defaultHost = '127.0.0.1';
var defaultPort = 6379;
var timeToStoreCache = 180;
var hsetxx;
var tokenCount = 30;
var lastFilledTime = 0;
var bucketSize = 60;
var tokeArrivalRate = 20;
var redisClient = redis.createClient();
var RateLimiter = require('limiter').RateLimiter;
var limiter = new RateLimiter(30, 'minute');
var server = app.listen(8080);
app.get("/api1", filterApiCalls, executeCalls);
// app.use(bodyParser.urlencoded({ extended  : true }));
logger.level = 'debug';

function executeCalls(req, res, next)
{
    logger.info("Request serving inititated");
    res.write("done");
    res.end();
    logger.info("Request served");
}

function _checkRedisClient() {
    if(!redisClient){
        redisClient = redis.createClient(defaultPort, defaultHost);
    }
}

function serveRequest(numOfTokens, res, next, req) {
    var date = new Date()
    var now = date.getMinutes();
    var currentSeconds = date.getTime();
    var prefix = req.query.client+'.'+req.url+'.';
    var key = prefix + currentSeconds+"";
    var timestampKey = prefix + 'token';
    
    
    var requests = redisClient.eval(fs.readFileSync('./limiter.lua'), 2, 
    key, prefix, numOfTokens, currentSeconds, lastFilledTime, (e, data) => {
        lastFilledTime = data[1];
        if(data[0] == -2)
        {
            logger.info("Burst limit exceeded!!! \nCannot send more than "+data[2]+" requests in "+data[3]+"seconds");
            res.end("cannot send more than 10 reqs in "+data[3]+"seconds");
        }
        else if(data[0] == -1)
        {
            logger.info("No tokens left in bucket for client "+req.query.client+" for the api "+req.url);
            res.write("Unable to serve this request.\nTokens insufficient");
            res.end();
        }
        else{
            logger.info("No. of tokens left in ucket after serving this request : "+data[0])
            res.write("Request served. Remainig tokens : "+data[0]);
            next();
        }
    });        
}
function filterApiCalls(req, res, next)
{
    _checkRedisClient();
    var currentSeconds = new Date().getTime();
    serveRequest(1, res, next, req);
}
