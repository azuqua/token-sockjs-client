
var sinon = require("sinon");

var MockSocketFactory = function(){
	return {
		_frames: [],

		write: function(data){
			if(typeof data !== "string")
				throw "Invalid data type for socket send";
			this._frames.push(data);
		},

		_emit: function(evt, data){
			if(evt && typeof this[evt] === "function")
				this[evt](data);
		},

		close: function(callback){
			setTimeout(function(){
				this._emit("close");
			}.bind(this), 0);
		},

		on: function(evt, callback){
			this[evt] = callback;
		}
	};
};


module.exports = {

	server: {

		respondWithJSON: function(req, code, data){
			req.callback(code === 200 ? null : new Error(data.error || "Error making HTTP request"), { body: JSON.stringify(data) });
		},

		authenticateSocket: function(socket, callback){
			var req = socket._frames.shift();
			if(typeof req === "string")
				req = JSON.parse(req);
			req.resp = "success";
			socket._emit("data", JSON.stringify(req));
			if(callback) callback();
		},

		socketResponse: function(socket, callback){
			var m, req = socket._frames.shift();
			callback(req, function(error, resp, mixins){
				if(error)
					req.error = error;
				else
					req.resp = resp;
				if(mixins){
					for(m in mixins)
						req[m] = mixins[m];
				}
				socket._emit("data", JSON.stringify(req));
			});
		}

	},

	RestJS: function(options){
		return {
			_options: options,
			_requests: [],
			request: function(options, data, callback){
				this._requests.push({ options: options, data: data, callback: callback });
			}
		};
	},

	WS: function(){
		var key, out = new MockSocketFactory();
		for(key in out)
			if(typeof out[key] === "function") sinon.spy(out, key);
		return out;
	}

};

// for proxyquire
module.exports.RestJS["@global"] = true;
module.exports.WS["@global"] = true;