;(function($){

	if(!window.SockJS){
		var script = document.createElement("script");
		script.type = "text/javascript";
		script.src = "//cdn.sockjs.org/sockjs-0.3.min.js";
		$("head").append(script);
	}
 
	var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	var uuid = function(){
		var i, out = "";
		for(i = 0; i < 10; i++)
			out += chars.charAt(Math.random() * chars.length | 0);
		return out;
	};
 
	var Monitor = function(socket, messageCallback){
		this.socket = socket;
		this.inTransit = {};
		this.messageCallback = messageCallback || function(){};
	};
 
	Monitor.prototype.sendMessage = function(data, callback){
		if(typeof data === "string")
			data = JSON.parse(data);
		var _uuid = uuid();
		data.uuid = _uuid;
		if(!this.inTransit[data.rpc])
			this.inTransit[data.rpc] = {};
		this.inTransit[data.rpc][_uuid] = callback;
		this.socket.send(JSON.stringify(data));
	};
 
	Monitor.prototype.handleResponse = function(data){
		var fn = null;
		if(data.rpc && data.uuid)
			fn = this.inTransit[data.rpc][data.uuid];
		if(fn){
			if(data.error)
				fn(data.error);
			else
				fn(null, data.resp);
			delete this.inTransit[data.rpc][data.uuid];
		}else{
			this.messageCallback(data.channel, data.message);
		}
	};

	var TokenSocket = function(host, tokenPath, socketPrefix){
		var self = this;
		if(!self.ready)
			self.ready = function(){};
		self.channels = {};
		self.messageCallback = null;
		self.apiRoute = window.location.protocol + "//" + (host || window.location.host);
		self.socketPrefix = socketPrefix || "/sockets";
		self.tokenPath = tokenPath;
		var opts = { 
			type: "GET",
			url: self.apiRoute + self.tokenPath 
		};
		if(host !== window.location.host)
			opts.dataType = "jsonp"; // fall back to jsonp for cross origin requests
		var request = $.ajax(opts);
		request.done(function(resp){
			if(!resp.token)
				return self.ready(new Error("No token found!"));
			self.token = resp.token;
			self.socket = new SockJS(self.apiRoute + self.socketPrefix);
			self.socket.onopen = function(){
				self.monitor.sendMessage({
					rpc: "auth",
					token: self.token
				}, function(error, resp){
					if(error)
						self.ready(error);
					else
						self.ready(null, true)
				});
			};
			self.monitor = new Monitor(self.socket);
			self.socket.onmessage = function(e){
				e.data = JSON.parse(e.data);
				self.monitor.handleResponse(e.data);
			};
		});
		request.fail(function(xhr, status, error){
			self.ready(new Error(err || "Error creating websocket connection!"));
		});
	};

	TokenSocket.prototype.ready = function(callback){
		this.ready = callback;
	};

	TokenSocket.prototype.channels = function(){
		return Object.keys(this.channels);
	};

	// @rpc is the controller action
	TokenSocket.prototype.rpc = function(rpc, data, callback){
		this.monitor.sendMessage({
			rpc: rpc,
			req: data
		}, callback);
	};

	TokenSocket.prototype.subscribe = function(channel){
		this.channels[channel] = true;
		this.monitor.sendMessage({
			rpc: "_subscribe",
			req: { channel: channel }
		});
	};

	TokenSocket.prototype.unsubscribe = function(channel){
		delete this.channels[channel];
		this.monitor.sendMessage({
			rpc: "_unsubscribe",
			req: { channel: channel }
		});
	};

	TokenSocket.prototype.publish = function(channel, data){
		this.monitor.sendMessage({
			rpc: "_publish",
			req: { 
				channel: channel,
				data: data
			}
		});
	};

	TokenSocket.prototype.broadcast = function(data){
		this.monitor.sendMessage({
			rpc: "_broadcast",
			req: { data: data }
		});
	};

	// callback will be called with channel and message arguments
	TokenSocket.prototype.onmessage = function(callback){
		this.monitor.messageCallback = callback;
	};

	// close the tokensocket connection
	TokenSocket.prototype.end = function(callback){
		this.socket.close();
		this.socket.onclose = callback;
	};
 
	$.TokenSocket = TokenSocket;
 
}(jQuery));