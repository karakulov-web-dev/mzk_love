var page = require("webpage").create();
var config = require("../account.config");

var configJson = JSON.stringify(config.account);

page.onConsoleMessage = function(msg) {
  console.log(msg);
};
page.open(
  "https://oauth.vk.com/authorize?client_id=6886658&display=page&redirect_uri=https://oauth.vk.com/blank.html&scope=video,wall&response_type=token&v=5.92&state=123456",
  function(status) {
    page.evaluate(function(configJson) {
      config = JSON.parse(configJson);
      document.querySelectorAll(".oauth_form_input")[0].value = config.login;
      document.querySelectorAll(".oauth_form_input")[1].value = config.password;
      document.querySelector("#install_allow").click();
    }, configJson);
    setTimeout(function() {
      page.evaluate(function() {
        try {
          document.querySelector(".button_indent").click();
        } catch (e) {}
      });
      setTimeout(function() {
        finish();
      }, 5000);
    }, 5000);

    function finish() {
      page.evaluate(function() {
        console.log(location.hash.split("&")[0].split("=")[1]);
      });
      phantom.exit();
    }
  }
);
