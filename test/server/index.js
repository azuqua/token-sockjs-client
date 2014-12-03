
var proxyquire = require("proxyquire"),
	mocks = require("../mocks/server");

console.log("mocks ,", mocks);

var	TokenSocketServer = proxyquire("../../index", { 
	"sockjs-client-ws": mocks.WS, 
	"restjs": mocks.RestJS 
});

module.exports = describe("Node.js client tests", function(){
	require("./unit")(TokenSocketServer, mocks);
	require("./integration")(TokenSocketServer, mocks);
});