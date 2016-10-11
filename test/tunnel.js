'use strict';

const should = require('should');
const sinon = require('sinon');
require('should-sinon');
const tunnel = require('../lib/tunnel.js')

describe("lib/tunnel.js", function() {
    tunnel.open({
        serviceUrl: "https://www.qcloud.la/tunnel",
        login: true,
        success: function() {
            tunnel.on('hi', function() {
                tunnel.close();
            });
            tunnel.emit('hello', { name: 'techird' });
        },
        fail: function() {
            
        }
    })
});