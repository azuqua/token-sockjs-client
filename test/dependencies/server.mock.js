/*jslint browser: true */

(function(global){

	global.sinon = require("sinon");
	global.chai = chai;
	global.mocha = mocha;
	global.assert = chai.assert;

	mocha.setup("exports");
	mocha.setup("bdd");
	mocha.reporter("html");

	global.mockServer = {

		init: function(){
			this.xhr = sinon.useFakeXMLHttpRequest();
	        var requests = this._requests = [];

	        this.xhr.onCreate = function(xhr){
	            requests.push(xhr);
	        };
		},

		end: function(){
			this.xhr.restore();
		},

		jsonpEmit: function(tag, resp){
			var callback, params = tag.src.split("?")[1].split("&");
			params.forEach(function(kv){
				kv = kv.split("=");
				if(kv[0].indexOf("callback") > -1)
					callback = kv[1];
			});
			if(callback && window[callback])
				window[callback](resp);
		},

		respondWithJSON: function(req, code, data){
			req.respond(200, { "Content-Type": "application/json" }, JSON.stringify(data));
		},

		authenticateSocket: function(socket, callback){
			socket.emit("open");
			setTimeout(function(){
				console.log("socket ", socket);
				var req = socket._frames.shift();
				if(typeof req === "string")
					req = JSON.parse(req);
				req.resp = "success";
				socket.emit("message", { data: JSON.stringify(req) });
				if(callback) callback();
			}, 10);
		},

		socketResponse: function(socket, callback){
			setTimeout(function(){
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
					socket.emit("message", { data: JSON.stringify(req) });
				});
			}, 5);
		}

	};

	global.mockWindow = {

		create: function(){
			var mock = {};
			mock.document = {};

			mock.document.appendChild = function(node){
				var index = this.childNodes.indexOf(node);
				if (index > -1) 
					this.childNodes.splice(index, 1);
				this.childNodes.push(node);
				node.parentNode = this;
			};

			mock.document.removeChild = function(node){
				var index = this.childNodes.indexOf(child);
				this.childNodes.splice(index, 1);
				node.parentNode = null;
			};

			mock.document.createElement = function(tag){
				return {
					childNodes: [],
					nodeName: tag.toUpperCase(),
					appendChild: mock.document.appendChild,
					removeChild: mock.document.removeChild
				};
			};

			mock.document.body = mock.document.createElement("body");
			mock.SockJS = global.SockJS;

			return mock;
		}
	};

	global.MockSocketFactory = function(){
		return {
			_frames: [],

			send: function(data){
				if(typeof data !== "string")
					throw "Invalid data type for socket send";
				this._frames.push(data);
			},

			emit: function(evt, data){
				if(evt && typeof this["on" + evt] === "function")
					this["on" + evt](data);
			},

			close: function(callback){
				setTimeout(function(){
					this.emit("close");
				}.bind(this), 0);
			}
		};
	};

	global.SockJS = function(){
		var key, out = global.MockSocketFactory();
		for(key in out)
			if(typeof out[key] === "function") sinon.spy(out, key);
		return out;
	};

}(window));