import {
  AmbientLight,
  Color,
  DirectionalLight,
  type Group,
  HemisphereLight,
  type Material,
  MathUtils,
  Mesh,
  NeutralToneMapping,
  PCFShadowMap,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  DETECTORS,
  DOORS,
  ROOMS,
  SOURCES,
  type DoorId,
  type SimulationSnapshot,
  type SourceId,
} from '../simulation'
import { HouseCamera } from './camera'
import { addSkyClouds } from './sky'
import { SmokeVolumes } from './smoke'

/** Coordinates in CSS pixels from the scene host's top left. */
export interface ProjectedMarker {
  id: string
  x: number
  y: number
  visible: boolean
}

export interface SceneCallbacks {
  /** Advance the lesson clock by this amount and return its current snapshot. */
  onFrame(deltaSeconds: number): SimulationSnapshot
  /** Reposition accessible HTML controls whenever the camera or stage changes. */
  onProject(markers: ProjectedMarker[]): void
  /** The child tapped a physical door or source mesh. */
  onActivate(id: string): void
  onFloorChange?(floor: number | null): void
  onError?(error: Error): void
}

export interface HouseScene {
  /** Relative zoom multiplier, e.g. 1.2 to zoom in by one step. */
  zoomBy(factor: number): void
  /** Focus a zero-based storey without altering the simulation. */
  focusFloor(floor: number): void
  /** Restore the original cutaway view and yaw. */
  resetView(): void
  /** Stop animation, detach event handlers and release graphics resources. */
  dispose(): void
}

function lighting(scene: Scene): void {
  scene.add(new HemisphereLight(0xfff8ec, 0xe2edf4, 2.4))
  // A large frontal bounce keeps the teaching surfaces legible under each floor.
  // It fills the shadows uniformly, as a studio softbox would on a miniature.
  scene.add(new AmbientLight(0xfff5e8, 0.52))
  const bounce = new DirectionalLight(0xfff2dc, 1.5)
  bounce.position.set(-1.8, 4, 9)
  bounce.target.position.set(0, 3.5, 0)
  scene.add(bounce, bounce.target)
  const sun = new DirectionalLight(0xfff2da, 2.03)
  sun.position.set(-5, 11, 9)
  sun.target.position.set(0, 3.4, 0)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -7
  sun.shadow.camera.right = 7
  sun.shadow.camera.top = 6.5
  sun.shadow.camera.bottom = -6.5
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 26
  sun.shadow.intensity = 0.55
  sun.shadow.normalBias = 0.014
  sun.shadow.bias = -0.00023
  scene.add(sun, sun.target)
  const fill = new DirectionalLight(0xd3edff, 0.48)
  fill.position.set(6, 4, -2)
  scene.add(fill)
}

function releaseMeshes(root: Object3D): void {
  const materials = new Set<Material>()
  const textures = new Set<Texture>()
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return
    node.geometry.dispose()
    const list = Array.isArray(node.material) ? node.material : [node.material]
    for (const material of list) materials.add(material)
  })
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof Texture) textures.add(value)
    }
    material.dispose()
  }
  for (const texture of textures) texture.dispose()
}

function readAnchors(model: Group) {
  const output = new Map<string, { position: Vector3; floor: number }>()
  const roomFloors = new Map(ROOMS.map((room) => [room.id, room.floor]))
  const items = [
    ...DOORS.map((door) => ({ id: door.id, room: door.rooms[0] })),
    ...SOURCES,
    ...DETECTORS,
  ]
  for (const { id, room } of items) {
    const anchor = model.getObjectByName(`anchor_${id}`)
    const floor = roomFloors.get(room)
    if (!anchor || floor === undefined) throw new Error(`Missing scene anchor for ${id}`)
    output.set(id, { position: anchor.getWorldPosition(new Vector3()), floor })
  }
  return output
}

/**
 * Load the self-contained Blender export, then start a depth-tested smoke and
 * interaction view. The host must have a nonzero layout size. Rejects on model,
 * WebGL or anchor errors so the lesson can offer a retry.
 */
