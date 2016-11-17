'use strict';

const should = require('should');
const sinon = require('sinon');
require('should-sinon');

const constants = require('../lib/constants');
const Session = require('../lib/session');
const { login, LoginError, setLoginUrl } = require('../lib/login');

const setupFakeWxAPI = require('./helpers/setupFakeWxAPI');

describe('lib/login.js', function () {
    describe('class: LoginError', function () {
        it('should take type and message as property', function () {
            const error = new LoginError('mytype', 'mymessage');
            error.type.should.be.equal('mytype');
            error.message.should.be.equal('mymessage');
        });
    });

    describe('method: login()', function () {
        const testLoginUrl = 'https://api.mydomain.com/login';
        const testCode = 'test_code';
        const testEncryptedData = 'encrypt_data';
        const testIv = 'iv';
        const testUserInfo = { fakeUserInfo: true };
        const testId = 'test_id';
        const testSkey = 'test_skey';

        it('should be a function', function () {
            login.should.be.a.Function ();
        });

        it('should call fail() if called before `setLoginUrl()`', function (done) {
            login({
                fail: function (error) {
                    should(error).be.exist;
                    error.should.be.instanceOf(Error);
                    done();
                }
            });
        });

        it('should go through the login process without session stored', function (done) {
            setLoginUrl(testLoginUrl);

            setupFakeWxAPI();

            // 给微信两个接口打桩，响应正常
            sinon.stub(global.wx, 'login', function (options) {
                options.success({ code: testCode });
            });
            sinon.stub(global.wx, 'getUserInfo', function (options) {
                options.success({ encryptedData: testEncryptedData, iv: testIv, userInfo: testUserInfo });
            });

            // 给登录服务器请求打桩，检查参数是否正确的同时响应登录成功
            sinon.stub(global.wx, 'request', function (options) {
                const { url, header, method } = options;
                url.should.be.equal(testLoginUrl);

                header.should.be.an.Object();
                header[constants.WX_HEADER_CODE].should.be.equal(testCode);
                header[constants.WX_HEADER_ENCRYPTED_DATA].should.be.equal(testEncryptedData);

                options.success({
                    data: {
                        [constants.WX_SESSION_MAGIC_ID]: 1,
                        session: {
                            id: testId,
                            skey: testSkey
                        }
                    }
                });
            });

            login({
                success: function (userInfo) {
                    userInfo.should.be.equal(testUserInfo);
                    var session = Session.get();
                    session.id.should.be.equal(testId);
                    session.skey.should.be.equal(testSkey);
                    done();
                }
            });
        });

        it('should callback with userInfo in session if session exists and not expired', function (done) {
            setupFakeWxAPI();

            // 接口打桩，这些接口不应该被调用
            sinon.stub(global.wx, 'login');
            sinon.stub(global.wx, 'getUserInfo');
            sinon.stub(global.wx, 'request');

            sinon.stub(global.wx, 'checkSession', function (options) {
                options.success();
            });

            Session.set({
                id: testId,
                skey: testSkey,
                userInfo: testUserInfo,
            });

            login({
                loginUrl: testLoginUrl,
                success: function (userInfo) {
                    global.wx.checkSession.should.be.calledOnce();

                    global.wx.login.should.not.be.called();
                    global.wx.getUserInfo.should.not.be.called();
                    global.wx.request.should.not.be.called();

                    userInfo.should.be.equal(testUserInfo);

                    done();
                },
            });
        });

        it('should call wx.login() if session exists but expired', function () {
            setupFakeWxAPI();

            sinon.stub(global.wx, 'login');
            sinon.stub(global.wx, 'checkSession', function (options) {
                options.fail();
            });

            Session.set({
                id: testId,
                skey: testSkey,
                userInfo: testUserInfo,
            });

            login({ loginUrl: testLoginUrl });
            global.wx.login.should.be.calledOnce();
        });

        it('should call fail() if wx.login() fails', function () {
            setupFakeWxAPI();

            // 接口打桩
            sinon.stub(global.wx, 'login', function (options) {
                options.fail('login_failed');
            });

            sinon.stub(global.wx, 'getUserInfo');
            sinon.stub(global.wx, 'request');

            const success = sinon.spy();
            const fail = sinon.spy(function (error) {
                error.should.be.instanceOf(LoginError);
                error.type.should.be.equal(constants.ERR_WX_LOGIN_FAILED);
                error.detail.should.be.equal('login_failed');
            });

            login({ loginUrl: testLoginUrl, success, fail });

            fail.should.be.calledOnce();
            success.should.not.be.called();
            global.wx.getUserInfo.should.not.be.called();
            global.wx.request.should.not.be.called();
        });

        it('should call fail() if wx.getUserInfo() fails', function () {
            setupFakeWxAPI();

            // 接口打桩
            sinon.stub(global.wx, 'login', function (options) {
                options.success({ code: testCode, encryptedData: testEncryptedData });
            });

            sinon.stub(global.wx, 'getUserInfo', function (options) {
                options.fail('getUserInfo_failed');
            });

            sinon.stub(global.wx, 'request');

            const success = sinon.spy();
            const fail = sinon.spy(function (error) {
                error.should.be.instanceOf(LoginError);
                error.type.should.be.equal(constants.ERR_WX_GET_USER_INFO);
                error.detail.should.be.equal('getUserInfo_failed');
            });

            login({ loginUrl: testLoginUrl, success, fail });

            fail.should.be.calledOnce();
            success.should.not.be.called();
            global.wx.login.should.be.calledOnce();
            global.wx.getUserInfo.should.be.calledOnce();
            global.wx.request.should.not.be.called();
        });

        it('should call fail() if wx.request() didn\'t response with magic id', function () {
            setupFakeWxAPI();

            // 接口打桩
            sinon.stub(global.wx, 'login', function (options) {
                options.success({ code: testCode, encryptedData: testEncryptedData, iv: testIv });
            });

            sinon.stub(global.wx, 'getUserInfo', function (options) {
                options.success({ encryptedData: testEncryptedData, userInfo: testUserInfo });
            });

            sinon.stub(global.wx, 'request', function (options) {
                // no session
                options.success({});
            });

            const success = sinon.spy();
            const fail = sinon.spy(function (error) {
                error.should.be.instanceOf(LoginError);
                error.type.should.be.equal(constants.ERR_LOGIN_SESSION_NOT_RECEIVED);
            });

            login({ loginUrl: testLoginUrl, success, fail });

            fail.should.be.calledOnce();
            success.should.not.be.called();
            global.wx.login.should.be.calledOnce();
            global.wx.getUserInfo.should.be.calledOnce();
            global.wx.request.should.be.calledOnce();
        });

        it('should call fail() if wx.request() response with magic id but with no session', function () {
            setupFakeWxAPI();

            // 接口打桩
            sinon.stub(global.wx, 'login', function (options) {
                options.success({ code: testCode, encryptedData: testEncryptedData });
            });

            sinon.stub(global.wx, 'getUserInfo', function (options) {
                options.success({ encryptedData: testEncryptedData, userInfo: testUserInfo });
            });

            sinon.stub(global.wx, 'request', function (options) {
                // no session
                options.success({
                    data: {
                        [constants.WX_SESSION_MAGIC_ID]: 1
                    }
                });
            });

            const success = sinon.spy();
            const fail = sinon.spy(function (error) {
                error.should.be.instanceOf(LoginError);
                error.type.should.be.equal(constants.ERR_LOGIN_SESSION_NOT_RECEIVED);
            });

            login({ loginUrl: testLoginUrl, success, fail });

            fail.should.be.calledOnce();
            success.should.not.be.called();
            global.wx.login.should.be.calledOnce();
            global.wx.getUserInfo.should.be.calledOnce();
            global.wx.request.should.be.calledOnce();
        });

        it('should call fail() if wx.request() fails', function () {
            setupFakeWxAPI();

            // 接口打桩
            sinon.stub(global.wx, 'login', function (options) {
                options.success({ code: testCode, encryptedData: testEncryptedData });
            });

            sinon.stub(global.wx, 'getUserInfo', function (options) {
                options.success({ encryptedData: testEncryptedData, userInfo: testUserInfo });
            });

            sinon.stub(global.wx, 'request', function (options) {
                options.fail('server error');
            });

            const success = sinon.spy();
            const fail = sinon.spy(function (error) {
                error.should.be.instanceOf(LoginError);
                error.type.should.be.equal(constants.ERR_LOGIN_FAILED);
            });

            login({ loginUrl: testLoginUrl, success, fail });

            fail.should.be.calledOnce();
            success.should.not.be.called();
            global.wx.login.should.be.calledOnce();
            global.wx.getUserInfo.should.be.calledOnce();
            global.wx.request.should.be.calledOnce();
        });

        it('should be ok if no fail or success callback passed', function () {
            setupFakeWxAPI();

            // 接口打桩
            sinon.stub(global.wx, 'login', function (options) {
                options.fail('login_failed');
            });

            sinon.stub(global.wx, 'getUserInfo');
            sinon.stub(global.wx, 'request');

            login({ loginUrl: testLoginUrl });

            global.wx.login.should.be.called();
            global.wx.getUserInfo.should.not.be.called();
            global.wx.request.should.not.be.called();
        });
    });
});