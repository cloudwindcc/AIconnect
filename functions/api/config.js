import {
  audit,
  checkRateLimit,
  errorResponse,
  handleOptions,
  json,
  parseStored,
  readJsonBody,
  requireAdmin,
  requireDb,
} from "./_shared.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return handleOptions(request);

  try {
    checkRateLimit(request);
    const db = requireDb(env);
    if (request.method === "GET") {
      const row = await db.prepare("SELECT payload FROM rule_config WHERE id = 'default'").first();
      return json(request, parseStored(row) || {});
    }
    if (request.method === "PUT") {
      const identity = requireAdmin(request, env);
      const payload = await readJsonBody(request);
      const safePayload = { ...payload, aiConfig: { ...(payload.aiConfig || {}), apiKey: "" } };
      await db
        .prepare(
          "INSERT INTO rule_config (id, payload, updated_at) VALUES ('default', ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP",
        )
        .bind(JSON.stringify(safePayload))
        .run();
      await audit(env, identity, "update", "rule_config", "default");
      return json(request, safePayload);
    }
    return json(request, { error: "Method not allowed" }, 405);
  } catch (error) {
    return errorResponse(request, error);
  }
}
