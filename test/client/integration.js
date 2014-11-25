/*jslint browser: true */

(function(global){

	global.integrationTests = function(){

		var _document = window.document;

		describe("Integration tests", function(){

			before(function(){
				var mock = global.mockWindow.create();
				window.document = mock.document;
				window.SockJS = mock.SockJS;
				global.mockServer.init();
			});

			after(function(){
				window.document = _document;
				global.mockServer.end();
			});


			describe("Authentication tests", function(){

				it("Should handle a successful authentication http request ", function(){

				});

				it("Should handle a failed authentication http request", function(){

				});

				it("Should handle a successful websocket authentication request", function(){

				});

				it("Should handle a failed websocket authentication request", function(){

				});

			});

			describe("Connection management tests", function(){

				it("Should automatically reconnect if specified in config", function(){


				});

				it("Should queue requests up when the socket is closed", function(){


				});

				it("Should replay requests from the queue when the socket opens", function(){


				});

				it("Should implement exponential backoff on reconnection attempts", function(){


				});

			});

			describe("RPC tests", function(){

				it("Should track and create properly formatted rpc requests", function(){

				});


			});

			describe("Publish subscribe tests", function(){

				it("Should manage locally subscribed channels", function(){


				});

				it("Should handle internal channel synchronization requests", function(){

				});

			});

		});

	};

}(this));
