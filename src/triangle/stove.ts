import {
  AnimationMixer,
  Color,
  DirectionalLight,
  type Group,
  HemisphereLight,
  LoadingManager,
  type Material,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  type Object3D,
  OrthographicCamera,
  PCFShadowMap,
  PointLight,
  Scene,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { releaseMeshes } from '../scene/dispose'
import { STOVE_START_ANGLE, type TriangleReading } from './experiment'

/** Horizontal orbit is intentionally limited to keep the glass, log and flames in view. */
export const STOVE_ORBIT_LIMIT = Math.PI / 9

export interface StoveView {
  setReading(reading: TriangleReading): void
  setPaused(paused: boolean): void
  setAngle(radians: number): void
  capturePlayback(): () => void
  dispose(): void
}

/**
 * Bind the authored wood surfaces to the remaining fuel. Preserve each grain/bark tone as
 * it darkens and develops a thin ash finish. Materials also used by the stove are isolated.
 */
export function bindWoodFinish(model: Object3D, wood: Object3D): (available: number) => void {
  const timber = new Set<Mesh>()
  wood.traverse((object) => {
    if (object instanceof Mesh) timber.add(object)
  })
  const outside = new Set<Material>()
  model.traverse((object) => {
    if (object instanceof Mesh && !timber.has(object)) {
      for (const material of [object.material].flat()) outside.add(material)
    }
  })
  const copies = new Map<MeshStandardMaterial, MeshStandardMaterial>()
  const finishes = new Map<MeshStandardMaterial, { fresh: Color; char: Color; ash: Color }>()
  function prepare(source: Material): Material {
    if (!(source instanceof MeshStandardMaterial)) return source
    let material = source
    if (outside.has(source)) {
      material = copies.get(source) ?? source.clone()
      copies.set(source, material)
    }
    if (!finishes.has(material)) {
      const fresh = material.color.clone()
      const lightness = 0.2126 * fresh.r + 0.7152 * fresh.g + 0.0722 * fresh.b
      const charcoal = 0.013 + 0.15 * lightness
      const ash = 0.026 + 0.64 * lightness
      finishes.set(material, {
        fresh,
        char: new Color(charcoal * 1.1, charcoal, charcoal * 0.96),
        ash: new Color(ash * 1.05, ash, ash * 0.94),
      })
    }
    return material
  }
  for (const part of timber) {
    part.material = Array.isArray(part.material)
      ? part.material.map(prepare)
      : prepare(part.material)
  }
  let previousFuel = -1
  return (available) => {
    if (available === previousFuel) return
    previousFuel = available
    const char = Math.min(1, (1 - available) / 0.7)
    const ash = Math.max(0, 1 - available / 0.4)
    for (const [material, finish] of finishes)
      material.color
        .copy(finish.fresh)
        .lerp(finish.char, char)
        .lerp(finish.ash, ash * ash)
  }
}

/**
 * Mount the Blender-authored, WebGL 2 stove and its bounded camera. The abort signal owns
 * downloads, listeners and GPU resources. Rejects if WebGL or the model cannot be loaded.
 */
export async function createStove(
  host: HTMLElement,
  initial: TriangleReading,
  signal: AbortSignal,
  onAngle: (angle: number) => void,
): Promise<StoveView> {
  signal.throwIfAborted()
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
  renderer.setClearColor(0, 0)
  renderer.toneMapping = NeutralToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.shadowMap.autoUpdate = false
  const canvas = renderer.domElement
  canvas.className = 'stove-canvas'
  canvas.tabIndex = 0
  canvas.setAttribute('role', 'group')
  canvas.setAttribute('aria-label', '3D-Ofen schwenken')
  canvas.setAttribute('aria-describedby', 'stove-camera-help')
  host.prepend(canvas)

  const scene = new Scene()
  const camera = new OrthographicCamera(-1.75, 1.75, 1.4, -1.4, 0.1, 20)
  const sky = new HemisphereLight(0xe5f5ff, 0xb7a08b, 0.72)
  const daylight = new DirectionalLight(0xffefdc, 1.95)
  daylight.position.set(-3.4, 5.8, 3.1)
  daylight.target.position.set(0, 1.2, 0)
  daylight.castShadow = true
  daylight.shadow.mapSize.set(1024, 1024)
  Object.assign(daylight.shadow.camera, {
    left: -2.1,
    right: 2.1,
    top: 2,
    bottom: -2,
    near: 2,
    far: 12,
  })
  daylight.shadow.camera.updateProjectionMatrix()
  daylight.shadow.bias = -0.0003
  daylight.shadow.normalBias = 0.007
  daylight.shadow.intensity = 0.9
  const rim = new DirectionalLight(0xc9f3ff, 1.55)
  rim.position.set(3, 4, -2)
  const firelight = new PointLight(0xff952f, 2, 3.5, 2)
  firelight.position.set(0.05, 1.08, 0.16)
  scene.add(sky, daylight, daylight.target, rim, firelight)
  const manager = new LoadingManager()
  const events = new AbortController()
  const listeners = { signal: events.signal }
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')
  let root: Group | undefined
  let mixer: AnimationMixer | undefined
  let observer: ResizeObserver | undefined
  let request = 0
  let disposed = false

  function dispose(): void {
    if (disposed) return
    disposed = true
    signal.removeEventListener('abort', dispose)
    manager.abortController.abort()
    events.abort()
    observer?.disconnect()
    cancelAnimationFrame(request)
    mixer?.stopAllAction()
    if (root) {
      mixer?.uncacheRoot(root)
      releaseMeshes(root)
    }
    daylight.dispose()
    renderer.dispose()
    canvas.remove()
  }
  signal.addEventListener('abort', dispose, { once: true })
  try {
    const asset = await new GLTFLoader(manager).loadAsync(
      `${import.meta.env.BASE_URL}models/holzofen.glb`,
    )
    if (disposed) {
      releaseMeshes(asset.scene)
      signal.throwIfAborted()
    }
    root = asset.scene
    scene.add(root)
    const wood = root.getObjectByName('Fuel')
    const embers = root.getObjectByName('Embers')
    const flames = root.getObjectByName('Flames')
    if (!wood || !embers || !flames || !asset.animations.length)
      throw new Error('The stove model is missing wood, embers, flames or its Blender animation.')
    const coals = embers
    const fire = flames
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const opaque = [object.material].flat().every((material) => !material.transparent)
      object.castShadow = object.receiveShadow = opaque
    })
    // The tiny emissive tongues and ember fissures emit light instead of occluding the firebox.
    for (const group of [fire, coals])
      group.traverse((object) => {
        if (object instanceof Mesh) object.castShadow = object.receiveShadow = false
      })
    renderer.shadowMap.needsUpdate = true
    const setWoodFinish = bindWoodFinish(root, wood)
    const fireScale = fire.scale.clone()
    const emission = new Map<MeshStandardMaterial, { strength: number; baseColor: Color }>()
    coals.traverse((object) => {
      if (!(object instanceof Mesh)) return
      for (const material of [object.material].flat()) {
        if (material instanceof MeshStandardMaterial)
          emission.set(material, {
            strength: material.emissiveIntensity,
            baseColor: material.color.clone(),
          })
      }
    })
    mixer = new AnimationMixer(root)
    for (const clip of asset.animations) mixer.clipAction(clip).play()
    mixer.setTime(0.24)
    let reading = initial
    let paused = false
    let lost = false
    let angle = STOVE_START_ANGLE
    let previous = 0
    let residual = 0
    let glow = 0
    let dirty = true

    function wake(): void {
      if (!request && !disposed && !lost && !document.hidden) request = requestAnimationFrame(frame)
    }

    function frame(time: number): void {
      request = 0
      if (disposed || lost || document.hidden) return
      const dt = previous && !paused ? Math.min(0.1, (time - previous) / 1000) : 0
      previous = time
      const animate = !paused && !reduceMotion.matches && reading.flame > 0
      if (animate && dt > 0) mixer?.update(dt)
      const cooling = residual > 0 && !paused
      if (cooling) residual = Math.max(0, residual - dt / 4)
      if (dirty || animate || cooling) {
        const { flame, availability } = reading
        setWoodFinish(availability.fuel)
        fire.visible = flame > 0
        fire.scale.copy(fireScale)
        fire.scale.x *= 0.48 + 0.52 * flame
        fire.scale.y *= Math.sqrt(flame)
        glow = Math.max(residual, Math.sqrt(flame)) * availability.heat * availability.fuel
        coals.visible = glow > 0.025
        for (const [material, original] of emission) {
          material.emissiveIntensity = original.strength * glow
          material.color.copy(original.baseColor).multiplyScalar(glow)
        }
        firelight.intensity = 2.4 * flame + 0.55 * glow
        renderer.render(scene, camera)
        dirty = false
      }
      if (animate || (residual > 0 && !paused)) wake()
      else previous = 0
    }

    function setAngle(value: number): void {
      angle = Math.min(STOVE_ORBIT_LIMIT, Math.max(-STOVE_ORBIT_LIMIT, value))
      camera.position.set(7 * Math.sin(angle), 2.22, 7 * Math.cos(angle))
      camera.lookAt(0, 1.25, 0)
      onAngle(angle)
      dirty = true
      wake()
    }

    function resize(): void {
      const width = Math.max(1, host.clientWidth)
      const height = Math.max(1, host.clientHeight)
      const halfWidth = Math.max(1.67, (1.37 * width) / height)
      camera.right = halfWidth
      camera.left = -halfWidth
      camera.top = (halfWidth * height) / width
      camera.bottom = -camera.top
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, 1.7, Math.sqrt(1_200_000 / (width * height))),
      )
      renderer.setSize(width, height, false)
      dirty = true
      wake()
    }

    let drag: { id: number; x: number; angle: number } | null = null
    canvas.addEventListener(
      'pointerdown',
      (event) => {
        if (event.button !== 0 || !event.isPrimary) return
        canvas.setPointerCapture(event.pointerId)
        drag = { id: event.pointerId, x: event.clientX, angle }
      },
      listeners,
    )
    canvas.addEventListener(
      'pointermove',
      (event) => {
        if (drag?.id !== event.pointerId) return
        setAngle(drag.angle - ((event.clientX - drag.x) / host.clientWidth) * 1.5)
      },
      listeners,
    )
    canvas.addEventListener(
      'lostpointercapture',
      () => {
        drag = null
      },
      listeners,
    )
    canvas.addEventListener(
      'keydown',
      (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return
        if (event.key === 'ArrowLeft') setAngle(angle - 0.09)
        else if (event.key === 'ArrowRight') setAngle(angle + 0.09)
        else if (event.key === 'Home') setAngle(STOVE_START_ANGLE)
        else return
        event.preventDefault()
      },
      listeners,
    )
    canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault()
        lost = true
        previous = 0
      },
      listeners,
    )
    canvas.addEventListener(
      'webglcontextrestored',
      () => {
        lost = false
        resize()
      },
      listeners,
    )
    function resume(): void {
      previous = 0
      dirty = true
      wake()
    }
    document.addEventListener('visibilitychange', resume, listeners)
    reduceMotion.addEventListener('change', resume, listeners)
    observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()
    setAngle(STOVE_START_ANGLE)
    return {
      setReading(next) {
        if (reading.state !== 'out' && next.state === 'out' && next.limitingFactor === 'oxygen')
          residual = Math.max(0.2, glow)
        else if (next.state !== 'out' || next.limitingFactor !== 'oxygen') residual = 0
        reading = next
        dirty = true
        wake()
      },
      setPaused(value) {
        paused = value
        resume()
      },
      setAngle,
      capturePlayback() {
        const time = mixer?.time ?? 0
        const embersAtStop = residual
        const brightness = glow
        return () => {
          if (disposed) return
          mixer?.setTime(time)
          residual = embersAtStop
          glow = brightness
          resume()
        }
      },
      dispose,
    }
  } catch (error) {
    dispose()
    throw error
  }
}
