# 3HK Hub 生产部署与初始化步骤

## 1. 创建 Cloudflare 资源

```powershell
npx wrangler d1 create 3hk-hub
npx wrangler d1 execute 3hk-hub --file migrations/0001_initial.sql
npx wrangler pages secret put OPENAI_API_KEY
```

把生成的 D1 `database_id` 写入 `wrangler.toml`。

## 2. 配置 Cloudflare Access

- 为 Pages 项目或写入型 `/api/*` 路由配置 Access 策略。
- 设置 `ADMIN_EMAILS`，例如 `founder@3hk.xyz,ops@3hk.xyz`。
- 前端通过 `GET /api/session` 判断管理员身份；邮箱注册访客保持只读。
- 访客可通过 `/api/register` 邮箱注册，系统写入 `visitors` 和 `visitor_sessions`，并自动建立只读访客会话。

## 3. 绑定生产域名

在 Cloudflare Pages 项目中添加自定义域名：

```text
hub.3hk.xyz
```

如果 `3hk.xyz` 在同一 Cloudflare 账户，DNS 通常会自动创建；否则添加 CNAME：

```text
hub -> <your-pages-project>.pages.dev
```

## 4. 导入初始数据

1. 管理员通过 Cloudflare Access 登录。
2. 在数据管理区导入 Excel 或 JSON。
3. 系统写入 D1 并重新计算 Hub metrics。
4. 导出的金额单位保持：
   - 公司收入：人民币元，Excel 显示为亿人民币。
   - 机会金额：人民币元，Excel 显示为百万人民币。

## 5. 规则与 AI 配置

后台配置中的权重含义：

- `Demand-Resource Match`: 需求资源匹配。
- `Industry Affinity`: 行业相似与协同。
- `Cross-Border Bridge`: 跨区域桥接路径。
- `Scale Fit`: 规模承接关系。
- `Advisor Influence`: 顾问影响力。

AI 调用只允许后端代理：

```text
/api/analyze-opportunities
```

不要在前端保存或填写模型 API Key。

## 6. 验证

```powershell
npm test
npm run build
npm run test:e2e
```

生产发布后检查：

- `https://hub.3hk.xyz/` 正常打开。
- 公共访客只读，邮箱注册后显示为已登录访客但不能执行写入操作。
- 管理员通过 Access 后可导入、编辑、导出和生成报告。
- `/api/analyze-opportunities` 拒绝未授权请求。
