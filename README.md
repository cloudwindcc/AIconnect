# 3HK Hub

3HK Hub is an AI opportunity network for identifying Hub Nodes, Bridge Paths, Trust Edges, and high-value Opportunity Signals.

Production domain: `https://hub.3hk.xyz/`

## Overview

3HK Hub turns companies, advisors, needs, resources, and business opportunities into a computable network. It is designed for cross-border capital, industrial collaboration, and advisor-led deal discovery.

The product is no longer a browser-only demo. This repo now targets Cloudflare Pages, Pages Functions, D1, and Cloudflare Access.

## Product Capabilities

- Rebranded product experience: **3HK Hub｜AI Opportunity Network**.
- Complex-network concepts embedded in the UX: Hub Node, Bridge Path, Trust Edge, and Opportunity Signal.
- Interactive opportunity graph with a light network-map style, compact nodes, short company labels, and thin low-noise relationship lines.
- Hub metrics computed from the current graph: `hubScore`, `degree`, `bridgeScore`, and `expectedValueRank`.
- Rule engine scoring with production-friendly weights:
  - Demand-Resource Match
  - Industry Affinity
  - Cross-Border Bridge
  - Scale Fit
  - Advisor Influence
- AI analysis through a backend proxy only. Frontend browser-direct API keys are intentionally removed.
- Public read-only visitor mode, email visitor registration, and Cloudflare Access protected admin mode.
- Import/export support for JSON and Excel data.
- Report generation and local Word download for opportunity analysis.

## Architecture

```text
Vanilla JS + Vite
Cloudflare Pages
Cloudflare Pages Functions
Cloudflare D1
Cloudflare Access
OpenAI-compatible backend proxy
```

Important paths:

- `index.html` - application shell and dialogs.
- `src/app.js` - main vanilla JS app, graph rendering, matching, import/export, and UI state.
- `src/domain/metrics.js` - graph metrics, Hub Score, node sizing helpers, and link scale helpers.
- `src/security/html.js` - HTML escaping helpers.
- `src/api/client.js` - browser API client.
- `functions/api/*` - Cloudflare Pages Functions APIs.
- `migrations/0001_initial.sql` - D1 schema.
- `_headers` - Cloudflare Pages security headers.
- `_redirects` - production domain redirect placeholder.

## Local Development

Install dependencies:

```powershell
npm install
```

Run the Vite preview/dev server:

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

In plain Vite mode, `/api/*` Cloudflare Functions are not available. The frontend falls back to local demo data and local visitor-session behavior.

## Cloudflare Functions + D1 Local Preview

Create and initialize a local D1 database:

```powershell
npx wrangler d1 create 3hk-hub
npx wrangler d1 execute 3hk-hub --local --file migrations/0001_initial.sql
```

Build the app:

```powershell
npm run build
```

Run Pages Functions locally:

```powershell
npx wrangler pages dev dist --d1 DB=3hk-hub
```

Copy `.dev.vars.example` to `.dev.vars` for local model configuration.

## Cloudflare Production Setup

1. Create a Cloudflare D1 database named `3hk-hub`.
2. Replace the placeholder `database_id` in `wrangler.toml`.
3. Apply `migrations/0001_initial.sql`.
4. Add Pages environment variables and secrets:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`, optional, default `gpt-4.1-mini`
   - `OPENAI_BASE_URL`, optional, default `https://api.openai.com/v1`
   - `ADMIN_EMAILS`, comma-separated Cloudflare Access admin emails
5. Configure Cloudflare Access for admin users.
6. Add the Pages custom domain:

```text
hub.3hk.xyz
```

Visitor email registration is read-only and does not grant admin rights. Admin writes require Cloudflare Access identity.

## API Surface

- `GET /api/session`
- `POST /api/register`
- `GET/POST/PUT/DELETE /api/companies`
- `GET/POST/PUT/DELETE /api/advisors`
- `GET/POST/PUT/DELETE /api/opportunities`
- `POST /api/import`
- `GET /api/export`
- `GET/PUT /api/config`
- `POST /api/analyze-opportunities`
- `POST /api/scan-business-card` (admin only)
- `POST /api/reports`
- `GET /api/reports`

## Data Model

D1 tables:

- `companies`
- `advisors`
- `opportunities`
- `reports`
- `rule_config`
- `visitors`
- `visitor_sessions`
- `audit_log`

Money values are stored as RMB yuan integers. Probability and confidence values are stored as `0-1` decimals. IDs are stable strings.

## Validation

Run:

```powershell
npm test
npm run build
npm run test:e2e
```

The test suite covers:

- Hub metrics and graph scale helpers.
- HTML escaping.
- API shared validation helpers.
- Browser smoke test for graph rendering, product guide modal, and visitor registration flow.

## Deployment Notes

### 名片扫描录入

管理员进入“Hub Signal 录入”，点击“名片扫描”，拍摄或上传 JPG、PNG、WebP 图片（单张不超过 10 MB）。点击“识别名片”提取姓名、职务、机构、电话、邮箱、网址、地址和原文，核对修改后录入公司或顾问数据库。公司需填写公司名称，顾问需填写姓名。自动识别需要后端 `OPENAI_API_KEY`；可选 `OPENAI_VISION_MODEL` 未设置时沿用 `OPENAI_MODEL`，默认 `gpt-4.1-mini`。模型服务需支持 [图片输入](https://developers.openai.com/api/docs/guides/images-vision)。

图片先在浏览器缩放压缩，点击识别后发送给 AI 服务；数据库只保存核对后的字段。录入通过已有管理员认证和公司 / 顾问写入 API 保存到 D1。识别失败可手动填写；写入失败会保留表单供重试。重复公司名称，或重复顾问姓名与机构时，需确认后更新非空的名片字段。每条公司记录维护一位主要联系人，访客界面隐藏名片联系方式。

名片字段可在数据库编辑和节点详情查看，并随 Excel / JSON 导入导出。扫描时保留现有机会池；未提供的收入、需求和资源保持空缺，可在编辑时补充并重新匹配。

验证命令：`npm run test:cards`、`npm run test:cards:browser`（本机 Chrome 或指定 `CHROME_PATH`）。浏览器验证使用本地测试服务，不会调用外部 AI。

The repo prepares `hub.3hk.xyz`, security headers, Cloudflare Functions, and D1 schema. The final custom-domain binding still needs to be completed in the Cloudflare dashboard or through the account-level API.
