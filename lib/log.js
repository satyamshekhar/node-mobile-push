var log4js = require("log4js");
log4js.configure({
    doNotReplaceConsole: true
});
log4js.clearAppenders();
log4js.addAppender(log4js.consoleAppender(log4js.basicLayout));

log4js.setGlobalLogLevel("trace");
module.exports = log4js;