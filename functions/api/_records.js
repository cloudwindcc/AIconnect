import {
  audit,
  checkRateLimit,
  errorResponse,
  handleOptions,
  json,
  methodNotAllowed,
  parseStored,
  readJsonBody,
  requireAdmin,
  requireDb,
  validateRecordPayload,
} from "./_shared.js";

const TABLES = {
  company: "companies",
  advisor: "advisors",
  opportunity: "opportunities",
};

export async function collectionRequest(context, type) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return handleOptions(request);
  try {
    checkRateLimit(request);
    const db = requireDb(env);
    const table = TABLES[type];
    if (request.method === "GET") {
      const rows = await db.prepare(`SELECT payload FROM ${table} ORDER BY updated_at DESC`).all();
      return json(request, { items: rows.results.map(parseStored) });
    }
    if (request.method === "POST") {
      const identity = requireAdmin(request, env);
      const payload = validateRecordPayload(await readJsonBody(request), type);
      await upsertRecord(db, table, payload);
      await audit(env, identity, "create", type, payload.id);
      return json(request, payload, 201);
    }
    return methodNotAllowed(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function itemRequest(context, type) {
  const { request, env, params } = context;
  if (request.method === "OPTIONS") return handleOptions(request);
  try {
    checkRateLimit(request);
    const db = requireDb(env);
    const table = TABLES[type];
    const id = String(params.id || "");
    if (!id) return json(request, { error: "id is required" }, 400);

    if (request.method === "GET") {
      const row = await db.prepare(`SELECT payload FROM ${table} WHERE id = ?`).bind(id).first();
      const payload = parseStored(row);
      return payload ? json(request, payload) : json(request, { error: "Not found" }, 404);
    }

    const identity = requireAdmin(request, env);
    if (request.method === "DELETE") {
      await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
      await audit(env, identity, "delete", type, id);
      return json(request, { ok: true });
    }
    if (request.method === "PUT") {
      const payload = validateRecordPayload({ ...(await readJsonBody(request)), id }, type);
      await upsertRecord(db, table, payload);
      await audit(env, identity, "update", type, id);
      return json(request, payload);
    }
    return methodNotAllowed(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function upsertRecord(db, table, payload) {
  if (table === "opportunities") {
    await db
      .prepare(
        `INSERT INTO ${table} (id, source_company_id, target_company_id, advisor_id, payload, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET source_company_id = excluded.source_company_id, target_company_id = excluded.target_company_id, advisor_id = excluded.advisor_id, payload = excluded.payload, updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(payload.id, payload.sourceCompanyId, payload.targetCompanyId, payload.advisorId || null, JSON.stringify(payload))
      .run();
    return;
  }
  await db
    .prepare(
      `INSERT INTO ${table} (id, payload, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(payload.id, JSON.stringify(payload))
    .run();
}
