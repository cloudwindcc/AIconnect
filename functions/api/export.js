import { checkRateLimit, errorResponse, handleOptions, json, parseStored, requireDb } from "./_shared.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return handleOptions(request);
  if (request.method !== "GET") return json(request, { error: "Method not allowed" }, 405);

  try {
    checkRateLimit(request);
    const db = requireDb(env);
    const [companies, advisors, opportunities, config] = await Promise.all([
      db.prepare("SELECT payload FROM companies ORDER BY updated_at DESC").all(),
      db.prepare("SELECT payload FROM advisors ORDER BY updated_at DESC").all(),
      db.prepare("SELECT payload FROM opportunities ORDER BY updated_at DESC").all(),
      db.prepare("SELECT payload FROM rule_config WHERE id = 'default'").first(),
    ]);
    return json(request, {
      exportedAt: new Date().toISOString(),
      companies: companies.results.map(parseStored),
      advisors: advisors.results.map(parseStored),
      opportunities: opportunities.results.map(parseStored),
      config: parseStored(config),
    });
  } catch (error) {
    return errorResponse(request, error);
  }
}
