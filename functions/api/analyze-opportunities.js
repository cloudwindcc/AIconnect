import { audit, checkRateLimit, errorResponse, handleOptions, json, readJsonBody, requireAdmin } from "./_shared.js";

export async function onRequestOptions(context) {
  return handleOptions(context.request);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    checkRateLimit(request, 25);
    const identity = requireAdmin(request, env);
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      return json(request, { error: "OPENAI_API_KEY is not configured" }, 500);
    }

    const body = await readJsonBody(request, 500_000);
    validateAnalysisPayload(body);
    const model = String(body.model || env.OPENAI_MODEL || "gpt-4.1-mini");
    const baseUrl = stripTrailingSlash(env.OPENAI_BASE_URL || "https://api.openai.com/v1");
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt(body) },
          { role: "user", content: JSON.stringify(body, null, 2) },
        ],
        response_format: { type: "json_object" },
      }),
    });

    const text = await upstream.text();
    let upstreamJson = null;
    try {
      upstreamJson = text ? JSON.parse(text) : null;
    } catch (error) {
      return json(request, { error: "Model returned non-JSON response", detail: text.slice(0, 800) }, 502);
    }

    if (!upstream.ok) {
      return json(
        request,
        {
          error: upstreamJson?.error?.message || upstreamJson?.error || "Model API request failed",
          status: upstream.status,
        },
        upstream.status,
      );
    }

    const content = upstreamJson?.choices?.[0]?.message?.content;
    const analysis = parseJsonFromText(content);
    await audit(env, identity, "ai_analyze", body.mode === "opportunity_report" ? "report" : "opportunity", null, {
      mode: body.mode || "opportunity_match",
      model,
      candidates: Array.isArray(body.candidates) ? body.candidates.length : 0,
    });
    return json(request, { ...analysis, model, usage: upstreamJson?.usage || null });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function onRequestGet(context) {
  return json(context.request, { error: "Method not allowed" }, 405);
}

function buildSystemPrompt(body) {
  if (body.mode === "opportunity_report") {
    return `${body.prompt || "你是项目机会分析顾问。"}

只返回JSON，不要输出Markdown。必须返回 report 对象，包含 title、executive_summary、opportunity_logic、value_assessment、risks、recommended_actions、advisor_plan、closing_note。报告要简洁，适合下载为Word后直接给管理者阅读。`;
  }

  return `${body.prompt || "你是一个产业合作机会分析引擎。"}

只返回JSON，不要输出Markdown。必须返回 opportunities 数组。每一项都要保留输入中的 candidate_id，并包含 opportunity_type、recommended_advisor、estimated_value、probability、confidence、expected_value、evidence、risk_factors、summary、next_step。不要编造输入中不存在的公司和顾问。`;
}

function parseJsonFromText(content) {
  if (!content) throw new Error("Model did not return content");
  const text = String(content).trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(text);
  } catch (error) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("Model content is not valid JSON");
  }
}

function stripTrailingSlash(value) {
  return String(value).replace(/\/+$/, "");
}

function validateAnalysisPayload(body) {
  if (!body || typeof body !== "object") throw new Error("Analysis payload is required");
  if (body.mode === "opportunity_report") {
    if (!body.opportunity) throw new Error("opportunity_report requires opportunity");
    return;
  }
  if (!Array.isArray(body.candidates)) throw new Error("Opportunity analysis requires candidates");
  if (body.candidates.length > 25) throw new Error("Too many candidates");
}
