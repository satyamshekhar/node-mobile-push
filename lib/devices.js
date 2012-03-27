var util = require("util");
var events = require("events");
var _ = require ("underscore");
var log = require("./log.js").getLogger("[DEVICE]");


/* Application for a type of device */
var Devices = function (/* app name */ name, /* device type */ type) {
    events.EventEmitter.call(this);
    this.name = name;
    this.type = type;
    this._registeredDevices = { };
};

util.inherits(Devices, events.EventEmitter);

Devices.prototype._begetDevice = function (deviceId, params) {
    return {
        deviceId: deviceId
        , pushSent: 0
        , pushFailed: 0
        , lastRegistered: new Date()
        , deviceURL: params.deviceURL
		, params: params || {}
        , pending: [ ]
        , lastInterval: 1
        , nextId: 1
    };
};

Devices.prototype._begetPushObject = function (device, payload) {
    return {
        pushId: device.nextId++
        , payload: payload
    };
};

Devices.prototype._enqueuePush = function (device, pushObject) {
    device.pending.push (pushObject);
};

Devices.prototype._popAndSend = function (device) {
	//log.info("inside popAndSend "+ device.pending.length);
    if (device.pending.length) this.sendPush (device, device.pending[0]);
};

/* 
   How will I push?

   I will take the registrationId and payload to push to. 
   If the registerationId is not registered I ll return false
   otherwise I return a pushId that can be used to identify a
   push payload for a given registerationId. 

   On receiving a push payload for a registrationId that is valid
   I enqueue it to pending pushes and try to send that payload.

   If I receive a network error I ll retry with exponential backoff
   for LIMIT number of times and then report push-failed by emitting
   push-failed with registrationId and pushId as args.

   If I receive a valid http-response with statusCode 200 I emit 
   pushed with registrationId and pushId as args.

   If there is an error

   pushes the given payload to the client with 
   registrationId = registrationId. retries 
   in case of network/service error. honors 
   retry-after header or does an exponential backoff.

   returns pushId that can be used to uniquely 
   identify a payload for a registration id.

   returns false if device with registration 
   id = registrationId is not registered.  

   emits "pushed" on success (registrationId, pushId)
   emits "push-failed" on failure.
*/

Devices.prototype.pushFailedButDontRetry = function (deviceId, reason) {
    var device = this._registeredDevices[deviceId];
    if (device) {
        var pushObj = device.pending[0];
        if (!pushObj) return;

        devce.lastInterval = 1;
        devce.pending.splice (0, 1);
        
        this.emit ("push-failed", deviceId, pushObj.pushId, reason);
        
        if (device.pending.length) this._popAndSend (device);
    }
};

Devices.prototype.pushSuccessful = function (deviceId) {
    var device = this._registeredDevices[deviceId];
    if (device) {
        this.emit ("push-success", deviceId, device.pending[0].pushId);
        device.pending.splice (0, 1);
        device.lastInterval = 1;

        if (device.pending.length) this._popAndSend (device);
    }
};

Devices.prototype.pushFailed = function (deviceId, retryAfter /* in seconds */) {
    var device = this._registeredDevices[deviceId];
	if (device) {
		var interval;
	    if (retryAfter) {
	        interval = retryAfter;
	        device.lastInterval = 1;
	    } else {
	        interval = device.lastInterval;
	        device.lastInterval *= 2;
	    }
	    device.timer = setTimeout (this._popAndSend.bind(this), interval * 1000, device);
	}
};

Devices.prototype.push = function (/* deviceId */ deviceId, /* payload */ payload) {
    log.debug("unregister device: %s", deviceId);
    var device = this._registeredDevices[deviceId];

    if (!device) return false;
    var pushObj = this._begetPushObject (device, payload);
    
    this._enqueuePush (device, pushObj);
    if (device.pending.length === 1) this._popAndSend (device);
    return pushObj.pushId;
};

Devices.prototype.register = function (/* deviceId */ deviceId, /*params*/ params) {
    log.debug("register device: %s", deviceId);
    if (this._registeredDevices[deviceId]) {
        log.info ("device: %s already registered", deviceId);
        this._registeredDevices[deviceId].lastRegistered = new Date();
        this._registeredDevices[deviceId].params = params || {};
        return true;
    }

    this._registeredDevices[deviceId] = this._begetDevice (deviceId,params);

    return true;
};

Devices.prototype.unregister = function (/* deviceId */ deviceId, reason) {
    var device = this._registeredDevices[deviceId];
    if (!device) {
        log.warn ("trying to unregister not registered device: %s", deviceId);
        return;
    }

    if (device.timer) {
        clearTimeout (device.timer);
    }
    
    _(device.pending).each (function (pushObj) {
        this.emit ("push-failed", deviceId, pushObj.pushId, reason || "unregistered");
    }, this);

    delete this._registeredDevices[deviceId];
};

exports.Devices = Devices;
