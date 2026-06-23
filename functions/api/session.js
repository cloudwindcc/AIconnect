import { errorResponse, getAccessIdentity, getCookie, handleOptions, json } from "./_shared.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return handleOptions(request);
  try {
    const identity = getAccessIdentity(request, env);
    const visitor = identity.admin ? null : await getVisitorFromSession(request, env);
    const authenticated = identity.authenticated || Boolean(visitor);
    return json(request, {
      authenticated,
      admin: identity.admin,
      email: identity.email || visitor?.email || null,
      visitor,
      authProvider: identity.authenticated ? "cloudflare-access" : visitor ? "visitor-email" : "public-viewer",
    });
  } catch (error) {
    return errorResponse(request, error);
  }
}

async function getVisitorFromSession(request, env) {
  if (!env.DB) return null;
  const token = getCookie(request, "3hk_hub_visitor");
  if (!token) return null;
  const now = new Date().toISOString();
  const row = await env.DB
    .prepare(
      `SELECT v.id, v.email, v.name, v.organization, v.interest
       FROM visitor_sessions s
       JOIN visitors v ON v.id = s.visitor_id
       WHERE s.id = ? AND s.expires_at > ?
       LIMIT 1`,
    )
    .bind(token, now)
    .first();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name || "",
    organization: row.organization || "",
    interest: row.interest || "",
  };
}
