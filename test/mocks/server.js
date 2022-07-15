
var _ = require("lodash");

var MockSocketFactory = function(){

	var _Socket = function(path){
		this._path = path;
		this._frames = [];
		this._events = {};
	};

	_.extend(_Socket.prototype, {

		send: function(data){
			if(typeof data !== "string")
				throw "Invalid data type for socket send";
			this._frames.push(data);
		},

		_emit: function(evt, data){
			if(evt && typeof this["on" + evt] === "function")
				this["on" + evt](data ? { data: data } : undefined);
		},

		close: function(callback){
			setTimeout(function(){
				this._emit("close");
			}.bind(this), 0);
		}

	});

	return _Socket;
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
			socket._emit("message", JSON.stringify(req));
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
				socket._emit("message", JSON.stringify(req));
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

	WS: new MockSocketFactory()

};

// for proxyquire
module.exports.RestJS["@global"] = true;
module.exports.WS["@global"] = true;