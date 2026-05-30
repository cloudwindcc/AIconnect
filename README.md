# AIConnect 机会图谱 Demo

## 打开方式

直接用浏览器打开：

```text
/mnt/c/AIconnect/index.html
```

## 已实现

- 50 个公司节点，5 个顾问节点。
- 公司节点大小代表年收入规模，颜色代表国家或地区。
- 公司之间的机会线：
  - 虚线：潜在合作机会。
  - 实线：合作进行中。
  - 粗细：机会规模。
  - 透明度：成交概率。
- 顾问节点连接其覆盖的公司资源。
- 支持地区、机会类型、期望值、状态和关键词筛选。
- 支持点击节点、点击机会线查看详情。
- 图谱背景加入半透明地图，公司和顾问按地区落在近似坐标位置。
- 支持右键点击机会连线，生成项目机会简要分析报告，并保存本地或下载 Word。
- 支持公司数据库、顾问数据库、机会池表格。
- 支持 Excel 导入/导出公司、顾问和机会池数据。
- 支持管理员/访客两种权限；访客只读，管理员可录入、编辑、导入、导出。
- 支持文字录入和浏览器语音识别入口。
- 点击“解析并匹配”会新增公司节点，并自动生成潜在机会；启用真实 AI 后，会调用 API 对候选机会重排、补充证据、风险和下一步建议。
- 支持导出当前模拟数据 JSON。

## Excel 字段约定

- 中国大陆企业可填写 `城市`，例如苏州、东莞、杭州、上海、深圳；图谱会按城市近似坐标放置。
- 公司收入使用 `收入规模（亿人民币）`，导入 `8` 表示 8 亿人民币。
- 机会金额使用 `机会规模（百万人民币）` 和 `期望值（百万人民币）`，导入 `20` 表示 2000 万人民币。
- 机会池支持 `备注`、`跟进1`、`跟进2`、`跟进3`、`跟进4`、`跟进5`。

## 真实 AI API

默认前端请求同源接口：

```text
/api/analyze-opportunities
```

Cloudflare Pages 部署时，把密钥放在环境变量或 Secret：

```powershell
npx wrangler pages secret put OPENAI_API_KEY
```

本地调试可复制 `.dev.vars.example` 为 `.dev.vars`，填入自己的密钥后运行：

```powershell
npx wrangler pages dev .
```

可选变量：

- `OPENAI_MODEL`：默认 `gpt-4.1-mini`
- `OPENAI_BASE_URL`：默认 `https://api.openai.com/v1`

## 文件

- `index.html`：页面结构。
- `styles.css`：界面样式。
- `app.js`：模拟数据、图谱渲染、AI匹配、录入逻辑。
- `functions/api/analyze-opportunities.js`：Cloudflare Pages Function，代理调用 OpenAI-compatible API。
