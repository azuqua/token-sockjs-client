
var _            = require("lodash"),
    async        = require("async"),
    url          = require("url"),
    uuid         = require("uuid"),
    SockJS       = require("sockjs-client"),
    RestJS       = require("restjs"),
    EventEmitter = require("events").EventEmitter;

var MAX_DELAY = 5 * 1000,
    MIN_DELAY = 10,
    dt = 5;

var nextDelay = function(last){
  return Math.min(last * dt, MAX_DELAY);
};

if(typeof RestJS === "object" && RestJS.Rest)
  RestJS = RestJS.Rest;

var Monitor = function(socket, emitter){
  this._socket = socket;
  this._inTransit = {};
  this._emitter = emitter;
};

Monitor.prototype.sendMessage = function(data, callback){
  if(typeof data === "string")
    data = JSON.parse(data);
  data.uuid = uuid.v4();
  if(!this._inTransit[data.rpc])
    this._inTransit[data.rpc] = {};
  this._inTransit[data.rpc][data.uuid] = callback || _.noop;
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
    if(Object.keys(this._inTransit[data.rpc]).length === 0)
      delete this._inTransit[data.rpc];
  }
  if(data.channel){
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

var formEncode = function(obj, prefix){
  var prop, out = [];
  for(prop in obj){
    if(!obj.hasOwnProperty(prop))
      continue;
    var key = prefix ? prefix + "[" + prop + "]" : prop, 
        val = obj[prop];
    out.push(typeof val == "object" ? formEncode(val, key) : encodeURIComponent(key) + "=" + encodeURIComponent(val));
  }
  return out.join("&");
};

var request = function(client, options, data, callback){
  options = _.extend({}, options);
  options.path += (options.path.indexOf("?") < 0 ? "?" : "&") + formEncode(data);
  client.request(options, null, function(error, resp){
    if(error)
      return callback(error);
    try{
      resp = JSON.parse(resp.body);
    }catch(e){
      return callback(new Error(resp.body || "Invalid message"));
    }
    callback(resp.error ? new Error(resp.error) : null, resp);
  });
};

var resetConnection = function(tokenSocket, callback){
  request(tokenSocket._rest, tokenSocket._opts, tokenSocket._authentication, function(error, resp){
    if(error || !resp || !resp.token){
      error = error || new Error("No token found!");
      return typeof callback === "string" 
          ? tokenSocket._emitter.emit(callback, error) 
          : callback(error);
    }

    tokenSocket._token = resp.token;
    tokenSocket._socket = new SockJS(tokenSocket._protocol + "//" + tokenSocket._host + ":" + tokenSocket._port 
      + tokenSocket._socketPrefix);

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
  if(tokenSocket._closed){
    tokenSocket._queue.push({
      fn: callback
    });
  }else{
    callback();
  }
};

var replay = function(tokenSocket){
  _.each(tokenSocket._channels, function(bool, channel){
    tokenSocket.subscribe(channel);
  });
  _.each(tokenSocket._queue, function(req){ 
    if(req.fn && typeof req.fn === "function")
      req.fn(); 
  });
  tokenSocket._queue = [];
};

var TokenSocket = function(options, actions){
  if(!options || !options.host)
    throw new Error("TokenSocket requires host option!");

  var self = this;
  self._emitter = new EventEmitter();

  _.each(EventEmitter.prototype, function(fn){
    self[fn] = self._emitter[fn];
  });

  self._closed = true;

  var parsed = url.parse(options.host);
  options.protocol = parsed.protocol === "https:" ? "https:" : "http:";

  if(!options.port){
    var parts = options.host.split(":");
    if(parts[1] && !isNaN(parseInt(parts[1]))){
      options.port = parseInt(parts[1]);
      options.host = parts[0];
    }
  }

  options = _.merge({
    tokenPath: "/socket/token",
    socketPrefix: "/sockets",
    authentication: {},
    reconnect: true,
    port: options.port ? options.port : (options.protocol === "https:" ? 443 : 80)
  }, options);

  _.extend(self, {
    _connectDelay: MIN_DELAY,
    _connectTimer: null,
    _actions: actions || {},
    _ping: options.ping || false,
    _rest: new RestJS({ protocol: options.protocol.slice(0, options.protocol.length - 1) }),
    _reconnect: options.reconnect,
    _authentication: options.authentication,
    _socketPrefix: options.socketPrefix,
    _tokenPath: options.tokenPath,
    _channels: {},
    _queue: [],
    _host: options.host,
    _protocol: options.protocol,
    _port: options.port
  });

  if(typeof options.ready === "function")
    self.ready(options.ready);
  if(typeof options.onreconnect === "function")
    self.onreconnect(options.onreconnect);

  self._opts = {
    method: "GET",
    protocol: options.protocol,
    host: options.host,
    path: self._tokenPath,
    port: options.port
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

TokenSocket.prototype.subscribe = function(channel, callback){
  var self = this;
  checkAndUseConnection(self, function(){
    self._channels[channel] = true;
    self._monitor.sendMessage({
      rpc: "_subscribe",
      req: { channel: channel }
     }, callback);
  });
};

TokenSocket.prototype.unsubscribe = function(channel, callback){
  var self = this;
  checkAndUseConnection(self, function(){
    delete self._channels[channel];
    self._monitor.sendMessage({
      rpc: "_unsubscribe",
      req: { channel: channel }
    }, callback);
  });
};

TokenSocket.prototype.publish = function(channel, data, callback){
  var self = this;
  checkAndUseConnection(self, function(){
    self._monitor.sendMessage({
      rpc: "_publish",
      req: { 
        channel: channel,
        data: data
      }
    }, callback);
  });
};

TokenSocket.prototype.broadcast = function(data, callback){
  var self = this;
  checkAndUseConnection(self, function(){
    self._monitor.sendMessage({
      rpc: "_broadcast",
      req: { data: data }
    }, callback);
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

module.exports = TokenSocket;
