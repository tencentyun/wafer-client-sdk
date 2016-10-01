var sessionRequest = require('./lib/session-request.js');
var websocket = require('./lib/websocket.js');

module.exports = {
    request: sessionRequest.request,
    websocket: websocket
};