
module.exports = function(grunt){

	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),
		clean: ["clients/browser/*.min.js", "test/dependencies/*.browser.js"],

		jshint: {
			options: {},
			files: [
				"Gruntfile.js",
				"clients/**/*.js",
				"test/server/**/*.js",
				"test/browser/**/*.js",
				"test/mocks/*.js"
			]
		},

		uglify: {
            release: {
                files: {
                	"clients/browser/tokensockjs.min.js": ["clients/browser/tokensockjs.js"]
                }
            }
        },

        browserify: {
			"test/dependencies/server.browser.js": ["test/mocks/server.client.js"]
		},

        mochaTest: {
        	options: { reporter: "spec", checkLeaks: true },
	        src: ["test/server/index.js"]
        },

        mocha_phantomjs: {
    		all: [
    			"test/browser/unit.html", 
    			"test/browser/integration.html"
    		]
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
	grunt.registerTask("debug", ["clean", "lint", "browserify", "test"]);
	grunt.registerTask("release", ["debug", "compress"]);
	grunt.registerTask("default", ["release"]);

};
