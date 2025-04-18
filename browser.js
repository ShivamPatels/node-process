const { isFunction, safeCall, noop, isString, isObject } = require("utils-core");

// shim for using process in browser
const process = (module.exports = {});

// Timer management with utils-core safety
const { cachedSetTimeout, cachedClearTimeout } = (() => {
  const defaults = {
    setTimeout: () => {
      throw new Error("setTimeout has not been defined");
    },
    clearTimeout: () => {
      throw new Error("clearTimeout has not been defined");
    },
  };

  return {
    cachedSetTimeout: safeCall(
      () => (isFunction(setTimeout) ? setTimeout : defaults.setTimeout),
      defaults.setTimeout
    ),
    cachedClearTimeout: safeCall(
      () => (isFunction(clearTimeout) ? clearTimeout : defaults.clearTimeout),
      defaults.clearTimeout
    ),
  };
})();

function runTimeout(fn) {
  if (cachedSetTimeout === setTimeout) {
    return setTimeout(fn, 0);
  }

  if (
    (cachedSetTimeout === defaults.setTimeout || !cachedSetTimeout) &&
    setTimeout
  ) {
    cachedSetTimeout = setTimeout;
    return setTimeout(fn, 0);
  }

  return safeCall(
    () => cachedSetTimeout(fn, 0),
    () =>
      safeCall(
        () => cachedSetTimeout.call(null, fn, 0),
        () => cachedSetTimeout.call(this, fn, 0)
      )
  );
}

function runClearTimeout(marker) {
  if (cachedClearTimeout === clearTimeout) {
    return clearTimeout(marker);
  }

  if (
    (cachedClearTimeout === defaults.clearTimeout || !cachedClearTimeout) &&
    clearTimeout
  ) {
    cachedClearTimeout = clearTimeout;
    return clearTimeout(marker);
  }

  return safeCall(
    () => cachedClearTimeout(marker),
    () =>
      safeCall(
        () => cachedClearTimeout.call(null, marker),
        () => cachedClearTimeout.call(this, marker)
      )
  );
}

// Queue management
const queue = [];
let draining = false;
let currentQueue;
let queueIndex = -1;

function cleanUpNextTick() {
  if (!draining || !currentQueue) return;

  draining = false;
  queueIndex = -1;

  if (currentQueue.length) {
    queue.unshift(...currentQueue);
  }

  if (queue.length) {
    drainQueue();
  }
}

function drainQueue() {
  if (draining) return;

  const timeout = runTimeout(cleanUpNextTick);
  draining = true;

  while (queue.length) {
    currentQueue = queue;
    queue.length = 0;

    for (queueIndex = 0; queueIndex < currentQueue.length; queueIndex++) {
      currentQueue[queueIndex].run();
    }
  }

  currentQueue = null;
  draining = false;
  runClearTimeout(timeout);
}

process.nextTick = function (fn, ...args) {
  if (!isFunction(fn)) {
    throw new TypeError("Callback must be a function");
  }

  queue.push(new QueueItem(fn, args));

  if (queue.length === 1 && !draining) {
    runTimeout(drainQueue);
  }
};

class QueueItem {
  constructor(fn, args) {
    this.fn = fn;
    this.args = args || [];
  }

  run() {
    this.fn(...this.args);
  }
}

if (!isObject(process)) {
  throw new Error("Process shim initialization failed");
}
// Process properties
process.title = "browser";
process.browser = true;
process.env = {};
process.argv = [];
process.version = "";
process.versions = {};
process.release = { name: "browser" };
process.config = {};

// Complete EventEmitter API stubbing
process._events = undefined;
process._eventsCount = 0;
process._maxListeners = undefined;

// EventEmitter methods
process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = (name) => [];
process.listenerCount = (name) => 0;
process.eventNames = () => [];
process.getMaxListeners = () => 0;
process.setMaxListeners = (n) => process;

// Warning emission
process.emitWarning = (warning, options) => {
  if (isString(warning)) {
    warning = new Error(warning);
    warning.name = options?.type || "Warning";
    if (options?.code) warning.code = options.code;
    if (options?.detail) warning.detail = options.detail;
  }

  if (typeof console !== "undefined") {
    if (isFunction(console.warn)) {
      console.warn(warning);
    } else if (isFunction(console.error)) {
      console.error(warning);
    }
  }
  return warning;
};

// Process-specific methods
process.binding = (name) => {
  throw new Error("process.binding is not supported");
};

process.cwd = () => "/";
process.chdir = (dir) => {
  throw new Error("process.chdir is not supported");
};

process.umask = () => 0;

// Node.js 10+ features
process.hasUncaughtExceptionCaptureCallback = () => false;
process.setUncaughtExceptionCaptureCallback = noop;
process.enableSourceMaps = noop;

// Process I/O
process.stdout = {
  write:
    typeof console !== "undefined" && console.log
      ? console.log.bind(console)
      : noop,
  isTTY: false,
};

process.stderr = {
  write:
    typeof console !== "undefined" && console.error
      ? console.error.bind(console)
      : noop,
  isTTY: false,
};

process.stdin = {
  resume: noop,
  pause: noop,
  on: noop,
  isTTY: false,
};

// Process exit handling
process.exitCode = 0;
process.exit = (code) => {
  process.exitCode = code || 0;
  throw new Error(`Process terminated with exit code ${process.exitCode}`);
};

// Process hrtime polyfill
if (typeof performance !== "undefined" && performance.now) {
  const startTime = performance.now();
  process.hrtime = () => {
    const diff = performance.now() - startTime;
    const seconds = Math.floor(diff / 1000);
    const nanoseconds = Math.floor((diff % 1000) * 1e6);
    return [seconds, nanoseconds];
  };
} else {
  process.hrtime = () => [0, 0];
}
