var util = require ("util");
var https = require ("https");
var _ = require ("underscore");
var queryString = require ("querystring");

var Devices = require ("./devices.js").Devices;
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


Android.prototype._onPushReqError = function (device) {
	return function (err) {
        // just keep retrying.
        this.pushFailed(device.deviceId, 2 * 1000);
    }.bind (this);
};

Android.prototype.handleError = function (device, error) {
    switch (error) {
    case "QuotaExceeded":
        // Too many messages sent by the sender. Retry after a while.
        // What we can do is set a x mins timer that resets this
        // value and respond with push failed during that time.
        this.quotaExceeded = true;
        log.error ("Quota exceeded for application %s", this._userName);
        this.emit ("QuotaExceeded", this);
        break;
    case "DeviceQuotaExceeded":
        // Too many messages sent by the sender to a specific device. Retry after a while.

        // What we can do is set a x mins timer that resets this
        // value and respond with push failed during that time.
        device.quotaExceeded = true;
        log.error ("DeviceQuotaExceeded for device: %s", device.deviceId, device.deviceURL);
        this.emit ("DeviceQuotaExceeded");
        break;
    case "MissingRegistration":
        // Missing registration_id. Sender should always add the registration_id to the request.
        log.error ("Missing registration_id: shouldn't have happened");
        break;

    case "InvalidRegistration": 
        // Bad registration_id. Sender should remove this registration_id.
        this.emit ("InvalidRegistration", device.deviceURL);
        this.unregister (device.deviceId, "InvalidRegistration");
        log.error ("registration_id is invalid: %s", device.deviceURL);
        break;

    case "MismatchSenderId":
        // The sender_id contained in the registration_id does not match the sender id used to register with the C2DM servers.
        break;

    case "NotRegistered":
        // The user has uninstalled the application or turned off notifications. Sender should stop sending messages to this device and delete the registration_id. The client needs to re-register with the c2dm servers to receive notifications again.
        log.error ("deviceId: %s, deviceURL: %s is not registered (anymore)", device.deviceId, device.deviceURL);
        this.unregister (device.deviceId, "NotRegistered");
        this.emit ("NotRegistered", device.deviceId, device.deviceURL);
        break;

    case "MessageTooBig":
        // The payload of the message is too big, see the limitations. Reduce the size of the message.
        log.error ("Message was too big to be sent. deviceId: %s", device.deviceId);
        this.pushFailedButDontRetry (device.deviceId, "MessageTooBig");
        break;

    case "MissingCollapseKey":
        // Collapse key is required. Include collapse key in the request.
        log.error ("We insert a default collapse_key. This shouldnt happend.");
        break;

    default:
        log.error ("Error case not handled");
        break;
    }
};

Android.prototype._onPushResponse = function (device) {
    return function (statusCode, body, headers) {
        switch (statusCode) {
        case 200:
            var response = queryString.parse (body, "\n");
            if (!response.Error) {
                this.pushSuccessful (device.deviceId);
            }
            else {
                this.handleError (device, response.Error);
            }
            break;
        case 401:
            log.error ("Client auth-token is invalid. This shouldn't have happened. Reinitiating Login.");
            this._getClientAuthToken ();
            // giving a 5 sec delay for us to relogin.
            this.pushFailed (device.deviceId, 5 * 1000);
            break;
        case 503:
            var retryAfter = headers['Retry-After'] ? Math.floor (headers['Retry-After']) : undefined;
            this.pushFailed (device.deviceId);
            break;
        }
    }.bind(this);
};

Android.prototype.register = function (deviceId, params) {
    params = params || { };
    params.deviceURL = deviceId;
    Devices.prototype.register.call (this, deviceId, params);
};

Android.prototype.sendPush = function (device, pushObj) {
    var options = {
        host: this._pushUrlHost
        , path: this._pushUrlPath
        , method: "POST"
    };

    var request = https.request (options);

    request.on ("response", onCompleteBody (this._onPushResponse (device).bind(this)));
    request.on ("error", this._onPushReqError (device).bind(this));
    request.setHeader ("Content-type", "application/x-www-form-urlencoded");
    request.setHeader ("Authorization", "GoogleLogin auth=" + this._authToken);

    var message = pushObj.payload;
    var payload = {
        registration_id: device.deviceURL
        , "data.message": pushObj.message
        , collapse_key: pushObj.collapse_key || "collapse"
    };

    var requestBody = queryString.stringify (payload);
    request.end (requestBody);
};

exports.Android = Android;
