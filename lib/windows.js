var util = require("util");
var http = require("http");
var url = require("url");
var queryString = require("querystring");

var devices = require("./devices.js");
var pushUtils = require("./push-utils.js");

var Timer = require("./timer.js");

var onCompleteBody = pushUtils.onCompleteBody;
var log = require("./log.js").getLogger("[WINDOWS]");


function Windows () {
}

Windows.prototype = new devices.Devices("talk.to", "windows");

Windows.prototype._onPushResponse = function (deviceId) {
    return function (statusCode, body, response_headers) {
			var responseNotificationState = response_headers ['x-notificationstatus'];
			var responseSubscriptionState = response_headers ['x-subscriptionstatus'];
			var responseDeviceConnectionStatus = response_headers ['x-deviceconnectionstatus'];
		//	log.info("Response received " + responseNotificationState + " " + responseSubscriptionState +" " + responseDeviceConnectionStatus +" " + statusCode);
			if (responseSubscriptionState === 'Expired') {
				log.info ("Drop the subscription state of deviceId" + deviceId + " and doesn't send any further push notification");
				this.unregister (deviceId);
				return;
			} else if (statusCode === 200){
				if (responseNotificationState === 'Received') {
					log.info ("Message send to " + deviceId);
					this.pushSuccessful (deviceId);
				} else if (responseNotificationState === 'QueueFull') {
					log.info("Resend the message using exponential backoff to deviceId " + deviceId);
					this.pushFailed (deviceId);
				} else if(responseNotificationState === 'Suppressed') {
					log.info ("push notification is supressed of a particular push notification class");
					this.pushSuccessful (deviceId);
				}	
			} else if (statusCode === 400) {
				log.error ("Bad request due to Malformed XML for registration id " + deviceId);
				this.pushSuccessful (deviceId);
			} else if (statusCode === 401) {
				log.error ("Unauthorised request for registration id " + deviceId);
				this.unregister (deviceId);
			} else if (statusCode === 404) {
				log.error("Dropped due to invalid subscription for registration id " + deviceId);
				this.unregister(deviceId);
			} else if (statusCode === 405) {
				log.error("Method not allowed for registration id " + deviceId);
				this.pushFailed (deviceId);
			} else if (statusCode === 406) {
				log.error("Not acceptable the unathenticated service has reached a daily limit for registration id " + deviceId);
				this.pushFailed (deviceId, 60*60); 
			} else if (statusCode === 412) {
				log.error("Device inactive try sending it after 1 hrs but dont violates the maximum of one re-attempt per hour for registration id " + deviceId);
				this.pushFailed (deviceId, 60*60);
			} else if (statusCode === 503) {
				log.error("Service Unavailable for registration id " + deviceId);
				this.pushFailed (deviceId);
			}	
    }.bind(this);
};

Windows.prototype._onPushReqError = function (deviceId) {
    return function (statusCode, body, response_headers) {
    }.bind (this);
};

Windows.prototype._sendToastMessage = function(deviceId, options , description, message, callbackURL){
	//log.info("inside send toast message " + description + " : "+ message);
	var payload = "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
						"<wp:Notification xmlns:wp=\"WPNotification\">" +
							"<wp:Toast>" +
								"<wp:Text1>" + description + "</wp:Text1>" +
								"<wp:Text2>" + message + "</wp:Text2>" +
								"<wp:Param>" + callbackURL + "</wp:Param>" +
							"</wp:Toast>" +
						"</wp:Notification>";
	
	
	var request = http.request(options);
	request.on ("response", onCompleteBody(this._onPushResponse(deviceId)));
    request.on ("error", this._onPushReqError(deviceId).bind(this));
	request.setHeader ("Content-Type", "text/xml");
	request.setHeader ("Content-Length", payload.length);
	request.setHeader ("X-WindowsPhone-Target", "toast");
	request.setHeader ("X-NotificationClass", "2");
	
	request.write(payload);
	request.end();	
};

Windows.prototype.sendPush = function(device, params) {
	//log.info ("push message inside windows to " + device.deviceId + " to the uri " + device.params.pushURI + params.payload.description + params.payload.message);
	var uriData = url.parse (device.params.pushURI);
	var options = {
	  host: uriData.host,
	  path: uriData.pathname,
	  method: 'POST',
	  headers: {}
	};		
	this._sendToastMessage (device.deviceId, options, params.payload.description, params.payload.message, device.params.callbackURI);
};

exports.Windows = Windows;
