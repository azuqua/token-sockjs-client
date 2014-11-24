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

			describe("Initialization unit tests", function(){

				it("Should not throw an error when created without options", function(done){
					assert.doesNotThrow(function(){
						var socket = new TokenSocket();
						socket.ready(done);
						ms.respondWithJSON(ms._requests.shift(), 200, { token: "abc123" });
						ms.authenticateSocket(socket._socket);
					}, "Constructor does not throw when called without arguments");
				});

				it("Should not throw an error when creating with all possible arguments", function(done){
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

				it("Should allow for protocol overrides", function(){

					// test options after passing it in (use the fact that it modifies it...)

				});

				it("Should correctly infer protocols", function(){



				});

				it("Should correctly form encode JSON objects", function(){


				});

			});

		});

		describe("Exports unit tests", function(){






		});

	};

}(this));
