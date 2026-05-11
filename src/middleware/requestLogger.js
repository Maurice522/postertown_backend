const HIDDEN_VALUE = "[hidden]";
const MAX_TEXT_LENGTH = 1200;

const sensitiveKeys = new Set([
  "authorization",
  "cookie",
  "password",
  "token",
  "secret",
  "api_key",
  "apikey",
  "apiKey"
]);

function maskSensitiveData(value) {
  if (Array.isArray(value)) {
    return value.map(maskSensitiveData);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      const normalizedKey = key.toLowerCase();
      const isSensitive = [...sensitiveKeys].some((sensitiveKey) => normalizedKey.includes(sensitiveKey));

      return [key, isSensitive ? HIDDEN_VALUE : maskSensitiveData(entryValue)];
    })
  );
}

function trimForLog(value) {
  if (value == null || value === "") {
    return value;
  }

  const text = typeof value === "string" ? value : JSON.stringify(value);

  if (text.length <= MAX_TEXT_LENGTH) {
    return value;
  }

  return `${text.slice(0, MAX_TEXT_LENGTH)}... [truncated ${text.length - MAX_TEXT_LENGTH} chars]`;
}

function getRequestData(req) {
  return {
    params: maskSensitiveData(req.params),
    query: maskSensitiveData(req.query),
    body: trimForLog(maskSensitiveData(req.body))
  };
}

function joinRoutePath(baseUrl, routePath) {
  if (!routePath || routePath === "unmatched") {
    return routePath ?? "unmatched";
  }

  if (!baseUrl || baseUrl === "/") {
    return routePath;
  }

  return routePath === "/" ? baseUrl : `${baseUrl}${routePath}`;
}

export function requestLogger(req, res, next) {
  const startedAt = Date.now();
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  let responseBody;

  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };

  res.send = (body) => {
    responseBody = body;
    return originalSend(body);
  };

  console.log(`[route:start] ${req.method} ${req.originalUrl}`);
  console.log("[request:data]", getRequestData(req));

  res.on("finish", () => {
    const routePath = req.route?.path ?? "unmatched";
    const reachedRoute = joinRoutePath(req.baseUrl, routePath);
    const durationMs = Date.now() - startedAt;

    console.log(
      `[route:finish] ${req.method} ${reachedRoute} -> ${res.statusCode} (${durationMs}ms)`
    );
    console.log("[response:data]", trimForLog(maskSensitiveData(responseBody)));
  });

  next();
}
