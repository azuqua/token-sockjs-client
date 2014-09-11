;(function($){
 
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

	var TokenSocket = function(host, tokenPath, socketPrefix, actions){
		var self = this;
		if(!self._ready)
			self._ready = function(){};
		self._channels = {};
		self._apiRoute = window.location.protocol + "//" + (host || window.location.host);
		self._socketPrefix = socketPrefix || "/sockets";
		self._tokenPath = tokenPath;
		self._actions = typeof actions === "object" ? actions : {};

		var opts = { 
			type: "GET",
			url: self._apiRoute + self._tokenPath 
		};
		if(host !== window.location.host)
			opts.dataType = "jsonp"; // fall back to jsonp for cross origin requests
		var request = $.ajax(opts);
		request.done(function(resp){
			if(!resp.token)
				return self._ready(new Error("No token found!"));
			self._token = resp.token;
			self._socket = new SockJS(self._apiRoute + self._socketPrefix);
			self._socket.onopen = function(){
				self._monitor.sendMessage({
					rpc: "auth",
					token: self._token
				}, function(error, resp){
					if(error)
						self._ready(error);
					else
						self._ready();
				});
			};
			self._monitor = new Monitor(self._socket);
			self._socket.onmessage = function(e){
				e.data = JSON.parse(e.data);
				if(e.data.internal)
					handleInternal(self, e.data.command, e.data.data);
				else	
					self._monitor.handleResponse(e.data);
			};
		});
		request.fail(function(xhr, status, error){
			self._ready(new Error(error || "Error creating websocket connection!"));
		});
	};

	TokenSocket.prototype.ready = function(callback){
		this._ready = callback;
	};

	TokenSocket.prototype.channels = function(){
		return Object.keys(this._channels);
	};

	// @rpc is the controller action
	TokenSocket.prototype.rpc = function(rpc, data, callback){
		this._monitor.sendMessage({
			rpc: rpc,
			req: data
		}, callback);
	};

	TokenSocket.prototype.register = function(actions){
		this._actions = actions;
	};

	TokenSocket.prototype.subscribe = function(channel){
		this._channels[channel] = true;
		this._monitor.sendMessage({
			rpc: "_subscribe",
			req: { channel: channel }
		});
	};

	TokenSocket.prototype.unsubscribe = function(channel){
		delete this._channels[channel];
		this._monitor.sendMessage({
			rpc: "_unsubscribe",
			req: { channel: channel }
		});
	};

	TokenSocket.prototype.publish = function(channel, data){
		this._monitor.sendMessage({
			rpc: "_publish",
			req: { 
				channel: channel,
				data: data
			}
		});
	};

	TokenSocket.prototype.broadcast = function(data){
		this._monitor.sendMessage({
			rpc: "_broadcast",
			req: { data: data }
		});
	};

	// callback will be called with channel and message arguments
	TokenSocket.prototype.onmessage = function(callback){
		this._monitor._messageCallback = callback;
	};

	// close the tokensocket connection
	TokenSocket.prototype.end = function(callback){
		this._socket.close();
		this._socket.onclose = callback;
	};
 
	$.TokenSocket = TokenSocket;
 
}(jQuery));
