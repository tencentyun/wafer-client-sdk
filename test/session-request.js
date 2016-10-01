'use strict';

const should = require('should');
const sinon = require('sinon');
require('should-sinon');
const request = require('../lib/session-request').request;

describe('Session Request', function() {
    let wx;
    beforeEach(function() {
        wx = global.wx = {
            login() {},
            request() {}
        };
    });

    it('should be a function', function() {
        should(request).be.a.Function();
    });

    it('should throw an error when no options passed', function() {
        should.throws(function() {
            request();
        })
    });

    it('should call login for the first request', function() {
        sinon.stub(wx, 'login');
        request({
            url: 'https://www.mydomain.com/ajax/action'
        });
        wx.login.should.be.calledOnce();
    });

    it('should call with code for the first request', function() {
        
    });
});