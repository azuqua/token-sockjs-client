
var _ = require("lodash"),
	async = require("async"),
	sinon = require("sinon");


var MockSocketFactory = function(){
	return {
		_frames: [],

		send: function(data){
			if(typeof data !== "string")
				throw "Invalid data type for socket send";
			this._frames.push(data);
		},

		_emit: function(evt, data){
			if(evt && typeof this["on" + evt] === "function")
				this["on" + evt](data);
		},

		close: function(callback){
			setTimeout(function(){
				this._emit("close");
			}.bind(this), 0);
		}
	};
};


module.exports = {

	RestJS: function(options){
		return {
			_options: options,
			_requests: [],
			get: function(options, data, callback){
				this._requests.push({ options: options, data: data });
			},
		};
	},

	WS: function(){
		var key, out = new MockSocketFactory();
		for(key in out)
			if(typeof out[key] === "function") sinon.spy(out, key);
		return out;
	}

};

module.exports.RestJS["@global"] = true;
module.exports.WS["@global"] = true;