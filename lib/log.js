var log4js = require("log4js");
log4js.configure({
    doNotReplaceConsole: true
});
log4js.clearAppenders();
var appender = log4js.appenders.console(log4js.layouts.basicLayout);
log4js.addAppender(appender);

log4js.setGlobalLogLevel("trace");
module.exports = log4js;
