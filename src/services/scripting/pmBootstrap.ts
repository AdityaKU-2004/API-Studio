/**
 * JavaScript bootstrap evaluated inside the isolated QuickJS WASM context before user scripts.
 * Provides Postman-compatible `pm` API, Chai-like `pm.expect`, and `console` forwarding.
 * Never executes outside QuickJS.
 */
export const PM_BOOTSTRAP_CODE = `
(function (global) {
  function safeFormat(args) {
    var parts = [];
    for (var i = 0; i < args.length; i++) {
      var val = args[i];
      if (val === null) parts.push('null');
      else if (val === undefined) parts.push('undefined');
      else if (typeof val === 'string') parts.push(val);
      else if (typeof val === 'number' || typeof val === 'boolean') parts.push(String(val));
      else {
        try {
          parts.push(JSON.stringify(val));
        } catch (e) {
          parts.push('[Object]');
        }
      }
    }
    return parts.join(' ');
  }

  global.console = {
    log: function () { __hostLog('log', safeFormat(arguments)); },
    info: function () { __hostLog('info', safeFormat(arguments)); },
    warn: function () { __hostLog('warn', safeFormat(arguments)); },
    error: function () { __hostLog('error', safeFormat(arguments)); }
  };

  var __ctx = __hostGetContext();
  var __envVars = Object.assign({}, __ctx.environmentVariables || {});
  var __colVars = Object.assign({}, __ctx.collectionVariables || {});
  var __globalVars = Object.assign({}, __ctx.globalVariables || {});
  var __localVars = Object.assign({}, __ctx.localVariables || {});
  var __iterData = Object.assign({}, __ctx.iterationData || {});

  function deepEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
      return Number.isNaN(a) && Number.isNaN(b);
    }
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    var keysA = Object.keys(a);
    var keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (var i = 0; i < keysA.length; i++) {
      var k = keysA[i];
      if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
      if (!deepEqual(a[k], b[k])) return false;
    }
    return true;
  }

  function safeStr(v) {
    if (typeof v === 'string') return JSON.stringify(v);
    if (v === undefined) return 'undefined';
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }

  function AssertionError(message, expected, actual) {
    var err = new Error(message);
    err.name = 'AssertionError';
    if (expected !== undefined) err.expected = typeof expected === 'string' ? expected : safeStr(expected);
    if (actual !== undefined) err.actual = typeof actual === 'string' ? actual : safeStr(actual);
    return err;
  }

  function createExpect(actual) {
    var negated = false;
    var isDeep = false;

    function assert(cond, posMsg, negMsg, expected, actualVal) {
      var ok = negated ? !cond : Boolean(cond);
      if (!ok) {
        throw AssertionError(negated ? negMsg : posMsg, expected, actualVal !== undefined ? actualVal : actual);
      }
    }

    var api = {};
    var chainWords = ['to', 'be', 'been', 'is', 'that', 'which', 'and', 'has', 'have', 'with', 'at', 'of', 'same'];
    for (var i = 0; i < chainWords.length; i++) {
      (function (word) {
        Object.defineProperty(api, word, {
          get: function () { return api; }
        });
      })(chainWords[i]);
    }

    Object.defineProperty(api, 'not', {
      get: function () {
        negated = !negated;
        return api;
      }
    });

    Object.defineProperty(api, 'deep', {
      get: function () {
        isDeep = true;
        return api;
      }
    });

    Object.defineProperty(api, 'exist', {
      get: function () {
        var cond = actual !== null && actual !== undefined;
        assert(cond, 'Expected ' + safeStr(actual) + ' to exist', 'Expected ' + safeStr(actual) + ' not to exist', 'defined & non-null', actual);
        return api;
      }
    });

    Object.defineProperty(api, 'true', {
      get: function () {
        assert(actual === true, 'Expected ' + safeStr(actual) + ' to be true', 'Expected value not to be true', true, actual);
        return api;
      }
    });

    Object.defineProperty(api, 'false', {
      get: function () {
        assert(actual === false, 'Expected ' + safeStr(actual) + ' to be false', 'Expected value not to be false', false, actual);
        return api;
      }
    });

    Object.defineProperty(api, 'null', {
      get: function () {
        assert(actual === null, 'Expected ' + safeStr(actual) + ' to be null', 'Expected value not to be null', null, actual);
        return api;
      }
    });

    Object.defineProperty(api, 'undefined', {
      get: function () {
        assert(actual === undefined, 'Expected ' + safeStr(actual) + ' to be undefined', 'Expected value not to be undefined', undefined, actual);
        return api;
      }
    });

    Object.defineProperty(api, 'ok', {
      get: function () {
        assert(Boolean(actual), 'Expected ' + safeStr(actual) + ' to be truthy', 'Expected ' + safeStr(actual) + ' to be falsy', 'truthy', actual);
        return api;
      }
    });

    Object.defineProperty(api, 'empty', {
      get: function () {
        var isEmpty = false;
        if (typeof actual === 'string' || Array.isArray(actual)) isEmpty = actual.length === 0;
        else if (actual && typeof actual === 'object') isEmpty = Object.keys(actual).length === 0;
        assert(isEmpty, 'Expected ' + safeStr(actual) + ' to be empty', 'Expected ' + safeStr(actual) + ' not to be empty', 'empty', actual);
        return api;
      }
    });

    function checkEqual(expected, forceDeep) {
      var eq = (forceDeep || isDeep) ? deepEqual(actual, expected) : actual === expected;
      assert(eq, 'Expected ' + safeStr(actual) + ' to equal ' + safeStr(expected), 'Expected ' + safeStr(actual) + ' not to equal ' + safeStr(expected), expected, actual);
      return api;
    }

    api.equal = function (expected) { return checkEqual(expected, false); };
    api.equals = api.equal;
    api.eq = api.equal;
    api.eql = function (expected) { return checkEqual(expected, true); };

    function checkType(typeName) {
      var expectedType = String(typeName).toLowerCase();
      var actualType;
      if (actual === null) actualType = 'null';
      else if (Array.isArray(actual)) actualType = 'array';
      else actualType = typeof actual;
      assert(actualType === expectedType, 'Expected ' + safeStr(actual) + ' to be a(n) ' + expectedType + ' but got ' + actualType, 'Expected ' + safeStr(actual) + ' not to be a(n) ' + expectedType, expectedType, actualType);
      return api;
    }
    api.a = checkType;
    api.an = checkType;

    api.include = function (subset) {
      var found = false;
      if (typeof actual === 'string') {
        found = actual.indexOf(String(subset)) !== -1;
      } else if (Array.isArray(actual)) {
        for (var i = 0; i < actual.length; i++) {
          if (isDeep ? deepEqual(actual[i], subset) : actual[i] === subset) {
            found = true;
            break;
          }
        }
      } else if (actual && typeof actual === 'object' && subset && typeof subset === 'object') {
        found = true;
        var keys = Object.keys(subset);
        for (var k = 0; k < keys.length; k++) {
          var key = keys[k];
          if (!(key in actual) || (isDeep ? !deepEqual(actual[key], subset[key]) : actual[key] !== subset[key])) {
            found = false;
            break;
          }
        }
      }
      assert(found, 'Expected ' + safeStr(actual) + ' to include ' + safeStr(subset), 'Expected ' + safeStr(actual) + ' not to include ' + safeStr(subset), subset, actual);
      return api;
    };
    api.includes = api.include;
    api.contain = api.include;
    api.contains = api.include;

    api.property = function (prop, val) {
      var hasProp = actual !== null && actual !== undefined && typeof actual === 'object' && (prop in actual);
      if (arguments.length === 1) {
        assert(hasProp, 'Expected object to have property "' + prop + '"', 'Expected object not to have property "' + prop + '"', prop, actual ? Object.keys(actual) : actual);
      } else {
        var match = hasProp && (isDeep ? deepEqual(actual[prop], val) : actual[prop] === val);
        assert(match, 'Expected property "' + prop + '" to equal ' + safeStr(val) + ' but got ' + safeStr(hasProp ? actual[prop] : undefined), 'Expected property "' + prop + '" not to equal ' + safeStr(val), val, hasProp ? actual[prop] : undefined);
      }
      return api;
    };

    api.lengthOf = function (n) {
      var len = actual && typeof actual.length === 'number' ? actual.length : undefined;
      assert(len === n, 'Expected length ' + len + ' to equal ' + n, 'Expected length not to equal ' + n, n, len);
      return api;
    };
    api.length = api.lengthOf;

    api.above = function (n) {
      assert(typeof actual === 'number' && actual > n, 'Expected ' + actual + ' to be above ' + n, 'Expected ' + actual + ' not to be above ' + n, '> ' + n, actual);
      return api;
    };
    api.gt = api.above;
    api.greaterThan = api.above;

    api.below = function (n) {
      assert(typeof actual === 'number' && actual < n, 'Expected ' + actual + ' to be below ' + n, 'Expected ' + actual + ' not to be below ' + n, '< ' + n, actual);
      return api;
    };
    api.lt = api.below;
    api.lessThan = api.below;

    api.least = function (n) {
      assert(typeof actual === 'number' && actual >= n, 'Expected ' + actual + ' to be at least ' + n, 'Expected ' + actual + ' not to be at least ' + n, '>= ' + n, actual);
      return api;
    };
    api.gte = api.least;

    api.most = function (n) {
      assert(typeof actual === 'number' && actual <= n, 'Expected ' + actual + ' to be at most ' + n, 'Expected ' + actual + ' not to be at most ' + n, '<= ' + n, actual);
      return api;
    };
    api.lte = api.most;

    api.within = function (min, max) {
      assert(typeof actual === 'number' && actual >= min && actual <= max, 'Expected ' + actual + ' to be within [' + min + ', ' + max + ']', 'Expected ' + actual + ' not to be within [' + min + ', ' + max + ']', min + '..' + max, actual);
      return api;
    };

    api.match = function (re) {
      var regex = re instanceof RegExp ? re : new RegExp(re);
      var cond = typeof actual === 'string' && regex.test(actual);
      assert(cond, 'Expected ' + safeStr(actual) + ' to match ' + String(regex), 'Expected ' + safeStr(actual) + ' not to match ' + String(regex), String(regex), actual);
      return api;
    };

    api.oneOf = function (list) {
      var found = Array.isArray(list) && list.indexOf(actual) !== -1;
      assert(found, 'Expected ' + safeStr(actual) + ' to be one of ' + safeStr(list), 'Expected ' + safeStr(actual) + ' not to be one of ' + safeStr(list), list, actual);
      return api;
    };

    api.throw = function (errSubstr) {
      var threw = false;
      var caughtMsg = '';
      try {
        if (typeof actual === 'function') actual();
      } catch (e) {
        threw = true;
        caughtMsg = e && e.message ? String(e.message) : String(e);
      }
      var ok = threw && (errSubstr === undefined || caughtMsg.indexOf(String(errSubstr)) !== -1);
      assert(ok, 'Expected function to throw' + (errSubstr ? ' matching ' + safeStr(errSubstr) : ''), 'Expected function not to throw', errSubstr || 'error', threw ? caughtMsg : 'no error');
      return api;
    };

    return api;
  }

  function makeScopeStore(scopeName, backingMap) {
    return {
      get: function (key) {
        return Object.prototype.hasOwnProperty.call(backingMap, key) ? backingMap[key] : undefined;
      },
      set: function (key, value) {
        var k = String(key);
        var v = value === undefined || value === null ? '' : String(value);
        backingMap[k] = v;
        __hostVarOp(scopeName, 'set', k, v);
      },
      unset: function (key) {
        var k = String(key);
        delete backingMap[k];
        __hostVarOp(scopeName, 'unset', k, null);
      },
      has: function (key) {
        return Object.prototype.hasOwnProperty.call(backingMap, key);
      },
      toObject: function () {
        return Object.assign({}, backingMap);
      }
    };
  }

  function resolveEffectiveVar(key) {
    if (Object.prototype.hasOwnProperty.call(__localVars, key)) return __localVars[key];
    if (Object.prototype.hasOwnProperty.call(__iterData, key)) return __iterData[key];
    if (Object.prototype.hasOwnProperty.call(__envVars, key)) return __envVars[key];
    if (Object.prototype.hasOwnProperty.call(__colVars, key)) return __colVars[key];
    if (Object.prototype.hasOwnProperty.call(__globalVars, key)) return __globalVars[key];
    return undefined;
  }

  var respData = __ctx.response;
  var respHeaders = respData ? Object.assign({}, respData.headers || {}) : {};
  var parsedJsonCache = null;
  var parsedJsonDone = false;

  var pmResponse = respData ? {
    code: respData.code,
    status: respData.status,
    responseTime: respData.responseTime,
    headers: Object.assign({
      get: function (name) {
        var lower = String(name).toLowerCase();
        var keys = Object.keys(respHeaders);
        for (var i = 0; i < keys.length; i++) {
          if (keys[i].toLowerCase() === lower) return respHeaders[keys[i]];
        }
        return undefined;
      },
      has: function (name) {
        var lower = String(name).toLowerCase();
        return Object.keys(respHeaders).some(function (k) { return k.toLowerCase() === lower; });
      }
    }, respHeaders),
    text: function () {
      return respData.body || '';
    },
    json: function () {
      if (!parsedJsonDone) {
        parsedJsonCache = JSON.parse(respData.body || '');
        parsedJsonDone = true;
      }
      return parsedJsonCache;
    },
    to: {
      have: {
        status: function (expected) {
          if (typeof expected === 'number') {
            if (respData.code !== expected) {
              throw AssertionError('Expected response status code ' + expected + ' but received ' + respData.code + ' ' + respData.status, expected, respData.code);
            }
          } else {
            if (String(respData.status).toLowerCase() !== String(expected).toLowerCase()) {
              throw AssertionError('Expected response status "' + expected + '" but received "' + respData.status + '"', expected, respData.status);
            }
          }
        },
        header: function (headerName, expectedValue) {
          var lower = String(headerName).toLowerCase();
          var matchedKey = null;
          var keys = Object.keys(respHeaders);
          for (var i = 0; i < keys.length; i++) {
            if (keys[i].toLowerCase() === lower) {
              matchedKey = keys[i];
              break;
            }
          }
          if (!matchedKey) {
            throw AssertionError('Expected response to have header "' + headerName + '"', headerName, Object.keys(respHeaders));
          }
          if (expectedValue !== undefined && String(respHeaders[matchedKey]) !== String(expectedValue)) {
            throw AssertionError('Expected header "' + headerName + '" to equal ' + safeStr(expectedValue) + ' but got ' + safeStr(respHeaders[matchedKey]), expectedValue, respHeaders[matchedKey]);
          }
        }
      },
      be: {
        get ok() {
          if (respData.code < 200 || respData.code >= 400) {
            throw AssertionError('Expected response to be ok (2xx/3xx) but received ' + respData.code, '2xx/3xx', respData.code);
          }
          return true;
        },
        get success() {
          if (respData.code < 200 || respData.code >= 300) {
            throw AssertionError('Expected response status to be 2xx but received ' + respData.code, '2xx', respData.code);
          }
          return true;
        },
        get json() {
          try {
            JSON.parse(respData.body || '');
          } catch (e) {
            throw AssertionError('Expected response body to be valid JSON', 'Valid JSON', 'Invalid JSON');
          }
          return true;
        }
      }
    }
  } : undefined;

  var reqData = __ctx.request || {};

  global.pm = {
    info: {
      eventName: __ctx.stage === 'pre-request' ? 'prerequest' : 'test',
      requestName: reqData.name || '',
      requestId: reqData.id || ''
    },
    request: {
      id: reqData.id || '',
      name: reqData.name || '',
      method: reqData.method || 'GET',
      url: reqData.url || '',
      headers: Object.assign({}, reqData.headers || {}),
      queryParams: Object.assign({}, reqData.queryParams || {}),
      body: reqData.body || ''
    },
    response: pmResponse,
    environment: makeScopeStore('environment', __envVars),
    collectionVariables: makeScopeStore('collectionVariables', __colVars),
    globals: makeScopeStore('globals', __globalVars),
    variables: {
      get: resolveEffectiveVar,
      has: function (key) { return resolveEffectiveVar(key) !== undefined; },
      set: function (key, val) {
        var k = String(key);
        var v = val === undefined || val === null ? '' : String(val);
        __localVars[k] = v;
        __hostVarOp('variables', 'set', k, v);
      },
      unset: function (key) {
        var k = String(key);
        delete __localVars[k];
        __hostVarOp('variables', 'unset', k, null);
      },
      replaceIn: function (tpl) {
        return String(tpl || '').replace(/\\{\\{([^}]+)\\}\\}/g, function (full, name) {
          var resolved = resolveEffectiveVar(String(name).trim());
          return resolved !== undefined ? String(resolved) : full;
        });
      },
      toObject: function () {
        return Object.assign({}, __globalVars, __colVars, __envVars, __iterData, __localVars);
      }
    },
    iterationData: {
      get: function (key) {
        return Object.prototype.hasOwnProperty.call(__iterData, key) ? __iterData[key] : undefined;
      },
      has: function (key) {
        return Object.prototype.hasOwnProperty.call(__iterData, key);
      },
      toObject: function () {
        return Object.assign({}, __iterData);
      }
    },
    expect: createExpect,
    test: function (name, fn) {
      var testName = String(name || 'Unnamed Test');
      var tStart = Date.now();
      try {
        fn();
        __hostRecordTest(testName, true, null, null, null, Math.max(0, Date.now() - tStart));
      } catch (err) {
        var msg = err && err.message ? String(err.message) : String(err);
        var exp = err && err.expected !== undefined ? String(err.expected) : null;
        var act = err && err.actual !== undefined ? String(err.actual) : null;
        __hostRecordTest(testName, false, msg, exp, act, Math.max(0, Date.now() - tStart));
      }
    }
  };
})(globalThis);
`;
