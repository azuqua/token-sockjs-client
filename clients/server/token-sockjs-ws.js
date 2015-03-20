
var _      = require("lodash"),
    async  = require("async"),
    url    = require("url"),
    uuid   = require("node-uuid"),
    WS     = require("sockjs-client-ws"),
    RestJS = require("restjs"); 

var MAX_DELAY = 5 * 1000,
    MIN_DELAY = 10,
    dt = 5;

var nextDelay = function(last){
  return Math.min(last * dt, MAX_DELAY);
};

if(typeof RestJS === "object" && RestJS.Rest)
  RestJS = RestJS.Rest;

var Monitor = function(socket, messageCallback){
  this._socket = socket;
  this._inTransit = {};
  this._messageCallback = messageCallback || function(){};
};

Monitor.prototype.sendMessage = function(data, callback){
  if(typeof data === "string")
    data = JSON.parse(data);
  data.uuid = uuid.v4();
  if(!this._inTransit[data.rpc])
    this._inTransit[data.rpc] = {};
  this._inTransit[data.rpc][data.uuid] = callback;
  this._socket.write(JSON.stringify(data));
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
  instance._socket.write(JSON.stringify(out));
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
        instance._onreconnect(error);
        attemptReconnect(instance);
      }else{
        instance._onreconnect();
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
  options.url += (options.url.indexOf("?") < 0 ? "?" : "&") + formEncode(data);
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
      return typeof callback === "string" ? tokenSocket[callback](error) : callback(error);
    }

    tokenSocket._token = resp.token;
    tokenSocket._socket = new WS(tokenSocket._apiRoute + tokenSocket._socketPrefix);
    tokenSocket._socket.on("connection", function(){
      tokenSocket._monitor.sendMessage({
        rpc: "auth",
        token: tokenSocket._token
      }, function(error, resp){
        callback = typeof callback === "string" ? tokenSocket[callback] : callback;
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
    });
    tokenSocket._monitor = new Monitor(tokenSocket._socket);
    tokenSocket._socket.on("data", function(data){
      try{
        if(typeof data === "string")
          data = JSON.parse(data);
      }catch(e){ return; }
      if(data.internal)
        handleInternal(tokenSocket, data.command, data.data);
      else
        tokenSocket._monitor.handleResponse(data);
    });
    tokenSocket._socket.on("error", function(){
      tokenSocket._closed = true;
      tokenSocket._socket.close();
    });
    tokenSocket._socket.on("close", function(){
      tokenSocket._closed = true;
      if(tokenSocket._reconnect)
        attemptReconnect(tokenSocket);
    });
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
  self._closed = true;

  var parsed = url.parse(options.host);
  options.protocol = parsed.protocol || "http:";

  options = _.merge({
    tokenPath: "/socket/token",
    socketPrefix: "/sockets",
    authentication: {},
    reconnect: true
  }, options);

  _.extend(self, {
    _connectDelay: MIN_DELAY,
    _connectTimer: null,
    _actions: actions || {},
    _ready: options.ready || function(){},
    _onreconnect: options.onreconnect || function(){},
    _rest: new RestJS({ protocol: options.protocol.slice(0, options.protocol.length - 1) }),
    _reconnect: options.reconnect,
    _authentication: options.authentication,
    _apiRoute: options.host.indexOf("http") < 0 ? options.protocol + "//" + options.host : options.host,
    _socketPrefix: options.socketPrefix,
    _tokenPath: options.tokenPath,
    _channels: {},
    _queue: []
  });

  self._opts = {
    method: "GET",
    url: self._apiRoute + self._tokenPath
  };

  resetConnection(self, "_ready");
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
  this._socket.on("close", callback);
  this._socket.close();
};

module.exports = TokenSocket;
