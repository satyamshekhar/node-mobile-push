var https = require('https');
var events = require('events');

var MasterKey = '';
var MasterSecret = '';

var emitter = new events.EventEmitter();

var get_config = function () {
    return {
        host: 'go.urbanairship.com',
        port: 443,
        headers: {}
    };
};


var get_register_path_for_device = function (device) {
	switch (device) {
	case 'iphone': 
		return '/api/device_tokens/';
	case 'blackberry': 
		return '/api/device_pins/';
	}
};

module.exports.init = function (config) {
    // if (!config) {
    //    console.error(new Date() + 'No config provided to urban-airship');
    //    return;
    // }
    MasterKey = config.key || 'nfztGmYQTe-tlimG5e2iFA';
    MasterSecret = config.secret || 'PzhmbD1-T5CPrxrF3d_6LQ';
    return emitter;
};

/* 
   emitted events
   register-req -- request sent to urban-airship
   register-res -- got response from urban-airship
   register-incr -- device already registered with urban-airship, incrementing its count
   unregister-req -- request sent to urban-airship
   unregister-res -- got response from urban-airship
   unregister-decr -- device can't be unregister from urban-airship, decrementing its count

   push-req --
   push-res --
*/

var _register = function (deviceToken, params, callback) {
    var options = get_config();
    options.path = get_register_path_for_device(params.deviceType) + deviceToken;
    options.method = 'PUT';
    options.headers['Content-Length'] = '0';
    options.headers.Authorization = 'Basic ' + new Buffer(MasterKey + ':' + MasterSecret).toString('base64');
    

    //response return 200 for updates, 201 for created
    var req = https.request(options, function (res) {        
        params.statusCode = res.statusCode;
        if (callback) {
            callback(res.statusCode);
        }
        emitter.emit('register-res', params);
    });
    
    req.on('error', function(e, b) {
        console.error('Register call failed with error = ', e);
    });
    emitter.emit('register-req', params);
    req.end();
};

var _unregister = function (deviceToken, params, callback) {
    var options = get_config();
    options.path = get_register_path_for_device(params.deviceType) + deviceToken;
    options.method = 'DELETE';
    options.headers['Content-Length'] = '0';
    options.headers.Authorization = 'Basic ' + new Buffer(MasterKey + ':' + MasterSecret).toString('base64');
    
    //response return 204
    var req = https.request(options, function (res) {
        params.statusCode = res.statusCode;
        if (callback) {
            callback(res.statusCode);
        }
        emitter.emit('unregister-res', params);
    });
    
    req.on('error', function() {
        console.error('unregister call to urbanairship failed for deviceToken = ' + deviceToken);
    });

    emitter.emit('unregister-req', params);
    req.end();
};

/* 
   it executes the callback with the status code of the response
   201 - created
   200 - updated
*/
module.exports.register = function (deviceToken, params, callback) {
    if (!deviceToken) {
        return;
    }
    
    /* registering with the server every-time */
    _register(deviceToken, params, callback);
};

/*
  204 - deleted 
*/
module.exports.unregister = function (deviceToken, params, callback) {
    if (!deviceToken) {
        return;
    }
    /*
    store.getDeviceTokenCount(deviceToken, function (count) {
        if (count === 1 || count === "1") {
            _unregister(deviceToken, params, callback);
        }
        else {
            store.decrementDeviceTokenCount(deviceToken);
            params.statusCode = 204;
            if (callback) {
                callback(params.statusCode);
            }
            emitter.emit('unregister-decr', params);
        }
    });
    */
};

var post_body_for_device_type = function (alert, params) {
	switch (params.deviceType) {
	case 'iphone':
        return {
            "device_tokens": [params.deviceToken],
            "aps": {
                'alert': alert,
                'to': params.to,
                'badge': params.badge || 1,
                'sound': 'default'
            }
        };
    case 'blackberry':
        return {
            "device_pins": [params.deviceToken],
            "blackberry": {
                'content-type': 'text/plain',
                'body': params.sid
            }
        };
    }
};

module.exports.push = function (alert, params) {
	var post_body = JSON.stringify(post_body_for_device_type (alert, params));
	console.log(post_body);
    var options = get_config();
    options.path = '/api/push/';
    options.method = 'POST';
    options.headers['Content-Type'] = 'application/json';
    options.headers['Content-Length'] = post_body.length;
    options.headers.Authorization = 'Basic ' + new Buffer(MasterKey + ':' + MasterSecret).toString('base64');

    //response return 200
    var req = https.request(options, function (res) {
        params.statusCode = res.statusCode;
		console.log("Push urban airship "+res.statusCode);
        emitter.emit('push-res', params);
    });
    
    req.on('error', function(e) {
        console.error('push call to urbanairship failed for deviceToken = ' + deviceToken);
        console.error('error recvd: ' + e);
    });
    
    req.write(post_body);

    emitter.emit('push-req', params);
    req.end();
};
