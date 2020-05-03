const { RateLimiterMemory } = require("rate-limiter-flexible");

module.exports = {
  /**
  * Rate limiting variable. Only give clients 5 points per seconds.
  * Protects against potential flooding and DDoS.
  */
  rateLimiter: new RateLimiterMemory(
    {
      points: 5,
      duration: 1,
    }
  ),
};
