import * as THREE from 'three'
import { DRAGON_RAJA_MEDIA } from '../media'

export interface AdmissionsSealSceneController {
  dispose(options?: AdmissionsSealSceneDisposeOptions): void
}

export interface AdmissionsSealSceneDisposeOptions {
  releaseContext?: boolean
}

export type AdmissionsSealSceneFailureCode =
  | 'webgl-api-unavailable'
  | 'webgl2-context-creation-failed'
  | 'renderer-initialization-failed'
  | 'initialization-failed'
  | 'webgl-context-lost'

export interface AdmissionsSealSceneFailure {
  code: AdmissionsSealSceneFailureCode
  message: string
}

export interface AdmissionsSealSceneOptions {
  onFailure?: (failure: AdmissionsSealSceneFailure) => void
  onRecovery?: () => void
}

interface AshField {
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  speeds: Float32Array
  lateral: Float32Array
  phases: Float32Array
}

type AdmissionsSealSceneProfileKind = 'base' | 'ember-light'
type EnvelopeStyle = 'classic' | 'cassell-crimson'

interface AdmissionsSealSceneProfile {
  kind: AdmissionsSealSceneProfileKind
  externalBackdrop: boolean
  backgroundBottom: number
  fogColor: number
  exposure: number
  fogNear: number
  fogFar: number
  envelopeStyle: EnvelopeStyle
  envelopeScale: number
  ringScale: number
  ringOpacity: number
  sigilOpacity: number
  ashDesktop: number
  ashMobile: number
  ashSize: number
  ashOpacity: number
  keyIntensity: number
  emberIntensity: number
}

const BACKGROUND = 0x030507
const BASE_CAMERA_Z = 8.4

class AdmissionsSealSceneError extends Error {
  constructor(readonly failure: AdmissionsSealSceneFailure) {
    super(failure.message)
    this.name = 'AdmissionsSealSceneError'
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error || 'Unknown WebGL error')
}

function fail(code: AdmissionsSealSceneFailureCode, message: string): never {
  throw new AdmissionsSealSceneError({ code, message })
}

export function describeAdmissionsSealSceneFailure(error: unknown): AdmissionsSealSceneFailure {
  if (error instanceof AdmissionsSealSceneError) return error.failure
  return {
    code: 'initialization-failed',
    message: errorMessage(error),
  }
}

