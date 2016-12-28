

var _ = require("lodash"),
	sinon = require("sinon"),
	assert = require("chai").assert;

module.exports = function(TokenSocket, mocks){

	describe("Unit Tests", function(){

		describe("Initialization Tests", function(){

			it("Should not throw an error when created without optional options", function(){
				assert.doesNotThrow(function(){
					var socket = new TokenSocket({ host: "foo.com" });
					socket._rest._requests.shift();
				}, "Constructor does not throw when called without optional arguments");
			});

			it("Should make an http request for a token upon initialization", function(){
				var socket = new TokenSocket({ host: "foo.com" });
				var req = socket._rest._requests.shift();
				assert.ok(req, "HTTP request exists");
				assert.include(req.options.path, socket._tokenPath, "Request url contains token path");
			});

			it("Should correctly form encode JSON objects", function(){
				var input = { foo: "bar", alice: "bob" },
					out = "foo=bar&alice=bob";
				var socket = new TokenSocket({ host: "foo.com", authentication: input });
				var req = socket._rest._requests.shift();
				assert.ok(req, "HTTP request exists");
				assert.include(req.options.path, out, "Request url contains properly form encoded input");
			});

			it("Should use the token in the socket request", function(){
				var socket = new TokenSocket({ host: "foo.com" }),
					token = "abc123";
				var req = socket._rest._requests.shift();
				assert.ok(req, "HTTP request exists");
				mocks.server.respondWithJSON(req, 200, { token: token });
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
						host: "foo.com",
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
					mocks.server.respondWithJSON(socket._rest._requests.shift(), 200, { token: "abc123" });
					socket._socket._emit("open");
					mocks.server.authenticateSocket(socket._socket);
				}, "Constructor does not throw when provided all possible arguments");
			});



		});

		describe("Exports tests", function() {
			
			var socket;

			before(function(done){
				socket = new TokenSocket({ host: "foo.com" });
				socket.ready(done);
				mocks.server.respondWithJSON(socket._rest._requests.shift(), 200, { token: "abc123" });
				socket._socket._emit("open");
				mocks.server.authenticateSocket(socket._socket);
			});

			after(function(done){
				socket.end(done);
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

	});

};