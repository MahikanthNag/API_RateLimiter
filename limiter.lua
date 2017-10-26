-- Error codes in different scenarios
local NO_TOKENS_LEFT = -2
local BURST_LIMIT_EXCEEDED = -1

local tokens_key = "tokens_in_bucket"
local last_refreshed_key = "LastRefreshed"
local requested_time_key = 'RequestedTime'

local  timestamp_key = KEYS[2]
local bucket_size = 50
local capacity = 30
local  token_arrival_rate = 4;
-- local request_timestamp = os.clock()
local request_timestamp = KEYS[3]
local max_output_rate = 25
local burst_length = 10
local ttl = 180
local max_burst_length = bucket_size/(max_output_rate - token_arrival_rate)
local tokens_in_bucket = tonumber(redis.call("get", tokens_key))
-- local last_refreshed = tonumber(redis.call('get', last_refreshed))
local requested_time = tonumber(ARGV[2])
local last_refreshed_time = tonumber(ARGV[3])
local current_time = ARGV[2]


redis.call('set', requested_time_key, ARGV[2])
redis.call('set', last_refreshed_key, ARGV[3])

if tokens_in_bucket == nil then
    tokens_in_bucket = capacity
    redis.call("set", tokens_key, tokens_in_bucket)
end

if requested_time - last_refreshed_time > token_arrival_rate*60000 then
    tokens_in_bucket = capacity
    redis.call('set', last_refreshed_key, ARGV[2])
    last_refreshed_time = current_time
    redis.call("set", tokens_key, tokens_in_bucket)
end
local i
if tokens_in_bucket >= tonumber(ARGV[1]) then
    
    
    local results = redis.call("KEYS", KEYS[2].."*")
    -- return results
    local total_number_of_requests_in_window = 0
    for i, key in ipairs(results) 
    do 
        total_number_of_requests_in_window = total_number_of_requests_in_window + tonumber(redis.call("get", key))
    end
    if total_number_of_requests_in_window >= burst_length then    
        return {NO_TOKENS_LEFT, last_refreshed_time, burst_length, ttl}
    else
        local data = tonumber(redis.call("get", KEYS[1]))
        if data then
            redis.call('setex', KEYS[1], ttl, data+1)
        else
            redis.call('setex', KEYS[1], ttl, 1)
        end
        tokens_in_bucket = tokens_in_bucket - tonumber(ARGV[1])
        redis.call("set", tokens_key, tokens_in_bucket)
        return {tokens_in_bucket, last_refreshed_time}
    end        
else
    return {BURST_LIMIT_EXCEEDED, last_refreshed_time}
end