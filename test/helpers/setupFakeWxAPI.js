function setupFakeWxAPI() {
    const wx = global.wx = global.wx || {};
    const storage = {};

    wx.setStorageSync = (key, name) => storage[key] = name;
    wx.getStorageSync = key => storage[key];
    wx.removeStorageSync = key => delete storage[key];
    wx.login = () => void(0);
    wx.getUserInfo = () => void(0);
    wx.checkSession = () => void(0);
    wx.request = () => void(0);
}

module.exports = setupFakeWxAPI;