export function mountAdmissionsSealScene(
  canvas: HTMLCanvasElement,
  options: AdmissionsSealSceneOptions = {},
): AdmissionsSealSceneController {
  const host = canvas.closest<HTMLElement>('.dr-webgl-welcome__visual') ?? canvas.parentElement
  if (!host) throw new Error('WebGL host is unavailable')
  const sceneHost: HTMLElement = host
  const profile = resolveSceneProfile(canvas)
  if (typeof WebGLRenderingContext === 'undefined' && typeof WebGL2RenderingContext === 'undefined') {
    fail('webgl-api-unavailable', 'This browser does not expose a WebGL API.')
  }

  let contextCreationStatus = ''
  const handleContextCreationError = (event: Event): void => {
    contextCreationStatus = (event as WebGLContextEvent).statusMessage || 'The browser rejected WebGL2 context creation.'
  }
  canvas.addEventListener('webglcontextcreationerror', handleContextCreationError)
  let context: WebGL2RenderingContext | null = null
  try {
    context = canvas.getContext('webgl2', {
      alpha: profile.externalBackdrop,
      antialias: true,
      powerPreference: 'high-performance',
    })
  } catch (error) {
    contextCreationStatus = errorMessage(error)
  } finally {
    canvas.removeEventListener('webglcontextcreationerror', handleContextCreationError)
  }
  if (!context) {
    fail(
      'webgl2-context-creation-failed',
      contextCreationStatus || 'The browser returned null while creating a WebGL2 context.',
    )
  }

  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      antialias: true,
      alpha: profile.externalBackdrop,
      powerPreference: 'high-performance',
    })
  } catch (error) {
    fail('renderer-initialization-failed', errorMessage(error))
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = profile.exposure
  renderer.setClearColor(profile.backgroundBottom, profile.externalBackdrop ? 0 : 1)

  const scene = new THREE.Scene()
  scene.background = profile.externalBackdrop ? null : new THREE.Color(profile.backgroundBottom)
  scene.fog = new THREE.Fog(profile.fogColor, profile.fogNear, profile.fogFar)

  const camera = new THREE.PerspectiveCamera(36, 1, .1, 40)
  camera.position.set(0, 0, BASE_CAMERA_Z)
  camera.lookAt(0, 0, 0)

  const root = new THREE.Group()
  scene.add(root)

  const envelope = makeEnvelope(profile.envelopeStyle)
  envelope.scale.setScalar(profile.envelopeScale)
  envelope.position.z = .2
  envelope.rotation.set(-.065, .08, 0)
  root.add(envelope)

  const animatedRings: THREE.Object3D[] = []
  if (profile.kind === 'base') buildSealField(root, animatedRings, profile)

  const ash = makeAsh(sceneHost.clientWidth < 700 ? profile.ashMobile : profile.ashDesktop, profile)
  scene.add(ash.points)

  scene.add(new THREE.HemisphereLight(0x756b59, 0x100302, .76))
  const key = new THREE.PointLight(0xffdfb3, profile.keyIntensity, 12, 1.65)
  key.position.set(0, 3.5, 4.8)
  scene.add(key)
  const ember = new THREE.PointLight(0xd94722, profile.emberIntensity, 5.4, 2)
  ember.position.set(0, -.35, 1.9)
  scene.add(ember)

  const pointer = new THREE.Vector2()
  const targetPointer = new THREE.Vector2()
  const timer = new THREE.Timer()
  timer.connect(document)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let phase = 0
  let disposed = false
  let running = false
  let contextFailed = false

  const resizeObserver = typeof ResizeObserver === 'undefined'
    ? null
    : new ResizeObserver(resize)

  function resize(): void {
    if (disposed) return
    const width = Math.max(1, sceneHost.clientWidth)
    const height = Math.max(1, sceneHost.clientHeight)
    camera.aspect = width / height
    const portraitScale = camera.aspect < .82
      ? THREE.MathUtils.clamp(camera.aspect / .82, .5, 1)
      : 1
    root.scale.setScalar(portraitScale)
    camera.position.z = BASE_CAMERA_Z
    camera.updateProjectionMatrix()
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
    renderer.setPixelRatio(pixelRatio)
    ash.points.material.uniforms.uPixelRatio!.value = pixelRatio
    renderer.setSize(width, height, false)
    if (!running) renderFrame(0)
  }

  function renderFrame(delta: number): void {
    if (disposed || contextFailed) return
    if (!reducedMotion.matches) phase += delta

    pointer.lerp(targetPointer, reducedMotion.matches ? .24 : .065)
    root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, pointer.y * -.075, .06)
    root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, pointer.x * .11, .06)
    envelope.position.y = Math.sin(phase * .72) * .08
    envelope.rotation.z = Math.sin(phase * .34) * .035

    animatedRings.forEach((ring, index) => {
      if (!reducedMotion.matches) {
        const direction = index % 2 ? -1 : 1
        ring.rotation.z += delta * (.08 + index * .025) * direction
      }
      ring.rotation.x = Math.sin(phase * .22 + index) * .18
    })

    updateAsh(ash, phase, delta, reducedMotion.matches)
    renderer.render(scene, camera)
  }

  function animate(timestamp: DOMHighResTimeStamp): void {
    timer.update(timestamp)
    renderFrame(Math.min(timer.getDelta(), .05))
  }

  function start(): void {
    if (disposed || running || contextFailed || document.hidden || reducedMotion.matches) return
    running = true
    timer.reset()
    renderer.setAnimationLoop(animate)
  }

  function stop(): void {
    if (!running) return
    running = false
    renderer.setAnimationLoop(null)
  }

  function handleVisibility(): void {
    if (document.hidden) stop()
    else if (reducedMotion.matches) renderFrame(0)
    else start()
  }

  function handleMotionPreference(): void {
    if (reducedMotion.matches) {
      stop()
      targetPointer.set(0, 0)
      pointer.set(0, 0)
      renderFrame(0)
    } else {
      start()
    }
  }

  function handlePointerMove(event: PointerEvent): void {
    if (reducedMotion.matches) return
    const bounds = sceneHost.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    targetPointer.set(
      ((event.clientX - bounds.left) / bounds.width - .5) * 2,
      ((event.clientY - bounds.top) / bounds.height - .5) * 2,
    )
  }

  function handlePointerLeave(): void {
    targetPointer.set(0, 0)
  }

  function handleContextLost(event: Event): void {
    event.preventDefault()
    if (disposed || contextFailed) return
    contextFailed = true
    stop()
    options.onFailure?.({
      code: 'webgl-context-lost',
      message: (event as WebGLContextEvent).statusMessage || 'The browser lost the active WebGL context.',
    })
  }

  function handleContextRestored(): void {
    if (disposed || !contextFailed) return
    contextFailed = false
    options.onRecovery?.()
    resize()
    if (!reducedMotion.matches) start()
  }

  sceneHost.addEventListener('pointermove', handlePointerMove, { passive: true })
  sceneHost.addEventListener('pointerleave', handlePointerLeave, { passive: true })
  canvas.addEventListener('webglcontextlost', handleContextLost)
  canvas.addEventListener('webglcontextrestored', handleContextRestored)
  document.addEventListener('visibilitychange', handleVisibility)
  reducedMotion.addEventListener?.('change', handleMotionPreference)
  resizeObserver?.observe(sceneHost)
  window.addEventListener('resize', resize, { passive: true })
  resize()
  if (!reducedMotion.matches) start()

  return {
    dispose({ releaseContext = false }: AdmissionsSealSceneDisposeOptions = {}): void {
      if (disposed) return
      disposed = true
      stop()
      sceneHost.removeEventListener('pointermove', handlePointerMove)
      sceneHost.removeEventListener('pointerleave', handlePointerLeave)
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
      document.removeEventListener('visibilitychange', handleVisibility)
      reducedMotion.removeEventListener?.('change', handleMotionPreference)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', resize)
      timer.dispose()
      disposeSceneResources(scene)
      renderer.renderLists.dispose()
      renderer.dispose()
      if (releaseContext) renderer.forceContextLoss()
    },
  }
}

