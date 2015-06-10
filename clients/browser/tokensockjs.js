;(function(global){

	var MAX_DELAY = 5 * 1000,
		MIN_DELAY = 10,
		dt = 5;

	var nextDelay = function(last){
		return Math.min(last * dt, MAX_DELAY);
	};
 
	var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	var uuid = function(){
		var i, out = "";
		for(i = 0; i < 10; i++)
			out += chars.charAt(Math.random() * chars.length | 0);
		return out;
	};

	Object.size = function(obj){
		var size = 0, key;
		for(key in obj){
			if(obj.hasOwnProperty(key)) size++;
		}
		return size;
	};

	Object.shallowCopy = function(obj){
		var key, copy = {};
		for(key in obj){
			if(obj.hasOwnProperty(key))
				copy[key] = obj[key];
		}
		return copy;
	};

	// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
	if (!Object.keys) {
		Object.keys = (function() {
			'use strict';
			var hasOwnProperty = Object.prototype.hasOwnProperty,
			hasDontEnumBug = !({ toString: null }).propertyIsEnumerable('toString'),
			dontEnums = [
				'toString',
				'toLocaleString',
				'valueOf',
				'hasOwnProperty',
				'isPrototypeOf',
				'propertyIsEnumerable',
				'constructor'
			],
			dontEnumsLength = dontEnums.length;

			return function(obj) {
				if (typeof obj !== 'object' && (typeof obj !== 'function' || obj === null)) {
					throw new TypeError('Object.keys called on non-object');
				}

				var result = [], prop, i;

				for (prop in obj) {
					if (hasOwnProperty.call(obj, prop)) {
						result.push(prop);
					}
				}

				if (hasDontEnumBug) {
					for (i = 0; i < dontEnumsLength; i++) {
						if (hasOwnProperty.call(obj, dontEnums[i])) {
							result.push(dontEnums[i]);
						}
					}
				}
				return result;
			};
		}());
	}
 
	var Monitor = function(socket, emitter){
		this._socket = socket;
		this._inTransit = {};
		this._emitter = emitter;
	};
 
	Monitor.prototype.sendMessage = function(data, callback){
		if(typeof data === "string")
			data = JSON.parse(data);
		data.uuid = uuid();
		if(!this._inTransit[data.rpc])
			this._inTransit[data.rpc] = {};
		this._inTransit[data.rpc][data.uuid] = callback;
		this._socket.send(JSON.stringify(data));
	};
 
	Monitor.prototype.handleResponse = function(data){
		var fn = null;
		if(data.rpc && data.uuid)
			fn = this._inTransit[data.rpc][data.uuid];
		if(fn && typeof fn === "function"){
			if(data.error)
				fn(data.error);
			else
				fn(null, data.resp);
			delete this._inTransit[data.rpc][data.uuid];
			if(Object.size(this._inTransit[data.rpc]) === 0)
				delete this._inTransit[data.rpc];
		}else if(data.channel){
			this._emitter.emit("message", data.channel, data.message);
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

	var attemptReconnect = function(tokenSocket){
		tokenSocket._connectTimer = setTimeout(function(instance){
			resetConnection(instance, function(error){
				if(error){
					instance._emitter.emit("reconnect", error);
					attemptReconnect(instance);
				}else{
					instance._emitter.emit("reconnect");
				}
			});
		}, tokenSocket._connectDelay, tokenSocket);
		tokenSocket._connectDelay = nextDelay(tokenSocket._connectDelay);
	};

	var formEncode = function(obj, prefix) {
		var prop, out = [];
		for(prop in obj){
			if(!obj.hasOwnProperty(prop) || (typeof obj[prop] === "string" && obj[prop].length < 1))
				continue;
			var key = prefix ? prefix + "[" + prop + "]" : prop, 
				val = obj[prop];
			out.push(typeof val == "object" ? formEncode(val, key) : encodeURIComponent(key) + "=" + encodeURIComponent(val));
		}
		return out.join("&");
	};

	var request = function(options, data, callback){
		options = Object.shallowCopy(options);
		if(options.dataType && options.dataType.toLowerCase() === "jsonp"){
			var callbackKey = "token_callback_" + new Date().getTime() + "_" + (Math.round(Math.random() * 1e16)).toString(36);
			var script = global.document.createElement("script");
			global[callbackKey] = function(resp) {
				global.document.body.removeChild(script);
				delete global[callbackKey];
				if(typeof resp === "string"){
					try{
						resp = JSON.parse(resp);
					}catch(e){
						return callback(new Error(resp || "Error making jsonp request!"));
					}
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
			script.src = options.url + (options.url.indexOf("?") > 0 ? "&" : "?") + "callback=" + callbackKey + "&" + formEncode(data || {});
			global.document.body.appendChild(script);
		}else{
			var xhr = new global.XMLHttpRequest();
			options.url += (data && options.url.indexOf("?") > 0 ? "&" : "?") + formEncode(data || {});
			xhr.open(options.method, options.url, true);
			xhr.onreadystatechange = function(){
				if(xhr.readyState === 4){
					var msg = xhr.target ? xhr.target.responseText : xhr.responseText;
					try{
						msg = JSON.parse(msg);
					}catch(ev){}

					if(xhr.status >= 200 && xhr.status < 300)
						callback(null, msg);
					else
						callback(msg && msg.error ? new Error(msg.error) : msg instanceof Error ? msg : new Error(msg || "Error making HTTP request"));
				}
			};
			xhr.setRequestHeader("Accept", "application/json");
			xhr.send();
		}
	};

	var resetConnection = function(tokenSocket, callback){
		request(tokenSocket._opts, tokenSocket._authentication, function(error, resp){
			if(error || !resp || !resp.token){
				error = error || new Error("No token found!");
				return typeof callback === "string" 
					? tokenSocket._emitter.emit(callback, error) 
					: callback(error);
			}

			tokenSocket._token = resp.token;
			tokenSocket._socket = new global.SockJS(tokenSocket._apiRoute + tokenSocket._socketPrefix, null, tokenSocket._sockjs);
			tokenSocket._socket.onopen = function(){
				tokenSocket._monitor.sendMessage({
					rpc: "auth",
					token: tokenSocket._token
				}, function(error, resp){
					callback = typeof callback === "string" ? tokenSocket._emitter.emit.bind(tokenSocket._emitter, callback) : callback;
					if(error){
						callback(error);
					}else{
						delete tokenSocket._closed;
						clearInterval(tokenSocket._connectTimer);
						delete tokenSocket._connectTimer;
						tokenSocket._connectDelay = MIN_DELAY;
						replay(tokenSocket);
						callback();
					}
				});
			};
			tokenSocket._monitor = new Monitor(tokenSocket._socket, tokenSocket._emitter);
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
					attemptReconnect(tokenSocket);
			};
		});
	};

	var checkAndUseConnection = function(tokenSocket, callback){
		if(tokenSocket._closed)
			tokenSocket._queue.push({ fn: callback });
		else
			callback();
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
		self._emitter = new EventEmitter();

		Object.keys(EventEmitter.prototype).forEach(function(k){
			self[k] = self._emitter[k];
		});

		self._closed = true;
		if(!options)
			options = {};
		if(!self._ready && typeof options.ready === "function")
			self.ready(options.ready);
		if(!self._onreconnect && typeof options.onreconnect === "function")
			self.onreconnect(options.onreconnect);
		if(!options.host)
			options.host = global.location.host;
		self._reconnect = typeof options.reconnect === "undefined" ? true : options.reconnect;
		self._channels = {};
		self._ping = options.ping || false;
		self._sockjs = options.sockjs || {};
		self._apiRoute = options.host.indexOf("http") < 0 ? global.location.protocol + "//" + options.host : options.host;
		self._socketPrefix = options.socketPrefix || "/sockets";
		self._tokenPath = options.tokenPath || "/socket/token";
		self._actions = typeof actions === "object" ? actions : {};
		self._authentication = options.authentication || {};
		self._queue = [];
		self._connectDelay = MIN_DELAY;
		self._connectTimer = null;
		self._opts = {
			method: "GET",
			url: self._apiRoute + self._tokenPath,
			dataType: options.host !== global.location.host ? "jsonp" : "json"
		};

		if(self._ping && self._ping > 0){
			self._pingTimer = setInterval(function(){
				if(!self._closed)
					self.rpc("_ping", {});
			}, self._ping);
		}

		resetConnection(self, "ready");
	};

	TokenSocket.prototype.ready = function(callback){
		this._emitter.on("ready", callback);
	};

	TokenSocket.prototype.onreconnect = function(callback){
		this._emitter.on("reconnect", callback);
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
		this._emitter.on("message", callback);
	};

	TokenSocket.prototype.end = function(callback){
		this._emitter.removeAllListeners("ready");
		this._emitter.removeAllListeners("reconnect");
		this._emitter.removeAllListeners("message");
		this._closed = true;
		this._socket.onclose = callback;
		this._socket.close();
	};
 
	global.TokenSocket = TokenSocket;
 
}(typeof window === "undefined" ? {} : window));
