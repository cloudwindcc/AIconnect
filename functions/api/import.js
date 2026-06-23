import {
  audit,
  checkRateLimit,
  errorResponse,
  handleOptions,
  json,
  readJsonBody,
  requireAdmin,
  requireDb,
  validateRecordPayload,
} from "./_shared.js";
import { upsertRecord } from "./_records.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return handleOptions(request);
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

  try {
    checkRateLimit(request, 20);
    const identity = requireAdmin(request, env);
    const db = requireDb(env);
    const payload = await readJsonBody(request, 1_500_000);
    const companies = Array.isArray(payload.companies) ? payload.companies.map((item) => validateRecordPayload(item, "company")) : [];
    const advisors = Array.isArray(payload.advisors) ? payload.advisors.map((item) => validateRecordPayload(item, "advisor")) : [];
    const opportunities = Array.isArray(payload.opportunities)
      ? payload.opportunities.map((item) => validateRecordPayload(item, "opportunity"))
      : [];

    if (!companies.length && !advisors.length && !opportunities.length) {
      return json(request, { error: "Import requires companies, advisors, or opportunities" }, 400);
    }

    const batch = [
      ...companies.map((item) =>
        db
          .prepare(
            "INSERT INTO companies (id, payload, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP",
          )
          .bind(item.id, JSON.stringify(item)),
      ),
      ...advisors.map((item) =>
        db
          .prepare(
            "INSERT INTO advisors (id, payload, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP",
          )
          .bind(item.id, JSON.stringify(item)),
      ),
    ];
    if (batch.length) await db.batch(batch);
    for (const opportunity of opportunities) {
      await upsertRecord(db, "opportunities", opportunity);
    }
    await audit(env, identity, "import", "dataset", null, {
      companies: companies.length,
      advisors: advisors.length,
      opportunities: opportunities.length,
    });
    return json(request, { ok: true, companies: companies.length, advisors: advisors.length, opportunities: opportunities.length });
  } catch (error) {
    return errorResponse(request, error);
  }
}
