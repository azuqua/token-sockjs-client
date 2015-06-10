Token Sockjs Clients
====================

The client libraries for [node-token-sockjs](https://github.com/azuqua/node-token-sockjs). These modules provide additional websocket functionality on top of [sockjs](https://github.com/sockjs). If required in a node environment this module will export the node.js client library. To access the browser version require the browser client file directly.

# Browser Client

The browser client does not require any external dependencies other than [sockjs](https://github.com/sockjs/sockjs-client). 

The Azuqua CDN also hosts a minified copy of each version.

```
<script src="//cdn.jsdelivr.net/sockjs/0.3.4/sockjs.min.js"></script>
<script src="//d78vv2h34ll3s.cloudfront.net/tokensockjs-2.1.0.min.js"></script>
```

## API Overview

### Initialization

The TokenSocket constructor accepts two objects as arguments, options and actions. Neither are required.

#### Options

* **host** - The hostname of the server. If the protocol is withheld the socket will attempt to connect with the same protocol used by the browser to fetch the page. The module will fall back to jsonp token requests for cross domain requests.
* **tokenPath** - The URL path used to request a token. This must match the server's configuration.  The default value matches the default value the server uses.
* **socketPrefix** - The prefix of the routes owned by the sockjs server. This must match the server's configuration. The default value matches the default value the server uses.
* **reconnect** - Whether or not this module should automatically reconnect if the websocket connection closes. **Default value is true.**
* **authentication** - Any extra authentication data to be sent to the server upon a token request. This object will be form encoded and sent as URL parameters. The browser will automatically send your cookies.
* **sockjs** - [An object containing any valid sockjs configuration changes.](https://github.com/sockjs/sockjs-client#sockjs-class)
* **ping** - An integer indicating the frequency in milliseconds that the client should wait between ping requests. If this property is undefined the client will not make automatic ping requests. This can be useful for maintaining open connections across load balancers or proxies that close unused connections.

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
	// maybe modify sockjs options...
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

# Event Emitter Interface

The socket is now extended by an [EventEmitter](https://github.com/Wolfy87/EventEmitter/blob/master/docs/api.md) and currently emits three events. This interface can replace the earlier `ready`, `onreconnect`, and `onmessage` functions or can be used alongside them. In fact, those functions are now proxies for the event emitter. In order to make cleaning up registered listeners as easy as possible it would be ideal to switch entirely to this interface, however the old interface will remain in place until the next major release.

* **ready** - Emitted when the socket is first initialized and authenticated. This will be called with an optional error object.
* **reconnect** - Emitted when the socket reconnects after being disconnected. This will be called with an optional error object. If an error is provided the socket will automatically attempt to reconnect again after a few seconds.
* **message** - Emitted when a message arrives on the publish-subscribe network. This will be called with the channel and message as arguments.

```
socket.on("ready", function(error){
	// ...
});

socket.on("reconnect", function(error){
	// ...
});

socket.on("message", function(channel, message){
	// ...
});
```

**The uncompressed development version of the browser client does not ship with the EventEmitter dependency. Please use the minified version from the CDN or this repository for a full build with all dependencies.**

# Server Client

The server client is backed by [sockjs-client-ws](https://github.com/steerapi/sockjs-client-node) and will only use the websocket protocol. 

## API Overview

The API surface to the Node.js version is identical to the browser version with a few minor changes. First, the constructor options argument now requires a "host" property set to the hostname of the TokenSocket server and optionally accepts an associated "port" property. Additionally, the constructor no longer accepts a sockjs configuration object on the options argument. Other than those two initialization changes the functionality is identical to the browser version.

# Build and Test

To tinker with the code or to build minified versions of the browser client run the grunt tasks. This module uses Mocha, Chai, Sinon, and Phantomjs for testing. The default grunt task will clean, lint, test, and minify the included modules.

```
git clone git@github.com:azuqua/token-sockjs-client
cd token-sockjs-client
npm install
grunt
```
