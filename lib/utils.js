var exports = module.exports = {};

/**
 * 超时自动失败
 */
exports.limitTimeout = function limitTimeout(fn, timeout) {

    return function (/* ...args, callback */) {
        var args = Array.prototype.slice.call(arguments);
        var callback = args.pop();

        var hasTimeouted = false;
        var timerId = 0;
        var msecs = timeout();

        fn.apply(null, args.concat(function () {
            if (hasTimeouted) return;
            clearTimeout(timerId);
            callback.apply(null, arguments);
        }));

        timerId = setTimeout(function () {
            hasTimeouted = true;
            callback({ timeout: true }, null);
        }, msecs);
    };
};

/**
 * 拓展对象
 */
exports.extend = function extend(target) {
    var sources = Array.prototype.slice.call(arguments, 1);

    for (var i = 0; i < sources.length; i += 1) {
        var source = sources[i];
        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key];
            }
        }
    }

    return target;
};


/**
 * 保证 fn 在回调之前不会执行第二遍，回调之后把所有注册的回调都调用一次
 */
exports.mutex = function mutex(fn) {
    var pending = false;
    var callbacks = [];

    return function (/* ...args, callback */) {
        var args = Array.prototype.slice.call(arguments);

        // 回调放置到队列中
        callbacks.push(args.pop()/* callback */);

        if (pending) return;
        pending = true;

        var callbackAll = function () {
            var args = arguments;
            var workingCallbacks = callbacks;

            pending = false;
            callbacks = [];

            workingCallbacks.forEach(function (callback) {
                callback.apply(null, args);
            });
        };

        fn.apply(null, args.concat([callbackAll]));
    };
};