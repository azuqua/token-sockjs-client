<h1>TokenSocket jQuery Client</h1>
<p>
	The client library for node-token-sockjs. Provides extra websocket functionality on top of sockjs.
</p>
<p>
	<a href="https://github.com/azuqua/node-token-sockjs">Node Token Sockjs Server</a>
</p>
<h1>Usage</h1>
<pre>
	(function($){

		// these must match the server's configuration options
		var host = window.location.host || "yourserver.com",
			tokenPath = "/socket/token?a=b",
			socketPrefix = "/sockets";

		var socket = new $.TokenSocket(host, tokenPath, socketPrefix);
		
		// once the socket has been authenticated
		socket.ready(function(error){
			if(error){
				console.log("Error creating websocket", error);
			}else{
				
				// issue a rpc command
				socket.rpc("something", { foo: "bar" }, function(error, resp){
					console.log("Server responded: ", error, resp);
				});
	
				// issue a rpc command to a nested controller
				socket.rpc("nested.more.echo", { foo: "bar" }, function(error, resp){
					console.log("Nested rpc call: ", error, resp);
				});

				// if the server has pub/sub enabled
				socket.subscribe("channel1");
		
				// when messages arrive
				socket.onmessage(function(channel, message){
					console.log("Got message ", channel, message);
				});

				// list channels for this socket
				console.log("Channels: ", socket.channels());

				// publish a message
				socket.publish("channel1", { foo: "bar" });

				// publish a message on all channels, not just this socket's channels
				socket.broadcast({ foo: "bar" });

				// leave a channel
				socket.unsubscribe("channel1");

				// close the socket
				socket.end(function(){
					console.log("Socket closed");
				});

			}
		});

	}(jQuery))
</pre>
