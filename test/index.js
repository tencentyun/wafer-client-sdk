'use strict';

const should = require('should');
const sinon = require('sinon');
require('should-sinon');

require('./helpers/setupFakeWxAPI')();

const constants = require('../lib/constants');
const login = require('../lib/login');
const request = require('../lib/request');
const qcloud = require('../index');

describe('index.js', function () {
    describe('module: qcloud', function () {
        it('should export login() method', function () {
            qcloud.login.should.be.a.Function();
            qcloud.login.should.be.equal(login.login);
        });

        it('should export setLoginUrl() method', function () {
            qcloud.setLoginUrl.should.be.a.Function();
            qcloud.setLoginUrl.should.be.equal(login.setLoginUrl);
        });

        it('should export LoginError class', function () {
            qcloud.LoginError.should.be.a.Function();
            qcloud.LoginError.should.be.equal(login.LoginError);
        });

        it('should export request() method', function () {
            qcloud.request.should.be.a.Function();
            qcloud.request.should.be.equal(request.request);
        });

        it('should export RequestError class', function () {
            qcloud.RequestError.should.be.a.Function();
            qcloud.RequestError.should.be.equal(request.RequestError);
        });

        it('should export all error types', function () {
            Object.keys(constants)
                .filter(key => {
                    return key.indexOf('ERR_') === 0;
                })
                .forEach(key => {
                    qcloud[key].should.be.equal(constants[key]);
                });
        });
    });
});