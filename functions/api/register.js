import {
  audit,
  checkRateLimit,
  errorResponse,
  handleOptions,
  json,
  normalizeVisitorRegistration,
  readJsonBody,
  requireDb,
} from "./_shared.js";

const VISITOR_COOKIE = "3hk_hub_visitor";
const SESSION_DAYS = 30;

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return handleOptions(request);

  try {
    checkRateLimit(request, 20);
    if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

    const db = requireDb(env);
    const payload = normalizeVisitorRegistration(await readJsonBody(request, 20_000));
    const now = new Date().toISOString();
    const existing = await db.prepare("SELECT id FROM visitors WHERE email = ? LIMIT 1").bind(payload.email).first();
    const visitorId = existing?.id || crypto.randomUUID();

    await db
      .prepare(
        `INSERT INTO visitors (id, email, name, organization, interest, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(email) DO UPDATE SET
           name = excluded.name,
           organization = excluded.organization,
           interest = excluded.interest,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(visitorId, payload.email, payload.name, payload.organization, payload.interest)
      .run();

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await db.prepare("DELETE FROM visitor_sessions WHERE expires_at <= ?").bind(now).run();
    await db
      .prepare("INSERT INTO visitor_sessions (id, visitor_id, email, expires_at) VALUES (?, ?, ?, ?)")
      .bind(token, visitorId, payload.email, expiresAt)
      .run();

    await audit(env, { email: payload.email }, existing ? "visitor_login" : "visitor_register", "visitor", visitorId, {
      organization: payload.organization || null,
      interest: payload.interest || null,
    });

    const visitor = { id: visitorId, ...payload };
    return json(
      request,
      {
        authenticated: true,
        admin: false,
        email: payload.email,
        visitor,
        authProvider: "visitor-email",
      },
      201,
      { "Set-Cookie": visitorCookie(request, token) },
    );
  } catch (error) {
    return errorResponse(request, error);
  }
}

function visitorCookie(request, token) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${VISITOR_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}${secure}`;
}
