const keys = require("./keys.js");
const redis = require("redis");

const redisClient = redis.createClient({
  url: `redis://${keys.redisHost}:${keys.redisPort}`,
  retry_strategy: () => 1000,
});

const sub = redisClient.duplicate();

const fib = index => {
  if (index < 2) return 1;
  return fib(index - 1) + fib(index - 2);
};

(async () => {
  await redisClient.connect();
  await sub.connect();

  sub.subscribe("insert", message => {
    redisClient.hSet("values", message, fib(parseInt(message)));
  });
})();
