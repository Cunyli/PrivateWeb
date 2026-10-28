# Supabase 版本与认证检查 · 2026-10-28

本记录补充同日的安全审计，版本来自本次官方发布源和实际安装检查。此次代码变更只涉及依赖与运行环境要求。

## 已完成

| 组件 | 原版本 | 更新后 |
| --- | --- | --- |
| 本机 Supabase CLI | 2.40.7 | 2.122.0 |
| @supabase/supabase-js | 2.108.2 | 2.118.0 |
| @supabase/auth-js | 2.75.0（旧 override） | 2.118.0 |
| functions / postgrest / realtime / storage JS | 2.108.2 | 2.118.0 |
| Node.js 最低要求 | 20.9.0 | 22.0.0 |

移除了旧的 auth-js override，认证组件现在按 SDK 的官方依赖关系安装。使用项目锁定的 pnpm 9.15.9 更新锁文件。

本机 Homebrew 因 Xcode 许可检查无法运行。CLI 改用官方 darwin-arm64 独立安装包，校验官方 SHA-256 后安装到现有 PATH 中的 `~/.local/bin/supabase`。原 Homebrew 二进制保留，未接受或修改 Xcode 许可。

官方归档 SHA-256：`fe87a5f9781d5423dbd5ebba2d5a6e1a541d01754d14941c574952e5695eaab0`。

## 云端认证设置

使用用户正常登录的 CLI，向关联项目仅推送以下两个声明字段；未直接提取、显示或保存 CLI 登录凭证：

```toml
[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true
```

新版 CLI 的 config push 保留未声明字段。先审核 config diff，再推送；回读 diff 显示这两个字段已与云端一致。安全检查器的 `auth_insufficient_mfa_options` 告警随后消失，从 10 条降为 9 条（1 ERROR、8 WARN）。这仅启用了项目的 TOTP 能力，不代表用户已经绑定验证器，也没有强制所有会话达到 AAL2。

仍有 8 条托管 PostGIS 对象告警，以及 1 条泄露密码保护告警。原审计中的 Data API 防护继续生效，托管对象的权限/归属限制仍存在。泄露密码保护需要 Pro 或更高方案；本轮未启用该开关、未升级计费方案。未发送 Support 草稿。

## 云端数据库版本

| 组件 | 实际安装 | 当前实例提供的扩展版本 |
| --- | --- | --- |
| PostgreSQL | 15.14 | — |
| PostGIS | 3.3.7 | 3.3.7 |
| pg_trgm | 1.6 | 1.6 |
| vector | 0.8.0 | 0.8.0 |

扩展已与当前实例提供的默认版本一致。CLI/SDK 升级不会升级托管 PostgreSQL。数据库大版本升级需要在控制台核对该项目可用目标、兼容性与停机窗口；本轮未执行云端数据库升级、重置或数据删除。

## 验证

- 实际安装的六个 Supabase JS 组件均为 2.118.0。
- Supabase 授权与请求限额回归、Portrait 翻页回归、双语作品文案检查通过。
- TypeScript 检查、生产构建通过；完整 JavaScript 依赖审计 0 条漏洞。
- 隔离生产服务 18 项 HTTP 检查通过：主要页面、未公开作品隔离、匿名管理请求 401、公开优化素材与私有源图边界。
- 没有在报告或仓库中保存完整认证配置、密钥或用户记录。

## 官方依据

- [CLI 2.122.0 发布](https://github.com/supabase/cli/releases/tag/v2.122.0)
- [Supabase JS 2.118.0](https://www.npmjs.com/package/@supabase/supabase-js/v/2.118.0)
- [TOTP 设置及绑定流程](https://supabase.com/docs/guides/auth/auth-mfa/totp)
- [密码保护与方案限制](https://supabase.com/docs/guides/auth/password-security)
- [托管数据库升级及停机说明](https://supabase.com/docs/guides/platform/upgrading)
