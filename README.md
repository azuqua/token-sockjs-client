jQuery Token Sockjs Client
==========================

The client library for [node-token-sockjs](https://github.com/azuqua/node-token-sockjs). This module provides additional websocket functionality on top of [sockjs](https://github.com/sockjs/sockjs-client).  
# API Overview

## Initialization

This module automatically attempts to authenticate the socket upon initialization. Once a socket has been issued a token the token cannot be used again. If a socket needs to reconnect then a new TokenSocket must be initialized as the original token will have expired.

```
var host = "https://yourserver.com", // cross domain requests are supported via jsonp
	tokenPath = "/socket/token?a=b", // this must match the server configuration
	socketPrefix = "/sockets"; // this must match the server configuration

var socket = new $.TokenSocket(host, tokenPath, socketPrefix);
socket.ready(function(error){
	if(error)
		return console.log("Error creating websocket!", error);
});
```

## RPC Interface

This module supports a bidirectional RPC interface between the server and client. This means the client can issue calls to the server and the server can issue calls to the client with a simple function call/callback interface. This can be very useful for syncing data between a distributed store on the server and any number of clients without relying on a big switch statement on top of a publish/subscribe pattern. The examples here will show how to use the RPC API surface from the client. See the [server docs](https://github.com/azuqua/node-token-sockjs) for examples of RPC functions going in the other direction.

```
// issue remote procedure calls to the server
socket.rpc("echo", { foo: "bar" }, function(error, resp){
	console.log("Response: ", error, resp);
});

// issue remote procedure calls to a nested controller on the server
socket.rpc("something.nested", { foo: "bar" }, function(error, resp){
	console.log("Response: ", error, resp);
});

// set up this socket to accept remote procedure calls from the server
// this object can also be provided to the initialization function as a fourth parameter
socket.register({
	
	echo: function(data, callback){
		callback(null, data);
	}

});
```

# Publish - Subscribe

Sockets can also subscribe and unsubscribe from channels, publish messages on channels, and broadcast messages on all channels. 

## Handle Messages on Channels

In order to handle pub/sub messages on channels sockets need to declare a function to be executed when a message is received. 

```
socket.onmessage(function(channel, message){
	console.log("Got message on channel!", channel, message);
});
```

## Subscribe to a Channel

```
socket.subscribe("channel1");
```

## Unsubscribe from a Channel

```
socket.unsubscribe("channel1");
```

## Publish on a Channel

```
socket.publish("channel1", { foo: "bar" });
```

## Broadcast on all Channels

```
socket.broadcast({ foo: "bar" });
```

## Close Socket

```
socket.end(function(){
	console.log("Socket closed");
});
```
