/*jslint browser: true */


(function(global){

	global.integrationTests = function(){

		describe("Integration tests", function(){

			it("Should run a integration test", function(){
				assert.equal("1", "1", "Assert works");
				assert.ok(global.sinon, "Sinon is truthy in integrations");
				assert.ok(global.serverMock, "serverMock is truthy in integrations");
			});

		});

	};

}(this));
