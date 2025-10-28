import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

let scene, camera, renderer, controls
let pathGroup, markersGroup, resizeObserver
let mountEl
let currentIndex = 0
let orders = []

// 창고 기본 파라미터
const DIM = { cellW: 1.6, cellD: 1.0, gapX: 0.25, gapZ: 0.6, floorGapY: 1.4, shelfThick: 0.35 }
const WAREHOUSE = { cols: 5, rows: 6 }
const COLORS = [0x9a6161, 0xa97d56, 0x5f8263, 0x56779f, 0x6f5a89]
const zLines = Math.ceil(WAREHOUSE.rows / 2)

// ========= 초기화 =========
export function initWarehouseScene(container, orderList) {
  mountEl = container
  orders = orderList
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x8a8a8a)

  const w = container.clientWidth
  const h = container.clientHeight

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000)
  camera.position.set(10, 8, 16)
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(window.devicePixelRatio)
  container.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.target.set(0, 1, 0)

  scene.add(new THREE.AmbientLight(0xffffff, 0.8))

  const dir = new THREE.DirectionalLight(0xffffff, 0.6)

  dir.position.set(10, 15, 10)
  scene.add(dir)

  buildWarehouse()
  buildMarkers()

  resizeObserver = new ResizeObserver(() => {
    const w = container.clientWidth
    const h = container.clientHeight

    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  })
  resizeObserver.observe(container)

  animate()
  focusNextPath(0)
}

export function disposeWarehouse() {
  cancelAnimationFrame(anim)
  controls?.dispose?.()
  renderer?.dispose?.()
  if (mountEl) mountEl.innerHTML = ''
  scene = null
  camera = null
  renderer = null
  orders = []
}

// ========= 렌더링 =========
let anim
function animate() {
  anim = requestAnimationFrame(animate)
  controls?.update()
  renderer.render(scene, camera)
}

// ========= 창고/마커 =========
function buildWarehouse() {
  const { cellW, cellD, gapX, gapZ, floorGapY, shelfThick } = DIM

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 22),
    new THREE.MeshPhongMaterial({ color: 0xffffff }),
  )

  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  for (let c = 0; c < WAREHOUSE.cols; c++) {
    for (let r = 1; r <= WAREHOUSE.rows; r++) {
      const letter = String.fromCharCode(65 + c)
      const floor = r % 2 === 1 ? 0 : 1
      const pairIndex = Math.floor((r - 1) / 2)
      const x = (c - (WAREHOUSE.cols - 1) / 2) * (cellW + gapX)
      const z = (pairIndex - (zLines - 1) / 2) * (cellD + gapZ)
      const y = floor * floorGapY + shelfThick / 2

      const mat = new THREE.MeshPhongMaterial({
        color: COLORS[c % COLORS.length],
        transparent: true,
        opacity: 0.25,
      })

      const geo = new THREE.BoxGeometry(cellW, shelfThick, cellD)
      const mesh = new THREE.Mesh(geo, mat)

      mesh.position.set(x, y, z)
      scene.add(mesh)
    }
  }
}

function buildMarkers() {
  markersGroup = new THREE.Group()
  scene.add(markersGroup)

  orders.forEach((p, i) => {
    const pos = getPosition(p.location)
    const sprite = makeMarker(i + 1)

    sprite.position.copy(pos).add(new THREE.Vector3(0, 0.6, 0))
    markersGroup.add(sprite)
  })
}

function makeMarker(n) {
  const size = 64
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')

  c.width = c.height = size * 2
  ctx.scale(2, 2)
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.fillStyle = '#2563eb'
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = '600 18px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(n, size / 2, size / 2)

  const tex = new THREE.CanvasTexture(c)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true })
  const spr = new THREE.Sprite(mat)

  spr.scale.set(0.9, 0.9, 1)
  
  return spr
}

// ========= 경로 =========
export function focusNextPath(i) {
  if (!orders[i]) return
  const from = i === 0 ? 'A-1' : orders[i - 1].location
  const to = orders[i].location

  drawPath(from, to)
}

function drawPath(from, to) {
  if (!pathGroup) {
    pathGroup = new THREE.Group()
    scene.add(pathGroup)
  }
  while (pathGroup.children.length) {
    const ch = pathGroup.children.pop()

    ch.geometry?.dispose?.()
    ch.material?.dispose?.()
  }

  const pts = makePathPoints(from, to)
  const curve = new THREE.CatmullRomCurve3(pts)
  const tube = new THREE.TubeGeometry(curve, 30, 0.08, 16, false)

  const mat = new THREE.MeshPhongMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.9,
    emissive: 0x166534,
  })

  const mesh = new THREE.Mesh(tube, mat)

  pathGroup.add(mesh)

  // 포커스 이동
  const target = pts[pts.length - 1]

  camera.lookAt(target)
  controls.target.copy(target)
}

// ========= 유틸 =========
function getPosition(key) {
  const m = key.match(/^([A-Z])-(\d+)$/i)
  if (!m) return new THREE.Vector3()
  const letter = m[1].toUpperCase()
  const r = Number(m[2])
  const col = letter.charCodeAt(0) - 65
  const floor = r % 2 === 1 ? 0 : 1
  const pairIndex = Math.floor((r - 1) / 2)
  const { cellW, cellD, gapX, gapZ, floorGapY, shelfThick } = DIM
  const x = (col - (WAREHOUSE.cols - 1) / 2) * (cellW + gapX)
  const z = (pairIndex - (zLines - 1) / 2) * (cellD + gapZ)
  const y = floor * floorGapY + shelfThick / 2
  
  return new THREE.Vector3(x, y, z)
}

function makePathPoints(from, to) {
  const A = getPosition(from)
  const B = getPosition(to)
  const pts = []

  pts.push(A)
  if (Math.abs(A.y - B.y) > 0.01) pts.push(new THREE.Vector3(A.x, B.y, A.z))
  pts.push(new THREE.Vector3(B.x, B.y, A.z))
  pts.push(B)
  
  return pts
}
