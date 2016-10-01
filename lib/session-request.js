var utils = require('./utils.js');

var exports = module.exports = {};

var WX_HEADER_CODE = 'X-WX-Code';
var WX_HEADER_ID = 'X-WX-Id';
var WX_HEADER_SKEY = 'X-WX-Skey';
var WX_HEADER_ENCRYPT_DATA = 'X-WX-Encrypt-Data';

var WX_SESSION_MAGIC_ID = 'F2C224D4-2BCE-4C64-AF9F-A6D872000D1A';

var ERR_LOGIN_FAILED = 'ERR_LOGIN_FAILED';
var ERR_INVALID_REQUEST_OPTIONS = 'ERR_INVALID_REQUEST_OPTIONS';
var ERR_EXCEED_MAX_RETRY_TIMES = 'ERR_EXCEED_MAX_RETRY_TIMES';
var ERR_SESSION_EXPIRED = 'ERR_SESSION_EXPIRED';

var MAX_RETRY_TIMES = 3;
var LOGIN_TIME_OUT = 30000;

function SessionRequestError(type, message) {
    Error.apply(this, message);
    this.type = type;
}

SessionRequestError.prototype = new Error();
SessionRequestError.prototype.constructor = SessionRequestError;

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

        fail: function (error) {
            callback(error, null);
        },
    });
};

var buildAuthHeader = function (session) {
    var header = {};
    header[WX_HEADER_ID] = session.id;
    header[WX_HEADER_SKEY] = session.skey;
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
        loginHeader[WX_HEADER_CODE] = code;

        wx.request(utils.extend({}, options || {}, {
            header: loginHeader,

            success: function (response) {
                var data = response.data;

                if (data && data[WX_SESSION_MAGIC_ID]) {
                    session = data.session || {};
                    callback(null, buildAuthHeader(session));
                } else {
                    var error = new SessionRequestError(ERR_LOGIN_FAILED, '登录失败，可能 code 无效');
                    callback(error);
                }
            },

            fail: function (error) {
                callback(error, null);
            },
        }));
    });
};

login = utils.limitTimeout(login, LOGIN_TIME_OUT);
login = utils.mutex(login);

/**
 * 带会话管理 request
 */
exports.request = function request(options) {
    if (typeof options !== 'object') {
        var message = '请求传参应为 object 类型，但实际传了 ' + (typeof options) + ' 类型';
        throw new SessionRequestError(ERR_INVALID_REQUEST_OPTIONS, message);
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

        if (tryTimes++ > MAX_RETRY_TIMES) {
            callFail(new SessionRequestError(ERR_EXCEED_MAX_RETRY_TIMES, '请求失败次数过多'));
            return;
        }

        login(options, function (error, authHeader) {
            if (error) {
                callFail(error);
                return;
            }

            var header = utils.extend({}, originHeader, authHeader);

            wx.request(utils.extend({}, options, {
                header: header,

                success: function (response) {
                    var data = response.data;

                    if (data && data[WX_SESSION_MAGIC_ID]) {
                        switch (data.error) {
                        case ERR_SESSION_EXPIRED: // 处理会话过期的情形
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