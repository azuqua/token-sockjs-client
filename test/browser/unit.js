/*jslint browser: true */

(function(global){

	global.unitTests = function(){

		var _document = window.document,
			ms = global.mockServer;

		describe("Unit tests", function(){

			before(function(){
				var mock = global.mockWindow.create();
				window.document = global.document = mock.document;
				window.SockJS = global.SockJS = mock.SockJS;
				ms.init();
			});

			after(function(){
				window.document = _document;
				ms.end();
			});

			describe("Exports unit tests", function(){

				var socket;

				before(function(){
					socket = new TokenSocket();
				});

				after(function(){
					ms._requests.shift();
				});

				it("Should expose a ready function", function(){
					assert.isFunction(socket.ready, "Socket exposes ready function");
				});

				it("Should expose a onreconnect function", function(){
					assert.isFunction(socket.onreconnect, "Socket exposes onreconnect");
				});

				it("Should allow users to list channels", function(){
					assert.isFunction(socket.channels, "Socket exposes channels function");
					assert.isArray(socket.channels(), "Socket channels returns an array");
				});

				it("Should expose an rpc function to make rpc calls", function(){
					assert.isFunction(socket.rpc, "Socket exposes an rpc function");
				});

				it("Should allow users to register and overwrite rpc callbacks", function(){
					assert.isFunction(socket.register, "Socket exposes an action registration function");
				});

				it("Should expose pubsub commands", function(){
					assert.isFunction(socket.subscribe, "Socket exposes subscribe function");
					assert.isFunction(socket.publish, "Socket exposes publish function");
					assert.isFunction(socket.broadcast, "Socket exposes broadcast function");
					assert.isFunction(socket.unsubscribe, "Socket exposes unbsubcribe function");
				});

				it("Should expose a callback for handling pubsub messages", function(){
					assert.isFunction(socket.onmessage, "Socket exposes onmessage function");
				});

				it("Should expose a function to end the connection", function(){
					assert.isFunction(socket.end, "Socket exposes end function");
				});

			});

			describe("Initialization tests", function(){

				it("Should not throw an error when created without options", function(){
					assert.doesNotThrow(function(){
						var socket = new TokenSocket();
						ms._requests.shift();
					}, "Constructor does not throw when called without arguments");
				});

				/* 
				TODO wrap grunt-mocha-phantomjs in a grunt task that overrides window.location
				... apparently you can't overwrite it on the page
	
				it("Should allow for protocol overrides", function(){			
					var socket = new TokenSocket({ host: "http://foo.com" });
					assert.equal(socket._apiRoute.indexOf("http"), 0, "API route begins with http");
					socket = new TokenSocket({ host: "https://foo.com "});
					assert.equal(socket._apiRoute.indexOf("https"), 0, "API route begins with https");	
					ms.clean();
				});

				it("Should correctly infer protocols", function(){
					var old = global.location.protocol;
					// TODO cant override global.location stuff??
					global.location.protocol = "http:";
					var socket = new TokenSocket();
					assert.equal(socket._apiRoute.indexOf("http"), 0, "API route begins with http");
					global.location.protocol = "https:";
					socket = new TokenSocket();
					assert.equal(socket._apiRoute.indexOf("https"), 0, "API route begins with https");
					ms.clean();
					global.location.protocol = old;
				});

				*/

				it("Should make an http request for a token upon initialization", function(){
					var socket = new TokenSocket();
					var req = ms._requests.shift();
					assert.ok(req, "HTTP request exists");
					assert.include(req.url, socket._tokenPath, "Request url contains token path");
				});

				it("Should correctly form encode JSON objects", function(){
					var input = { foo: "bar", alice: "bob" },
						out = "foo=bar&alice=bob";
					var socket = new TokenSocket({ authentication: input });
					var req = ms._requests.shift();
					assert.ok(req, "HTTP request exists");
					assert.include(req.url, out, "Request url contains properly form encoded input");
				});


				it("Should use the token in the socket request", function(){
					var socket = new TokenSocket(),
						token = "abc123";
					var req = ms._requests.shift();
					assert.ok(req, "HTTP request exists");
					ms.respondWithJSON(req, 200, { token: token });
					socket._socket._emit("open");
					var socketReq = socket._socket._frames.shift();
					assert.ok(socketReq, "Socket has auth frame");
					socketReq = JSON.parse(socketReq);
					assert.property(socketReq, "token", "Socket auth request has token property");
					assert.equal(socketReq.token, token, "Socket auth request has correct token");
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
						socket._socket._emit("open");
						ms.authenticateSocket(socket._socket);
					}, "Constructor does not throw when provided all possible arguments");
				});

				/*
				// TODO mocking document.body isnt working

				it("Should support JSONP requests for initialization", function(){
					var socket = new TokenSocket({ host: "http://foo.com" });
					// check window callbacks
					// check dom for script tag
					var scriptTag = global.document.body.childNodes[0];
					
				});

				*/

			});

		});

	};

}(this));
