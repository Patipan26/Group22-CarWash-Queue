const jwt = require('jsonwebtoken');

function loadRouter(routePath, pool) {
  const dbPath = require.resolve('../../src/db');
  const modulePath = require.resolve(routePath);
  const previousDb = require.cache[dbPath];
  delete require.cache[modulePath];
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: pool };
  try {
    return require(modulePath);
  } finally {
    if (previousDb) require.cache[dbPath] = previousDb;
    else delete require.cache[dbPath];
  }
}

function makeToken(user) {
  return jwt.sign(user, process.env.JWT_SECRET || 'development-secret');
}

function matchRoute(router, method, pathname) {
  const parts = pathname.split('/').filter(Boolean);
  const layer = router.stack.find((candidate) => {
    if (!candidate.route?.methods[method.toLowerCase()]) return false;
    const routeParts = String(candidate.route.path).split('/').filter(Boolean);
    return routeParts.length === parts.length && routeParts.every((part, index) => part.startsWith(':') || part === parts[index]);
  });
  if (!layer) throw new Error(`No route for ${method} ${pathname}`);
  const params = {};
  String(layer.route.path).split('/').filter(Boolean).forEach((part, index) => {
    if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(parts[index] || '');
  });
  return { layer, params };
}

async function invoke(router, path, options = {}) {
  const { method = 'GET', body = {}, headers = {}, cookies = {}, file, skipRouteHandlerIndexes = [] } = options;
  const url = new URL(path, 'http://test.local');
  const { layer, params } = matchRoute(router, method, url.pathname);
  const req = {
    method, headers, cookies, params, body, file,
    query: Object.fromEntries(url.searchParams.entries()),
    user: undefined
  };
  const res = {
    statusCode: 200, body: null, headersSent: false, cookiesSet: {}, cookiesCleared: [],
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; this.headersSent = true; return this; },
    cookie(name, value, options) { this.cookiesSet[name] = { value, options }; return this; },
    clearCookie(name) { this.cookiesCleared.push(name); return this; },
    sendFile(filename, fileOptions, callback) { this.fileResponse = { filename, options: fileOptions }; this.headersSent = true; callback?.(null); return this; },
    send(value) { this.body = value; this.headersSent = true; return this; }
  };
  let nextError;
  async function runHandlers(handlers) {
    for (const handler of handlers) {
      let nextCalled = false;
      let nextValue;
      await handler(req, res, (error) => { nextCalled = true; nextValue = error; });
      if (nextCalled && nextValue) { nextError = nextValue; return; }
      if (!nextCalled || res.headersSent) return;
    }
  }

  const routerMiddleware = router.stack
    .filter((candidate) => !candidate.route)
    .flatMap((candidate) => candidate.handle.stack ? candidate.handle.stack.map((item) => item.handle) : [candidate.handle]);
  await runHandlers(routerMiddleware);
  if (!res.headersSent && !nextError) {
    const handlers = layer.route.stack
      .map((item, index) => ({ handle: item.handle, index }))
      .filter((item) => !skipRouteHandlerIndexes.includes(item.index))
      .map((item) => item.handle);
    await runHandlers(handlers);
  }
  return { status: nextError ? 500 : res.statusCode, body: nextError ? { message: nextError.message } : res.body, error: nextError, res, req };
}

module.exports = { invoke, loadRouter, makeToken };