export async function createHouseScene(
  host: HTMLElement,
  callbacks: SceneCallbacks,
): Promise<HouseScene> {
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setClearColor(new Color(0x9ee5f5), 0)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = NeutralToneMapping
  renderer.toneMappingExposure = 1.01
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true
  const canvas = renderer.domElement
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;user-select:none;'
  canvas.tabIndex = 0
  canvas.setAttribute('role', 'group')
  canvas.setAttribute(
    'aria-label',
    'Das Rauchhaus im Schnitt. Mit einem Finger schwenken, auf ein Stockwerk tippen oder die beschrifteten Bedienelemente nutzen.',
  )
  host.append(canvas)
  const scene = new Scene()
  const camera = new HouseCamera()
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const controller = new AbortController()
  const { signal } = controller
  let smoke: SmokeVolumes | undefined
  let resizeObserver: ResizeObserver | undefined
  let request = 0
  let disposed = false

  function dispose(): void {
    if (disposed) return
    disposed = true
    cancelAnimationFrame(request)
    resizeObserver?.disconnect()
    controller.abort()
    if (smoke) {
      scene.remove(smoke)
      smoke.dispose()
    }
    releaseMeshes(scene)
    scene.traverse((node) => {
      if (node instanceof DirectionalLight) node.dispose()
    })
    renderer.dispose()
    canvas.remove()
  }

  try {
    const { scene: model } = await new GLTFLoader().loadAsync(
      `${import.meta.env.BASE_URL}models/rauchhaus.glb`,
    )
    scene.add(model)
    scene.updateMatrixWorld(true)
    model.traverse((node) => {
      if (node instanceof Mesh) {
        node.castShadow = true
        node.receiveShadow = true
      }
    })
    const anchors = readAnchors(model)
    const positions = new Map<SourceId, Vector3>()
    for (const { id } of SOURCES) {
      const point = anchors.get(id)
      if (point) positions.set(id, point.position)
    }
    const hinges = DOORS.map((door) => {
      const object = model.getObjectByName(`hinge_${door.id}`)
      if (!object) throw new Error(`Missing door hinge for ${door.id}`)
      const angle = Number(object.userData.openAngle ?? 1.35)
      return { id: door.id, object, angle, rest: object.quaternion.clone() }
    })
    smoke = new SmokeVolumes(positions)
    const clouds = addSkyClouds()
    scene.add(smoke, clouds)
    lighting(scene)
    let width = 1
    let height = 1
    let forceRender = true
    let reproject = true
    let ratio = 1
    let previous: SimulationSnapshot | undefined
    let projections: ProjectedMarker[] = []
    let lastTimestamp = 0
    let slowFrameCount = 0
    let contextLost = false
    const projection = new Vector3()
    const axis = new Vector3(0, 1, 0)
    const opening = new Map<DoorId, number>()
    const touchPoints = new Map<number, Vector2>()
    let dragStart = new Vector2()
    let dragged = false
    let pinchDistance = 0

    function project(): void {
      projections = []
      for (const [id, { position, floor }] of anchors) {
        projection.copy(position).project(camera.camera)
        const x = ((projection.x + 1) * width) / 2
        const y = ((1 - projection.y) * height) / 2
        const visible =
          x >= 0 &&
          x <= width &&
          y >= 0 &&
          y <= height &&
          (camera.floor === null || camera.floor === floor)
        projections.push({ id, x, y, visible })
      }
      callbacks.onProject(projections)
    }

    function resize(): void {
      width = Math.max(1, host.clientWidth)
      height = Math.max(1, host.clientHeight)
      ratio = Math.min(window.devicePixelRatio || 1, 1.65, Math.sqrt(2_100_000 / (width * height)))
      renderer.setPixelRatio(ratio)
      renderer.setSize(width, height, false)
      camera.resize(width, height)
      reproject = forceRender = true
    }

    function focusFloor(floor: number): void {
      if (!Number.isFinite(floor)) return
      camera.focus(floor)
      callbacks.onFloorChange?.(camera.floor)
      reproject = true
    }

    function resetView(): void {
      camera.reset()
      callbacks.onFloorChange?.(null)
      reproject = true
    }

    canvas.addEventListener(
      'keydown',
      (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          camera.drag(width * (event.key === 'ArrowLeft' ? 0.068 : -0.068), 0)
        } else if (/^[1-4]$/.test(event.key)) {
          focusFloor(Number(event.key) - 1)
        } else if (event.key === 'Home') {
          resetView()
        } else return
        event.preventDefault()
      },
      { signal },
    )

    const ray = new Raycaster()
    const ndc = new Vector2()
    function tap(clientX: number, clientY: number): void {
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      let closest: ProjectedMarker | undefined
      let distance = 18
      for (const marker of projections) {
        if (!marker.visible || marker.id.startsWith('m_')) continue
        const d = Math.hypot(marker.x - x, marker.y - y)
        if (d < distance) {
          closest = marker
          distance = d
        }
      }
      if (closest) {
        callbacks.onActivate(closest.id)
        return
      }
      ndc.set((x / width) * 2 - 1, 1 - (y / height) * 2)
      ray.setFromCamera(ndc, camera.camera)
      const hit = ray.intersectObject(model, true)[0]
      if (!hit) return
      let node: Object3D | null = hit.object
      while (node) {
        if (node.name.startsWith('hinge_')) {
          callbacks.onActivate(node.name.slice(6))
          return
        }
        node = node.parent
      }
      for (const [id, position] of positions) {
        if (position.distanceToSquared(hit.point) < 0.36) {
          callbacks.onActivate(id)
          return
        }
      }
      if (Math.abs(hit.point.x) <= 3.12 && hit.point.y >= 0 && hit.point.y <= 8.66) {
        focusFloor(Math.floor(hit.point.y / 2.1))
      }
    }

    function fingerDistance(): number {
      const [a, b] = touchPoints.values()
      return a && b ? a.distanceTo(b) : 0
    }
    canvas.addEventListener(
      'pointerdown',
      (event) => {
        if (event.button !== 0) return
        const point = new Vector2(event.clientX, event.clientY)
        touchPoints.set(event.pointerId, point)
        canvas.setPointerCapture(event.pointerId)
        if (touchPoints.size === 1) {
          dragStart = point.clone()
          dragged = false
        } else {
          dragged = true
          pinchDistance = fingerDistance()
        }
      },
      { signal },
    )
    canvas.addEventListener(
      'pointermove',
      (event) => {
        const old = touchPoints.get(event.pointerId)
        if (!old) return
        const dx = event.clientX - old.x
        const dy = event.clientY - old.y
        old.set(event.clientX, event.clientY)
        if (touchPoints.size === 2) {
          const next = fingerDistance()
          if (pinchDistance > 2) camera.zoomBy(next / pinchDistance)
          pinchDistance = next
        } else if (touchPoints.size === 1) {
          if (old.distanceToSquared(dragStart) > 49) dragged = true
          if (dragged) camera.drag(dx, dy)
        }
      },
      { signal },
    )
    canvas.addEventListener(
      'pointerup',
      (event) => {
        if (!touchPoints.has(event.pointerId)) return
        touchPoints.delete(event.pointerId)
        if (!dragged && touchPoints.size === 0) tap(event.clientX, event.clientY)
      },
      { signal },
    )
    const cancelPointer = (event: PointerEvent) => {
      if (touchPoints.delete(event.pointerId)) dragged = true
    }
    canvas.addEventListener('pointercancel', cancelPointer, { signal })
    canvas.addEventListener('lostpointercapture', cancelPointer, { signal })
    canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault()
        contextLost = true
      },
      { signal },
    )
    canvas.addEventListener(
      'webglcontextrestored',
      () => {
        contextLost = false
        lastTimestamp = 0
        renderer.shadowMap.needsUpdate = true
        forceRender = reproject = true
      },
      { signal },
    )
    document.addEventListener(
      'visibilitychange',
      () => {
        lastTimestamp = 0
      },
      { signal },
    )

    function frame(timestamp: number): void {
      if (disposed) return
      request = requestAnimationFrame(frame)
      if (contextLost || document.hidden) return
      try {
        const elapsed = lastTimestamp ? Math.max(0, (timestamp - lastTimestamp) / 1000) : 0
        lastTimestamp = timestamp
        const dt = Math.min(elapsed, 0.16)
        const snapshot = callbacks.onFrame(dt)
        const moved = camera.update(dt, reducedMotion.matches)
        let changed = forceRender || moved
        for (const { id, object, angle, rest } of hinges) {
          const target = snapshot.doors[id] ? angle : 0
          const last = opening.get(id)
          if (last !== undefined && last === target) continue
          const next =
            last === undefined || reducedMotion.matches || Math.abs(target - last) < 0.006
              ? target
              : MathUtils.lerp(last, target, 1 - Math.exp(-dt * 12))
          opening.set(id, next)
          object.quaternion.copy(rest)
          object.rotateOnAxis(axis, next)
          if (next === target) renderer.shadowMap.needsUpdate = true
          changed = true
        }
        if (moved || reproject) {
          project()
          for (const cloud of clouds.children) {
            projection.copy(cloud.position).project(camera.camera)
            // Do not leave a chopped fragment of an illustration at the edge.
            const extent = cloud.scale.x / camera.camera.right
            cloud.visible = Math.abs(projection.x) + extent < 0.99
          }
        }
        const smokeChanged = snapshot !== previous
        if (smokeChanged || forceRender) smoke?.update(snapshot)
        if (changed || smokeChanged) {
          renderer.render(scene, camera.camera)
          // Lower the pixel budget only during sustained slow animated frames.
          // Long pauses, a hidden tab or loading a model do not count.
          if (elapsed > 0.032 && elapsed < 0.16 && snapshot.source) slowFrameCount++
          else slowFrameCount = Math.max(0, slowFrameCount - 1)
          if (slowFrameCount > 40 && ratio > 0.89) {
            ratio = Math.max(0.85, ratio * 0.84)
            renderer.setPixelRatio(ratio)
            slowFrameCount = 0
          }
        }
        previous = snapshot
        forceRender = reproject = false
      } catch (error) {
        dispose()
        callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
      }
    }

    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)
    resize()
    request = requestAnimationFrame(frame)
    return { zoomBy: (factor) => camera.zoomBy(factor), focusFloor, resetView, dispose }
  } catch (error) {
    dispose()
    throw error
  }
}
