const noop = () => void(0);

function setupFakeWxAPI() {
    const wx = global.wx = global.wx || {};
    const storage = {};

    wx.setStorageSync = (key, name) => storage[key] = name;
    wx.getStorageSync = key => storage[key];
    wx.removeStorageSync = key => delete storage[key];

    wx.login = noop;
    wx.getUserInfo = noop;
    wx.checkSession = noop;
    wx.request = noop;

    wx.connectSocket = noop;
    wx.sendSocketMessage = noop;
    wx.closeSocket = noop;

    wx.onSocketOpen = noop;
    wx.onSocketClose = noop;
    wx.onSocketMessage = noop;
    wx.onSocketError = noop;
}

module.exports = setupFakeWxAPI;