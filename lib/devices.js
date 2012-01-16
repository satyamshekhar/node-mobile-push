var util = require("util");
var events = require("events");
var _ = require ("underscore");
var log = require("./log.js").getLogger("[DEVICE]");


/* Application for a type of device */
var Device = function (/* app name */ name, /* device type */ type) {
    events.EventEmitter.call(this);
    this.name = name;
    this.type = type;
    this._registeredDevices = { };
};

util.inherits(Device, events.EventEmitter);

Device.prototype.begetDevice = function (deviceId) {
    return {
        deviceId: deviceId
        , pushSent: 0
        , pushFailed: 0
        , lastRegistered: new Date()
		, params: params || {}
        , pending: [ ]
        , lastInterval: 1
        , nextId: 1
    };
};

Device.prototype._begetPushObject = function (deviceId, payload) {
    return {
        pushId: this._registeredDevices[deviceId].nextId++
        , payload: payload
    };
};

Device.prototype.register = function (/* deviceId */ deviceId, /*params*/ params) {
    if (this._registeredDevices[deviceId]) {
        log.info ("device: %s already registered", deviceid);
        _registeredDevices[deviceId].lastRegistered = new Date();
        _registeredDevices[deviceId].params = params || {};
        return true;
    }

    this._registeredDevices[deviceId] = this.begetDevice (deviceId);

    return true;
};

Device.prototype._enqueuePush = function (deviceId, pushObj) {
    this._registeredDevices[deviceId].pending.push (pushObj);
};

Device.prototype._popAndSend = function (deviceId) {
    var device = this._registeredDevices [deviceId];
    if (device.pending.length) this.sendPush (device, device.pending[0]);
};

Device.prototype.pushSuccessful = function (deviceId) {
    var device = this._registeredDevices[deviceId];
    this.emit ("push-success", deviceId, device.pending[0].pushId);
    device.pending.splice (0, 1);
    device.lastInterval = 1;
    if (device.pending.length) this._popAndSend ();
};

Device.prototype.pushFailed = function (deviceId, retryAfter /* in seconds */) {
    var device = this._registeredDevices[deviceId];
    var interval;
    if (retryAfter) {
        interval = retryAfter;
        device.lastInterval = 1;
    } else {
        interval = device.lastInterval;
        device.lastInterval *= 2;
    }
    device.timer = setTimeout (this._popAndSend.bind (this), interval * 1000);
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

Device.prototype.push = function (/* deviceId */ deviceId, /* payload */ payload) {
    if (!this._registeredDevices[deviceId]) return false;
    var pushObj = this._begetPushObject (deviceId, payload);
    this._enqueuePush (deviceId, pushObj);
    if (this.pending.length === 1) this._popAndSend (deviceId);
    return this.pushObj.pushId;
};

Device.prototype.unregister = function (/* deviceId */ deviceId) {
    if (!this._registeredDevices[deviceId]) {
        log.warn ("trying to unregister not registered device: %s", deviceId);
        return;
    }

    if (this._registeredDevices[deviceId].timer) {
        clearTimeout (this._registeredDevices[deviceId].timer);
    }
    
    _(this._registeredDevices[deviceId].pending).each (function (pushObj) {
        this.emit ("push-failed", deviceId, pushObj.pushId);
    });

    delete this._registeredDevices[deviceId];
};

exports.Device = Device;
