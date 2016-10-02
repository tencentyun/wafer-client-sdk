'use strict';

const should = require('should');
const sinon = require('sinon');
require('should-sinon');

const { extend } = require('../lib/utils');

describe('lib/utils.js', function () {
    describe('method: extend()', function () {
        it('should ignore properties from prototype', function () {
            const a = {};
            const b = Object.create({
                foo: 1,
            });
            b.bar = 2;

            extend(a, b);

            a.bar.should.be.equal(2);
            a.should.not.has.property('foo');
        });
    });
});