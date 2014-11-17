
module.exports = function(grunt){

	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),
		clean: ["clients/client/*.min.js"],

		jshint: {
			options: {},
			files: [
				"Gruntfile.js",
				"clients/**/*.js"
			]
		},

		uglify: {
            release: {
                files: {
                	"clients/client/tokensockjs.min.js": ["clients/client/tokensockjs.js"]
                }
            }
        }
	
	});

	grunt.loadNpmTasks("grunt-contrib-clean");
	grunt.loadNpmTasks("grunt-contrib-jshint");
	grunt.loadNpmTasks("grunt-contrib-uglify");

	grunt.registerTask("lint", ["jshint"]);
	grunt.registerTask("release", ["clean", "uglify"]);
	grunt.registerTask("default", ["lint", "release"]);

};