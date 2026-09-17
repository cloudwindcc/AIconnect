import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost, onRequestGet } from "../functions/api/scan-business-card.js";

const image = "data:image/png;base64,iVBORw0KGgo=";
const env = { OPENAI_API_KEY: "test-only-key" };
function request(body = { image }, headers = {}) {
  return new Request("https://example.test/api/scan-business-card", {
    method: "POST", headers: { "Content-Type": "application/json", "Cf-Access-Authenticated-User-Email": "admin@example.test", "CF-Connecting-IP": crypto.randomUUID(), ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
async function scan(req = request(), config = env) { return onRequestPost({ request: req, env: config }); }
function upstream(card) { return Response.json({ choices: [{ message: { content: JSON.stringify({ card }) } }] }); }

test("missing key gives a manual-entry message without calling the model", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected fetch"); });
  const result = await scan(request(), {});
  assert.equal(result.status, 503);
  assert.match((await result.json()).error, /手动/);
  assert.equal(mock.mock.callCount(), 0);
});

test("unauthenticated requests cannot use the vision model", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected fetch"); });
  const req = request();
  req.headers.delete("Cf-Access-Authenticated-User-Email");
  assert.equal((await scan(req)).status, 401);
  assert.equal(mock.mock.callCount(), 0);
});

test("valid image is sent to the configured vision model; only bounded string fields return", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://model.test/v1/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer test-only-key");
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, "vision-test");
    assert.equal(payload.messages[1].content[1].image_url.url, image);
    assert.equal(payload.messages[1].content[1].image_url.detail, "high");
    assert.equal(payload.response_format.type, "json_object");
    return upstream({ contactName: " 张三 ", companyName: "示例科技有限公司", phone: "+86 13800138000", email: "a@sample.test, b@sample.test", industry: { wrong: true }, address: "x".repeat(1500), extra: "ignored" });
  });
  const result = await scan(request(), { ...env, OPENAI_BASE_URL: "https://model.test/v1/", OPENAI_VISION_MODEL: "vision-test" });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("cache-control"), "no-store");
  const { card } = await result.json();
  assert.equal(card.contactName, "张三");
  assert.equal(card.phone, "+86 13800138000");
  assert.equal(card.industry, "");
  assert.equal(card.address.length, 1000);
  assert.equal(card.extra, undefined);
  assert.equal(mock.mock.callCount(), 1);
});

test("invalid input never calls the model", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected fetch"); });
  for (const [req, status] of [
    [request("{"), 400],
    [request(null), 400],
    [request({}), 400],
    [request({ image: "https://somewhere.test/photo.jpg" }), 400],
    [request({ image: "data:image/svg+xml;base64,PHN2Zz4=" }), 400],
    [request({ image: "data:image/png;base64,bm90IGFuIGltYWdl" }), 400],
    [request({ image: "data:image/png;base64,iVBORw0KGgo" }), 400],
    [request({ image }, { "Content-Type": "text/plain" }), 415],
    [request({ image }, { "Content-Length": "6000000" }), 413],
  ]) assert.equal((await scan(req)).status, status);
  assert.equal(mock.mock.callCount(), 0);
});

test("oversized chunked body is rejected even without Content-Length", async () => {
  const req = new Request("https://example.test/api/scan-business-card", {
    method: "POST", headers: { "Content-Type": "application/json", "Cf-Access-Authenticated-User-Email": "admin@example.test", "CF-Connecting-IP": crypto.randomUUID() }, duplex: "half",
    body: new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(3 * 1024 * 1024));
      controller.enqueue(new Uint8Array(3 * 1024 * 1024));
      controller.close();
    } }),
  });
  assert.equal((await scan(req)).status, 413);
});

test("supported JPEG and WebP signatures work, with OPENAI_MODEL fallback", async (t) => {
  t.mock.method(globalThis, "fetch", async (_, options) => {
    assert.equal(JSON.parse(options.body).model, "fallback-test");
    return upstream({ companyName: "Company" });
  });
  for (const [mime, bytes] of [["jpeg", [255, 216, 255]], ["webp", Buffer.from("RIFFxxxxWEBP")]]) {
    const value = `data:image/${mime};base64,${Buffer.from(bytes).toString("base64")}`;
    assert.equal((await scan(request({ image: value }), { ...env, OPENAI_MODEL: "fallback-test" })).status, 200);
  }
});

test("model failures return actionable errors without exposing upstream data", async (t) => {
  for (const [upstreamStatus, expected] of [[401, 502], [429, 429], [500, 502]]) {
    const mock = t.mock.method(globalThis, "fetch", async () => new Response("private upstream details", { status: upstreamStatus }));
    const result = await scan();
    assert.equal(result.status, expected);
    assert.doesNotMatch(await result.text(), /private/);
    mock.mock.restore();
  }
});

test("malformed, empty or missing model output cannot become a record", async (t) => {
  for (const [content, expected] of [["not json", 502], ["{}", 502], [JSON.stringify({ card: [] }), 502], [JSON.stringify({ card: {} }), 422]]) {
    const mock = t.mock.method(globalThis, "fetch", async () => Response.json({ choices: [{ message: { content } }] }));
    assert.equal((await scan()).status, expected);
    mock.mock.restore();
  }
});

test("timeout does not leak internals", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new DOMException("private details", "TimeoutError"); });
  const result = await scan();
  assert.equal(result.status, 504);
  assert.match((await result.json()).error, /超时/);
});

test("GET is rejected", () => { assert.equal(onRequestGet().status, 405); });
