const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      return json({ error: "OPENAI_API_KEY is not configured" }, 500);
    }

    const body = await request.json();
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
      return json({ error: "Model returned non-JSON response", detail: text.slice(0, 800) }, 502);
    }

    if (!upstream.ok) {
      return json(
        {
          error: upstreamJson?.error?.message || upstreamJson?.error || "Model API request failed",
          status: upstream.status,
        },
        upstream.status,
      );
    }

    const content = upstreamJson?.choices?.[0]?.message?.content;
    const analysis = parseJsonFromText(content);
    return json({ ...analysis, model, usage: upstreamJson?.usage || null });
  } catch (error) {
    return json({ error: error.message || "AI analysis failed" }, 500);
  }
}

export async function onRequestGet() {
  return json({ error: "Method not allowed" }, 405);
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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
