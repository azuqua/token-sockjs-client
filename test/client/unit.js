/*jslint browser: true */

(function(global){

	global.unitTests = function(){

		describe("Unit tests", function(){

			it("Should run a unit test", function(){
				assert.equal("1", "1", "Assert works");
				assert.ok(global.sinon, "Sinon is truthy in unit tests");
			});

		});

	};

}(this));
