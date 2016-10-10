'use strict';

const should = require('should');
const sinon = require('sinon');
require('should-sinon');

const constants = require('../lib/constants')
var Session = require('../lib/session.js');
const { request, RequestError } = require('../lib/request');
const loginLib = require('../lib/login');

const setupFakeWxAPI = require('./helpers/setupFakeWxAPI');

describe('lib/request.js', function () {
    beforeEach(setupFakeWxAPI);

    describe('class: RequestError', function () {
        it('should return Error instance with type and message', function () {
            const error = new RequestError('pseudo_type', 'pseudo_message');

            error.should.be.instanceof(RequestError);
            error.should.be.instanceof(Error);
            error.type.should.equal('pseudo_type');
            error.message.should.equal('pseudo_message');
        });
    });

    describe('method: request()', function () {
        it('should throw an error if no options passed', function () {
           should.throws(function () {
              request();
           });
        });

        it('should call wx.request() with header(id, skey) if session exists', function (done) {
            sinon.stub(Session, 'get', function () {
                return {
                    id: 'pseudo_id',
                    skey: 'pseudo_skey',
                };
            });

            sinon.stub(wx, 'request', function (options) {
                options.header.should.be.an.Object();
                options.header[constants.WX_HEADER_ID].should.be.equal('pseudo_id');
                options.header[constants.WX_HEADER_SKEY].should.be.equal('pseudo_skey');

                Session.get.restore();
                done();
            });

            request({ url: 'https://www.mydomain.com/ajax/action' });
        });

        it('should call wx.request() with no header(id, skey) if session not exists', function (done) {
            sinon.stub(Session, 'get', function () {
                return null;
            });

            sinon.stub(wx, 'request', function (options) {
                options.header.should.be.an.Object();
                should.not.exists(options.header[constants.WX_HEADER_ID]);
                should.not.exists(options.header[constants.WX_HEADER_SKEY]);

                Session.get.restore();
                done();
            });

            request({ url: 'https://www.mydomain.com/ajax/action' });
        });

        it('should clear session data when check login failed', function () {
            sinon.stub(Session, 'get');
            sinon.stub(Session, 'clear');
            sinon.stub(wx, 'request', function (options) {
                options.success({
                    data: {
                        [constants.WX_SESSION_MAGIC_ID]: 1,
                    }
                });
            });

            request({ url: 'https://www.mydomain.com/ajax/action' });
            Session.clear.should.be.calledOnce();

            Session.get.restore();
            Session.clear.restore();
        });

        it('should login and retry when response with session error', function (done) {
            sinon.stub(Session, 'get');
            sinon.stub(Session, 'clear');

            sinon.stub(wx, 'request', function (options) {
                options.success({
                    data: {
                        [constants.WX_SESSION_MAGIC_ID]: 1,
                        error: constants.ERR_INVALID_SESSION,
                    }
                });
            });

            sinon.stub(loginLib, 'login', function(options) {
                options.success({});
            });

            request({
                url: 'https://www.mydomain.com/ajax/action',
                fail: function (error) {
                    error.should.be.instanceof(RequestError);
                    error.type.should.be.equal(constants.ERR_INVALID_SESSION);

                    loginLib.login.should.be.calledOnce();
                    wx.request.should.be.calledTwice();

                    Session.get.restore();
                    Session.clear.restore();
                    loginLib.login.restore();
                    done();
                },
            });
        });

        it('should call options.success() when response without session error', function (done) {
            sinon.stub(Session, 'get');
            sinon.stub(Session, 'clear');

            sinon.stub(wx, 'request', function (options) {
                options.success({
                    data: { foo: 1, bar: '2' }
                });
            });

            request({
                url: 'https://www.mydomain.com/ajax/action',
                success: function (response) {
                    response.should.be.an.Object();
                    response.data.should.be.an.Object();
                    response.data.foo.should.be.equal(1);
                    response.data.bar.should.be.equal('2');

                    Session.get.restore();
                    Session.clear.restore();
                    done();
                },
            });
        });

        it('should login before request if `login` options set to true', function(done) {
            sinon.stub(wx, 'request', function (options) {
                options.success({
                    data: { foo: 1, bar: '2' }
                });
            });

            sinon.stub(loginLib, 'login', function(options) {
                options.success({});
            });
            
            request({
                url: 'https://www.mydomain.com/ajax/action',
                login: true,
                success: function (response) {
                    response.should.be.an.Object();
                    response.data.should.be.an.Object();
                    response.data.foo.should.be.equal(1);
                    response.data.bar.should.be.equal('2');

                    loginLib.login.should.be.calledOnce();
                    loginLib.login.restore();
                    done();
                },
            });
        });
    });
});