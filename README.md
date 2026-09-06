# MMD 新版 Host 本地预览

这是一个用于开发新版 MMD 角色卡的本地模拟环境。它保留 Vite HMR，角色卡源码变化后会在 iframe 模拟页面中自动重载，方便实时检查 HTML、CSS、正则替换和 SDK 脚本。

架构边界见 [ARCHITECTURE.md](./ARCHITECTURE.md)。HUD 逻辑应放在 `src/features`，跨平台状态放在 `src/core`，Vue DOM/Canvas/WebGL 输出放在 `src/renderers`；`src/runtime` 仅是本地 Host 的模拟实现。

## 源码备份与资源边界

源码仓库为 [Godcount10/new-mmd-hud](https://github.com/Godcount10/new-mmd-hud)，仓库根目录对应本地 `HOST`。本仓库独立于旧版 HUD 项目，仅备份新版模拟 Host、HUD、播放器、构建和维护脚本、测试代码及文档。

- 包含 `src/renderers/spine/nikkeCatalog.generated.ts` 图鉴索引和 `spine-release.json` 外链配置；索引不是模型资源本体，普通构建无需重新生成它。
- 不包含 `public` 中的本地模型、`release-assets`、旁边的 `mmd-spine-models`、`node_modules`、构建产物、报告、缓存或本机凭据。这些文件仍保留在原电脑上，`.gitignore` 只排除上传，不删除文件。
- 模型发布资源单独保存在 [Godcount10/mmd-models](https://github.com/Godcount10/mmd-models)。生产 HUD 根据 `spine-release.json` 使用已发布的 CDN 资源。

接收源码后，建议安装 Node.js 22，再运行 `npm ci` 安装锁定版本的依赖。`npm run build:hud` 可直接使用现有图鉴索引生成引用 CDN 资源的注入 JSON，不需要下载本地模型库。

**当前本地预览仍默认使用本地资源，并未自动切换到 CDN。** 单独克隆本仓库后可以启动模拟 Host，但要完整预览模型，还需要恢复同级 `mmd-spine-models/models` 与本目录 `release-assets`；历史单模型示例另需 `public/spine`。仅克隆已发布的模型仓库不能补齐全部原始骨骼、图集和生成元数据。

`generate:*`、`prepare:spine-release`、模型审计及 `test:spine` 属于资源维护流程，需要对应本地资源和生成文件，不是源码首次安装的必需步骤。`scripts/publish-spine-release.mjs` 是针对 `Godcount10/mmd-models@v2.0.0` 的专用发布脚本，并非供接收者直接运行的通用上传命令。

## 启动

在本目录执行：

```powershell
npm install
npm run dev
```

默认打开 `http://127.0.0.1:5180/`，端口占用时 Vite 会自动尝试下一端口，以终端输出为准。`/stage-preview.html` 可直接查看全屏 HUD。

## 开发入口

编辑 `src/card/currentCard.ts`：

- `beginning`：初始 AI 消息；
- `statusbar`：状态栏插槽内容；
- `rules`：普通文本或 `/正则/flags` 替换规则；
- `replaceString` 中的 `<style>` 会安装到模拟页面；
- `replaceString` 中的 `<script>` 会在 iframe 内执行。

保存文件后，右侧预览会通过 HMR 更新，不会刷新整个 Host 控制台。

## 模拟范围

iframe 页面提供新版角色卡常用的 DOM 标记：

- `data-chat="root|header|messages|list|message-frame|message|message-body|composer|input|send|author-stage"`；
- `data-slot="statusbar|left|right|toolbar|message-extra"`。

角色卡脚本可使用 `sdk`：

- `sdk.input`、`sdk.composer`、`sdk.message`；
- `sdk.cache`、`sdk.save`；
- `sdk.stage`、`sdk.role`、`sdk.user`；
- `sdk.on(event, callback)`、`sdk.debug.log(...)`、`sdk.version`。

左侧控制区可触发主题切换、舞台开关、AI 流式回复、消息挂载/卸载、会话切换和返回事件。事件日志页会显示生命周期事件、脚本输出和规则错误。

运行时也暴露了可插拔入口：`MockMmdRuntime.registerFeature(...)` 和 `MockMmdRuntime.registerRenderer(...)`。模块通过 `HudFeatureContext` 访问 `HudStore` 与类型安全事件总线，不需要直接依赖 Vue 组件。`GameStore` 由需要游戏逻辑的实例显式创建和传入。

## 内置 Spine 舞台

`createPreviewRuntime` 默认注册 `nikke-spine-stage` renderer。点击“切换舞台”会以 `full` 模式打开图鉴，覆盖模拟原生界面。当前合并了 730 份角色、服装和场景档案，包含 1,756 个模型变体与 730 张本地生成的小图。冬日露菲位于 `c203`，旧库独有资源也已保留。

浏览图鉴只加载小图；选择版本并确认流量后，才下载对应模型包与纹理。官方 Spine 4.0、4.1 运行时按骨骼版本自动分流。播放器提供动作、皮肤、暂停和缩放，镜头按动画范围固定取景，上下工具栏不覆盖画布。

目录生成、资源发布和测试说明见 [SPINE-LIBRARY.md](./SPINE-LIBRARY.md)。

## 检查命令

```powershell
npm run typecheck
npm run build
```

## 独立实例

现在按实例选择功能，不在公共入口导入所有播放器。`hud-instances.json` 指定组合入口，构建自动检查模块清单；实例没有引用的功能不会进入其产物。底层 Runtime 不再默认创建游戏状态。

| 实例 | 本地启动 | 编译 | 产物目录 |
| --- | --- | --- | --- |
| NIKKE / Spine | `npm run dev` | `npm run build:hud -- nikke` | `dist-hud/nikke/` |
| 碧蓝航线 / Live2D | `npm run dev:live2d` | `npm run build:live2d` | `dist-hud/live2d/` |

Live2D 默认端口为 5182，直接舞台地址为 `http://127.0.0.1:5182/stage-preview.html`。它按确认后加载的方式提供 243 个模型入口，支持动作、表情、暂停、镜头缩放/拖动和卸载。源码中的轻量目录不是模型文件；原始文件和生成播放包位于独立的 [mmd-live2d-models](https://github.com/Godcount10/mmd-live2d-models) 资源仓库。

完整说明见 [LIVE2D.md](./LIVE2D.md)，新增实例的方式见 [ARCHITECTURE.md](./ARCHITECTURE.md)。只克隆源码也能运行 `npm ci` 和 `npm run build:live2d` 生成线上 JSON；本地模型测试需要资源仓库位于 HOST 的同级目录，或设置 `MMD_ASSETS=remote` 使用 CDN。

## 真实平台产物

本地 Host 和线上 HUD 使用两个独立的 Vite build：

```powershell
# 本地 Vue Host
npm run build

# 真实 MMD 舞台使用的 standalone bundle
npm run build:hud
```

`build:hud` 默认编译 `nikke`，把其 HUD Runtime、Vue、Spine 4.0/4.1、紧凑目录和样式打包到 `dist-hud/nikke/mmd-hud.js`。`build:live2d` 则输出到 `dist-hud/live2d/`，只包含 Live2D 所需的 Vue、Pixi、Cubism Core 和适配器，不含 Spine。二者均为自执行 IIFE，读取真实页面的 `window.sdk`（也兼容脚本作用域里的 `sdk`），自动打开 `full` Stage 并挂载到 `sdk.stage.el()`；模型本体不包含在 IIFE 中。

生产外链由 `spine-release.json` 配置。`Godcount10/mmd-models@v2.0.0` 已于 2026-09-06 发布，提交为 `8aa5985b4354bc0d484d4bfc76eef108a6ef5c06`。发布包含清单中的模型包、纹理和图鉴小图；生成 JSON 本身不会自动上传文件。此前的冬日露菲 `v1.0.1` 仍保留为可选版本。

为兼容 MMD 的 CSP，模型包通过外链脚本注册 Base64 骨骼和图集，纹理使用图片外链；不使用跨域 XHR/fetch 读取模型。注入前可设置 `window.__MMD_SPINE_CATALOG_OVERRIDE__` 明确指定其他目录，默认目录会随每次新注入更新。

```html
<script src="https://你的域名.example/mmd-hud.js"></script>
```

角色卡应优先导入对应实例的 `mmd-hud.json`，不要把完整的大 bundle 塞进单条受限正则。线上外链地址应使用 HTTPS，并按 MMD 平台白名单配置。Vue 只属于表现层，`src/core`、`src/domain`、`src/features` 和平台适配器仍然可以脱离 Vue 使用。

`build:hud` 还会把同一个 bundle 编译为可直接导入 MMD 的角色卡 JSON：

```text
dist-hud/<实例名>/
├─ mmd-hud.js
├─ mmd-hud.json
├─ mmd-hud-manifest.json
└─ mmd-hud-placeholders.txt
```

JSON 使用链式占位符连接规则。每条 `replaceString` 保持在 18,000 字符安全线内，并在构建结束时再次验证不超过平台的 20,000 字符上限；`statusbar` 只放第一条短占位符，最后一条规则负责执行已拼接的 HUD IIFE。可通过 `MMD_HUD_BUILD_ID` 指定 manifest 中的构建标识，不设置时会自动生成时间戳标识。

每份产物还包含 `bundle-modules.json` 和 `THIRD-PARTY-LICENSES.txt`。构建自动验证正则顺序替换、源码重组、重复启动保护和实例模块隔离。原根目录 `dist-hud/mmd-hud.json` 是历史文件，不再由新构建更新。
