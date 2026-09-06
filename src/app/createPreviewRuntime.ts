import { MockMmdRuntime, type RuntimeOptions } from '../runtime/mockMmd'
import { instance } from '@hud-instance'

/** Composition root for the local preview. The Vue shell depends on this factory only. */
export function createPreviewRuntime(frameWindow: Window, options: RuntimeOptions): MockMmdRuntime {
  const runtime = new MockMmdRuntime(frameWindow, options)
  const modules = instance.createModules(frameWindow)
  for (const feature of modules.features ?? []) runtime.registerFeature(feature)
  for (const renderer of modules.renderers ?? []) runtime.registerRenderer(renderer)
  return runtime
}

export { MockMmdRuntime }