function resolveSceneProfile(canvas: HTMLCanvasElement): AdmissionsSealSceneProfile {
  const isImperialCrown = canvas.classList.contains('dr-webgl-welcome__scene--imperial-crown')
  const envelopeStyle = resolveEnvelopeStyle(canvas)
  if (canvas.classList.contains('dr-webgl-welcome__scene--light-rays-embers')) {
    const ashDesktop = isImperialCrown ? 980 : 1100
    const ashMobile = isImperialCrown ? 620 : 680
    const ashSize = isImperialCrown ? .036 : .038
    const ashOpacity = isImperialCrown ? .76 : .84
    const emberIntensity = isImperialCrown ? 1.35 : 1.5
    return {
      kind: 'ember-light',
      externalBackdrop: true,
      backgroundBottom: 0x070302,
      fogColor: 0x170503,
      exposure: 1.12,
      fogNear: 5.6,
      fogFar: 18,
      envelopeStyle,
      envelopeScale: .87,
      ringScale: 1.16,
      ringOpacity: 0,
      sigilOpacity: 0,
      ashDesktop,
      ashMobile,
      ashSize,
      ashOpacity,
      keyIntensity: 20,
      emberIntensity,
    }
  }

  return {
    kind: 'base',
    externalBackdrop: false,
    backgroundBottom: BACKGROUND,
    fogColor: BACKGROUND,
    exposure: .96,
    fogNear: 5.5,
    fogFar: 15,
    envelopeStyle,
    envelopeScale: .84,
    ringScale: 1,
    ringOpacity: .34,
    sigilOpacity: .13,
    ashDesktop: 620,
    ashMobile: 420,
    ashSize: .028,
    ashOpacity: .24,
    keyIntensity: 18,
    emberIntensity: 1.25,
  }
}

function resolveEnvelopeStyle(canvas: HTMLCanvasElement): EnvelopeStyle {
  if (canvas.classList.contains('dr-webgl-welcome__scene--cassell-crimson')) return 'cassell-crimson'
  return 'classic'
}

