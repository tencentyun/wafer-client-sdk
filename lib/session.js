var constants = require('./constants.js');
var SESSION_KEY = "weapp_session_" + constants.WX_SESSION_MAGIC_ID;

var session = {
    get: function() {
        return wx.getStorageSync(SESSION_KEY) || null;
    },
    set: function(session) {
        wx.setStorageSync(SESSION_KEY, session)
    },
    clear: function() {
        wx.setStorageSync(SESSION_KEY, null);
    }
}

module.exports = session;