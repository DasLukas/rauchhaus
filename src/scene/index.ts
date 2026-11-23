import {
  AmbientLight,
  Color,
  DirectionalLight,
  type Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  NeutralToneMapping,
  type Object3D,
  PCFShadowMap,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  CLASSROOM_SOURCES,
  DETECTORS,
  DOORS,
  type DoorId,
  HOUSE_VARIANT,
  MODEL_FILENAME,
  ROOMS,
  type SimulationSnapshot,
  type SourceId,
} from '../simulation'
import { HouseCamera, pickedFloor } from './camera'
import { releaseMeshes } from './dispose'
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
  /** Focus a physical level, optionally centering a source at its model-space X position. */
  focusFloor(floor: number, x?: number): void
  /** Restore the original cutaway view and yaw. */
  resetView(): void
  captureRoom(snapshot: SimulationSnapshot, roomId: 'stair1' | 'living'): HTMLCanvasElement
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
  sun.position.set(HOUSE_VARIANT === 'klein' ? 9 : -9, 17, 13)
  sun.target.position.set(0, 4.2, 0)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -11
  sun.shadow.camera.right = 11
  sun.shadow.camera.top = 10
  sun.shadow.camera.bottom = -10
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 44
  sun.shadow.intensity = 0.55
  sun.shadow.normalBias = 0.014
  sun.shadow.bias = -0.00023
  scene.add(sun, sun.target)
  const fill = new DirectionalLight(0xd3edff, 0.48)
  fill.position.set(6, 4, -2)
  scene.add(fill)
}

function readAnchors(model: Group) {
  const output = new Map<string, { position: Vector3; floor: number }>()
  const roomFloors = new Map(ROOMS.map((room) => [room.id, room.floor]))
  const items = [
    ...DOORS.map((door) => ({ id: door.id, room: door.rooms[0] })),
    ...CLASSROOM_SOURCES,
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
    'Brandhaus im Schnitt. Wähle ein Stockwerk, um es zu vergrößern. Mit den Pfeiltasten bewegst du die Ansicht.',
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
      `${import.meta.env.BASE_URL}models/${MODEL_FILENAME}`,
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
    for (const { id, marker } of CLASSROOM_SOURCES) {
      const point = anchors.get(id)
      if (point) {
        positions.set(id, point.position.clone())
        point.position.fromArray(marker)
      }
    }
    const hinges = DOORS.map((door) => {
      const object = model.getObjectByName(`hinge_${door.id}`)
      if (!object) throw new Error(`Missing door hinge for ${door.id}`)
      const angle = Number(object.userData.openAngle)
      if (Math.abs(Math.abs(angle) - Math.PI / 2) > 0.002 || !Number.isFinite(angle))
        throw new Error(`Unexpected door angle for ${door.id}`)
      return { id: door.id, object, angle, rest: object.quaternion.clone() }
    })
    const doorIds = new Map(hinges.map(({ object, id }) => [object, id]))
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

    function captureRoom(snapshot: SimulationSnapshot, roomId: 'stair1' | 'living'): HTMLCanvasElement {
      const image = document.createElement('canvas')
      image.width = 540
      image.height = 360
      const view = new HouseCamera()
      view.resize(image.width, image.height)
      const room = ROOMS.find((room) => room.id === roomId)
      if (room) view.focus(room.floor, (room.minX + room.maxX) / 2)
      view.update(0, true)

      // Skipping to the result can precede the next animation frame. Apply the
      // final smoke and door positions before copying the WebGL drawing buffer.
      smoke?.update(snapshot, reducedMotion.matches)
      for (const { id, object, angle, rest } of hinges) {
        const rotation = snapshot.doors[id] ? angle : 0
        object.quaternion.copy(rest)
        object.rotateOnAxis(axis, rotation)
        opening.set(id, rotation)
      }
      renderer.shadowMap.needsUpdate = true
      renderer.render(scene, view.camera)
      image.getContext('2d')?.drawImage(canvas, 0, 0, image.width, image.height)
      renderer.render(scene, camera.camera)
      forceRender = true
      return image
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

    function focusFloor(floor: number, x = 0): void {
      if (!camera.focus(floor, x)) return
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
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          camera.drag(0, height * (event.key === 'ArrowUp' ? 0.14 : -0.14))
        } else if (/^[0-4]$/.test(event.key)) {
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
        const doorId = doorIds.get(node)
        if (doorId) {
          callbacks.onActivate(doorId)
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
      const floor = pickedFloor(hit.point)
      if (floor !== undefined) focusFloor(floor, hit.point.x)
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
        if (smokeChanged || forceRender) smoke?.update(snapshot, reducedMotion.matches)
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
    return { zoomBy: (factor) => camera.zoomBy(factor), focusFloor, resetView, captureRoom, dispose }
  } catch (error) {
    dispose()
    throw error
  }
}
