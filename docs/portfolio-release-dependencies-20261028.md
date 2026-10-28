# 发布前依赖安全更新 · 2026-10-28

首次上传时 GitHub 报告主分支有 41 条依赖告警（包括 package.json / lockfile 的重复记录）。本轮继续从 npm 注册表对候选锁文件进行完整扫描，按新增发现补齐修复。最终 `pnpm audit --json` 退出 0，info / low / moderate / high / critical 均为 0。这是本次扫描的结果，不是对未来漏洞或所有安全问题的保证。

- Next.js / eslint-config-next 保持 15.5 系列，升级至 15.5.28；没有迁移到 Next 16。
- Sharp 升级至 0.35.5，校验其原生 WebP 编码可用。
- 更新 postcss、source-map-js、browserslist、brace-expansion、nanoid 3、js-yaml、@humanfs/node 和 postcss-selector-parser 6 的受影响版本，使用 pnpm overrides 限定兼容范围。
- 当前源码没有使用 Zod 或 @hookform/resolvers。移除这两项遗留模板依赖，并显式移除 OpenAI 4 SDK 的可选 Zod peer；没有删改表单校验逻辑，也没有升级 SDK 或调用外部模型。独立检查确认现有普通 chat-completion SDK 可正常加载。
- 固定 pnpm 9.15.9，继续使用现有 package.json overrides 与锁文件格式。当前全局 pnpm 11 会忽略旧位置的 overrides；固定版本避免依赖修复在重新安装时被静默忽略。

官方依据：[Next.js 新增图像处理告警及修复范围](https://github.com/advisories/GHSA-2464-fhr4-w9xw)、[Sharp 上游图像库告警](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c)、[已撤回的 braces 告警](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)。没有手动忽略 audit 告警或关闭扫描；GitHub 主分支告警状态会在合并后随依赖图重新计算。

候选安装、类型检查、Portrait / 文案 / 安全回归和正式构建均在独立目录执行。主预览的现有 node_modules 在此阶段保持运行中的版本，避免安装过程破坏正在使用的预览；发布代码和锁文件使用上述已验证版本。运行本地预览前应按锁文件安装依赖。

此记录与 Supabase 平台检查分开：8 条托管 PostGIS 与 2 条 Auth 配置告警仍按前一份审计记录处理，未被包依赖扫描的 0 结果覆盖。
