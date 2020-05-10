var socket = io();

let app = new Vue({
  el: '.login-register-container',
  data: {
    alertHeader: "",
    alertBody: ""
  }
});

// Get the modal
var modal = document.getElementById("alertModal");

// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];

// When the user clicks on <span> (x), close the modal
span.onclick = function () {
  modal.style.display = "none";
}

var errorType = getParameterByName("errorType");
if (errorType && errorType != '') {
  if (errorType === "registrationError") {
    app.alertHeader = "Failed to Create Account!";
  }
  else if (errorType === "loginError") {
    app.alertHeader = "Failed to log in!";
  }
  else {
    app.alertHeader = "";
  }
}

var errorCode = getParameterByName('errorCode');
if (errorCode && errorCode != '') {
  if (errorCode === "UsernameInvalid") {
    app.alertBody = "Username contains illegal character.";
  }
  else if (errorCode === "EmailInvalid") {
    app.alertBody = "Are you sure that's a valid email address?";
  }
  else if (errorCode === "PasswordConfirmation") {
    app.alertBody = "The entered passwords don't match.";
  }
  else if (errorCode === "PasswordLength") {
    app.alertBody = "Password needs to be at least 12 characters.";
  }
  else if (errorCode === "PasswordInvalid") {
    app.alertBody = "Password contains an illegal character.";
  }
  else if (errorCode === "PasswordUpperLetter") {
    app.alertBody = "Password needs more upper case letters.";
  }
  else if (errorCode === "PasswordLowerLetter") {
    app.alertBody = "Password needs more lower case letters.";
  }
  else if (errorCode === "PasswordNumbers") {
    app.alertBody = "Password needs more numbers.";
  }
  else if (errorCode === "PasswordCharacters") {
    app.alertBody = "Password needs more special characters.";
  }
  else if (errorCode === "InvalidCredentials") {
    app.alertBody = "Please choose another username/email and try again.";
  }
  else if (errorCode === "InvalidLogin") {
    app.alertBody = "Incorrect username/password.";
  }
  else {
    app.alertBody = "Unkown error occurred. Please try again.";
  }
}

if (app.alertBody != "" || app.alertHeader != "") {
  modal.style.display = "block";
}

function getParameterByName(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
    results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}