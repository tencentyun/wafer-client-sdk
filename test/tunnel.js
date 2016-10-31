'use strict';

const should = require('should');
const sinon = require('sinon');
require('should-sinon');

const setupFakeWxAPI = require('./helpers/setupFakeWxAPI');
const requestLib = require('../lib/request');
const wxTunnel = require('../lib/wxTunnel');

// 信道服务模块使用了闭包变量记录模块状态，测试时不能依赖 require 缓存
const require_tunnel_module = (() => {
    const TUNNEL_MODULE_ABSPATH = require.resolve('../lib/tunnel');

    return () => {
        delete require.cache[TUNNEL_MODULE_ABSPATH];
        return require(TUNNEL_MODULE_ABSPATH);
    };
})();

describe('lib/tunnel.js', function () {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms || 0));
    const defer = () => delay(0);

    const wx = global.wx = global.wx || {};
    const simuteCloseSocket = () => wx.onSocketClose();
    const simuteServerPostMessage = result => wx.onSocketMessage(result);
    const simuteIssueError = error => wx.onSocketError(error);

    const serverUrl = 'https://www.qcloud.la/tunnel';
    const respond200WithUrl = {
        'statusCode': 200,
        'data': {
            'url': 'wss://ws.qcloud.com/ws/tunnel1'
        }
    };

    before(setupFakeWxAPI);

    before(function () {
        let onOpen, onClose, onMessage, onError;

        sinon.stub(wxTunnel, 'listen', function (listener) {
            onOpen = listener.onOpen;
            onClose = listener.onClose;
            onMessage = listener.onMessage;
            onError = listener.onError;
        });

        sinon.stub(wx, 'connectSocket', () => wx.onSocketOpen());

        sinon.stub(wx, 'onSocketOpen', result => onOpen(result));
        sinon.stub(wx, 'onSocketClose', result => onClose(result));
        sinon.stub(wx, 'onSocketMessage', result => onMessage(result));
        sinon.stub(wx, 'onSocketError', result => onError(result));
    });

    after(function () {
        wxTunnel.listen.restore();

        wx.connectSocket.restore();

        wx.onSocketOpen.restore();
        wx.onSocketClose.restore();
        wx.onSocketMessage.restore();
        wx.onSocketError.restore();
    });

    let Tunnel;
    beforeEach(function () {
       Tunnel = require_tunnel_module();
       sinon.spy(wx, 'sendSocketMessage');
    });

    afterEach(function () {
        requestLib.request.restore && requestLib.request.restore();
        wx.sendSocketMessage.restore();
    });

    it('should initialize with `CLOSED` status for instanciated Tunnel', function () {
        const tunnel = new Tunnel(serverUrl);
        tunnel.isClosed().should.be.True();
    });

    it('should transition to `CONNECTING` status when connection opened', function () {
        const tunnel = new Tunnel(serverUrl);
        tunnel.open();
        tunnel.isConnecting().should.be.True();
    });

    it('should only react to opening connecton', function () {
        const tunnel = new Tunnel(serverUrl);
        tunnel.open();
        tunnel.open();
        tunnel.isConnecting().should.be.True();
    });

    it('should throw an error when instanciate another Tunnel if non-closed tunnel exists', function () {
        const tunnel = new Tunnel(serverUrl);
        tunnel.open();

        should.throws(function () {
            new Tunnel(serverUrl);
        });
    });

    it('should transition to `ACTIVE` status when connection established', function (done) {
        sinon.stub(requestLib, 'request', options => defer().then(() => {
            options.success(respond200WithUrl);
            options.complete();
        }));

        const tunnel = new Tunnel(serverUrl);

        const connectCallback = sinon.spy();
        tunnel.on('connect', connectCallback);
        tunnel.on('connect', 'pointless');
        tunnel.open();

        defer()
        .then(() => {
            tunnel.isActive().should.be.True();
            connectCallback.should.be.calledOnce();
        })
        .then(done, done);
    });

    it('should transition to `CLOSED` status when connection closed', function (done) {
        sinon.stub(requestLib, 'request', options => defer().then(() => {
            options.success(respond200WithUrl);
            options.complete();
        }));

        const tunnel = new Tunnel(serverUrl);

        const connectCallback = sinon.spy();
        tunnel.on('connect', connectCallback);

        const closeCallback = sinon.spy();
        tunnel.on('close', closeCallback);

        tunnel.open();

        defer()
        .then(() => {
            tunnel.close();
            tunnel.isClosed().should.be.True();

            connectCallback.should.be.calledOnce();
            closeCallback.should.be.calledOnce();
        })
        .then(done, done);
    });

    it('should transition to `RECONNECTING` and `ACTIVE` status when connection closed unexpected', function (done) {
        Tunnel.RECONNECT_TIME_INCREASE = 1;

        sinon.stub(requestLib, 'request', options => defer().then(() => {
            options.success(respond200WithUrl);
            options.complete();
        }));

        const tunnel = new Tunnel(serverUrl);

        const reconnectingCallback = sinon.spy();
        tunnel.on('reconnecting', reconnectingCallback);

        const reconnectCallback = sinon.spy();
        tunnel.on('reconnect', reconnectCallback);

        tunnel.open();

        defer()
        .then(() => simuteCloseSocket())
        .then(() => {
            tunnel.isReconnecting().should.be.True();
        })
        .then(() => delay(10).then(() => {
            reconnectingCallback.should.be.calledOnce();
            reconnectCallback.should.be.calledOnce();
            tunnel.isActive().should.be.True();
        }))
        .then(done, done);
    });

    it('should not transition to `RECONNECTING` status when connection closed normally', function (done) {
        sinon.stub(requestLib, 'request', options => defer().then(() => {
            options.success(respond200WithUrl);
            options.complete();
        }));

        const tunnel = new Tunnel(serverUrl);
        tunnel.open();

        defer()
        .then(() => {
            tunnel.close();
            tunnel.isClosed().should.be.True();
        })
        .then(done, done);
    });

    it('should not reconnect if connect opened with 500 for the first time', function (done) {
        sinon.stub(requestLib, 'request', options => defer().then(() => {
            options.success({ 'statusCode': 500 });
            options.complete();
        }));

        const tunnel = new Tunnel(serverUrl);

        const errorCallback = sinon.spy();
        tunnel.on('error', errorCallback);
        tunnel.open();

        defer()
        .then(() => {
            errorCallback.should.be.calledOnce();
            errorCallback.should.be.calledWithMatch({ code: Tunnel.ERR_CONNECT_SERVICE });

            tunnel.isClosed().should.be.True();
        })
        .then(done, done);
    });

    it('should not reconnect if connect opened failed for the first time', function (done) {
        sinon.stub(requestLib, 'request', options => defer().then(() => {
            options.fail();
            options.complete();
        }));

        const tunnel = new Tunnel(serverUrl);

        const errorCallback = sinon.spy();
        tunnel.on('error', errorCallback);
        tunnel.open();

        defer()
        .then(() => {
            errorCallback.should.be.calledOnce();
            errorCallback.should.be.calledWithMatch({ code: Tunnel.ERR_CONNECT_SERVICE });

            tunnel.isClosed().should.be.True();
        })
        .then(done, done);
    });

    it('should transition to `CLOSED` status if reconnect times exceed max rety times', function (done) {
        Tunnel.MAX_RECONNECT_TRY_TIMES = 2;
        Tunnel.RECONNECT_TIME_INCREASE = 1;

        let isFirstCalled = true;
        sinon.stub(requestLib, 'request', options => defer().then(() => {
            if (isFirstCalled) {
                isFirstCalled = false;

                options.success(respond200WithUrl);
            } else {
                options.fail();
            }

            options.complete();
        }));

        const tunnel = new Tunnel(serverUrl);

        const connectCallback = sinon.spy();
        tunnel.on('connect', connectCallback);

        const closeCallback = sinon.spy();
        tunnel.on('close', closeCallback);

        const reconnectingCallback = sinon.spy();
        tunnel.on('reconnecting', reconnectingCallback);

        const reconnectCallback = sinon.spy();
        tunnel.on('reconnect', reconnectCallback);

        const errorCallback = sinon.spy();
        tunnel.on('error', errorCallback);

        const universalCallback = sinon.spy();
        tunnel.on('*', universalCallback);

        tunnel.open();

        defer()
        .then(() => simuteCloseSocket())
        .then(() => delay(10).then(() => {
            connectCallback.should.be.calledOnce();
            closeCallback.should.be.calledOnce();

            reconnectingCallback.should.be.calledTwice();
            reconnectCallback.should.have.callCount(0);

            errorCallback.should.be.calledOnce();
            errorCallback.should.be.calledWithMatch({ code: Tunnel.ERR_RECONNECT });

            universalCallback.should.have.callCount(5);
            universalCallback.should.be.calledWith('connect');
            universalCallback.should.be.calledWith('close');
            universalCallback.should.be.calledWith('reconnecting');
            universalCallback.should.be.calledWith('error');
            universalCallback.should.not.be.calledWith('reconnect');

            tunnel.isClosed().should.be.True();
        }))
        .then(done, done);
    });

    it('should emit normal message packet', function (done) {
        sinon.stub(requestLib, 'request', options => defer().then(() => {
            options.success(respond200WithUrl);
            options.complete();
        }));

        const tunnel = new Tunnel(serverUrl);
        tunnel.open();

        defer()
        .then(() => {
            tunnel.emit('hi', 'hello, everyone!');
            tunnel.emit('bye', 'bye, everyone!');

            wx.sendSocketMessage.should.have.callCount(2);

            wx.sendSocketMessage.should.be.calledWithMatch({
                data: 'message:{"type":"hi","content":"hello, everyone!"}'
            });

            wx.sendSocketMessage.should.be.calledWithMatch({
                data: 'message:{"type":"bye","content":"bye, everyone!"}'
            });
        })
        .then(done, done);
    });

    it('should emit queued message packet', function (done) {
        sinon.stub(requestLib, 'request', options => defer().then(() => {
            options.success(respond200WithUrl);
            options.complete();
        }));

        const tunnel = new Tunnel(serverUrl);

        tunnel.emit('hi', 'hello, everyone!');
        tunnel.emit('bye', 'bye, everyone!');

        tunnel.open();

        defer()
        .then(() => {
            wx.sendSocketMessage.should.have.callCount(2);

            wx.sendSocketMessage.should.be.calledWithMatch({
                data: 'message:{"type":"hi","content":"hello, everyone!"}'
            });

            wx.sendSocketMessage.should.be.calledWithMatch({
                data: 'message:{"type":"bye","content":"bye, everyone!"}'
            });
        })
        .then(done, done);
    });

    it('should emit normal and queued message packet', function (done) {
        sinon.stub(requestLib, 'request', options => defer().then(() => {
            options.success(respond200WithUrl);
            options.complete();
        }));

        const tunnel = new Tunnel(serverUrl);
        tunnel.emit('hi', 'hello, everyone!');
        tunnel.open();

        defer()
        .then(() => {
            tunnel.emit('bye', 'bye, everyone!');

            wx.sendSocketMessage.should.have.callCount(2);

            wx.sendSocketMessage.should.be.calledWithMatch({
                data: 'message:{"type":"hi","content":"hello, everyone!"}'
            });

            wx.sendSocketMessage.should.be.calledWithMatch({
                data: 'message:{"type":"bye","content":"bye, everyone!"}'
            });
        })
        .then(done, done);
    });

    it('should handle `message` packet', function (done) {
        sinon.stub(requestLib, 'request', options => defer().then(() => {
            options.success(respond200WithUrl);
            options.complete();
        }));

        const tunnel = new Tunnel(serverUrl);

        const hiCallback = sinon.spy();
        tunnel.on('hi', hiCallback);

        const universalCallback = sinon.spy();
        tunnel.on('*', universalCallback);

        tunnel.open();

        defer()
        .then(() => {
            simuteServerPostMessage({ data: 'message:{"type":"hi","content":"hello, everyone!"}' });
        })
        .then(() => {
            hiCallback.should.be.calledOnce();
            hiCallback.should.be.calledWithExactly('hello, everyone!');

            universalCallback.should.be.calledTwice();
            universalCallback.should.be.calledWith('connect');
            universalCallback.should.be.calledWithExactly('hi', 'hello, everyone!');
        })
        .then(done, done);
    });

    it('should handle preserved `message` packet', function (done) {
        sinon.stub(requestLib, 'request', options => defer().then(() => {
            options.success(respond200WithUrl);
            options.complete();
        }));

        const tunnel = new Tunnel(serverUrl);

        const closeCallback = sinon.spy();
        tunnel.on('close', closeCallback);

        const atCloseCallback = sinon.spy();
        tunnel.on('@close', atCloseCallback);

        const universalCallback = sinon.spy();
        tunnel.on('*', universalCallback);

        tunnel.open();

        defer()
        .then(() => {
            simuteServerPostMessage({ data: 'message:{"type":"close","content":"fake close message"}' });
        })
        .then(() => {
            closeCallback.should.have.callCount(0);

            atCloseCallback.should.be.calledOnce();
            atCloseCallback.should.be.calledWithExactly('fake close message');

            universalCallback.should.be.calledTwice();
            universalCallback.should.be.calledWith('connect');
            universalCallback.should.be.calledWithExactly('@close', 'fake close message');
        })
        .then(done, done);
    });

    it('should handle `pong` packet', function (done) {
        sinon.stub(requestLib, 'request', options => defer().then(() => {
            options.success(respond200WithUrl);
            options.complete();
        }));

        const tunnel = new Tunnel(serverUrl);
        tunnel.open();

        defer()
        .then(() => {
            simuteServerPostMessage({ data: 'pong' });
        })
        .then(done, done);
    });

    it('should handle `timeout` packet', function (done) {
        sinon.stub(requestLib, 'request', options => defer().then(() => {
            options.success(respond200WithUrl);
            options.complete();
        }));

        const tunnel = new Tunnel(serverUrl);
        tunnel.open();

        defer()
        .then(() => {
            simuteServerPostMessage({ data: 'timeout:0.01' });
        })
        .then(() => delay(20).then(() => {
            tunnel.isReconnecting().should.be.True();
        }))
        .then(done, done);
    });

    it('should handle `close` packet', function (done) {
        sinon.stub(requestLib, 'request', options => defer().then(() => {
            options.success(respond200WithUrl);
            options.complete();
        }));

        const tunnel = new Tunnel(serverUrl);
        tunnel.open();

        defer()
        .then(() => {
            simuteServerPostMessage({ data: 'close' });
        })
        .then(() => {
            tunnel.isClosed().should.be.True();
        })
        .then(done, done);
    });

    it('should handle `unknown` packet', function (done) {
        sinon.stub(requestLib, 'request', options => defer().then(() => {
            options.success(respond200WithUrl);
            options.complete();
        }));

        const tunnel = new Tunnel(serverUrl);
        tunnel.open();

        defer()
        .then(() => {
            simuteServerPostMessage({ data: 'whatever' });
        })
        .then(done, done);
    });

    it('should handle socket error', function (done) {
        wx.connectSocket.restore();
        sinon.stub(wx, 'connectSocket', () => simuteIssueError('something wrong happened'));

        sinon.stub(requestLib, 'request', options => defer().then(() => {
            options.success(respond200WithUrl);
            options.complete();
        }));

        const tunnel = new Tunnel(serverUrl);

        const errorCallback = sinon.spy();
        tunnel.on('error', errorCallback);

        const universalCallback = sinon.spy();
        tunnel.on('*', universalCallback);

        tunnel.open();

        defer()
        .then(() => {
            errorCallback.should.be.calledOnce();
            errorCallback.should.be.calledWithMatch({ code: Tunnel.ERR_SOCKET_ERROR
            });

            universalCallback.should.be.calledOnce();
            universalCallback.should.be.calledWith('error');
        })
        .then(done, done);
    });
});