Token Sockjs Clients
====================

# Server Client





# Browser Client

The browser client library for [node-token-sockjs](https://github.com/azuqua/node-token-sockjs). This module provides additional websocket functionality on top of [sockjs](https://github.com/sockjs/sockjs-client) and is designed to run in the browser.  

## API Overview

### Initialization

The TokenSocket constructor accepts two objects as arguments, options and actions. Neither are required.

#### Options

* **host** - The hostname of the server. If the protocol is withheld the socket will attempt to connect with the same protocol used by the browser to fetch the page. The module will fall back to jsonp token requests if necessary.
* **tokenPath** - The URL path used to request a token. This must match the server's configuration.  The default value matches the default value the server uses.
* **socketPrefix** - The prefix of the routes owned by the sockjs server. This must match the server's configuration. The default value matches the default value the server uses.
* **reconnect** - Whether or not this module should automatically reconnect if the websocket connection closes. **Default value is true.**
* **authentication** - Any extra authentication data to be sent to the server upon a token request. The browser will automatically send your cookies.
* **sockjs** - [An object containing any valid sockjs configuration changes.](https://github.com/sockjs/sockjs-client#sockjs-class)

#### Actions

The actions argument is an optionally nested object that maps keys to functions. The server will be able to call any of these functions via the RPC interface. The actions can also be modified later with the TokenSocket.register() function.

```
var options = {
	host: "https://yourserver.com",
	tokenPath: "/socket/token",
	socketPrefix: "/sockets",
	reconnect: true,
	authentication: {
		foo: "bar"
	},
	// modify sockjs options...
	sockjs: {
		transports: ["xhr-polling"]
	}
};

var actions = {

	ping: function(data, callback){
		callback(null, data);
	},

	nested: {
		foo: function(data, callback){
			callback(null, "foo");
		}
	}

};

var socket = new TokenSocket(options, actions);

// when the socket is connected and authenticated the ready function will be called
socket.ready(function(error){
	if(error)
		console.log("Error creating websocket!", error);
});

// it's also possible to hook into the reconnection event
socket.onreconnect(function(error){
	if(error)
		console.log("Error reconnecting websocket!", error);
});

```

### RPC Interface

This module supports a bidirectional RPC interface between the server and client. This means the client can issue calls to the server and the server can issue calls to the client with a simple function call/callback interface. The examples here will show how to use the RPC API surface from the client. See the [server docs](https://github.com/azuqua/node-token-sockjs) for examples of RPC functions going in the other direction.

```
// issue remote procedure calls to the server
socket.rpc("echo", { foo: "bar" }, function(error, resp){
	console.log("Response: ", error, resp);
});

// issue remote procedure calls to a nested controller on the server
socket.rpc("something.nested", { foo: "bar" }, function(error, resp){
	console.log("Response: ", error, resp);
});

// it's also possible to modify the socket's available actions
// this will overwrite any current actions, to modify them in place change socket.actions directly
socket.register({
	echo: function(data, callback){
		callback(null, data);
	}
});
```

## Publish - Subscribe Interface

Sockets can also subscribe and unsubscribe from channels, publish messages on channels, and broadcast messages on all channels. 

### Handle Messages on Channels

In order to handle pub/sub messages on channels sockets need to declare a function to be executed when a message is received. 

```
socket.onmessage(function(channel, message){
	console.log("Got message on channel!", channel, message);
});
```

### Subscribe to a Channel

```
socket.subscribe("channel1");
```

### Unsubscribe from a Channel

```
socket.unsubscribe("channel1");
```

### Publish on a Channel

```
socket.publish("channel1", { foo: "bar" });
```

### Broadcast on all Channels

```
socket.broadcast({ foo: "bar" });
```

### Close Socket

```
socket.end(function(){
	console.log("Socket closed");
});
```
