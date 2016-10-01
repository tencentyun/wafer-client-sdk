/** 
 * 工具：超时自动失败 
 */
function limitTimeout(fn, timeout) {
    return function(callback) {
        var hasTimeouted = false;
        var timerId = 0;
        fn(function() {
            if (hasTimeouted) return;
            clearTimeout(timerId);
            callback.apply(null, arguments);
        });
        timerId = setTimeout(function() {
            hasTimeouted = true;
            callback(new Error('timeout calling ' + fn.name));
        }, timeout);
    };
}

/**
 * 拓展对象
 */
function extend(target) {
    var sources = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < sources.length; i++) {
        var source = sources[i];
        for(var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key];
            }
        }
    }
    return target;
}


/**
 * 保证 fn 在回调之前不会执行第二遍，回调之后把所有注册的回调都调用一次
 */
function mutex(fn) {
    function wrapped() {
        var args = Array.prototype.slice.call(arguments);
        var callback = args.pop();
        if (!fn.callbacks) {
            fn.callbacks = [];
        }
        fn.callbacks.push(callback);
        if (fn.isBusy) {
            return;
        }
        fn.isBusy = true;
        var callbackAll = function() {
            var args = arguments;
            var callbacks = fn.callbacks;
            fn.isBusy = false;
            fn.callbacks = null;
            callbacks.forEach(function(callback) {
                callback.apply(null, args);
            });
        };
        fn.call(null, args.concat([callbackAll]));
    }
    return wrapped;
}

module.exports = {
    limitTimeout: limitTimeout,
    extend: extend,
    mutex: mutex
};