'use strict';

const should = require('should');
const sinon = require('sinon');
require('should-sinon');

const constants = require('../lib/constants');

const WX_SESSION_MAGIC_ID = 'F2C224D4-2BCE-4C64-AF9F-A6D872000D1A';
const REQUEST_PATH = require.resolve('../lib/session-request');

describe('Session Request', function () {
    let wx, request, SessionRequestError, setLoginTimeout;
    beforeEach(function () {
        delete require.cache[REQUEST_PATH];
        ({ request, SessionRequestError, setLoginTimeout } = require('../lib/session-request'));

        wx = global.wx = {
            login() {},
            request() {},
        };
    });

    it('should be a function', function () {
        should(request).be.a.Function ();
    });

    it('should throw an error when no options passed', function () {
        should.throws(function () {
            request();
        });
    });

    it('should call login for the first request', function () {
        sinon.stub(wx, 'login');
        request({
            url: 'https://www.mydomain.com/ajax/action'
        });

        wx.login.should.be.calledOnce();
    });

    it('should call login only once for multiple request', function () {
        sinon.stub(wx, 'login');
        request({
            url: 'https://www.mydomain.com/ajax/action'
        });

        request({
            url: 'https://www.mydomain.com/ajax/action'
        });

        wx.login.should.be.calledOnce();
    });

    it('should call with code for the first request', function (done) {
        sinon.stub(wx, 'login', function (options) {
           options.success({ code: 'pseudo_code' });
        });

        sinon.stub(wx, 'request', function (options) {
            options.header.should.be.Object();
            options.header[constants.WX_HEADER_CODE].should.be.equal('pseudo_code');
            done();
        });

        request({
            url: 'https://www.mydomain.com/ajax/action'
        });

        wx.login.should.be.calledOnce();
    });

    it('should call with session after login', function (done) {
        let calledCount = 0;

        sinon.stub(wx, 'login', function (options) {
           options.success({ code: 'pseudo_code' });
        });

        sinon.stub(wx, 'request', function (options) {
            if (options.header[constants.WX_HEADER_CODE]) {
                options.success({ data: {
                    [WX_SESSION_MAGIC_ID]: 1,
                    session: {
                        'id': 'pseudo_id',
                        'skey': 'pseudo_skey',
                    },
                }});
            } else {
                options.header.should.be.Object();
                options.header[constants.WX_HEADER_ID].should.be.equal('pseudo_id');
                options.header[constants.WX_HEADER_SKEY].should.be.equal('pseudo_skey');
                options.success({});
            }
        });

        function checkDone() {
            calledCount += 1;

            if (calledCount === 2) {
                done();
            }
        }

        request({
            url: 'https://www.mydomain.com/ajax/action',
            complete: checkDone,
        });

        request({
            url: 'https://www.mydomain.com/ajax/action',
            complete: checkDone,
        });

        wx.login.should.be.calledOnce();
    });

    it('should call options.fail() when wx.login() failed', function (done) {
        sinon.stub(wx, 'login', function (options) {
           options.fail('wx_login_error');
        });

        sinon.stub(wx, 'request', function (options) {
            options.header.should.be.Object();
            options.header[constants.WX_HEADER_CODE].should.be.equal('pseudo_code');
            done();
        });

        request({
            url: 'https://www.mydomain.com/ajax/action',
            fail(error) {
                should.exist(error);
                error.should.be.instanceof(SessionRequestError);
                error.type.should.be.equal(constants.ERR_WX_LOGIN_FAILED);
                error.detail.should.be.equal('wx_login_error');
                done();
            },
        });

        wx.login.should.be.calledOnce();
    });

    it('should call options.fail() when server didn\'t respond with a session', function (done) {
        let responseId = 0;

        sinon.stub(wx, 'login', function (options) {
           options.success({ code: 'pseudo_code' });
        });

        sinon.stub(wx, 'request', function (options) {
            responseId += 1;

            if (options.header[constants.WX_HEADER_CODE]) {
                if (responseId === 1) {
                    options.fail('failed_due_request_error');
                }

                if (responseId === 2) {
                    options.success({});
                }
            }
        });

        // 第一次测试服务器响应错误（如500）
        request({
            url: 'https://www.mydomain.com/ajax/action',
            fail(error) {
                should.exist(error);
                error.should.be.instanceof(SessionRequestError);
                error.type.should.be.equal(constants.ERR_LOGIN_FAILED);
                error.detail.should.be.equal('failed_due_request_error');
            },
        });

        // 第二次测试服务器无会话响应
        request({
            url: 'https://www.mydomain.com/ajax/action',
            fail(error) {
                should.exist(error);
                error.should.be.instanceof(SessionRequestError);
                error.type.should.be.equal(constants.ERR_LOGIN_MISSING_SESSION);
                error.detail.should.be.equal('没有收到 session 响应，可能是服务端 SDK 配置不正确');
                done();
            },
        });
    });

    it('should re-login on session expired', function (done) {
        let responseId = 0;

        sinon.stub(wx, 'login', function (options) {
           options.success({ code: 'pseudo_code' });
        });

        sinon.stub(wx, 'request', function (options) {
            if (options.header[constants.WX_HEADER_CODE]) {
                options.success({
                    data: {
                        [WX_SESSION_MAGIC_ID]: 1,
                        session: {
                            'id': 'pseudo_id',
                            'skey': 'pseudo_skey',
                        },
                    }
                });
            } else {
                options.header.should.be.Object();
                options.header[constants.WX_HEADER_ID].should.be.equal('pseudo_id');
                options.header[constants.WX_HEADER_SKEY].should.be.equal('pseudo_skey');
                options.success({
                    data: {
                        [constants.WX_SESSION_MAGIC_ID]: 1,
                        error: constants.ERR_SESSION_EXPIRED,
                    }
                });
            }
        });

        request({
            url: 'https://www.mydomain.com/ajax/action',
            fail(error) {
                should.exist(error);
                error.should.be.instanceof(SessionRequestError);
                error.type.should.be.equal(constants.ERR_EXCEED_MAX_RETRY_TIMES);
                error.message.should.be.equal('请求失败次数过多');
                done();
            },
        });
    });

    it('should failed when login timeout', function (done) {
        setLoginTimeout(10);

        sinon.stub(wx, 'login', function (options) {
            setTimeout(function () {
                options.success({ code: 'pseudo_code' });
                done();
            }, 200);
        });

        sinon.stub(wx, 'request', function (options) {
            options.success({});
        });

        request({
            url: 'https://www.mydomain.com/ajax/action',
            fail(error) {
                should.exist(error);
                error.should.be.instanceof(SessionRequestError);
                error.type.should.be.equal(constants.ERR_LOGIN_TIMEOUT);
                error.message.should.be.equal('登录超时，请检查网络状态');
            },
        });

        wx.login.should.be.calledOnce();
        wx.request.should.not.be.called();
    });
});