function buildSealField(root: THREE.Group, animatedRings: THREE.Object3D[], profile: AdmissionsSealSceneProfile): void {
  const brass = new THREE.MeshStandardMaterial({ color: 0xb99761, roughness: .42, metalness: .78 })
  ;[2.15, 2.72, 3.32].forEach((radius, index) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * profile.ringScale, .016 + index * .005, 8, 128), brass)
    ring.rotation.set((index - 1) * .16, index * .12, index * .08)
    ring.position.z = -.15 - index * .12
    root.add(ring)
    animatedRings.push(ring)
  })

  const compass = new THREE.Group()
  const compassMaterial = new THREE.LineBasicMaterial({ color: 0xb99761, transparent: true, opacity: profile.ringOpacity })
  for (let index = 0; index < 24; index += 1) {
    const angle = index / 24 * Math.PI * 2
    const innerRadius = (index % 2 ? 3.5 : 3.42) * profile.ringScale
    const outerRadius = (index % 6 ? 3.72 : 3.86) * profile.ringScale
    const start = new THREE.Vector3(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius, -.48)
    const end = new THREE.Vector3(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius, -.48)
    compass.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, end]), compassMaterial))
  }

  const sigilMaterial = new THREE.LineBasicMaterial({ color: 0x72bfc1, transparent: true, opacity: profile.sigilOpacity })
  const sigilPoints = Array.from({ length: 6 }, (_, index) => {
    const angle = index / 6 * Math.PI * 2 + Math.PI / 6
    return new THREE.Vector3(Math.cos(angle) * 4.15 * profile.ringScale, Math.sin(angle) * 4.15 * profile.ringScale, -.62)
  })
  compass.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(sigilPoints), sigilMaterial))
  root.add(compass)
  animatedRings.push(compass)
}

function makeEnvelope(style: EnvelopeStyle): THREE.Group {
  if (style === 'classic') return makeClassicEnvelope()

  const palette = {
    paper: 0xeadfca,
    fold: 0xd8c9ae,
    edge: 0x8d2924,
    wax: 0x9b2823,
    waxShadow: 0x4a0d0c,
    crest: 0x3a0a09,
    ribbon: 0x8d2924,
  }

  const group = new THREE.Group()
  const width = 3.34
  const height = 1.94
  const paper = new THREE.MeshStandardMaterial({
    color: palette.paper,
    emissive: 0x1b140b,
    emissiveIntensity: .13,
    roughness: .82,
    metalness: 0,
  })
  const foldPaper = new THREE.MeshStandardMaterial({
    color: palette.fold,
    roughness: .8,
    metalness: 0,
    side: THREE.DoubleSide,
  })
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: palette.edge,
    transparent: true,
    opacity: .74,
  })

  const bodyGeometry = new THREE.BoxGeometry(width, height, .12)
  const body = new THREE.Mesh(bodyGeometry, paper)
  group.add(body)
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeometry), edgeMaterial))

  const inset = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-width / 2 + .1, -height / 2 + .1, .071),
      new THREE.Vector3(width / 2 - .1, -height / 2 + .1, .071),
      new THREE.Vector3(width / 2 - .1, height / 2 - .1, .071),
      new THREE.Vector3(-width / 2 + .1, height / 2 - .1, .071),
    ]),
    edgeMaterial,
  )
  group.add(inset)

  const ribbon = new THREE.Mesh(
    new THREE.BoxGeometry(.08, height - .14, .024),
    new THREE.MeshStandardMaterial({ color: palette.ribbon, roughness: .58, metalness: .08 }),
  )
  ribbon.position.z = .074
  group.add(ribbon)

  const flapShape = new THREE.Shape()
  flapShape.moveTo(-width / 2 + .04, height / 2 - .05)
  flapShape.lineTo(width / 2 - .04, height / 2 - .05)
  flapShape.lineTo(0, -.12)
  flapShape.closePath()
  const flap = new THREE.Mesh(new THREE.ShapeGeometry(flapShape), foldPaper)
  flap.position.z = .078
  group.add(flap)

  const foldLines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-width / 2 + .06, height / 2 - .06, .09), new THREE.Vector3(0, -.12, .09),
    new THREE.Vector3(width / 2 - .06, height / 2 - .06, .09), new THREE.Vector3(0, -.12, .09),
  ]), edgeMaterial)
  group.add(foldLines)

  const crestTexture = loadCassellCrestTexture()
  crestTexture.colorSpace = THREE.SRGBColorSpace
  crestTexture.anisotropy = 4

  const paperCrest = makeCrestMesh(crestTexture, .25, palette.crest, .76)
  paperCrest.position.set(-1.08, .45, .106)
  group.add(paperCrest)

  const seal = makeCassellWaxSeal(crestTexture, palette.wax, palette.waxShadow, palette.crest)
  seal.position.set(0, -.12, .14)
  seal.scale.setScalar(1.08)
  group.add(seal)

  return group
}

