/*jslint browser: true */

(function(global){

	global.unitTests = function(){

		var _document = window.document,
			ms = global.mockServer;

		describe("Unit tests", function(){

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

			describe("Initialization tests", function(){

				it("Should allow for protocol overrides", function(){

					// test options after passing it in (use the fact that it modifies it...)

				});

				it("Should correctly infer protocols", function(){



				});

				it("Should correctly form encode JSON objects", function(){


				});

				it("Should make an http request for a token with proper arguments", function(){



				});

				it("Should use the token in the socket request", function(){


				});

				it("Should not throw an error when created without options", function(done){
					assert.doesNotThrow(function(){
						var socket = new TokenSocket();
						socket.ready(done);
						ms.respondWithJSON(ms._requests.shift(), 200, { token: "abc123" });
						ms.authenticateSocket(socket._socket);
					}, "Constructor does not throw when called without arguments");
				});

				it("Should not throw an error when created with all possible arguments", function(done){
					assert.doesNotThrow(function(){
						var socket = new TokenSocket({
							host: window.location.host,
							ready: done,
							onreconnect: function(){},
							reconnect: false,
							sockjs: {},
							socketPrefix: "/foo",
							tokenPath: "/foo/bar",
							authentication: {}
						}, 
						{
							foo: function(){}	
						});
						ms.respondWithJSON(ms._requests.shift(), 200, { token: "abc123" });
						ms.authenticateSocket(socket._socket);
					}, "Constructor does not throw when provided all possible arguments");
				});

				it("Should support JSONP requests for initialization", function(){


				});

			});

		});

		describe("Connection unit tests", function(){

			it("Should automatically reconnect if specified in config", function(){


			});

			it("Should queue requests up when the socket is closed", function(){


			});

			it("Should replay requests from the queue when the socket opens", function(){


			});

			it("Should implement exponential backoff on reconnection attempts", function(){


			});

		});

		describe("Exports unit tests", function(){

			var socket;

			before(function(done){
				// init socket
				done();
			});

			it("Should expose a ready function", function(){

			});

			it("Should expose a onreconnect function", function(){

			});

			it("Should allow users to list channels", function(){
				// just test fn, use integration tests to test with pubsub commands
			});

			it("Should expose an rpc function to make rpc calls", function(){

			});

			it("Should allow users to register and overwrite rpc callbacks", function(){
				// check for side affects of calling this
				// use integration tests to verify callbacks being called

			});

			it("Should expose pubsub commands", function(){
				// subscribe, publish, broadcast, unsubscribe
				// just test for fn existence
			});

			it("Should expose a callback for handling pubsub messages", function(){

			});

			it("Should expose a function to end the connection", function(){
				// just test for fn, not side affects
			});

		});

	};

}(this));
