
module.exports = function(grunt){

	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),
		clean: ["clients/client/*.min.js"],

		jshint: {
			options: {},
			files: [
				"Gruntfile.js",
				"clients/**/*.js",
				"test/server/**/*.js",
				"test/client/**/*.js"
			]
		},

		uglify: {
            release: {
                files: {
                	"clients/client/tokensockjs.min.js": ["clients/client/tokensockjs.js"]
                }
            }
        },

        browserify: {
			"test/dependencies/server.mock.browser.js": ["test/dependencies/server.mock.js"],
			"test/dependencies/testing.browser.js": ["test/dependencies/testing.js"]
		},

        mochaTest: {
        	options: { reporter: "spec", checkLeaks: true },
	        src: ["test/server/**/*.js"]
        },

        mocha_phantomjs: {
    		all: ["test/client/**/*.html"]
  		}
        
	});

	grunt.loadNpmTasks("grunt-browserify");
	grunt.loadNpmTasks("grunt-mocha-phantomjs");
	grunt.loadNpmTasks("grunt-contrib-clean");
	grunt.loadNpmTasks("grunt-contrib-jshint");
	grunt.loadNpmTasks("grunt-contrib-uglify");
	grunt.loadNpmTasks("grunt-mocha-test");

	grunt.registerTask("test", ["mochaTest", "mocha_phantomjs"]);
	grunt.registerTask("lint", ["jshint"]);
	grunt.registerTask("compress", ["uglify"]);
	grunt.registerTask("release", ["clean", "lint", "browserify", "test", "compress"]);
	grunt.registerTask("default", ["release"]);

};