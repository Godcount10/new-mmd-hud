import { MockMmdRuntime, type RuntimeOptions } from '../runtime/mockMmd'
import { createSpineStageRenderer } from '../renderers/spineStageRenderer'
import { localNikkeSpineConfig } from '../renderers/spine/nikkeAssets'
import { localNikkeCatalog } from '../renderers/spine/nikkeCatalog.local'

/** Composition root for the local preview. The Vue shell depends on this factory only. */
export function createPreviewRuntime(frameWindow: Window, options: RuntimeOptions): MockMmdRuntime {
  frameWindow.__MMD_DEFAULT_SPINE_ASSET__ = localNikkeSpineConfig
  frameWindow.__MMD_SPINE_CATALOG__ = localNikkeCatalog
  const runtime = new MockMmdRuntime(frameWindow, options)
  runtime.registerRenderer(createSpineStageRenderer())
  return runtime
}

export { MockMmdRuntime }