function loadCassellCrestTexture(): THREE.Texture {
  if (DRAGON_RAJA_MEDIA.cassellCrestUrl) {
    return new THREE.TextureLoader().load(DRAGON_RAJA_MEDIA.cassellCrestUrl)
  }
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  texture.needsUpdate = true
  return texture
}

function makeClassicEnvelope(): THREE.Group {
  const group = new THREE.Group()
  const paper = new THREE.MeshStandardMaterial({
    color: 0xe8e2d6,
    emissive: 0x17120b,
    emissiveIntensity: .16,
    roughness: .84,
    metalness: 0,
  })
  const foldPaper = new THREE.MeshStandardMaterial({
    color: 0xd8d0c1,
    roughness: .88,
    side: THREE.DoubleSide,
  })
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.18, 1.82, .1), paper)
  group.add(body)

  const flapShape = new THREE.Shape()
  flapShape.moveTo(-1.56, .86)
  flapShape.lineTo(1.56, .86)
  flapShape.lineTo(0, -.08)
  flapShape.closePath()
  const flap = new THREE.Mesh(new THREE.ShapeGeometry(flapShape), foldPaper)
  flap.position.z = .058
  group.add(flap)

  const foldMaterial = new THREE.LineBasicMaterial({ color: 0x675946, transparent: true, opacity: .54 })
  const foldLines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-1.55, .84, .07), new THREE.Vector3(0, -.08, .07),
    new THREE.Vector3(1.55, .84, .07), new THREE.Vector3(0, -.08, .07),
  ]), foldMaterial)
  group.add(foldLines)

  const wax = new THREE.Mesh(
    new THREE.CylinderGeometry(.3, .33, .12, 48, 1),
    new THREE.MeshStandardMaterial({ color: 0xa52924, roughness: .58, metalness: .12 }),
  )
  wax.rotation.x = Math.PI / 2
  wax.position.set(0, -.1, .14)
  group.add(wax)

  const crestMaterial = new THREE.MeshStandardMaterial({ color: 0x43100e, roughness: .48, metalness: .35 })
  const outer = new THREE.Mesh(new THREE.TorusGeometry(.215, .014, 8, 48), crestMaterial)
  const inner = new THREE.Mesh(new THREE.TorusGeometry(.155, .011, 8, 48), crestMaterial)
  outer.position.set(0, -.1, .211)
  inner.position.copy(outer.position)
  group.add(outer, inner)

  const starPoints = Array.from({ length: 16 }, (_, index) => {
    const angle = index / 16 * Math.PI * 2 + Math.PI / 2
    const radius = index % 2 ? .07 : .14
    return new THREE.Vector3(Math.cos(angle) * radius, -.1 + Math.sin(angle) * radius, .214)
  })
  group.add(new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(starPoints),
    new THREE.LineBasicMaterial({ color: 0x43100e }),
  ))

  return group
}

function makeCassellWaxSeal(
  crestTexture: THREE.Texture,
  waxColor: number,
  waxShadow: number,
  crestColor: number,
): THREE.Group {
  const seal = new THREE.Group()
  const waxMaterial = new THREE.MeshStandardMaterial({
    color: waxColor,
    emissive: waxShadow,
    emissiveIntensity: .08,
    roughness: .42,
    metalness: .16,
  })

  for (let index = 0; index < 11; index += 1) {
    const angle = index / 11 * Math.PI * 2
    const lobe = new THREE.Mesh(new THREE.CylinderGeometry(.095, .115, .055, 24), waxMaterial)
    lobe.rotation.x = Math.PI / 2
    lobe.position.set(Math.cos(angle) * .31, Math.sin(angle) * .31, 0)
    lobe.scale.y = .72 + (index % 3) * .1
    seal.add(lobe)
  }

  const wax = new THREE.Mesh(new THREE.CylinderGeometry(.345, .385, .135, 64, 2), waxMaterial)
  wax.rotation.x = Math.PI / 2
  seal.add(wax)

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: waxShadow,
    roughness: .36,
    metalness: .28,
  })
  const outerRim = new THREE.Mesh(new THREE.TorusGeometry(.285, .018, 10, 64), rimMaterial)
  const innerRim = new THREE.Mesh(new THREE.TorusGeometry(.245, .009, 8, 64), rimMaterial)
  outerRim.position.z = .076
  innerRim.position.z = .078
  seal.add(outerRim, innerRim)

  const crest = makeCrestMesh(crestTexture, .225, crestColor, .96)
  crest.position.z = .082
  seal.add(crest)
  return seal
}

