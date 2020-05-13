"use strict";
const { RateLimiterMemory } = require("rate-limiter-flexible");

const minPasswordLength = 12;
// Allow letters and numbers with - or _ somewhere in the middle
const usernamePattern = /^[A-Za-z0-9]+([_|-]?[A-Za-z0-9]){4,14}$/;
// Typical email pattern name@domain.com
const emailPattern = /^[A-Za-z0-9_\-.]+@[A-Za-z0-9_\-.]+(\.[A-Za-z]{2,5})+$/;
// Password have upper/lower case letters, numbers, and a handful of symbols
const passwordPattern = /^[A-Za-z0-9_\-.!#@$&\[\]]{12,}$/;
// At least 1 upper case letter
const upperCase = /[A-Z]{1,}/;
// At least 1 upper case letter
const lowerCase = /[a-z]{1,}/;
// At lease 2 numbers
const twoNumbers = /\d.*\d/;
// At least 2 special characters
const twoSpecialCharacters = /[_\-.!#@$&\[\]].*[_\-.!#@$&\[\]]/;

module.exports = {
  validateRegisterForm: function (username, email, password, confirmPassword) {
    if (username.length < 4 || username.length > 15) {
      throw new Error("UsernameTooShort");
    }
    if (!username.match(usernamePattern)) {
      throw new Error("UsernameInvalid");
    }
    if (!email.match(emailPattern)) {
      throw new Error("EmailInvalid");
    }
    if (password !== confirmPassword) {
      throw new Error("PasswordConfirmation");
    }
    if (password.length < minPasswordLength) {
      throw new Error("PasswordLength");
    }
    if (!password.match(passwordPattern)) {
      throw new Error("PasswordInvalid");
    }
    if (!password.match(upperCase)) {
      throw new Error("PasswordUpperLetter");
    }
    if (!password.match(lowerCase)) {
      throw new Error("PasswordLowerLetter");
    }
    if (!password.match(twoNumbers)) {
      throw new Error("PasswordNumbers");
    }
    if (!password.match(twoSpecialCharacters)) {
      throw new Error("PasswordCharacters");
    }
    return true;
  },

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
