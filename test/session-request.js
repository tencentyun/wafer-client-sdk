var should = require('should');
var sinon = require('sinon');
require('should-sinon');
var request = require('../lib/session-request').request;

describe('Session Request', function() {
    it('should be a function', function() {
        should(request).be.a.Function();
    });
    it('should throw an error when no options passed', function() {
        should.throws(function() {
            request();
        })
    });
    it('should call login for the first request', function() {
        var wx = global.wx = {
            login() {},
            request() {}
        };
        sinon.stub(wx, 'login');
        sinon.stub(wx, 'request');
        request({
            url: 'https://www.mydomain.com/ajax/action'
        });
        wx.login.should.be.calledOnce();
    });
    it('should call with code for the first request', function() {

    });
});