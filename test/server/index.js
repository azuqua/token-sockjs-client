
var proxyquire = require("proxyquire"),
	mocks = require("../mocks/server");

var	TokenSocket = proxyquire("../../index", { 
	"restjs": mocks.RestJS,
	"sockjs-client": mocks.WS
});

describe("Node.js client tests", function(){
	require("./unit")(TokenSocket, mocks);
	require("./integration")(TokenSocket, mocks);
});