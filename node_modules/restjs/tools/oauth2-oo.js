"use strict";
var rest = require('../index.js').rest();
var querystring = require('querystring');
function cloneObject(obj) {
	var returnObj;
	try {
		returnObj = JSON.parse(JSON.stringify(obj));
	} catch (e) {
		console.error(e);
		returnObj = -1;
	}
	return returnObj;
}

/**
*	Oauth2
*	handles Oauth2 calls according to spec
*	@param	{object}	config		Oauth2 configs
*	@constructor
*/
function Oauth2(config) {
	var self = this;
	var cHolder = cloneObject(config);
	self.config = (cHolder !== -1) ? cHolder : {};
	self.state = 0;
	self.lastCheck = self.state;
}
Oauth2.prototype.refreshCall = function authCall(config) {
	config = config || this.config;
	var body = {};
	var head = this.options;
	body = config;
	body.grant_type = "refresh_token";
	body.client_secret = config.consumer_secret;
	body.client_id = config.consumer_key;
	body.refresh_token = config.refresh_token;
	body = querystring.stringify(body);

	head.hostname =  config.hostname || head.hostname;
	head.method = 'POST';
	head.headers['Content-Type'] = 'application/x-www-form-urlencoded';
	head.path = config.refresh_path;
	head.headers.Accept = "application/json";
	head.headers['Content-length'] = body.length;
	return {
		body : body,
		head : head
	};
};
Oauth2.prototype.refreshToken = function refreshToken(auth, done) {
	var info;
	var self = this;
	if (typeof auth === "function") {
		done = auth;
		auth = {};
		info = self.refreshCall();
	} else {
		info = self.refreshCall(auth);
	}
	function tokenBack(err, res) {
		if (err) {
			console.log("[auth][refreshToken]" + err);
			done(err);
		} else {
			var newToken;
			try {
				newToken = JSON.parse(res.body);
			} catch (e) {
				console.log('parse error');
				done(e);
			}
			if (Math.floor(res.statusCode / 100) !== 2) {
				done(newToken);
			} else {
				self.state += 1;
				auth.access_token = newToken.access_token;
				if (newToken.expires_in || newToken.expires) {
					var expires = newToken.expires_in || newToken.expires;
					var time = Date.now();
					expires = (expires * 1000) + time;
					auth.expires = expires;
				}
				if (newToken.refresh_token) {
					auth.refresh_token = newToken.refresh_token;
				}
				done(null, auth);
			}
		}
	}
	console.log(info.head);
	console.log(info.body);
	rest.request(info.head, info.body, tokenBack);
};
Oauth2.prototype.hasChanged = function () {
	var self = this;
	if (self.state !== self.lastCheck) {
		self.lastCheck = self.state;
		return true;
	}
	return false;
};
Oauth2.prototype.getConfig = function () {
	return cloneObject(this.config);
};
Oauth2.prototype.setConfig = function (config) {
	var newConfig = cloneObject(config);
	if (newConfig === -1) {
		return false;
	}
	this.config = newConfig;
	return true;
};
Oauth2.prototype.setHead = function (options) {
	var newOptions = cloneObject(options);
	if (newOptions === -1) {
		return false;
	}
	this.options = newOptions;
	return true;
}
Oauth2.prototype.head = function () {
	return this.options;
};

/**
*	call
*	attempts to make specified call, refreshes token on failuer
*	@param	{string}	body			body of request
*	@param	{function}	callback	function to call on completion
*/
Oauth2.prototype.call = function attemptRequest(options, body, callback) {
	var self = this;
	var currentTime = new Date().getTime();

	if (self.config.expires <= (currentTime - 172800000)) {
		console.log('old token');
		self.refreshToken(self.config, function (err, newAuth) {
			if (err) {
				return callback(err);
			}
			rest.request(options, body, callback);
		});
	} else {
		rest.request(options, body, function (err, response) {
			if (err) {
				callback(err);
			} else {
				console.log(response.statusCode);
				if (response.statusCode === 401) {
					console.log(response.body);
					self.refreshToken(self.config, function (err, newAuth) {
						if (err) {
							return callback(err);
						}
						rest.request(options, body, callback);
					});
				} else {
					callback(null, response);
				}
			}
		});
	}
};

module.exports = Oauth2;
