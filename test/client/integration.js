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


			it("Should run a integration test", function(){
				assert.equal("1", "1", "Assert works");
			});

		});

	};

}(this));
