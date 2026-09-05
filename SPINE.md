# Spine 接入说明

HOST 已内置官方 `@esotericsoftware/spine-webgl@4.0.31`。当前下载的 Nikke
资源标记为 Spine `4.0.47`，因此使用 4.0 Runtime 以保证 binary skeleton 兼容。
`SpineViewport.vue` 可以加载 JSON 或 binary skeleton：

```text
skeleton.json 或 skeleton.skel
角色.atlas
atlas 引用的 PNG 纹理
```

## 当前模型

`public/spine/nikke-rupee/` 保存本地开发文件：`c203_00.skel`、`c203_00.atlas`
和 `c203_00.png`。它们对应公开仓库中的 Rupee: Winter Shopper，模型提供
`idle`、`action`、`delight`、`special` 等 14 个动画。舞台会自动选择 `idle` 循环播放，
并根据 canvas 尺寸重新计算 WebGL 相机和 GPU viewport。

## 接入有授权的 Nikke 资源

在真实 MMD 页面注入模型舞台前，可以设置 `window.__MMD_SPINE_ASSET__` 覆盖默认资源：

```js
window.__MMD_SPINE_ASSET__ = {
  id: 'rapi',
  label: 'RAPI / SPINE 4.0',
  basePath: 'https://assets.example.com/rapi/',
  skeleton: 'rapi.json',
  skeletonType: 'json',
  atlas: 'rapi.atlas',
  animation: 'idle',
  loop: true,
  premultipliedAlpha: false,
  source: 'user-provided',
  licenseNote: '自托管资源，已确认拥有网页嵌入授权',
}
```

真实 MMD 舞台的 CSP 通常允许外部脚本和图片，但不允许跨域 XHR。对于
binary skeleton 或 atlas，资源仓库应额外提供一个 `externalScript`，由脚本
把两者注册到 `window.__MMD_SPINE_PACKAGES__`。HOST 会动态插入该脚本，并将
注册的数据转换为 `inline` 配置；atlas 引用的 PNG 仍通过 `basePath` 作为图片
加载。例如：

```js
{
  basePath: 'https://cdn.jsdelivr.net/gh/owner/mmd-models@v1.0.1/models/rapi/1.0.0/',
  skeleton: 'rapi.skel',
  skeletonType: 'binary',
  atlas: 'rapi.atlas',
  externalScript: 'https://cdn.jsdelivr.net/gh/owner/mmd-models@v1.0.1/models/rapi/1.0.0/model.js',
  externalPackage: 'rapi',
}
```

如果 atlas 中的纹理文件名与 URL 不同，可以使用 `textureAliases`：

```js
textureAliases: {
  'rapi.png': 'https://assets.example.com/rapi/rapi-page.png',
}
```

使用 `basePath` 时，别名建议写成相对文件名；如果每个文件都是完整 URL，
则省略 `basePath`，并把 `skeleton`、`atlas` 和 `textureAliases` 都写成完整 URL。

外部脚本和 PNG 必须来自同一个可访问版本，且 Spine Runtime 版本要与导出版本
兼容。skeleton/atlas 已由 `model.js` 内嵌，因此不再依赖跨域 XHR。

## 资源来源与使用范围

当前本地文件最初来源：

```text
https://github.com/hebin1979/nikke-rupee-winter-viewer
```

生产默认资源托管在以下仓库的固定版本中：

```text
https://github.com/Godcount10/mmd-models/tree/v1.0.1/models/nikke-rupee-winter-shopper/1.0.0
```

资源仅按本地开发和个人酒馆预览用途接入，不代表项目拥有 Nikke 原作素材的
再分发权。若部署给其他用户，请替换为你有权使用或自行托管的资源，并确保
远程服务器允许 MMD 页面跨域加载。

官方运行时本身带有 Spine Runtimes License，依赖安装在 `node_modules` 中并在
构建产物中使用；发布产品时应保留该许可及版权声明，并确认你的 Spine 编辑器
授权满足运行时许可条款。
