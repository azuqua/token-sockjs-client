(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
;(function(global){
 
	var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	var uuid = function(){
		var i, out = "";
		for(i = 0; i < 10; i++)
			out += chars.charAt(Math.random() * chars.length | 0);
		return out;
	};
 
	var Monitor = function(socket, messageCallback){
		this._socket = socket;
		this._inTransit = {};
		this._messageCallback = messageCallback || function(){};
	};
 
	Monitor.prototype.sendMessage = function(data, callback){
		if(typeof data === "string")
			data = JSON.parse(data);
		var _uuid = uuid();
		data.uuid = _uuid;
		if(!this._inTransit[data.rpc])
			this._inTransit[data.rpc] = {};
		this._inTransit[data.rpc][_uuid] = callback;
		this._socket.send(JSON.stringify(data));
	};
 
	Monitor.prototype.handleResponse = function(data){
		var fn = null;
		if(data.rpc && data.uuid)
			fn = this._inTransit[data.rpc][data.uuid];
		if(fn){
			if(data.error)
				fn(data.error);
			else
				fn(null, data.resp);
			delete this._inTransit[data.rpc][data.uuid];
		}else if(this._messageCallback){
			this._messageCallback(data.channel, data.message);
		}
	};

	var rpcResponse = function(error, resp, instance, data){
		var res = {};
		if(error)
			res.error = error.message || error;
		else
			res.data = resp;
		var out = {
			rpc: "_rpc",
			fid: data.fid,
			resp: res
		};
		instance._socket.send(JSON.stringify(out));
	};

	var handleInternal = function(instance, command, data){
		if(command === "subscribe"){
			instance._channels[data.channel] = true;
		}else if(command === "unsubscribe"){
			delete instance._channels[data.channel];
		}else if(command === "rpc"){
			var fn = instance._actions;
			data.command.split(".").forEach(function(s){
				fn = fn && fn[s] ? fn[s] : null;
			});
			if(fn && typeof fn === "function"){
				fn(data.args, function(error, resp){
					rpcResponse(error, resp, instance, data);
				});
			}
		}
	};

	var formEncode = function(obj, prefix) {
		var out = [];
		for(var prop in obj){
			if(!obj.hasOwnProperty(prop))
				continue;
			var key = prefix ? prefix + "[" + prop + "]" : prop, 
				val = object[prop];
			str.push(typeof val == "object" ? formEncode(val, key) : encodeURIComponent(key) + "=" + encodeURIComponent(val));
		}
		return out.join("&");
	};

	var request = function(options, data, callback){
		if(options.dataType && options.dataType.toLowerCase() === "jsonp") {
			var callbackKey = "token_callback_" + new Date().getTime() + "_" + (Math.round(Math.random() * 1e16)).toString(36);
			var script = global.document.createElement("script");
			global[callbackKey] = function(resp) {
				global.document.body.removeChild(script);
				delete global[callbackKey];
				try{
					resp = JSON.parse(resp);
				}catch(e){
					return callback(new Error(resp || "Error making jsonp request!"));
				}
				callback(resp && resp.error ? resp.error : null, resp);
			};
			script.onerror = function(e){
				global.document.body.removeChild(script);
				delete global[callbackKey];
				callback(new Error("Error making jsonp request!"));
				return false;
			};
			script.onload = function(e){
				return false;
			};
			script.src = options.url + (options.url.indexOf("?") > 0 ? "&" : "?") + callback + "=" + callbackKey + "&" + formEncode(data || {});
			global.document.body.appendChild(script);
		}else{
			var xhr = new global.XMLHttpRequest();
			options.url += (options.url.indexOf("?") > 0 ? "&" : "?") + formEncode(data || {});
			xhr.open(options.method, options.url, true);
			xhr.onreadystatechange = function(){
				if(xhr.readyState === 4){
					var msg = xhr.target ? xhr.target.responseText : null;
					try{
						msg = JSON.parse(msg);
					}catch(ev){}

					if(xhr.status >= 200 && xhr.status < 300) 
						callback(null, msg);
					else 
						callback(msg ? msg : new Error("Error making HTTP request"));
				}
			};
			xhr.setRequestHeader("Accept", "application/json");
			xhr.send();
		}
	};

	var resetConnection = function(tokenSocket, callback){
		request(tokenSocket._opts, tokenSocket._authentication, function(error, resp){
			if(error)
				return callback(error);
			if(!resp.token)
				return callback(new Error("No token found!"));

			tokenSocket._token = resp.token;
			tokenSocket._socket = new global.SockJS(tokenSocket._apiRoute + tokenSocket._socketPrefix, null, tokenSocket._sockjs);
			tokenSocket._socket.onopen = function(){
				tokenSocket._monitor.sendMessage({
					rpc: "auth",
					token: tokenSocket._token
				}, function(error, resp){
					if(error){
						callback(error);
					}else{
						delete tokenSocket._closed;
						callback();
						replay(tokenSocket);
					}
				});
			};
			tokenSocket._monitor = new Monitor(tokenSocket._socket);
			tokenSocket._socket.onmessage = function(e){
				try{
					e.data = JSON.parse(e.data);
				}catch(ev){ return; }
				if(e.data.internal)
					handleInternal(tokenSocket, e.data.command, e.data.data);
				else	
					tokenSocket._monitor.handleResponse(e.data);
			};
			tokenSocket._socket.onclose = function(){
				tokenSocket._closed = true;
				if(tokenSocket._reconnect)
					resetConnection(tokenSocket, tokenSocket._onreconnect);
			};
		});
	};

	var checkAndUseConnection = function(tokenSocket, callback){
		if(tokenSocket._closed){
			tokenSocket._queue.push({
				fn: callback
			});
		}else{
			callback();
		}
	};

	var replay = function(tokenSocket){
		for(var channel in tokenSocket._channels)
			tokenSocket.subscribe(channel);
		tokenSocket._queue.forEach(function(curr){
			if(curr.fn && typeof curr.fn === "function")
				curr.fn();
		});
		tokenSocket._queue = [];
	};

	var TokenSocket = function(options, actions){
		var self = this;
		self._closed = true;
		if(!options)
			options = {};
		if(!self._ready)
			self._ready = function(){};
		if(!self._onreconnect)
			self._onreconnect = function(){};
		if(!options.host)
			options.host = global.location.host;
		self._reconnect = typeof options.reconnect === "undefined" ? true : options.reconnect;
		self._channels = {};
		self._sockjs = options.sockjs || {};
		self._apiRoute = options.host.indexOf("http") < 0 ? global.location.protocol + "//" + options.host : options.host;
		self._socketPrefix = options.socketPrefix || "/sockets";
		self._tokenPath = options.tokenPath || "/socket/token";
		self._actions = typeof actions === "object" ? actions : {};
		self._authentication = options.authentication || {};
		self._queue = [];
		self._opts = {
			type: "GET",
			url: self._apiRoute + self._tokenPath ,
			dataType: options.host !== global.location.host ? "jsonp" : "json"
		};

		resetConnection(self, self._ready);
	};

	TokenSocket.prototype.ready = function(callback){
		this._ready = callback;
	};

	TokenSocket.prototype.onreconnect = function(callback){
		this._onreconnect = callback;
	};

	TokenSocket.prototype.channels = function(){
		return Object.keys(this._channels);
	};

	// @rpc is the controller action
	TokenSocket.prototype.rpc = function(rpc, data, callback){
		var self = this;
		checkAndUseConnection(self, function(){
			self._monitor.sendMessage({
				rpc: rpc,
				req: data
			}, callback);
		});
	};

	TokenSocket.prototype.register = function(actions){
		this._actions = actions;
	};

	TokenSocket.prototype.subscribe = function(channel){
		var self = this;
		checkAndUseConnection(self, function(){
			self._channels[channel] = true;
			self._monitor.sendMessage({
				rpc: "_subscribe",
				req: { channel: channel }
			});
		});
	};

	TokenSocket.prototype.unsubscribe = function(channel){
		var self = this;
		checkAndUseConnection(self, function(){
			delete self._channels[channel];
			self._monitor.sendMessage({
				rpc: "_unsubscribe",
				req: { channel: channel }
			});
		});
	};

	TokenSocket.prototype.publish = function(channel, data){
		var self = this;
		checkAndUseConnection(self, function(){
			self._monitor.sendMessage({
				rpc: "_publish",
				req: { 
					channel: channel,
					data: data
				}
			});
		});
	};

	TokenSocket.prototype.broadcast = function(data){
		var self = this;
		checkAndUseConnection(self, function(){
			self._monitor.sendMessage({
				rpc: "_broadcast",
				req: { data: data }
			});
		});
	};

	TokenSocket.prototype.onmessage = function(callback){
		this._monitor._messageCallback = callback;
	};

	TokenSocket.prototype.end = function(callback){
		this._reconnect = false;
		this._closed = true;
		this._socket.onclose = callback;
		this._socket.close();
	};
 
	global.TokenSocket = TokenSocket;
 
}(window));

},{}],2:[function(require,module,exports){
/*jslint browser: true */

(function(global){

	global.unitTests = function(){

		describe("Unit tests", function(){

			before(function(){
				global.mockWindow.init();
				global.mockServer.init();

				// let mocks override globals first
				require("../../clients/client/tokensockjs.js");
			});

			after(function(){
				global.mockWindow.end();
				global.mockServer.end();
			});

			describe("Initialization unit tests", function(){

				it("Should not throw an error when created with valid options", function(){
					assert.doesNotThrow(function(){
						new TokenSocket();
						global.mockServer._requests[0].respond(200, { "Content-Type": "application/json" }, JSON.stringify({ token: "123" }));
						global.mockServer._requests.pop();
					}, "Constructor does not throw when called without arguments");
					assert.doesNotThrow(function(){
						new TokenSocket({
							host: "foo",
							ready: function(){},
							onreconnect: function(){},
							reconnect: false,
							sockjs: {},
							socketPrefix: "/foo",
							tokenPath: "/foo/bar",
							authentication: {}
						}, 
						{
							foo: function(){}	
						});
						global.mockServer._requests[0].respond(200, { "Content-Type": "application/json" }, JSON.stringify({ token: "123" }));
						global.mockServer._requests.pop();
					}, "Constructor does not throw when provided all possible arguments");
				});

				it("Should allow for protocol overrides", function(){

					// test options after passing it in (use the fact that it modifies it...)

				});

				it("Should correctly infer protocols", function(){



				});

				it("Should correctly form encode JSON objects", function(){


				});

			});

		});

		describe("Exports unit tests", function(){






		});

	};

}(window));

},{"../../clients/client/tokensockjs.js":1}]},{},[2]);
