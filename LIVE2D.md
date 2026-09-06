# 碧蓝航线 Live2D 实例

## 运行与构建

```powershell
npm ci
npm run dev:live2d
# http://127.0.0.1:5182/stage-preview.html

npm run build:live2d
# dist-hud/live2d/mmd-hud.json
```

本地预览默认读取同级 `mmd-live2d-models/azur-lane/v1`，不复制大资源到 HOST/public。只拿到源码时，可下载资源仓库，或在 PowerShell 设置 `$env:MMD_ASSETS='remote'` 后启动 `npm run dev:live2d`。线上构建始终使用 `live2d-release.json` 中的固定版本 CDN 地址。

NIKKE 仍通过 `npm run dev` / `npm run build:hud -- nikke` 使用，两个实例不互相打包。

## 文件与加载

- `src/instances/live2d/`：本地/线上组合入口、243 个模型的轻量索引。
- `src/renderers/live2d/`：Vue 舞台、流量确认、分片脚本加载器、Pixi/Cubism 播放器。
- `vendor/live2d/`：随应用嵌入的官方 Cubism Core 和来源声明；不放到模型资源仓库。
- `scripts/prepare-live2d-release.mjs`：读取现有 2026-03-08 原始合集，校验来源哈希，保存原始文件，并生成播放包及修复记录。
- `scripts/publish-live2d-release.mjs`：本机 Godcount10/mmd-live2d-models@v1.0.0 的专用发布脚本；不是通用上传工具。

资源仓库：[Godcount10/mmd-live2d-models](https://github.com/Godcount10/mmd-live2d-models)。只保存模型原件、适配包、目录、清单和来源说明，不混入 HUD 源码或 NIKKE 数据。

进入舞台不下载模型。用户选择原始文件名，确认估算流量后，按顺序下载该模型的脚本分片。脚本只登记 JSON 字符串；客户端重组后解析为 MOC、动作、物理和表情数据。播放器的内存加载中间件接管这些读取，不发出模型 fetch/XHR。贴图通过可取消的跨域图片请求加载。

单个分片小于 8 MB。超过 19 MB 的源 PNG 另外生成无损 WebP，原 PNG 不变；客户端实际引用的贴图均低于该安全线。若纹理超过设备 WebGL 最大纹理尺寸，载入后等比例缩小再上传 GPU。流量确认按脚本分片和实际引用的图片字节数统计；缓存、压缩、网络请求开销和运行内存不等于该数值。

暂停停止私有 Ticker；隐藏文档暂停渲染；卸载、关闭舞台、实例销毁会停止动画并释放纹理与 WebGL。切换或重试使用新 canvas，避免重用已销毁的上下文。

## 来源适配

原始资源仍为 Eikanya/Live2d-model 的 `94ae3e5628226726af96c6b4bf0e1ce5c728e28e`（2026-03-08），本次没有更换合集日期或重新命名角色。

生成包会修正 `z46_3` 物理文件大小写及嵌套 `zhala_2` 的重复路径。`bulaimodun_5` 原配置中两处指向不存在文件的动作不进入可选列表，其余动作保留。第三方 viewer 的命令动作不执行；本实例不启用模型语音。细节在资源 `manifest.json` 的 `repairs` 中。原文件保留，修正只作用于播放包。

## 验证

```powershell
npm run test:live2d
node tests/live2d-core.mjs
node tests/live2d-lifecycle.mjs
node tests/live2d-browser.mjs
node tests/live2d-browser.mjs --injection
node tests/live2d-browser.mjs --remote
```

浏览器测试使用本机 Edge 和 5182 服务。`--injection` 重现顺序单次正则替换，并设置 `connect-src 'none'`，使用本地播放包；`--remote` 不做本地覆盖，实际访问 CDN。覆盖确认前不下载、取消、画布非空与动画变化、暂停、动作、缩放、手机布局、卸载。普通与注入测试抽测五个不同模型，并非对全部动作逐帧人工检查。资源契约测试覆盖全部 243 个模型包。

真实 MMD 平台仍需用户最终导入确认：本地测试不能替代其账号页面和未来 CSP 的变化。

## 许可

模型权利属于原游戏及相关权利人。Cubism Core 不是 MIT；`vendor/live2d/NOTICE.txt` 保留官方来源和 Live2D 协议链接。构建产物附带 `THIRD-PARTY-LICENSES.txt`。商业发布前需另行核实游戏素材和 Live2D SDK 的授权要求。
