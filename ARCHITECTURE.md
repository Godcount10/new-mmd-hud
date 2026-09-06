# HOST 架构

HOST 负责本地预览和平台模拟；HUD 的领域逻辑不依赖 Vue 组件、Vite HMR 或 iframe。Vue 只作为可替换的表现层实现，这样同一套 HUD 逻辑仍然可以在新版 MMD 舞台、Canvas、Three.js 或 Live2D renderer 中复用。

## 分层

```text
Instance                src/instances (按需导入并装配)
  |
  +-- Platform Adapter  src/platform -> MMD SDK / Mock SDK
  +-- HUD Runtime       src/hud -> Core (EventBus + HudStore)
  +-- Domain (可选)     src/domain (GameStore + systems)
  +-- Features (可选)   src/features (游戏规则、交互模块)
  +-- Renderers (可选)  src/renderers (Vue / Canvas / Three.js / Live2D)
```

Runtime 通过统一接口挂载实例选中的 Features 和 Renderers，不直接导入具体实现。需要 Domain 的模块由实例显式传入共享状态；这些能力不是必须逐层加载的依赖链。

### `platform`

只处理 MMD 提供的接口和页面能力。`src/platform/sdk.ts` 定义 HUD 使用的公共 SDK 契约；生产环境将由 `MmdPlatformAdapter` 对接真实 SDK，本地环境使用 `createMockPlatformAdapter`。这一层可以知道 SDK，但不能包含游戏规则。

### `hud`

`HudRuntime` 是基础运行时：接收平台适配器，建立事件桥，挂载功能模块和渲染器，并负责统一销毁。它不导入 Vue、GameStore、Spine 或 Live2D。真正选择功能的组合入口在 `src/instances`。

### `core`

与平台无关的基础设施。`HudStore` 保存 HUD 状态，`EventBus` 为模块间通信提供类型安全的事件通道。复杂系统应通过 store 和事件协作，而不是互相直接调用。

### `domain`

纯游戏状态和规则的可选边界。`GameStore` 保存阶段、变量、标记、背包等数据，并通过 action 更新；它不引用 DOM、Vue 或 MMD SDK。只有需要游戏逻辑的实例才导入和创建它，再作为参数传给功能/渲染器。它不再是 `HudFeatureContext` 的必选成员；旧橙黑示例改为 `createOrangeHudRenderer(domain)` 显式接收，默认在该渲染器内创建。

### `features`

每个复杂能力一个模块，例如 `dialogue`, `inventory`, `battle`, `quest`。模块通过 `HudFeatureContext` 访问 SDK、状态、事件和文档，并从 `setup` 返回清理函数。模块可以在运行时注册，便于按角色卡启用功能。

### `renderers`

渲染后端的统一入口。当前 HUD 使用 Vue 管理 DOM 组件和响应式视图；需要高频动画时使用 Canvas 或 Three.js；Live2D 作为独立 renderer 挂载到 Stage。Vue 组件只负责表现和触发 action，渲染器通过 `createApp` 管理挂载与销毁，游戏规则仍然位于 framework-neutral 的 Store/Feature 层。

## 当前实现

- `MockMmdRuntime` 仍然负责模拟新版聊天 DOM、消息虚拟化、Stage 和角色卡脚本，这是本地平台实现。
- 平台事件会同步到 `HudStore`，外部模块可通过 `runtime.hud.store.getState()` 读取；本地模拟器的 DOM 操作也会写入同一份状态。
- `runtime.registerFeature(...)` 和 `runtime.registerRenderer(...)` 提供模块挂载入口。
- `createPreviewRuntime` 和 production entry 都只导入 `@hud-instance`，由 Vite 在构建/启动时映射到唯一实例文件。
- `nikke` 装配 Spine 图鉴和双版本播放器；`live2d` 装配碧蓝航线目录和 Cubism 播放器。二者不互相导入。
- Host 的 Stage 关闭仍隐藏 DOM；Live2D 实例响应 `stage:close` 卸载模型，避免隐藏后继续占用 GPU。

## 目录约定

```text
src/
  app/                 # Vue Host 的组合和开发工具界面
  core/                # EventBus、HudStore 等纯运行时基础设施
  domain/              # GameStore、游戏系统与领域 action
  hud/                 # HUD Runtime
  instances/           # 每个实例的 local/remote 组合入口与数据索引
  platform/            # MMD 真实适配器和 Mock 适配器
  features/            # 可插拔业务模块
  renderers/           # Vue DOM、Canvas、Three.js、Live2D 渲染器
    orangeHud/         # 旧版橙黑 HUD 示例（保留作后续 UI 参考）
    spine/             # Spine Runtime、模型视口和 Nikke 资源配置
    live2d/            # Cubism 播放器、分片加载、Vue 舞台；不依赖 Spine
  card/                # 本地开发中的角色卡源码
  runtime/             # 当前 Mock Host 的卡片编译与页面模拟实现
```

## 开发顺序

1. 先在 `features` 中实现纯状态和事件逻辑。
2. 再为功能添加 DOM 或 WebGL renderer。
3. 最后在 `platform` 中补齐真实 MMD SDK 差异。

这样本地预览和线上舞台只替换最外层适配器，不会把游戏逻辑重新写一遍。

## 按实例构建

`hud-instances.json` 是构建描述，不导入任何浏览器功能模块。每个实例声明本地/线上入口、资源版本文件、许可证和禁止进入产物的模块路径。`createModules(window)` 返回该实例的可选 `features` 和 `renderers`；它可以先创建游戏状态，再将同一份状态传给相关模块。

```text
构建选择 nikke  -> nikke/remote.ts  -> Spine + Vue -> dist-hud/nikke/
构建选择 live2d -> live2d/remote.ts -> Cubism + Vue -> dist-hud/live2d/
```

未导入的模块根本不进入依赖图；已导入但未使用的无副作用导出再由 Rollup tree-shaking 移除。不要在公共入口放“导入全部模块再按字符串选择”的总表；即使功能在运行时关闭，其静态导入或顶层副作用也可能保留。

构建在 `bundle-modules.json` 记录实际产生代码的模块。发现禁止的模块直接失败。`nikke` 禁止 Live2D/Pixi，`live2d` 禁止 Spine/NIKKE；两者均禁止未使用的 domain/orangeHud。底层测试另外验证纯 Runtime 不依赖模型引擎或 Vue。

单个实例仍输出一个 IIFE：实例内部的动态导入会被内联，不保证延迟执行。Cubism Core 必须先于适配器顶层检查初始化。这里的按需下载指模型数据和贴图，不是将同一实例的引擎拆成额外网络脚本。

添加新实例：在 `src/instances/<id>/` 创建 `local.ts` 与 `remote.ts`，导出满足 `HudInstance` 的 `instance`；在描述文件登记；仅导入所需模块。`npm run build:hud -- <id>` 会单独构建并验证，不覆盖其他实例。
