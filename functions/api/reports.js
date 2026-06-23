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
      const rows = await db.prepare("SELECT payload FROM reports ORDER BY created_at DESC LIMIT 50").all();
      return json(request, { reports: rows.results.map(parseStored) });
    }
    if (request.method === "POST") {
      const identity = requireAdmin(request, env);
      const payload = await readJsonBody(request, 400_000);
      const id = String(payload.id || crypto.randomUUID());
      const report = { ...payload, id };
      await db
        .prepare("INSERT INTO reports (id, opportunity_id, payload) VALUES (?, ?, ?)")
        .bind(id, report.opportunityId || null, JSON.stringify(report))
        .run();
      await audit(env, identity, "create", "report", id, { opportunityId: report.opportunityId || null });
      return json(request, report, 201);
    }
    return json(request, { error: "Method not allowed" }, 405);
  } catch (error) {
    return errorResponse(request, error);
  }
}
