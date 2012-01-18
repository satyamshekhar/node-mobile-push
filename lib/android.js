var util = require ("util");
var https = require ("https");
var _ = require ("underscore");
var queryString = require ("querystring");

var devices = require ("./devices.js");
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


Android.prototype = new devices.Devices ("talk.to", "android");

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


Android.prototype._onPushReqError = function (deviceId) {
	return function (statusCode, body, response_headers) {
    }.bind (this);
};

Android.prototype._onPushResponse = function (deviceId) {
    return function (statusCode, body, headers) {
		log.info(statusCode);
        switch (statusCode) {
        case 200:
            var response = queryString.parse (body, "\n");
            this.pushSuccessful (deviceId);
            break;
        case 401:
            break;
        case 503:
			if (headers ['Retry-After']) {
				this.pushFailed (deviceId, headers ['Retry-After']);
			} else {
				this.pushFailed (deviceId);
			}
            break;
        }
    }.bind(this);
};

Android.prototype.sendPush = function (device, params) {
    var options = {
        host: this._pushUrlHost
        , path: this._pushUrlPath
        , method: "POST"
    };

    var request = https.request (options);
	

    request.on ("response", onCompleteBody (this._onPushResponse (device.deviceId).bind(this)));
    request.on ("error", this._onPushReqError (device.deviceId).bind(this));
    request.setHeader ("Content-type", "application/x-www-form-urlencoded");
    request.setHeader ("Authorization", "GoogleLogin auth=" + this._authToken);
	console.log("params: " + JSON.stringify (params));
    var data = params.payload;
	
    data.registration_id = device.params.registrationId;

    var requestBody = queryString.stringify (data);
    log.info("Payload " + requestBody);

    request.end (requestBody);
};



/* 
   Sends a empty message with collapse key set to 
   tickle. This can be used to inform the client
   the server has some payload to send to the
   client.
*/
/*Android.prototype.tickle = function (registrationId) {
    return this.push (registrationId, {
        collapse_key: "tickle"
    });
};*/

exports.Android = Android;
