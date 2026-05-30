# AIConnect 真实初始化与智能匹配执行步骤

## 1. 准备真实数据

按 `real-data-template.json` 准备公司和顾问数据：

- `companies`: 公司名称、地区、行业、主营业务、收入规模、需求、资源、痛点。
- `advisors`: 顾问姓名、头衔、机构、能力、覆盖行业、覆盖区域、关系强度。

## 2. 导入初始化数据

进入页面底部“数据管理”：

1. 管理员权限下点击“导入 Excel”或“导入 JSON”。
2. 选择真实数据文件。
3. 系统自动重算机会池、顾问连接和图谱。
4. 点击“保存本地”。

Excel 推荐包含三张表：`公司数据库`、`顾问数据库`、`机会池`。如果只导入一张项目清单，系统会按公司清单处理并重新生成机会池。

字段单位：

- 中国大陆企业：`城市`，用于地图城市坐标落点。
- 公司收入：`收入规模（亿人民币）`
- 机会金额：`机会规模（百万人民币）`、`期望值（百万人民币）`
- 机会跟进：`备注`、`跟进1`、`跟进2`、`跟进3`、`跟进4`、`跟进5`

## 3. 配置规则引擎

进入“规则引擎与 AI 配置后台”：

- `需求资源匹配`: 控制公司需求和资源的匹配权重。
- `同业协同`: 控制同一行业的加分。
- `跨区域机会`: 控制出海、区域互补的加分。
- `规模承接关系`: 控制大公司需求与供应商承接能力的加分。
- `顾问影响力`: 控制顾问资源对机会评分的影响。
- `强匹配阈值`: 控制进入高质量机会池的最低分数。

点击“保存配置并重算”后，机会池会立即更新。

## 4. 配置 AI 提示词

在“智能匹配提示词”中维护系统提示词。建议要求模型输出结构化 JSON：

- `opportunity_type`
- `source_company`
- `target_company`
- `recommended_advisor`
- `estimated_value`
- `probability`
- `expected_value`
- `evidence`
- `risk_factors`

## 5. 配置模型 API

当前版本已支持真实 AI 分析：

1. 前端先用规则引擎生成候选机会。
2. 启用“真实AI分析”后，前端把候选机会提交到 `/api/analyze-opportunities`。
3. Cloudflare Pages Function 从 `OPENAI_API_KEY` 读取密钥。
4. 后端调用 OpenAI-compatible Chat Completions API。
5. 模型返回结构化 JSON。
6. 前端合并 AI 的机会排序、证据、风险因素和下一步建议。

本地直连测试也可以在后台填写 `https://api.openai.com/v1` 和 API Key。API Key 只保存在当前浏览器会话。

## 6. 生产化推荐架构

- 前端：Cloudflare Pages
- 后端：Cloudflare Workers / FastAPI / Node.js
- 数据库：PostgreSQL / Supabase
- 向量检索：pgvector
- 模型：OpenAI API 或其他兼容 API
- 密钥：Cloudflare Secrets / 后端环境变量

## 7. 注意事项

不要把真实 API Key 放在前端静态页面里。当前页面里的 API Key 输入框只用于本机直连测试，生产环境使用 `OPENAI_API_KEY` Secret。
