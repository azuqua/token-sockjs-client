/*jslint browser: true */

(function(global){

	global.integrationTests = function(){

		var _document = window.document,
			ms = global.mockServer;

		describe("Integration tests", function(){

			before(function(){
				var mock = global.mockWindow.create();
				window.document = mock.document;
				window.SockJS = mock.SockJS;
				ms.init();
			});

			after(function(){
				window.document = _document;
				ms.end();
			});

			describe("Authentication tests", function(){

				it("Should handle a successful authentication http request ", function(done){
					var socket = new TokenSocket({ authentication: { foo: "bar" } }),
						token = "abc123";
					socket.ready(function(e){
						assert.isUndefined(e, "Socket ready without error");
						assert.notOk(socket._closed, "Socket is open");
						done();
					});
					var httpReq = ms._requests.shift();
					assert.ok(httpReq, "Socket made http token request");
					assert.include(httpReq.url, socket._tokenPath, "HTTP token request goes to token path");
					assert.include(httpReq.url, "foo=bar", "HTTP token request has authentication params");
					ms.respondWithJSON(httpReq, 200, { token: token });
					assert.ok(socket._socket, "Socket created sockjs websocket");
					socket._socket._emit("open");
					assert.equal(socket._socket._frames.length, 1, "Socket made ws auth request");
					var socketReq = JSON.parse(socket._socket._frames[0]);
					assert.equal(socketReq.rpc, "auth", "Socket made auth rpc request");
					assert.equal(socketReq.token, token, "Socket auth request contains correct token");
					ms.authenticateSocket(socket._socket);
				});

				it("Should handle a failed authentication http request", function(done){
					var socket = new TokenSocket({ authentication: { foo: "bar" } }),
						error = "Error message test";
					socket.ready(function(e){
						assert.ok(e, "Socket ready with error");
						assert.equal(e.message, error, "Ready function called with correct error message");
						done();
					});
					var httpReq = ms._requests.shift();
					assert.ok(httpReq, "Socket made http token request");
					assert.include(httpReq.url, socket._tokenPath, "HTTP token request goes to token path");
					assert.include(httpReq.url, "foo=bar", "HTTP token request has authentication params");
					ms.respondWithJSON(httpReq, 500, { error: error });
					assert.isUndefined(socket._socket, "Socket did not create sockjs websocket");
				});

				/*
				TODO see unit test file TODO about mocking window in phantom

				it("Should handle a successful authentication http request with jsonp", function(){

				});
	
				it("Should handle a failed authentication http request with jsonp", function(){

					
				});
				*/

			});

			describe("RPC tests", function(){

				var socket,
					data = { foo: "bar" },
					cmd = "ping";

				before(function(done){
					socket = new TokenSocket();
					socket.ready(done);
					ms.respondWithJSON(ms._requests.shift(), 200, { token: "foo" });
					socket._socket._emit("open");
					ms.authenticateSocket(socket._socket);
				});

				after(function(done){
					socket.end(done);
				});

				it("Should track and create properly formatted rpc requests", function(){
					assert.ok(socket._monitor, "Socket has monitor obj");
					assert.ok(socket._monitor._socket, "Socket monitor also handles socket");
					assert.isObject(socket._monitor._inTransit, "Socket monitor tracks in transit rpc calls");
					socket.rpc(cmd, data, function(){});
					assert.notEqual(Object.keys(socket._monitor._inTransit), 0, "inTransit has at least one key after one rpc call");
					assert.isObject(socket._monitor._inTransit[cmd], "Socket monitor has object for rpc call");
					var uuid = Object.keys(socket._monitor._inTransit[cmd])[0];
					assert.isFunction(socket._monitor._inTransit[cmd][uuid], "Monitor tracks uuid -> function mappings");
				});

				it("Should invoke the user's callback upon an rpc response", function(done){
					var uuid = null;
					ms.socketResponse(socket._socket, function(req, callback){
						assert.ok(req, "Socket made rpc request");
						req = JSON.parse(req);
						assert.isString(req.uuid, "Request has uuid");
						uuid = req.uuid;
						assert.equal(req.rpc, cmd, "Request rpc has correct command");
						assert.deepEqual(req.req, data, "Request rpc has correct data");
						done();
					});
				});

				it("Should map rpc requests to a key -> function map on the actions", function(){
					assert.ok(socket._actions, "Socket has actions object");
					assert.lengthOf(Object.keys(socket._actions), 0, "Socket does not start with any actions");
					socket.register({
						ping: sinon.spy(function(args, callback){
							assert.deepEqual(args, data, "Ping data is correct");
							callback(null, {});
						})
					});
					assert.isFunction(socket._actions.ping, "Socket actions map has ping function");
					var wrapper = {
						internal: true,
						command: "rpc",
						data: {
							fid: (Math.random() * 1e16).toString(36).replace(".", ""),
							command: cmd,
							args: data
						}
					};
					socket._socket._emit("message", { data: JSON.stringify(wrapper) });
					assert.isTrue(socket._actions.ping.called, "Socket ping fn was called");
					var socketResp = socket._socket._frames.shift();
					assert.ok(socketResp, "Socket response is there");
					socketResp = JSON.parse(socketResp);
					assert.equal(wrapper.data.fid, socketResp.fid, "Input function id matches output function id");
					assert.equal(socketResp.rpc, "_rpc", "Socket response makes internal rpc call");
					assert.ok(socketResp.resp.data, "Socket response has data");
					assert.isObject(socketResp.resp.data, "Socket response has ping response data");
				});

				it("Should map rpc requests to an arbitrarily nested key -> function map on the actions", function(){
					socket.register({
						nested: {
							ping: sinon.spy(function(args, callback){
								assert.deepEqual(args, data, "Ping data is correct");
								callback(null, {});
							})
						}
					});
					assert.isObject(socket._actions.nested, "Socket has nested object");
					assert.isFunction(socket._actions.nested.ping, "Socket actions map has nested ping function");
					var wrapper = {
						internal: true,
						command: "rpc",
						data: {
							fid: (Math.random() * 1e16).toString(36).replace(".", ""),
							command: "nested." + cmd,
							args: data
						}
					};
					socket._socket._emit("message", { data: JSON.stringify(wrapper) });
					assert.isTrue(socket._actions.nested.ping.called, "Socket nested ping fn was called");
					var socketResp = socket._socket._frames.shift();
					assert.ok(socketResp, "Socket response is there");
					socketResp = JSON.parse(socketResp);
					assert.equal(wrapper.data.fid, socketResp.fid, "Input function id matches output function id");
					assert.equal(socketResp.rpc, "_rpc", "Socket response makes internal rpc call");
					assert.ok(socketResp.resp.data, "Socket response has data");
					assert.isObject(socketResp.resp.data, "Socket response has ping response data");
				});

			});

			describe("Publish subscribe tests", function(){

				var socket,
					channel = "foo",
					message = { foo: "bar" };

				before(function(done){
					socket = new TokenSocket();
					socket.ready(done);
					ms.respondWithJSON(ms._requests.shift(), 200, { token: "foo" });
					socket._socket._emit("open");
					ms.authenticateSocket(socket._socket);
				});

				after(function(done){
					socket.end(done);
				});

				it("Should handle subscribe side effects", function(){
					assert.isObject(socket._channels, "Socket has channels map");
					assert.lengthOf(Object.keys(socket._channels), 0, "Socket does not start with any channels");
					socket.subscribe(channel);
					assert.property(socket._channels, channel, "Socket channels map has new channel");
				});

				it("Should handle messages on that channel", function(){
					var startingFrames = socket._socket._frames.length;
					var data = {
						channel: channel, 
						message: message
					};
					socket.onmessage(function(_channel, _message){
						assert.equal(_channel, channel, "OnMessage fn has correct channel");
						assert.deepEqual(_message, message, "OnMessage fn has correct message");
					});
					socket._monitor._messageCallback = sinon.spy(socket._monitor._messageCallback);
					socket._socket._emit("message", { data: JSON.stringify(data) });
					assert.isTrue(socket._monitor._messageCallback.called, "Message callback was called");
					assert.lengthOf(socket._socket._frames, startingFrames, "Socket did not make any requests");
				});

				it("Should handle unsubscribe side effects", function(){
					assert.property(socket._channels, channel, "Socket channels map still has new channel");
					socket.unsubscribe(channel);
					assert.isUndefined(socket._channels[channel], "Socket does not have channel");
					assert.lengthOf(Object.keys(socket._channels), 0, "Socket does not end with any channels");
				});

				it("Should make internal channel synchronization requests for subscribe and unsubscribe", function(){
					assert.lengthOf(socket._socket._frames, 2, "Socket made two sync requests");
					var subscribeReq = socket._socket._frames.shift();
					var unsubscribeReq = socket._socket._frames.shift();
					assert.ok(subscribeReq, "Socket made subscribe sync request");
					assert.ok(unsubscribeReq, "Socket made unsubscribe sync request");
					subscribeReq = JSON.parse(subscribeReq);
					unsubscribeReq = JSON.parse(unsubscribeReq);
					assert.equal(subscribeReq.rpc, "_subscribe", "Socket made interal _subscribe rpc");
					assert.equal(subscribeReq.req.channel, channel, "Socket made interal _subscribe rpc with correct channel");
					assert.equal(unsubscribeReq.rpc, "_unsubscribe", "Socket made interal _unsubscribe rpc");
					assert.equal(unsubscribeReq.req.channel, channel, "Socket made interal _unsubscribe rpc with correct channel");
				});

				it("Should handle internal channel synchronization requests for subscribe and unsubscribe", function(){
					var wrapper = {
						internal: true,
						command: "subscribe",
						data: { channel: channel }
					};
					assert.lengthOf(socket._socket._frames, 0, "Socket does not have any outstanding requests");
					assert.lengthOf(Object.keys(socket._channels), 0, "Socket does not have any channels");
					
					socket._socket._emit("message", { data: JSON.stringify(wrapper) });
					assert.property(socket._channels, channel, "Socket is subscribed to channel");
					assert.lengthOf(socket._socket._frames, 0, "Socket did not try to respond");

					wrapper.command = "unsubscribe";
					socket._socket._emit("message", { data: JSON.stringify(wrapper) });
					assert.notOk(socket._channels[channel], "Socket is not subscribed to channel");
					assert.lengthOf(socket._socket._frames, 0, "Socket still didnt try to respond");
				});

				it("Should correctly make internal publish requests", function(){
					assert.lengthOf(socket._socket._frames, 0, "Socket doesn't have any outstanding frames");
					socket.publish(channel, message);
					assert.lengthOf(socket._socket._frames, 1, "Socket made one request");
					var publishReq = socket._socket._frames.shift();
					assert.ok(publishReq, "Publish request is ok");
					publishReq = JSON.parse(publishReq);
					assert.equal(publishReq.rpc, "_publish", "Socket request has publish rpc");
					assert.deepEqual(publishReq.req.data, message, "Socket request has correct message");
				});

				it("Should correctly make internal broadcast requests", function(){
					assert.lengthOf(socket._socket._frames, 0, "Socket doesn't have any outstanding frames");
					socket.broadcast(message);
					assert.lengthOf(socket._socket._frames, 1, "Socket made one request");
					var broadcastReq = socket._socket._frames.shift();
					assert.ok(broadcastReq, "Publish request is ok");
					broadcastReq = JSON.parse(broadcastReq);
					assert.equal(broadcastReq.rpc, "_broadcast", "Socket request has broadcast rpc");
					assert.deepEqual(broadcastReq.req.data, message, "Socket request has correct message");
				});

			});

			describe("Connection management tests", function(){

				var socket,
					channel = "channel",
					rpc = { foo: "bar" };

				before(function(done){
					socket = new TokenSocket();
					socket.ready(done);
					ms.respondWithJSON(ms._requests.shift(), 200, { token: "foo" });
					socket._socket._emit("open");
					ms.authenticateSocket(socket._socket);
				});

				after(function(done){
					socket.end(done);
				});

				it("Should automatically reconnect if not specified in config", function(){
					assert.isTrue(socket._reconnect, "Socket reconnect flag is true");
					assert.isFunction(socket._onreconnect, "Socket onreconnect is a function");
				});

				it("Should queue requests up when the socket is closed", function(){
					assert.isArray(socket._queue, "Socket queue is an array");
					assert.lengthOf(socket._queue, 0, "Socket queue is empty");
					socket._socket._emit("close");
					assert.isTrue(socket._closed, "Socket is closed");
					socket.rpc("ping", rpc, function(){});
					assert.lengthOf(socket._queue, 1, "Socket queue has one request");
					assert.isObject(socket._queue[0], "Socket queue has one request obj wrapper");
					assert.isFunction(socket._queue[0].fn, "Socket queue request has fn property");
					socket.subscribe(channel);
					assert.lengthOf(socket._queue, 2, "Socket queue has two requests");
					assert.isObject(socket._queue[1], "Socket queue has two request obj wrappers");
					assert.isFunction(socket._queue[1].fn, "Second socket queue request has fn property");
				});

				it("Should replay requests from the queue when the socket opens", function(){
					assert.isTrue(socket._closed, "Socket is still closed");
					assert.lengthOf(socket._queue, 2, "Socket queue still has two requests");
					ms.respondWithJSON(ms._requests.shift(), 200, { token: "foo" });
					socket._socket._emit("open");
					ms.authenticateSocket(socket._socket);
					assert.notOk(socket._closed, "Socket is open again");
					assert.lengthOf(socket._queue, 0, "Socket request queue is empty");
					assert.lengthOf(socket._socket._frames, 2, "Socket made two requests");
					var firstSocketReq = JSON.parse(socket._socket._frames[0]),
						secondSocketReq = JSON.parse(socket._socket._frames[1]);
					assert.equal(firstSocketReq.rpc, "ping", "Socket first made ping request");
					assert.equal(secondSocketReq.rpc, "_subscribe", "Socket then made subscribe request");
					assert.deepEqual(firstSocketReq.req, rpc, "Ping rpc request data is correct");
					assert.equal(secondSocketReq.req.channel, channel, "Subscribe request has correct channel");
				});

				it("Should implement exponential backoff on reconnection attempts", function(){
					// TODO still need to do implement this
				});

			});

		});

	};

}(this));
