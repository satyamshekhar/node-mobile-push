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

Device.prototype.register = function (/* deviceId */ deviceId, /*pushUri*/ pushURI, /*callback URl*/ callbackURL) {
    if (this._registeredDevices[deviceId]) {
        log.info ("device: %s already registered", deviceid);
        registeredDevices[deviceId].last_registered = new Date();
        
        /* for windows */
        registeredDevices[deviceId].pushURI = pushURI || "";
        registeredDevices[deviceId].callbackURL = callbackURL || "";
    }

    this._registeredDevices[deviceId] = {
        deviceId: deviceId
        , pushSent: 0
        , pushFailed: 0
        , lastRegistered: new Date()
		, pushURI: pushURI || ""
		, callbackURL: callbackURL || ""
        , pending: [ ]
        , lastInterval: 1
        , nextId: 1
    };

    return true;
};

Device.prototype._begetPushObject = function (registrationId, payload) {
    return {
        pushId: this.nextId++;
        , payload: payload
    };
};

Device.prototype._enqueuePush = function (pushObj) {
    this.pending.push (pushObj);
};

Device.prototype._popAndSend = function (deviceId) {
    if (this.pending.length) this.sendPush (this._registeredDevices[deviceId], this.pending[0]);
};

Device.prototype.pushSuccessful = function (deviceId) {
    this.emit ("push-success", deviceId, this.pending[0].pushId);
    this.pending.splice (0, 1);
    this.lastInterval = 1;
    if (this.pending.length) this._popAndSend ();
};

Device.prototype.pushFailed = function (deviceId, retryAfter /* in seconds */) {
    var interval;
    if (retryAfter) {
        interval = retryAfter;
        this.lastInterval = 1;
    } else {
        interval = this.lastInterval;
        this.lastInterval *= 2;
    }
    this._registeredDevices[deviceId].timer = setTimeout (this._popAndSend.bind (this), interval * 1000);
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
    this._enqueuePush (pushObj);
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

module.exports = Device;
