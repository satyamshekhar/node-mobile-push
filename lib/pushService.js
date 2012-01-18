var util = require ("util");
var https = require ("https");
var _ = require ("underscore");
var queryString = require ("querystring");

var timer = require ("./timer.js");
var pushUtils = require ("./push-utils.js");
var windows = require ("./windows.js");
var androids = require ("./android.js");
var urbanAirship = require ("./urban-airship.js");


var onCompleteBody = pushUtils.onCompleteBody;
var log = require ("./log.js").getLogger ("[MOBILE]");

var windowObject = null;
var androidObject = null;


init = function (config) {
	
    //var URI = "http://db3.notify.live.net/throttledthirdparty/01.00/AAE0R4lu2ccIRbCeWZolzYQJAgAAAAADAQAAAAQUZm52OjIzOEQ2NDJDRkI5MEVFMEQ";
    //windows.register ("123", {pushURI: "/Page2.xaml?NavigatedFrom=Toast Notification", callbackURI :"/Page2.xaml?NavigatedFrom=Toast Notification"});
    //windows.push("123", {description:"hello", message:"sandeep"});
	// var windowsObject = new windows.Windows ();
 	//windowsObject.register ("123", {pushURI: "http://db3.notify.live.net/throttledthirdparty/01.00/AAGgQc0JEtyBQKh8VxavONUjAgAAAAADAQAAAAQUZm52OjIzOEQ2NDJDRkI5MEVFMEQ", callbackURI :"/Page2.xaml?NavigatedFrom=Toast Notification"});
/*	windowsObject.push("123", {description:"hello", message:"sandeep"});
	windowsObject.push("123", {description:"hello1", message:"sandeep1"});
	windowsObject.push("123", {description:"hello2", message:"sandeep2"});*/
	//androidObject.register ("111", {registrationId: "APA91bGtHE9FmZGFDxFYRMw0Hkk8a8gOp_0ZQm1k6UNz7cvi_f6txk2gyI7anywxesrMttGq-FeDHGDrFvSt-W4YCeSff8pYZQRo7n5zT8CJLzEo7z4pnZQnVVQeolwk3XU66Jz-aftu"});
	//setTimeout(function(){androidObject.push("111", {collapse_key: "tickle", "data.sid":"12234"});},5000);
	
	/*	register("7cd590d00a256e32af3cd9242c08df6c0e554bc76adbb823ef747acc0ef68c77",{deviceType: "iphone"}, function(responseCode){
			log.info("Response code "+ responseCode);
		});
		setTimeout(function(){
			push("hi", {deviceToken:"7cd590d00a256e32af3cd9242c08df6c0e554bc76adbb823ef747acc0ef68c77", to: "sandeep.k@directi.com", deviceType: "iphone"});
			},5000);
		unregister("7cd590d00a256e32af3cd9242c08df6c0e554bc76adbb823ef747acc0ef68c77",{deviceType: "iphone"}, function(responseCode){
			log.info("Response code "+ responseCode);
		});*/
	androidObject = new androids.Android (); 
	windowObject = new windows.Windows ();
	urbanAirship.init (config);

};

register = function (deviceToken, params, callback) {
	switch (params.deviceType) {
		case 'iphone':
			urbanAirship.register (deviceToken, params, callback);
	        break;
	    case 'blackberry':
			urbanAirship.register (deviceToken, params, callback);
	        break;
		case 'windows':
			windowObject.register (deviceToken, params);
			break;
		case 'android':
			androidObject.register (deviceToken, params);
			break;
	}
};

unregister = function (deviceToken, params, callback) {
	switch (params.deviceType) {
		case 'iphone':
			urbanAirship.unregister (deviceToken, params, callback);
	        break;
	    case 'blackberry':
			urbanAirship.unregister (deviceToken, params, callback);
	        break;
		case 'windows':
			windowObject.unregister (deviceToken);
			break;
		case 'android':
			androidObject.unregister (deviceToken);
			break;
	}
};

push = function (alert, params) {
	switch (params.deviceType) {
		case 'iphone':
			urbanAirship.push (alert, params);
	        break;
	    case 'blackberry':
			urbanAirship.push (alert, params);
	        break;
		case 'windows':
			windowObject.register (deviceToken, params);
			break;
		case 'android':
			androidObject.register (deviceToken, params);
			break;
	}
};



init("hello");





