# 合并图鉴与双版本播放器

## 资源与入口

- 新库：`../mmd-spine-models/models/nikke-db-2026-08-26`，来自 Nikke-db 快照。
- 旧库：`../mmd-spine-models/models/nikke-spine-library`，保留独有角色和旧动作。
- 合计 730 份档案、1,756 个骨骼变体。其中 632 个为 Spine 4.0，1,124 个为 Spine 4.1。档案包括服装、NPC、场景，不等于独立角色数量。
- `src/renderers/spine/nikkeCatalog.generated.ts` 是生成的紧凑目录，不要手动修改。
- `spineCatalog.ts` 展开目录；本地与生产入口分别传入资源根路径。
- `SpineStageApp.vue` 管理图鉴、确认框和版本切换；`SpineViewport.vue` 管理播放器生命周期。
- `spineRenderer.ts` 使用同版本官方骨骼解析与 WebGL 渲染，自己持有并取消动画帧。
- `spineGeometry.ts` 采样当前动画范围；每帧只更新动画，不重新缩放镜头。

## 重新生成

在 HOST 目录依次运行：

```powershell
npm run generate:spine-catalog
npm run generate:spine-thumbnails
npm run generate:spine-catalog
npm run prepare:spine-release
npm run test:spine
npm run build:hud
npm run test:hud-json
```

第二次生成目录用于把新增的小图写入目录。生成器按骨骼版本选择官方解析器；同目录中名称不一致的图集只有在唯一配对时才采用。无法解析的条目写入 `reports/catalog-audit.json` 并使命令失败，不会悄悄跳过。

小图从本地资源离线生成，浏览器首屏不加载骨骼和大纹理。小图使用 Canvas 栅格化，仅用于导航，复杂混合和裁剪效果可能与 WebGL 播放器略有不同。默认优先皮肤 `00`，其次 `default`，不会自动选择背景皮肤。

流量估算按模型脚本实际字节数（含 Base64）加本变体所有纹理求和，不把它当作运行时内存大小。图片尺寸与图集声明不一致时，网格 UV 仍按图集逻辑尺寸计算；大图按 GPU 上限降采样，多页纹理逐页装载。

## 发布依赖

`spine-release.json` 的 `repository`、`ref`、`packageDirectory` 决定生产 URL。`v2.0.0` 已于 2026-09-06 发布，指向提交 `8aa5985b4354bc0d484d4bfc76eef108a6ef5c06`。

`release-assets/publish-manifest.json` 列出每个文件的本地路径、仓库目标路径、大小和 SHA-256。它引用已有模型纹理，不额外复制整套大库；`release-assets/packages` 和 `thumbnails` 是新生成的脚本包、小图。

先将清单中的文件发布到指定仓库路径及不可变标签，并验证外链，再将 `published` 标记更新为 `true`，重新编译。此标记只是发布记录，不能替代 CDN 可用性检查。脚本不会自动提交、推送或创建远程标签。

当前生成的 `dist-hud/mmd-hud.json` 引用已发布的 `v2.0.0` 资源；本地仍使用本地模型。已有冬日露菲保留线上 `v1.0.1` 包。本次按用户要求只发布资源，没有重复运行模型、界面或真实 MMD 导入测试。

## 验证

- `npm run test:spine` 检查覆盖率、目录唯一性、所有包注册、版本头、估算字节和小图。
- `npm run test:hud-json` 按一次顺序替换重建代码，检查 20,000 字限制、JS 语法和重复启动保护。
- `/stage-preview.html` 是直接舞台预览；`?injection&audit` 使用实际 JSON 和本地资源测试，关闭 `connect-src`，只允许脚本和图片资源。
- `/tests/render-check.html` 运行 7 类模型的桌面、手机 WebGL 像素检查：非空、运动、镜头稳定、边界留白、销毁后停止。
- 本地模拟不是对真实 MMD 新版 DOM/CSP 的实时在线验收；正式平台仍需在资源发布后做最后一次导入测试。

Spine 运行时受 Esoteric Software 的运行时许可约束，依赖包中的许可与模型素材权利是两回事。分发时保留构建目录中的第三方许可文件。
