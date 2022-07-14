
module.exports = function(grunt){

	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),
		clean: ["clients/browser/*.min.js", "test/dependencies/*.browser.js"],

		jshint: {
			options: {
				laxbreak: true
			},
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
                	"clients/browser/tokensockjs.min.js": [
                		"clients/browser/tokensockjs.js", 
                		"node_modules/wolfy87-eventemitter/EventEmitter.js"
                	]
                }
            }
        },

        browserify: {
			"test/dependencies/server.browser.js": [
				"test/mocks/server.client.js"
			]
		},

        mochaTest: {
        	options: { reporter: "spec", checkLeaks: true, timeout: 20000 },
	        src: ["test/server/index.js", "test/browser/index.js"]
        },
	});

	grunt.loadNpmTasks("grunt-browserify");
	grunt.loadNpmTasks("grunt-contrib-clean");
	grunt.loadNpmTasks("grunt-contrib-jshint");
	grunt.loadNpmTasks("grunt-contrib-uglify");
	grunt.loadNpmTasks("grunt-mocha-test");

	grunt.registerTask("test", ["mochaTest"]);
	grunt.registerTask("lint", ["jshint"]);
	grunt.registerTask("compress", ["uglify"]);
	grunt.registerTask("debug", ["clean", "lint", "browserify", "test"]);
	grunt.registerTask("release", ["debug", "compress"]);
	grunt.registerTask("default", ["release"]);

};