function makeCrestMesh(
  texture: THREE.Texture,
  radius: number,
  color: number,
  opacity: number,
): THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial> {
  const ink = new THREE.Color(color)
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMap: { value: texture },
      uInk: { value: ink },
      uOpacity: { value: opacity },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uInk;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec3 source = texture2D(uMap, vUv).rgb;
        float distanceFromWhite = distance(source, vec3(1.0));
        float mask = smoothstep(0.035, 0.22, distanceFromWhite);
        float luminance = dot(source, vec3(0.2126, 0.7152, 0.0722));
        vec3 embossed = mix(uInk * 0.56, uInk * 1.16, luminance);
        gl_FragColor = vec4(embossed, mask * uOpacity);
      }
    `,
  })
  return new THREE.Mesh(new THREE.CircleGeometry(radius, 64), material)
}

function makeAsh(count: number, profile: AdmissionsSealSceneProfile): AshField {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const alphas = new Float32Array(count)
  const speeds = new Float32Array(count)
  const lateral = new Float32Array(count)
  const phases = new Float32Array(count)
  const random = seededRandom(1773)
  const red = new THREE.Color(0xd84624)
  const orange = new THREE.Color(0xff9d32)
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (random() - .5) * 14
    positions[index * 3 + 1] = (random() - .5) * 9
    positions[index * 3 + 2] = -.8 + random() * 6.6
    const color = new THREE.Color().lerpColors(red, orange, random())
    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b
    sizes[index] = profile.ashSize * (.58 + random() * 1.85)
    alphas[index] = profile.ashOpacity * (.3 + random() * .7)
    speeds[index] = .22 + random() * 1.08
    lateral[index] = (random() - .5) * .72
    phases[index] = random() * Math.PI * 2
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1))
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.5) },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vColor = color;
        vAlpha = aAlpha;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = max(1.0, aSize * uPixelRatio * (340.0 / -viewPosition.z));
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float radius = distance(gl_PointCoord, vec2(0.5));
        float ember = 1.0 - smoothstep(0.08, 0.5, radius);
        float core = 1.0 - smoothstep(0.0, 0.2, radius);
        vec3 color = mix(vColor * 0.72, vec3(1.0, 0.64, 0.24), core * 0.45);
        gl_FragColor = vec4(color, ember * vAlpha);
      }
    `,
  })
  return { points: new THREE.Points(geometry, material), speeds, lateral, phases }
}

function updateAsh(ash: AshField, phase: number, delta: number, reducedMotion: boolean): void {
  if (reducedMotion || delta <= 0) return
  const position = ash.points.geometry.getAttribute('position') as THREE.BufferAttribute
  const positions = position.array as Float32Array
  for (let index = 0; index < ash.speeds.length; index += 1) {
    const offset = index * 3
    const turbulence = Math.sin(phase * (.62 + ash.speeds[index]! * .24) + ash.phases[index]!)
    positions[offset] += delta * (ash.lateral[index]! + turbulence * .72)
    positions[offset + 1] += delta * ash.speeds[index]!
    positions[offset + 2] += delta * Math.cos(phase * .48 + ash.phases[index]!) * .08
    if (positions[offset + 1] > 4.7) {
      positions[offset + 1] = -4.7
      positions[offset] += Math.sin(ash.phases[index]! + phase) * 2.4
    }
    if (positions[offset] > 7.2) positions[offset] = -7.2
    else if (positions[offset] < -7.2) positions[offset] = 7.2
  }
  position.needsUpdate = true
}

function disposeSceneResources(scene: THREE.Scene): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()

  scene.traverse((object: THREE.Object3D) => {
    const renderable = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry
      material?: THREE.Material | THREE.Material[]
    }
    if (renderable.geometry) geometries.add(renderable.geometry)
    const objectMaterials = Array.isArray(renderable.material) ? renderable.material : [renderable.material]
    objectMaterials.forEach((material: THREE.Material | undefined) => {
      if (!material) return
      materials.add(material)
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value)
      })
      if (material instanceof THREE.ShaderMaterial) {
        Object.values(material.uniforms).forEach((uniform: any) => {
          if (uniform.value instanceof THREE.Texture) textures.add(uniform.value)
        })
      }
    })
  })

  textures.forEach((texture) => texture.dispose())
  materials.forEach((material) => material.dispose())
  geometries.forEach((geometry) => geometry.dispose())
  scene.clear()
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}
