'use strict';
const { RateLimiterMemory } = require("rate-limiter-flexible");

module.exports = {
  /**
  * Rate limiting variable. Only give clients 5 points per seconds.
  * Protects against potential flooding and DDoS.
  */
  rateLimiter: new RateLimiterMemory(
    {
      points: 10,
      duration: 1,
    }
  ),

  /**
  * Validate that a user input is strictly a string of digits.
  */
  validateNumberInput: function (input) {
    var acceptedInput = /^\d+$/;
    return acceptedInput.test(input);
  }
};
