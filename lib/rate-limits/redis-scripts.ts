import "server-only"

// Atomically applies a GCRA token-bucket check and records the next theoretical
// arrival time when the request is allowed.
export const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local window = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])

local interval = window / limit
local tat = tonumber(redis.call("GET", key) or "0")
local candidate_tat = math.max(tat, now) + (cost * interval)
local allowed_at = candidate_tat - window

if allowed_at > now then
  local retry_after = math.max(1, math.ceil((allowed_at - now) / 1000))
  local reset = math.max(0, math.ceil((tat - now) / 1000))
  return {0, 0, retry_after, reset}
end

local ttl = math.ceil(window + (cost * interval))
redis.call("SET", key, candidate_tat, "PX", ttl)

local remaining = math.floor((window - (candidate_tat - now)) / interval)
if remaining < 0 then
  remaining = 0
end

local reset = math.max(1, math.ceil((candidate_tat - now) / 1000))
return {1, remaining, 0, reset}
`

// Atomically removes expired leases, then claims a new connection lease when
// the policy still has capacity.
export const ACQUIRE_CONNECTION_LEASE_SCRIPT = `
local key = KEYS[1]
local lease_id = ARGV[1]
local now = tonumber(ARGV[2])
local expires_at = tonumber(ARGV[3])
local limit = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])

redis.call("ZREMRANGEBYSCORE", key, "-inf", now)
local count = redis.call("ZCARD", key)

if count >= limit then
  local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  local retry_after = 1
  if oldest[2] ~= nil then
    retry_after = math.max(1, math.ceil((tonumber(oldest[2]) - now) / 1000))
  end
  return {0, count, retry_after}
end

redis.call("ZADD", key, expires_at, lease_id)
redis.call("PEXPIRE", key, ttl)
return {1, count + 1, 0}
`

// Extends an existing connection lease if it is still present.
export const RENEW_CONNECTION_LEASE_SCRIPT = `
local key = KEYS[1]
local lease_id = ARGV[1]
local expires_at = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

if redis.call("ZSCORE", key, lease_id) == false then
  return 0
end

redis.call("ZADD", key, expires_at, lease_id)
redis.call("PEXPIRE", key, ttl)
return 1
`

// Removes a connection lease when the stream closes.
export const RELEASE_CONNECTION_LEASE_SCRIPT = `
return redis.call("ZREM", KEYS[1], ARGV[1])
`
