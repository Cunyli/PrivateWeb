# Portfolio 文案重构 · 2026-10-28

已接入本地预览：36 个已发布系列、420 张照片，中英文标题与描述。照片副标题留空，避免同一画面重复两层修辞。当前网站照片、顺序、ID、构图及动画保持原有实现。

## 来源与模型

- 只读导出已发布作品的公开元数据；原始快照的 SHA-256 与导出时间记录在 `portfolio-editorial-coverage.json`。
- OpenCode CLI 2.0.32，经本机 Verda public endpoint `inference.verda.com` 使用实际模型 `verda/kimi-k3`。未切换到其他提供商或模型。
- 24 批：6 批系列、18 批照片。给模型提供编号联系表、640 像素公开缩略图与已有作者记录。未提供密钥、后台账户、预约记录或完整相片原件。
- 独立临时目录、自定义只输出文案的 agent、禁用工具权限；任务内 `editorial` variant 使用同一 Kimi 模型的 `reasoning_effort: low`。全局 OpenCode 配置未改。
- 先验证文本/图像调用，再生成结构化草稿；从带前缀说明的输出中只提取完整、schema 与 ID 均有效的 JSON，没有把 CLI 退出码当成文案验收。
- Codex 对全部 18 组照片联系表和系列文案逐批看图校对，另看不明确的单张图；手动修正认图、地名翻译、时间推断和叙述人称。保留原作者经历，删去无依据的情绪、关系与感官描写。

OpenCode v2 配置依据：[agents](https://opencode.ai/v2/docs/agents/)、[models](https://opencode.ai/v2/docs/models/)。

## 文案方向

具体、克制、带一点自己的语气。地点提供线索，经历提供区别，不套“低语、永恒、时光”等模板。英文按语境重写，保留 Zima Blue、Twin Peaks 等有意的引用。

例子：

- `Slovenia / 画画的老头` → `布莱德，四欧一张 / Four Euros by Lake Bled`
- `Vienna / 多瑙河` → `维也纳，先躺一下 / Vienna, Take It Slowly`
- `寂夜飞羽 / 灯柱下，海鸥数着城市的心跳` → `夜里的灯架 / Floodlight Tower`，修正灯架被写成灯塔的认图错误。
- 原来没有标题的仲夏节末张 → `狗也来游泳了 / The Dog Goes for a Swim`，修正草稿把狗认成游泳者的错误。

## 本地实现

- `data/portfolio-editorial-collections.json`：系列文案。
- `data/portfolio-editorial-photos.json`：单张照片文案。
- `lib/portfolio-editorial.ts`：系列读取与双语匹配；420 张照片的检索文本延迟导入，不进入首页初始动画所需的包。
- `lib/portfolio-photo-editorial.server.ts`：服务器读取照片文案；详情页只把当前需要的条目传给客户端。
- 列表、详情、分类 API 和搜索结果统一读取新文案。直接匹配新文案的搜索结果排在语义推荐之前。
- 修正详情页 metadata 查询中不存在的 `primary_location_*` 字段，保留现有地点关联表查询。
- `/copy-review.html` 提供可搜索、按系列筛选、可切换中英文的新旧对照，独立分页，不加入网站导航。

原数据库没有写入或删除。这轮文案以两个 JSON 文件为来源；已覆盖 ID 的文字优先于后台原文。未来新增的 ID 没有本地文案时，继续使用原后台内容。若要编辑这一轮文案，更新对应 JSON 后同步对照页。

## 验证

运行 `node scripts/check-portfolio-editorial.cjs`，检查完整 ID 覆盖、父系列归属、中英字段、系列内重名、英文混入中文、空副标题，以及真实读取函数的延迟导入、双语搜索和未知 ID 回退。

独立运行 TypeScript 检查；生产构建在 `/private/tmp/portfolio-refresh-audit-20261028/site` 中完成，未重启或中断端口 3000 的原预览。原项目 build 配置跳过内置类型检查，因此另跑 `tsc --noEmit --incremental false`。

原始快照、Kimi 草稿、联系表、人工修正记录与验证输出保存在本次任务附件目录的 `portfolio-editorial-20261028.zip` 及 `portfolio-editorial-checks-20261028.json`。
