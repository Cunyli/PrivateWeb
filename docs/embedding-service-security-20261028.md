# 可选图片嵌入服务依赖 · 2026-10-28

网站 PR #70 合并后，GitHub 依赖图重新识别出独立 Python 服务中的 54 条 Pillow 和 1 条 Torch 告警。它们与已经通过 npm 全量扫描的网站 JS 依赖不同。

更新该服务源码配置：Pillow 12.2.0 → 13.0.0，Torch 2.12.1 → 2.14.1，配套 torchvision 0.27.1 → 0.29.1。PyPI 元数据确认三者都提供 Python 3.12 Linux wheel；torchvision 0.29.1 要求 torch>=2.14.0，与所选版本兼容。

对 requirements 中 7 个固定的直接依赖逐项查询 OSV，均未返回已知告警；Python 服务源码语法检查通过。没有构建包含大型模型依赖的 Docker 镜像，也没有下载权重、启动训练或重新部署远端嵌入服务。因此这些结果只验证仓库的依赖配置，不证明远端服务运行时已经升级，也不是完整传递依赖审计或模型推理回归。

依据：[Pillow 修复范围](https://github.com/advisories/GHSA-5x8w-8jj5-q52h)、[Torch 修复范围](https://github.com/advisories/GHSA-rrmf-rvhw-rf47)、[Pillow 发布](https://pypi.org/project/Pillow/13.0.0/)、[torchvision 发布](https://pypi.org/project/torchvision/0.29.1/)。网站页面、API 与 Supabase 配置没有在本补丁中改动。
