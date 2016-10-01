var constants = require('./constants.js');
var utils = require('./utils.js');

var exports = module.exports = {};

var MAX_RETRY_TIMES = 3;
var loginTimeout = 30000;

function SessionRequestError(type, message) {
    Error.call(this, message);
    this.type = type;
    this.message = message;
}

SessionRequestError.prototype = new Error();
SessionRequestError.prototype.constructor = SessionRequestError;
exports.SessionRequestError = SessionRequestError;

var noop = function () {};

/** 当前用户会话信息 */
var session = null;

/**
 * 微信登录，获取 code
 */
var getLoginCode = function getLoginCode(callback) {
    wx.login({
        success: function (result) {
            callback(null, result.code);
        },

        fail: function (loginError) {
            var error = new SessionRequestError(constants.ERR_WX_LOGIN_FAILED, '微信登录失败');
            error.detail = loginError;
            callback(error, null);
        },
    });
};

var buildAuthHeader = function (session) {
    var header = {};
    header[constants.WX_HEADER_ID] = session.id;
    header[constants.WX_HEADER_SKEY] = session.skey;
    return header;
};

/** 登录 */
var login = function login(options, callback) {
    if (session) {
        callback(null, buildAuthHeader(session));
        return;
    }

    getLoginCode(function (error, code) {
        if (error) {
            callback(error, null);
            return;
        }

        var loginHeader = {};
        loginHeader[constants.WX_HEADER_CODE] = code;

        function callFail(type, detail) {
            var error = new SessionRequestError(type, '登录失败，可能服务器错误或者 code 无效');
            error.detail = detail;
            callback(error, null);
        }

        wx.request(utils.extend({}, options, {
            header: loginHeader,

            success: function (response) {
                var data = response.data;

                if (data && data[constants.WX_SESSION_MAGIC_ID] && data.session) {
                    session = data.session;
                    callback(null, buildAuthHeader(session));
                } else {
                    callFail(constants.ERR_LOGIN_MISSING_SESSION, '没有收到 session 响应，可能是服务端 SDK 配置不正确');
                }
            },

            fail: function (error) {
                callFail(constants.ERR_LOGIN_FAILED, error);
            },
        }));
    });
};

login = utils.limitTimeout(login, function () { return loginTimeout; });
login = utils.mutex(login);

/**
 * 带会话管理 request
 */
exports.request = function request(options) {
    if (typeof options !== 'object') {
        var message = '请求传参应为 object 类型，但实际传了 ' + (typeof options) + ' 类型';
        throw new SessionRequestError(constants.ERR_INVALID_REQUEST_OPTIONS, message);
    }

    var tryTimes = 0;

    var doRequest = function () {
        var success = options.success || noop;
        var fail = options.fail || noop;
        var complete = options.complete || noop;
        var originHeader = options.header || {};

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

        if (++tryTimes > MAX_RETRY_TIMES) {
            callFail(new SessionRequestError(constants.ERR_EXCEED_MAX_RETRY_TIMES, '请求失败次数过多'));
            return;
        }

        login(options, function (error, authHeader) {
            if (error) {
                if (error.timeout) {
                    error = new SessionRequestError(constants.ERR_LOGIN_TIMEOUT, '登录超时，请检查网络状态');
                }

                callFail(error);
                return;
            }

            var header = utils.extend({}, originHeader, authHeader);

            wx.request(utils.extend({}, options, {
                header: header,

                success: function (response) {
                    var data = response.data;

                    if (data && data[constants.WX_SESSION_MAGIC_ID]) {
                        switch (data.error) {
                        case constants.ERR_SESSION_EXPIRED: // 处理会话过期的情形
                            session = null;
                            doRequest();
                            return;
                        }
                    }

                    callSuccess.apply(null, arguments);
                },

                fail: callFail,
                complete: noop,
            }));
        });
    };

    doRequest();
};

exports.setLoginTimeout = function (msecs) {
    loginTimeout = msecs;
};