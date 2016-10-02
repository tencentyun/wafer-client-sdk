'use strict';

const should = require('should');
const sinon = require('sinon');
require('should-sinon');

const constants = require('../lib/constants');
const Session = require('../lib/session');

const setupFakeWxAPI = require('./helpers/setupFakeWxAPI');

describe('lib/session.js', function () {
    before(setupFakeWxAPI);

    describe('method: get(), set() and clear()', function () {
        it('should get value that set', function () {
            const myValue = 'test_value';
            Session.set(myValue);
            Session.get(myValue).should.be.equal(myValue);
        });

        it('should get null after clear', function () {
            const myValue = 'test_value';
            Session.set(myValue);
            Session.clear();
            should.not.exist(Session.get(myValue));
        });
    });
});