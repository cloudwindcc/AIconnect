# 3HK Hub

AI Opportunity Network for identifying Hub Nodes, Bridge Paths, Trust Edges and Opportunity Signals.

Production domain: `https://hub.3hk.xyz/`

## What It Does

- Maps companies, advisors, needs, resources and opportunities as a dynamic business network.
- Computes Hub metrics: `hubScore`, `degree`, `bridgeScore`, and `expectedValueRank`.
- Scales company node size by revenue and opportunity line width by opportunity value.
- Uses a rule engine first, then an OpenAI-compatible backend proxy to refine candidate opportunities.
- Supports Cloudflare Access admin mode and public read-only viewer mode.
- Supports email visitor registration; successful visitors are automatically logged in as read-only viewers.
- Persists production data in Cloudflare D1 instead of browser-only localStorage.

## Local Development

```powershell
npm install
npm run dev
```

For Cloudflare Pages Functions + D1 local development:

```powershell
npx wrangler d1 create 3hk-hub
npx wrangler d1 execute 3hk-hub --local --file migrations/0001_initial.sql
npx wrangler pages dev dist --d1 DB=3hk-hub
```

Copy `.dev.vars.example` to `.dev.vars` for local model configuration.

## Cloudflare Production Setup

1. Create a Cloudflare D1 database named `3hk-hub`.
2. Replace the placeholder `database_id` in `wrangler.toml`.
3. Apply `migrations/0001_initial.sql`.
4. Add Pages environment variables / secrets:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` optional, default `gpt-4.1-mini`
   - `OPENAI_BASE_URL` optional, default `https://api.openai.com/v1`
   - `ADMIN_EMAILS` comma-separated Cloudflare Access admin emails
5. Configure Cloudflare Access for admin users. Visitor email registration remains read-only and does not grant admin rights.
6. Add the Pages custom domain `hub.3hk.xyz`.

Cloudflare docs:

- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/pages/configuration/headers/
- https://developers.cloudflare.com/d1/

## Files

- `index.html` - application shell and 3HK Hub UI.
- `src/app.js` - main vanilla JS application.
- `src/domain/metrics.js` - Hub metrics, node radius and link width scaling.
- `src/security/html.js` - HTML escaping helpers.
- `src/api/client.js` - browser API client.
- `functions/api/*` - Cloudflare Pages Functions.
- `migrations/0001_initial.sql` - D1 schema.
- `_headers` - Cloudflare Pages security headers.
