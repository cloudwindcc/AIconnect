const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const TRUSTED_ORIGINS = new Set([
  "https://hub.3hk.xyz",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

const WINDOW_MS = 60_000;
const rateCounters = new Map();

export function corsHeaders(request) {
  const origin = request?.headers?.get("Origin") || "";
  const allowed = TRUSTED_ORIGINS.has(origin) ? origin : "https://hub.3hk.xyz";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export function json(request, payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(request), ...extraHeaders },
  });
}

export function methodNotAllowed(request) {
  return json(request, { error: "Method not allowed" }, 405);
}

export function handleOptions(request) {
  return new Response(null, { headers: corsHeaders(request) });
}

export async function readJsonBody(request, maxBytes = 200_000) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > maxBytes) throw new HttpError(413, "Request body is too large");
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request body is too large");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

export function requireDb(env) {
  if (!env.DB) throw new HttpError(500, "D1 binding DB is not configured");
  return env.DB;
}

export function getAccessIdentity(request, env) {
  const email =
    request.headers.get("Cf-Access-Authenticated-User-Email") ||
    request.headers.get("X-3HK-Dev-User") ||
    "";
  const adminEmails = String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const devAdmin = env.DEV_ADMIN === "true" && request.headers.get("X-3HK-Dev-User");
  const authenticated = Boolean(email || request.headers.get("Cf-Access-Jwt-Assertion"));
  const admin = Boolean(devAdmin || (authenticated && (!adminEmails.length || adminEmails.includes(email.toLowerCase()))));
  return { authenticated, admin, email: email || null };
}

export function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const prefix = `${name}=`;
  return (
    cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length) || ""
  );
}

export function normalizeVisitorRegistration(payload = {}) {
  const email = String(payload.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Valid email is required");
  return {
    email,
    name: cleanText(payload.name, 80),
    organization: cleanText(payload.organization, 120),
    interest: cleanText(payload.interest, 160),
  };
}

function cleanText(value, maxLength) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function requireAdmin(request, env) {
  const identity = getAccessIdentity(request, env);
  if (!identity.admin) throw new HttpError(401, "Admin access requires Cloudflare Access");
  return identity;
}

export function checkRateLimit(request, limit = 60) {
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
  const now = Date.now();
  const bucket = rateCounters.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (bucket.resetAt < now) {
    bucket.count = 0;
    bucket.resetAt = now + WINDOW_MS;
  }
  bucket.count += 1;
  rateCounters.set(ip, bucket);
  if (bucket.count > limit) throw new HttpError(429, "Rate limit exceeded");
}

export async function audit(env, identity, action, entityType, entityId, metadata = {}) {
  if (!env.DB) return;
  await env.DB.prepare(
    "INSERT INTO audit_log (id, actor_email, action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), identity?.email || null, action, entityType || null, entityId || null, JSON.stringify(metadata))
    .run();
}

export function validateRecordPayload(payload, type) {
  if (!payload || typeof payload !== "object") throw new HttpError(400, `${type} payload is required`);
  if (!payload.id || typeof payload.id !== "string") throw new HttpError(400, `${type}.id is required`);
  if (type === "company") {
    if (!payload.name) throw new HttpError(400, "company.name is required");
    if (!payload.countryRegion) throw new HttpError(400, "company.countryRegion is required");
    payload.revenue = integerMoney(payload.revenue);
  }
  if (type === "advisor") {
    if (!payload.name) throw new HttpError(400, "advisor.name is required");
  }
  if (type === "opportunity") {
    for (const field of ["sourceCompanyId", "targetCompanyId", "opportunityType"]) {
      if (!payload[field]) throw new HttpError(400, `opportunity.${field} is required`);
    }
    payload.estimatedValue = integerMoney(payload.estimatedValue);
    payload.expectedValue = integerMoney(payload.expectedValue);
    payload.probability = probability(payload.probability);
    payload.confidence = probability(payload.confidence);
  }
  return payload;
}

export function integerMoney(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

export function probability(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function parseStored(row) {
  return row ? JSON.parse(row.payload) : null;
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function errorResponse(request, error) {
  const status = error.status || 500;
  return json(request, { error: error.message || "Unexpected server error" }, status);
}
