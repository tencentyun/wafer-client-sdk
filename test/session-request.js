'use strict';

const should = require('should');
const sinon = require('sinon');
require('should-sinon');

const constants = require('../lib/constants');

const WX_SESSION_MAGIC_ID = 'F2C224D4-2BCE-4C64-AF9F-A6D872000D1A';
const REQUEST_PATH = require.resolve('../lib/session-request');

describe('Session Request', function() {
    let wx, request;
    beforeEach(function() {
        delete require.cache[REQUEST_PATH];
        request = require('../lib/session-request').request;

        wx = global.wx = {
            login() {},
            request() {},
        };
    });

    it('should be a function', function() {
        should(request).be.a.Function();
    });

    it('should throw an error when no options passed', function() {
        should.throws(function() {
            request();
        });
    });

    it('should call login for the first request', function() {
        sinon.stub(wx, 'login');
        request({
            url: 'https://www.mydomain.com/ajax/action'
        });

        wx.login.should.be.calledOnce();
    });

    it('should call with code for the first request', function(done) {
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
});