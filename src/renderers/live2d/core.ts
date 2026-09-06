import coreSource from '../../../vendor/live2d/live2dcubismcore.min.js?raw'

/** Install in the player module's realm (the Host may render into another document). */
export function ensureCubismCore(): void {
  const globals = globalThis as typeof globalThis & { Live2DCubismCore?: unknown }
  if (globals.Live2DCubismCore) return
  const script = document.createElement('script')
  script.dataset.live2dCore = 'official'
  script.textContent = coreSource
  document.head.appendChild(script)
  script.remove()
  if (!globals.Live2DCubismCore) throw new Error('Live2D Core 未能启动，请检查舞台脚本策略。')
}

// Single-file IIFE builds evaluate inlined dynamic imports eagerly. Core must exist
// before the Cubism adapter's top-level runtime check, even before a model is selected.
ensureCubismCore()
