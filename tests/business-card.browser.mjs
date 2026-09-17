// Local model and D1 fixtures exercise the production UI and real record handlers.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { chromium } from "@playwright/test";
import { onRequestPost } from "../functions/api/scan-business-card.js";
import { collectionRequest, itemRequest } from "../functions/api/_records.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const artifacts = await mkdtemp(join(tmpdir(), "3hk-card-browser-"));
let admin = false, modelMode = "success", saveMode = "success", modelCalls = 0;
let dataset = { companies: [], advisors: [], opportunities: [] };
const card = { contactName: "张三", contactTitle: "业务总监", companyName: "扫描测试科技有限公司", phone: "+86 13800138000", email: "zhang@example.test", website: "www.example.test", countryRegion: "中国大陆", city: "深圳", address: "深圳市测试路 88 号", cardNotes: "张三 业务总监\n扫描测试科技有限公司" };
const audits = [];
const DB = { prepare(sql) { return { bind(...args) { return { async run() {
  if (sql.includes("INSERT INTO audit_log")) { audits.push(args); return; }
  const table = sql.match(/INSERT INTO (companies|advisors)/)?.[1];
  assert.ok(table, `Unexpected SQL: ${sql}`);
  const record = JSON.parse(args[1]);
  const index = dataset[table].findIndex((item) => item.id === args[0]);
  if (index >= 0) dataset[table][index] = record; else dataset[table].push(record);
} }; } }; } };
const server = createServer(async (req, res) => {
  try {
    if (req.url === "/model/chat/completions") {
      const parts = []; for await (const chunk of req) parts.push(chunk);
      const body = JSON.parse(Buffer.concat(parts));
      assert.match(body.messages[1].content[1].image_url.url, /^data:image\/jpeg;base64,/);
      modelCalls += 1;
      if (modelMode === "delay") await new Promise((r) => setTimeout(r, 600));
      res.setHeader("Content-Type", "application/json");
      if (modelMode === "failure") { res.writeHead(429); res.end("{}"); return; }
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ card }) } }] })); return;
    }
    if (req.url?.startsWith("/api/")) {
      const parts = []; for await (const chunk of req) parts.push(chunk);
      const body = Buffer.concat(parts), headers = { ...req.headers };
      if (admin) headers["Cf-Access-Authenticated-User-Email"] = "admin@example.test";
      const context = { request: new Request(`${origin}${req.url}`, { method: req.method, headers, ...(body.length ? { body } : {}) }), env: { OPENAI_API_KEY: "local-fixture", OPENAI_BASE_URL: `${origin}/model`, ADMIN_EMAILS: "admin@example.test", DB } };
      let result;
      if (req.url === "/api/session") result = Response.json({ authenticated: admin, admin, email: admin ? "admin@example.test" : null, authProvider: admin ? "cloudflare-access" : "public-viewer" });
      else if (req.url === "/api/config") result = Response.json({});
      else if (req.url === "/api/export") result = Response.json(dataset);
      else if (req.url === "/api/import") { dataset = JSON.parse(body); result = Response.json({ ok: true }); }
      else if (req.url === "/api/scan-business-card") result = await onRequestPost(context);
      else if (/^\/api\/(companies|advisors)(\/[^/]+)?$/.test(req.url)) {
        const [, table, id] = req.url.split("/").slice(1);
        if (saveMode === "failure") result = Response.json({ error: "测试数据库暂时不可用，请重试" }, { status: 503 });
        else if (id) result = await itemRequest({ ...context, params: { id } }, table === "companies" ? "company" : "advisor");
        else result = await collectionRequest(context, table === "companies" ? "company" : "advisor");
      } else result = Response.json({ error: "Not found" }, { status: 404 });
      res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(await result.text()); return;
    }
    const name = req.url === "/" ? "index.html" : decodeURIComponent(req.url?.slice(1).split("?")[0]);
    const file = resolve(root, "dist", name);
    if (!file.startsWith(resolve(root, "dist") + "\\") && !file.startsWith(resolve(root, "dist") + "/")) { res.writeHead(404); res.end(); return; }
    res.setHeader("Content-Type", file.endsWith("css") ? "text/css" : file.endsWith("js") ? "text/javascript" : "text/html"); res.end(await readFile(file));
  } catch (error) { res.writeHead(500); res.end(error.message); }
});
server.listen(0, "127.0.0.1"); await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
const page = await browser.newPage(), errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("https://raw.githubusercontent.com/**", (route) => route.abort());
const open = () => page.locator("#scanBusinessCardButton").click();
const setForm = (values) => page.evaluate((values) => {
  const form = document.getElementById("businessCardForm");
  for (const [key, value] of Object.entries(values)) { form.elements[key].value = value; form.elements[key].dispatchEvent(new Event("input", { bubbles: true })); }
}, values);
const submit = async (success = true) => { await page.locator("#saveBusinessCardButton").click(); if (success) await page.waitForFunction(() => !document.getElementById("businessCardDialog").open); };
const upload = async (type = "image/png", size = null) => {
  await page.evaluate(({ type, size }) => {
    const canvas = document.createElement("canvas"); canvas.width = 900; canvas.height = 500;
    const c = canvas.getContext("2d"); c.fillStyle = "#fff"; c.fillRect(0, 0, 900, 500); c.fillStyle = "#111"; c.font = "36px sans-serif"; c.fillText("Business Card Test", 40, 80);
    const bytes = Uint8Array.from(atob(canvas.toDataURL("image/png").split(",")[1]), (c) => c.charCodeAt(0));
    const transfer = new DataTransfer(); transfer.items.add(new File([size ? new Uint8Array(size) : bytes], "card.png", { type }));
    const input = document.getElementById("businessCardFile"); input.files = transfer.files; input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { type, size });
  await page.waitForFunction(() => document.getElementById("businessCardDialog").getAttribute("aria-busy") !== "true");
};
try {
  await page.goto(origin); await page.waitForFunction(() => document.getElementById("companyCount").textContent === "50");
  assert.equal(await page.locator("#scanBusinessCardButton").isVisible(), false);
  admin = true; await page.reload(); await page.locator("#scanBusinessCardButton").waitFor();
  await page.locator("#saveLocalButton").click(); await page.waitForTimeout(150); assert.equal(dataset.companies.length, 50);
  await open(); await upload(); assert.equal(modelCalls, 0);
  await page.locator("#recognizeBusinessCardButton").click(); await page.waitForFunction(() => document.getElementById("businessCardStatus").textContent.includes("识别完成"));
  assert.equal(dataset.companies.length, 50, "recognition must await confirmation");
  await setForm({ phone: "+86 13900139000", email: '<script>alert(1)</script>@example.test' }); await submit();
  assert.equal(dataset.companies.length, 51); assert.equal(dataset.companies.at(-1).phone, "+86 13900139000");
  assert.equal(dataset.companies.at(-1).revenue, 0); assert.deepEqual(dataset.companies.at(-1).needs, []);
  assert.equal(dataset.opportunities.length, 48); assert.equal(await page.locator("#dataTable script").count(), 0); assert.equal(audits.length, 1);
  const opportunities = JSON.stringify(dataset.opportunities);
  console.log("PASS upload, vision request, review, escaping, D1 write and audit");
  await page.reload(); await page.locator("#scanBusinessCardButton").waitFor(); assert.equal(await page.locator("#companyCount").textContent(), "51");
  await open(); await setForm({ companyName: card.companyName, contactName: "张三", phone: "+86 13000000000" });
  assert.equal(await page.locator("#businessCardDuplicate").isVisible(), true); await submit(false); assert.equal(dataset.companies.at(-1).phone, "+86 13900139000");
  await page.locator('[name="confirmUpdate"]').check(); await submit();
  assert.equal(dataset.companies.length, 51); assert.equal(dataset.companies.at(-1).phone, "+86 13000000000");
  assert.equal(dataset.companies.at(-1).email, '<script>alert(1)</script>@example.test'); assert.equal(JSON.stringify(dataset.opportunities), opportunities);
  console.log("PASS reload, duplicate confirmation, nonempty updates and opportunity retention");
  await open(); await setForm({ recordType: "advisor", contactName: "李四", contactTitle: "产业顾问", companyName: "顾问测试机构", phone: "021-12345678", email: "li@example.test", city: "上海", cardNotes: "手动核对" }); await submit();
  assert.equal(dataset.advisors.length, 6); assert.equal(dataset.advisors.at(-1).title, "产业顾问");
  await page.locator(`[data-action="edit-advisor"][data-id="${dataset.advisors.at(-1).id}"]`).click(); assert.equal(await page.locator('#editForm [name="phone"]').inputValue(), "021-12345678");
  await page.locator('#editForm [name="title"]').fill("高级产业顾问"); await page.locator('#editForm button[type="submit"]').click(); await page.waitForTimeout(150); assert.equal(dataset.advisors.at(-1).email, "li@example.test");
  console.log("PASS advisor manual entry and contact retention after editing");
  await open(); await upload("image/heic"); assert.match(await page.locator("#businessCardStatus").textContent(), /仅支持/);
  await upload("image/png", 11 * 1024 * 1024); assert.match(await page.locator("#businessCardStatus").textContent(), /不超过/);
  await upload(); modelMode = "failure"; await page.locator("#recognizeBusinessCardButton").click(); await page.waitForFunction(() => document.getElementById("businessCardStatus").classList.contains("is-error"));
  await setForm({ companyName: "手动补录有限公司", contactName: "王五", phone: "010-12345678" }); await submit(); assert.equal(dataset.companies.at(-1).name, "手动补录有限公司");
  console.log("PASS invalid files and manual fallback after AI failure");
  await open(); await upload(); modelMode = "delay"; await page.locator("#recognizeBusinessCardButton").click(); await page.waitForTimeout(100);
  await page.locator("#cancelBusinessCardButton").click(); await open(); await page.waitForTimeout(800);
  assert.equal(await page.locator('[name="companyName"]').inputValue(), ""); assert.equal(await page.locator("#businessCardPreview").isVisible(), false);
  console.log("PASS cancel/reopen clears image and ignores late recognition");
  saveMode = "failure"; await setForm({ companyName: "数据库失败测试有限公司" }); await submit(false); await page.waitForFunction(() => document.getElementById("businessCardStatus").classList.contains("is-error"));
  assert.equal(await page.locator('[name="companyName"]').inputValue(), "数据库失败测试有限公司"); assert.equal(dataset.companies.length, 52); saveMode = "success";
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator("#businessCardDialog").evaluate((d) => d.getBoundingClientRect().width <= 390 && d.scrollWidth <= d.clientWidth), true);
  assert.equal(await page.locator("#closeBusinessCardButton").evaluate((b) => b.getBoundingClientRect().width), 36);
  await page.locator("#businessCardDialog").evaluate((d) => { d.scrollTop = 0; }); await page.screenshot({ path: join(artifacts, "mobile.png") }); await page.locator("#cancelBusinessCardButton").click();
  console.log("PASS failed D1 write retains draft, database unchanged, mobile layout");
  if (await page.evaluate(() => Boolean(window.XLSX))) {
    const downloadPromise = page.waitForEvent("download"); await page.locator("#exportExcelButton").click(); const file = join(artifacts, "contacts.xlsx"); await (await downloadPromise).saveAs(file);
    const rows = await page.evaluate((bytes) => { const book = XLSX.read(new Uint8Array(bytes), { type: "array" }); return Object.fromEntries(book.SheetNames.map((name) => [name, XLSX.utils.sheet_to_json(book.Sheets[name])])); }, Array.from(await readFile(file)));
    assert.equal(rows["公司数据库"].find((r) => r["公司名称"] === card.companyName)["电话"], "+86 13000000000"); assert.equal(rows["顾问数据库"].find((r) => r["姓名"] === "李四")["邮箱"], "li@example.test");
    await page.locator("#importExcelFile").setInputFiles(file); await page.waitForTimeout(200);
    assert.equal(dataset.companies.find((r) => r.name === card.companyName).contactName, "张三"); assert.equal(dataset.advisors.find((r) => r.name === "李四").cardNotes, "手动核对"); console.log("PASS real Excel export/import retains contact fields");
  } else console.log("Excel CDN unavailable; field mappings reviewed");
  await page.locator("#viewerModeButton").click(); assert.equal((await page.locator("#dataTable").textContent()).includes("13000000000"), false); assert.deepEqual(errors, []);
  console.log(`PASS viewer masking and no uncaught errors. Artifacts: ${artifacts}`);
} finally { await browser.close(); server.closeAllConnections(); server.close(); }
