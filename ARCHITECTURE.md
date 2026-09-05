# HOST 架构

HOST 负责本地预览和平台模拟；HUD 的领域逻辑不依赖 Vue 组件、Vite HMR 或 iframe。Vue 只作为可替换的表现层实现，这样同一套 HUD 逻辑仍然可以在新版 MMD 舞台、Canvas、Three.js 或 Live2D renderer 中复用。

## 分层

```text
MMD SDK / Mock SDK
        |
Platform Adapter        src/platform
        |
HUD Runtime             src/hud
        |
Core                    src/core
  EventBus + HudStore
        |
Domain                  src/domain
  GameStore + systems
        |
Features                src/features
  游戏规则、状态系统、交互模块
        |
Renderers               src/renderers
  Vue DOM / Canvas / Three.js / Live2D
```

### `platform`

只处理 MMD 提供的接口和页面能力。`src/platform/sdk.ts` 定义 HUD 使用的公共 SDK 契约；生产环境将由 `MmdPlatformAdapter` 对接真实 SDK，本地环境使用 `createMockPlatformAdapter`。这一层可以知道 SDK，但不能包含游戏规则。

### `hud`

`HudRuntime` 是组合根：接收平台适配器，建立事件桥，挂载功能模块和渲染器，并负责统一销毁。它不负责具体游戏逻辑，也不负责 Vue 页面布局。

### `core`

与平台无关的基础设施。`HudStore` 保存 HUD 状态，`EventBus` 为模块间通信提供类型安全的事件通道。复杂系统应通过 store 和事件协作，而不是互相直接调用。

### `domain`

纯游戏状态和规则的边界。`GameStore` 保存阶段、变量、标记、背包等数据，并通过 action 更新；它不引用 DOM、Vue 或 MMD SDK。战斗、任务、经济等系统应在这里消费和产生状态。

### `features`

每个复杂能力一个模块，例如 `dialogue`, `inventory`, `battle`, `quest`。模块通过 `HudFeatureContext` 访问 SDK、状态、事件和文档，并从 `setup` 返回清理函数。模块可以在运行时注册，便于按角色卡启用功能。

### `renderers`

渲染后端的统一入口。当前 HUD 使用 Vue 管理 DOM 组件和响应式视图；需要高频动画时使用 Canvas 或 Three.js；Live2D 作为独立 renderer 挂载到 Stage。Vue 组件只负责表现和触发 action，渲染器通过 `createApp` 管理挂载与销毁，游戏规则仍然位于 framework-neutral 的 Store/Feature 层。

## 当前实现

- `MockMmdRuntime` 仍然负责模拟新版聊天 DOM、消息虚拟化、Stage 和角色卡脚本，这是本地平台实现。
- 平台事件会同步到 `HudStore`，外部模块可通过 `runtime.hud.store.getState()` 读取；本地模拟器的 DOM 操作也会写入同一份状态。
- `runtime.registerFeature(...)` 和 `runtime.registerRenderer(...)` 提供模块挂载入口。
- `createPreviewRuntime` 和 production entry 都挂载 `nikke-spine-stage`；它由 `spineStageRenderer.ts` 创建 Vue 应用，并将 `SpineStageApp.vue` 作为只含模型的 Stage 覆盖层。
- Stage 关闭只隐藏内容，重新打开时保留内部 DOM，符合新版文档。

## 目录约定

```text
src/
  app/                 # Vue Host 的组合和开发工具界面
  core/                # EventBus、HudStore 等纯运行时基础设施
  domain/              # GameStore、游戏系统与领域 action
  hud/                 # HUD Runtime
  platform/            # MMD 真实适配器和 Mock 适配器
  features/            # 可插拔业务模块
  renderers/           # Vue DOM、Canvas、Three.js、Live2D 渲染器
    orangeHud/         # 旧版橙黑 HUD 示例（保留作后续 UI 参考）
    spine/             # Spine Runtime、模型视口和 Nikke 资源配置
  card/                # 本地开发中的角色卡源码
  runtime/             # 当前 Mock Host 的卡片编译与页面模拟实现
```

## 开发顺序

1. 先在 `features` 中实现纯状态和事件逻辑。
2. 再为功能添加 DOM 或 WebGL renderer。
3. 最后在 `platform` 中补齐真实 MMD SDK 差异。

这样本地预览和线上舞台只替换最外层适配器，不会把游戏逻辑重新写一遍。
