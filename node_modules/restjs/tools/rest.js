"use strict";
function RestWrap(opts) {
	/**
	 * Rest module
	 */

	/**
	 *	Rest
	 *	Rest object to handle RESTful outbound calls
	 *	@constructor
	 *	@params	{object}	[options]		options to override default UTF-e and HTTPS
	 */
	function Rest(options) {
		options = options || {};
		this.encoding = options.encoding || 'utf8';
		/*
		I'm pretty sure RESTful calls have to be done with http[s], other types of protocols
		i.e ftp, ws, ect. should be handled by some other object that deals with them so that this is
		a pure RESTful object like the name suggest
		 */
		this.protocol = options.protocol || 'https';
		this._requestModule = require(this.protocol);

		return this;
	}

	/**
	 * Generic REST invocation function
	 * Should handle all verbs
	 * @param	  {object}	  opts		  options for request
	 * @param  	{string}	  body		  body of request
	 * @param  	{Function}	callback	function(data) error handling & parseing should be done by module
	 */
	Rest.prototype.request = function (opts, body, callback) {
		var self = this,
		callbackArgs = [],
		isDone = false;

		body = body || '';

		function finish(err, res) {
			if (isDone){
				return; //This would only happen if an error occurs AFTER the res has ended...doubtful that would ever happen.
			}
			if (err) {
				callbackArgs[0] = err; //If there's an error and no res, collect it and keep waiting until the 'end' event
			} else {
				isDone = true;
				callbackArgs[1] = res;
				callback.apply(null, callbackArgs); //Pass both the err and res to the callback, because often times the body will be just fine despite errors
			}
		}

		var req = this._requestModule.request(opts, function (res) {
				var data = '';

				res.setEncoding(self.encoding);

				res.on('data', function (d) {
					data += d;
				}); //capture data
				res.on('end', function () {
					res.body = res.message = data;
					finish(null, res);
				});
			});

		req.on('error', finish);

		req.write(body);
		req.end();
	}

	return new Rest(opts);
}
module.exports = RestWrap;