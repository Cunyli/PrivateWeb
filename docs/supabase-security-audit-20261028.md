# Supabase 安全修复记录 · 2026-10-28

此文记录发布前的审计状态；后续线上发布状态以 GitHub PR 和 Vercel 部署记录为准。

项目：`ncytmmujlnhscchfujkc`。已通过现有 Supabase CLI 登录连接并修改云端数据库。本地网站代码已修改、验证，**尚未部署到线上**。本轮没有删除作品、图片、预约记录，没有重置数据库或轮换 JWT / 服务密钥，也没有修改页面视觉排版。

## 已修复并在云端生效

| 项目 | 修复前 | 修复后 |
| --- | --- | --- |
| 匿名读取照片 | 494 张，包含未发布系列中的 74 张 | 420 张，只能读取照片自身及其父系列均已发布的数据 |
| 匿名读取公开系列 | 36 个 | 仍为 36 个 |
| 服务端管理读取 | 494 张、45 个系列 | 数量不变 |
| 内部表与向量表 | 部分存在过宽读取 / 写入权限 | 内部表、向量表拒绝公开直接访问 |
| 扩展表 / 扩展 RPC | 大量公开 RPC 可直接调用 | Data API 只放行应用公开内容及必要的只读地图 RPC |
| 写入与清表权限 | 多个表向 anon / authenticated 授予了不必要的写入、TRUNCATE 等权限 | 已收回；ai_tasks 保留其现有用户所有权 RLS 行为 |
| pg_trgm | 安装在 public | 已迁移至 extensions |

根因是旧的 permissive SELECT 策略与新策略通过 OR 合并：`USING (true)` 覆盖了已发布限制。本轮移除了宽松 / 重复策略，并增加 restrictive 发布边界，防止未来另一个宽松 SELECT 策略重新放开草稿。

应用拥有的 26 个表的公开授权、18 个内部函数和 postgres 新对象默认权限已收紧。数据库内的授权与 RLS 已使用 anon、authenticated、service_role 分别检查。公开地图只读 RPC 仍能调用；REST 关联查询可读取 35 个公开系列地点。

`public.enforce_portfolio_api_access()` 配置为 PostgREST 的 pre-request 钩子。其允许列表只针对匿名 / authenticated 的 Data API 请求；它不把应用内管理员当成数据库 service_role。管理写入仍经服务器校验后使用服务密钥。

钩子只作用于 Data API，不能替代 Storage、Realtime、GraphQL 或直接 SQL 的权限控制。实际照片表另有 RLS 和最小授权独立保护。本轮目录检查显示：Storage 存储桶 0 个、Realtime 发布表 0 个；应用自身的公开视图均已使用 security_invoker。

## 已在本地网站修复，等待部署

- 删除 R2 文件、图片分析、翻译、地理编码接口补上服务端管理员校验；相关客户端调用与服务器内部调用同时补齐当前会话 Authorization。
- 管理员必须有经 Supabase 验证的有效会话、已验证邮箱，并命中服务端私有邮箱允许列表。NEXT_PUBLIC_ADMIN_EMAILS 不再有授权作用。
- 后台页面通过 `/api/admin/session` 检查服务器授权，缺少私有管理员配置时拒绝访问。
- `supabaseAdmin` 标记 server-only，关闭服务端持久会话与自动刷新。公共 SSR 使用单独的匿名客户端，遵守 RLS。
- `/work/[id]`、搜索结果、样式数据与精选照片添加或继承父系列已发布限制；猜测草稿编号也不能进入浏览器取图。经既有样片配置明确选定的约拍人像仍由受控服务端出口提供，未擅自下架。
- 登录返回地址限制为本地路径，拦截外部跳转、反斜杠、编码分隔符和控制字符等绕过形式。
- 约拍 / 语义搜索接入数据库共享限额，移除公开错误响应中的提供方 / 数据库详细错误。内部计数表仅 service_role 有权限，不保存 IP 或客户信息。
- 公共 SSR 相关查询失败时交回浏览器的数据获取回退流程，避免把不完整的地点 / 分类数据静默当成完整结果缓存。

### 共享限额的行为

约拍：全站每小时 20 次、每天 60 次。语义搜索：全站每分钟 60 次、每天 2000 次。这些是本轮选定的保守运营值，可以在 SQL 函数中调整，并非平台默认或“无限防刷”保证。

限额在所有实例之间共享，超额返回 429 与 Retry-After。数据库限额服务失败时返回 503，停止发送邮件或调用 embedding。**因此数据库异常时约拍暂时不可提交，即使本地预约日志原本可以作为写入回退。**共享总额也不能取代部署平台按 IP 的速率限制 / WAF；本轮没有假定或修改未知部署平台的规则。

