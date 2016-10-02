var constants = require('./constants.js');
var utils = require('./utils.js');
var Session = require('./session.js');

var noop = function noop() {};

var buildAuthHeader = function buildAuthHeader(session) {
    var header = {};

    if (session && session.id && session.skey) {
        header[constants.WX_HEADER_ID] = session.id;
        header[constants.WX_HEADER_SKEY] = session.skey;
    }

    return header;
};

var RequestError = (function () {
    function RequestError(type, message) {
        Error.call(this, message);
        this.type = type;
        this.message = message;
    }

    RequestError.prototype = new Error();
    RequestError.prototype.constructor = RequestError;

    return RequestError;
})();

var request = function request(options) {
    if (typeof options !== 'object') {
        var message = '请求传参应为 object 类型，但实际传了 ' + (typeof options) + ' 类型';
        throw new RequestError(constants.ERR_PARAM_INVALID, message);
    }

    var success = options.success || noop;
    var fail = options.fail || noop;
    var complete = options.complete || noop;
    var originHeader = options.header || {};
    var authHeader = buildAuthHeader(Session.get());

    // 成功回调
    var callSuccess = function () {
        success.apply(null, arguments);
        complete.apply(null, arguments);
    };

    // 失败回调
    var callFail = function (error) {
        fail.call(null, error);
        complete.call(null, error);
    };

    wx.request(utils.extend({}, options, {
        header: utils.extend({}, originHeader, authHeader),

        success: function (response) {
            var data = response.data;

            if (data && data[constants.WX_SESSION_MAGIC_ID]) {
                // clear session data
                Session.clear();

                var error;
                switch (data.error) {
                case constants.ERR_SESSION_EXPIRED:
                    error = new RequestError(data.error, '当前会话已过期');
                    break;

                default:
                    error = new RequestError(constants.ERR_CHECK_LOGIN_FAILED, '校验登录态失败');
                    break;
                }

                callFail(error);
                return;
            }

            callSuccess.apply(null, arguments);
        },

        fail: callFail,
        complete: noop,
    }));
};

module.exports = {
    RequestError: RequestError,
    request: request,
};