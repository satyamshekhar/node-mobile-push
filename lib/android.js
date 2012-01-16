var util = require ("util");
var https = require ("https");
var _ = require ("underscore");
var queryString = require ("querystring");

var Devices = require ("./devices.js");
var pushUtils = require ("./push-utils.js");

var onCompleteBody = pushUtils.onCompleteBody;
var log = require ("./log.js").getLogger ("[ANDROID]");

var config = {
    userName: "android@talk.to"
    , password: "*h*wOOl2"
    , clientAuthHost: "www.google.com"
    , clientAuthPath: "/accounts/ClientLogin"
    , clientLoginUrl: "https://www.google.com/accounts/ClientLogin"

    , pushUrlHost: "android.apis.google.com"
    , pushUrlPath: "/c2dm/send"

    , accountType: "GOOGLE"
    , service: "ac2dm"
    , collapseKey: "collapse_key"
};

function Android () {
    this._userName = config.userName;
    this._password = config.password;
    this._clienAuthHost = config.clientAuthHost || "www.google.com";
    this._clienAuthPath = config.clientAuthPath || "/accounts/ClientLogin";
    this._clientLoginUrl = config.clientLoginUrl || "https://www.google.com/accounts/ClientLogin";

    this._pushUrlHost = config.pushUrlHost || "android.apis.google.com";
    this._pushUrlPath = config.pushUrlPath || "/c2dm/send";

    this._service = config.service || "ac2dm";
    this._accountType = config.accountType || "HOSTED_OR_GOOGLE";
    this._collapseKey = config.collapseKey || "default";

    this._getClientAuthToken ();
};


Android.prototype = new Devices ("talk.to", "android");

Android.prototype._onClientAuthResponse = function (statusCode, body) {
    var parsedRes = queryString.parse(body, "\n");
    if (statusCode !== 200) {
        log.error ("Auth Error: %s %s", statusCode, parsedRes.Error);
        this.emit ("error", parsedRes.Error);
    } else {
        this._authToken = parsedRes.Auth;
        log.info ("Registerd token: %s", this._authToken);
        this.emit ("ready");
    }
};

Android.prototype._onClientAuthReqError = function (err) {
    log.error ("Client Auth Request Failure");
    log.error (err.toString());
    this.emit ("error", "Client Auth Request Failure");
};

Android.prototype._getClientAuthToken = function () {
    var options = {
          host: this._clienAuthHost
        , path: this._clienAuthPath
        , method: "POST"
    };

    var request = https.request (options);
    request.on ("response", onCompleteBody(this._onClientAuthResponse.bind(this)));
    request.on ("error", this._onClientAuthReqError.bind(this));
    request.setHeader ("Content-type", "application/x-www-form-urlencoded");

    var authBody = queryString.stringify({
        accountType: this._accountType
        , Email: this._userName
        , Passwd: this._password
        , service: this._service
    });

    log.info ("Requesting ClientAuthToken");
    request.end (authBody);
};


Android.prototype._onPushReqError = function (registrationId, pushId) {

};

Android.prototype._onPushResponse = function (registrationId, pushd) {
    return function (statusCode, body, headers) {
        switch (statusCode) {
        case 200:
            var response = queryString.parse (body, "\n");

            this.emit ("pushed", registrationId, pushId);
            log.info ("pushed " + pushId + " to " + registrationId);
            break;
        case 401:
            this.emit ("push-failed", registrationId, pushId);
            log.error ("AUTH-TOKEN invalid");
            this.emit ("error", "Invalid Auth-Token");
            break;
        case 503:
            this.emit ("push-failed", registrationId, pushId);
            log.error ()
            break;
        }
    }.bind(this);
};

Android.prototype.sendPush = function (device, payload) {
    var options = {
        host: this._pushUrlHost
        , path: this._pushUrlPath
        , method: "POST"
    };

    var request = https.request (options);

    request.on ("response", onCompleteBody (this._onPushResponse (registrationId, pushId).bind(this)));
    request.on ("error", this._onPushReqError (registrationId, pushId).bind(this));
    request.setHeader ("Content-type", "application/x-www-form-urlencoded");
    request.setHeader ("Authorization", "GoogleLogin auth=" + this._authToken);

    var payload = payload;
    var requestBodyObj = {
        registration_id: device.deviceId
        , collapse_key: payload.collapse_key
    };

    delete payload.collapse_key;

    _(requestBodyObj).extend (payload);

    var requestBody = queryString.stringify (requestBodyObj);
    log.info("Trying to push " + message + "to " + registrationId);

    request.end (requestBody);
};



/* 
   Sends a empty message with collapse key set to 
   tickle. This can be used to inform the client
   the server has some payload to send to the
   client.
*/
Android.prototype.tickle = function (registrationId) {
    return this.push (registrationId, {
        collapse_key: "tickle"
    });
};

exports.Android = Android;