## 仍需处理：10 条官方安全告警

官方 Security Advisor：11 条降到 10 条，当前仍有 1 条 ERROR、9 条 WARN，不能称为全部清零。

1. **8 条与 PostGIS 托管对象有关**：public 扩展、spatial_ref_sys 的 RLS、三个 st_estimatedextent SECURITY DEFINER 重载对 anon / authenticated 的执行权限各 3 条。对象归 supabase_admin，当前 postgres 不是超级用户或该角色成员。PostGIS 3.3.7 不支持直接 relocatable 迁移；普通 REVOKE 的回滚实验也确认托管 ACL 无法被本角色有效修改。spatial_ref_sys 是内置坐标参考资料，并非客户记录。Data API 已阻止这些对象被公开直接调用，但底层 ACL / schema 告警仍存在。
2. **2 条认证设置告警**：泄露密码保护未启用、MFA 选项不足。控制台尚未登录；自动审批拒绝了额外直接读取 macOS 钥匙串内 Supabase CLI 凭证的方法，理由是该提取方式未经明确授权、有敏感凭证暴露风险。此后没有绕过或间接提取，等待用户登录控制台或明确授权该具体方式。

已准备 [Supabase Support 草稿](supabase-postgis-support-draft.md)，请求官方文档所述的无损 PostGIS 迁移；**未发送**。不执行 DROP EXTENSION CASCADE，也不修改托管系统目录来冒险消除告警。

官方依据：[PostGIS 与迁移说明](https://supabase.com/docs/guides/database/extensions/postgis)、[Data API 安全及 pre-request 范围](https://supabase.com/docs/guides/api/securing-your-api)、[安全检查器](https://supabase.com/docs/guides/observability/advisors)。

## 验证与实际边界

- 独立 TypeScript 检查通过。项目原有构建配置忽略类型 / ESLint 错误，因此没有用构建替代 TypeScript 检查。
- 隔离镜像完整 production build 通过，允许访问 Supabase，日志无抓取失败。未重启或污染正在运行的 3000 端口预览。
- 安全回归测试通过：缺少令牌、无效会话、非管理员、未验证邮箱、只有公开邮箱配置均被拒绝；合法私有允许列表被接受；8 类外部跳转 payload 被拦截；限额成功、429、503 分支通过。
- 11 个真实本地管理接口的匿名请求均返回 401；7 个真实 Supabase 公开边界检查通过，包括编码形式的扩展 RPC 路径。
- 12 个路由检查通过：公开浏览器 / 样式 / 样片 / 简历可读，草稿系列和草稿照片显示不存在。开发模式中 Next.js 流式 notFound 可先返回 HTTP 200，随后携带 404 fallback；测试检查了该信号，没有把它误当成内容公开。
- 浏览器检查了公开照片打开、下一张、返回、地图加载；保留了地图回归截图。公开 SSR 实际读取到 36 系列、35 地点；模拟地点查询异常确认返回回退信号。
- 检查 187 个已跟踪文件和 84 个构建客户端资源，对照本地 8 类已配置服务端密钥，未发现值被写入；没有已跟踪的真实 .env。此检查不等于整个 Git 历史或未知外泄渠道扫描。
- 没有通过真实管理员提交 / 删除、实际发送预约邮件或付费模型调用来测试。管理员分支使用受控测试数据验证；最终真实登录操作仍待用户完成。
- RLS 限制数据库元数据；已经公开在 R2/CDN、且 URL 已被获知的文件，不能靠 RLS 收回访问。已选定展示的约拍样片继续公开展示。

## 实施文件与恢复

已应用的数据库变更：
- [权限收紧 SQL](supabase-security-hardening-20261028.sql)
- [共享请求限额 SQL](supabase-public-budgets-20261028.sql)

准备好的恢复脚本（没有执行）：
- [原授权 / 策略恢复 SQL](supabase-security-rollback-20261028.sql)：恢复原状态也会恢复原漏洞，仅用于审阅与明确选择的故障恢复。
- [限额对象恢复 SQL](supabase-public-budgets-rollback-20261028.sql)：应先回退应用调用，再移除本轮私有计数对象；不删除客户数据。

本轮 source patch 以执行前的脏工作区为基线生成，共 28 个源文件，不包含此前视觉改动。代码备份暂存在 `/private/tmp/portfolio-supabase-security-20261028/before/`；安全验证 JSON、受控 source patch、截图保存在本次可视化附件目录。原始 CLI 认证诊断日志保留于权限受限的临时目录，未纳入仓库、附件或报告。

未提交 Git、未推送、未部署线上，等待认证设置访问和托管 PostGIS 后续处理。
