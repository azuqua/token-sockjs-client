
var _      = require("lodash"),
  async  = require("async"),
  uuid   = require("node-uuid"),
  WS     = require("sockjs-client-ws"),
  RestJS = require("restjs");

if(RestJS.Rest)
  RestJS = RestJS.Rest;

var Monitor = function(socket, messageCallback){
  this._socket = socket;
  this._inTransit = {};
  this._messageCallback = messageCallback || function(){};
};

Monitor.prototype.sendMessage = function(data, callback){
  if(typeof data === "string")
    data = JSON.parse(data);
  var _uuid = uuid.v4();
  data.uuid = _uuid;
  if(!this._inTransit[data.rpc])
    this._inTransit[data.rpc] = {};
  this._inTransit[data.rpc][_uuid] = callback;
  this._socket.write(JSON.stringify(data));
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
  instance._socket.write(JSON.stringify(out));
};

var handleInternal = function(instance, command, data){
  if(command === "subscribe"){
    instance._channels[data.channel] = true;
  }else if(command === "unsubscribe"){
    delete instance._channels[data.channel];
  }else if(command === "rpc"){
    var fn = instance.actions;
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
  _.each(obj, function(val, key){
    key = prefix ? prefix + "[" + key + "]" : key;
    str.push(typeof val == "object" ? formEncode(val, key) : encodeURIComponent(key) + "=" + encodeURIComponent(val));
  });
  return out.join("&");
};

var request = function(client, options, data, callback){
  options.url += (options.url.indexOf("?") < 0 ? "?" : "&") + formEncode(obj);
  client.get(options, null, function(error, resp){
    if(error)
      return callback(error);
    try{
      resp = JSON.parse(resp.body);
    }catch(e){
      return callback(new Error(resp.body || "Invalid message"));
    }
    callback(resp.error ? resp.error : null, resp);
  });
};

var resetConnection = function(tokenSocket, callback){
  request(tokenSocket._rest, tokenSocket._opts, tokenSocket._authentication, function(error, resp){
    if(error)
      return callback(error);
    if(!resp.token)
      return callback(new Error("No token found!"));

    tokenSocket._token = resp.token;
    tokenSocket._socket = new WS(tokenSocket._apiRoute + tokenSocket._socketPrefix);
    tokenSocket._socket.on("connection", function(){
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
    });
    tokenSocket._monitor = new Monitor(tokenSocket._socket);
    tokenSocket._socket.on("data", function(data){
      try{
        data = JSON.parse(data);
      }catch(e){ return; }
      if(data.internal)
        handleInternal(tokenSocket, data.command, data.data);
      else  
        tokenSocket._monitor.handleResponse(data);
    });
    tokenSocket._socket.on("error", function(){
      tokenSocket._closed = true;
      tokenSocket._socket.close(); // TODO test
      if(tokenSocket._reconnect)
        resetConnection(tokenSocket, tokenSocket._onreconnect);
    });
    tokenSocket._socket.on("close", function(){
      tokenSocket._closed = true;
      if(tokenSocket._reconnect)
        resetConnection(tokenSocket, tokenSocket._onreconnect);
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
  _.each(TokenSocket._channels, function(bool, channel){
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

  if(options.host.indexOf("http") < 0)
    options.protocol = "https";
  else
    options.protocol = options.host.indexOf("https") < 0 ? "http" : "https";

  options = _.merge({
    tokenPath: "/socket/token",
    socketPrefix: "/sockets",
    authentication: {},
    reconnect: true
  }, options);

  _.extend(self, {
    actions: actions || {},
    _ready: function(){},
    _onreconnect: function(){},
    _rest: new RestJS({ protocol: options.protocol }),
    _reconnect: options.reconnect,
    _authentication: options.authentication,
    _apiRoute: options.host.indexOf("http") < 0 ? options.protocol + "//" + options.host : options.host,
    _socketPrefix: options.socketPrefix,
    _tokenPath: options.tokenPath,
    _channels: {},
    _queue: []
  });

  self._opts = {
    type: "GET",
    url: self._apiRoute + self._tokenPath
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
  this.actions = actions;
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

module.exports = TokenSocket;
