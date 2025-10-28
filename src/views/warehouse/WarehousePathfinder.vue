<!-- File: src/views/warehouse/WarehousePathfinder.vue -->
<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 데모 가정
 * - 창고: A~E(5열), 행 1..6 → (1,2)=z라인1, (3,4)=z라인2, (5,6)=z라인3
 * - 층: 홀수=1층(0), 짝수=2층(1) — 같은 자리에서 y만 다름
 * - 좌표/치수는 PartWarehouse3D와 동일 톤
 * - 경로: 그리드 맨해튼 경로(+층 바뀌면 수직 세그먼트), TubeGeometry로 두껍게 시각화
 */

// ======== 데모 입력 ========
const demoOrder = ref(['B-5', 'D-2', 'E-4', 'A-3'])

// 시작점(입구) 가정: A-1
const START_LOC = 'A-1'

// ======== 3D 공용 ========
const mountRef = ref(null)
let renderer, scene, camera, controls, animId, resizeObserver

// 창고 치수(PartWarehouse3D와 맞춤)
const DIM = { cellW: 1.6, cellD: 1.0, gapX: 0.25, gapZ: 0.6, floorGapY: 1.4, shelfThick: 0.35 }
const WAREHOUSE = { cols: 5, rows: 6 }
const zLines = Math.ceil(WAREHOUSE.rows / 2)
const colColors = [0x9a6161, 0xa97d56, 0x5f8263, 0x56779f, 0x6f5a89]

// 선반 셀 맵
const cellsMap = new Map() // key "A-1" → { group, mesh, label }

// 경로 라인/튜브 Mesh
let pathGroup // 이전 경로 제거용 그룹
let markersGroup // 마커 그룹
let currentKey = START_LOC // 현재 “서 있는” 위치 키
let stepIndex = 0 // demoOrder 인덱스

// ======== 유틸 ========
function parseKey(key) {
  const m = key.trim().match(/^([A-Z])-(\d+)$/i)
  if (!m) return null
  const letter = m[1].toUpperCase()
  const rowNum = Math.max(1, Math.min(WAREHOUSE.rows, Number(m[2]) || 1))
  const col = letter.charCodeAt(0) - 65
  const floor = rowNum % 2 === 1 ? 0 : 1
  const pairIndex = Math.floor((rowNum - 1) / 2) // 0..2
  
  return { letter, rowNum, col, floor, pairIndex }
}

function gridToWorld({ col, floor, pairIndex }) {
  const { cellW, cellD, gapX, gapZ, floorGapY, shelfThick } = DIM
  const x = (col - (WAREHOUSE.cols - 1) / 2) * (cellW + gapX)
  const z = (pairIndex - (zLines - 1) / 2) * (cellD + gapZ)
  const y = floor * floorGapY + shelfThick / 2
  
  return new THREE.Vector3(x, y, z)
}

// 마커(숫자원) 스프라이트
function makeNumberMarker(n, color = '#3b82f6') {
  const s = 48
  const canvas = document.createElement('canvas')

  canvas.width = canvas.height = s * 2

  const ctx = canvas.getContext('2d')

  ctx.scale(2, 2)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = '600 18px system-ui, -apple-system, Segoe UI, Roboto'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(n), s / 2, s / 2)

  const tex = new THREE.CanvasTexture(canvas)

  tex.minFilter = THREE.LinearFilter

  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })
  const spr = new THREE.Sprite(mat)


  // 카메라와 무관한 픽셀 고정 스케일 보정은 animate에서 처리
  spr.userData.aspect = 1
  
  return spr
}

// 경로 계산(간단 맨해튼 + 층이동 수직 세그먼트)
function computePathPoints(fromKey, toKey) {
  const a = parseKey(fromKey); const b = parseKey(toKey)
  if (!a || !b) return []

  // world 점(센터)
  const A = gridToWorld(a)
  const B = gridToWorld(b)

  // 같은 z라인(같은 pairIndex)에서만 좌/우/앞/뒤로 간다고 가정.
  // z라인이 다르면 z라인 중간 통로(중간 z=0 라인)로 내려갔다가 이동 → 단순화
  const pts = []

  // 수직(층) 먼저 맞추기(같은 자리에서 y만 이동)
  if (a.floor !== b.floor) {
    pts.push(A.clone())

    const mid = A.clone()

    mid.y = B.y
    pts.push(mid)
  }

  // 수평이동: x → z 순서(또는 z → x). 여기서는 x 먼저.
  const start = pts.length ? pts[pts.length - 1] : A.clone()
  const midX = new THREE.Vector3(B.x, start.y, start.z)

  pts.push(start, midX)

  const midZ = new THREE.Vector3(B.x, B.y, B.z)

  pts.push(midZ)

  // 맨 마지막은 B 주변으로 부드럽게
  pts.push(B.clone())

  // 중복 제거
  const cleaned = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    if (!pts[i].equals(pts[i - 1])) cleaned.push(pts[i])
  }
  
  return cleaned
}

// 튜브로 경로 메쉬 생성
function makePathTube(points, color = 0x22c55e) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.0)
  const tube = new THREE.TubeGeometry(curve, Math.max(8, points.length * 4), 0.06, 12, false)

  const mat = new THREE.MeshPhongMaterial({
    color,
    emissive: new THREE.Color(color).multiplyScalar(0.2),
    transparent: true,
    opacity: 0.95,
  })

  return new THREE.Mesh(tube, mat)
}

// 경로 표시
function showPath(fromKey, toKey) {
  if (!pathGroup) {
    pathGroup = new THREE.Group()
    scene.add(pathGroup)
  }

  // 지우고 그리기
  while (pathGroup.children.length) {
    const ch = pathGroup.children.pop()

    ch.geometry?.dispose?.()
    ch.material?.dispose?.()
  }

  const pts = computePathPoints(fromKey, toKey)
  if (pts.length >= 2) {
    const tube = makePathTube(pts)

    pathGroup.add(tube)
    focusCameraTo(pts[pts.length - 1])
  }
}

// 카메라 포커스
function focusCameraTo(targetVec3, dist = 6.5) {
  const target = targetVec3.clone().add(new THREE.Vector3(0, 0.3, 0))
  const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize()
  const newPos = new THREE.Vector3().addVectors(target, dir.multiplyScalar(dist))
  let t = 0
  const startPos = camera.position.clone()
  const startTarget = controls.target.clone()

  const step = () => {
    t += 0.12

    const k = Math.min(1, t)

    camera.position.lerpVectors(startPos, newPos, k)
    controls.target.lerpVectors(startTarget, target, k)
    if (k < 1) requestAnimationFrame(step)
  }

  step()
}

// 마커 만들기
function buildMarkers() {
  if (markersGroup) {
    scene.remove(markersGroup)
    markersGroup = null
  }
  markersGroup = new THREE.Group()
  scene.add(markersGroup)

  demoOrder.value.forEach((key, i) => {
    const p = parseKey(key)
    const pos = gridToWorld(p)
    const spr = makeNumberMarker(i + 1, '#3b82f6')


    // 라벨 픽셀 고정 스케일은 animate에서 다시 맞춤
    spr.position.copy(pos).add(new THREE.Vector3(0, 0.55, 0))
    spr.userData.key = key
    spr.name = `POI-${key}`
    markersGroup.add(spr)
  })
}

// 라벨 픽셀 고정 스케일
const tmpV = new THREE.Vector3()
function adjustMarkerScale() {
  if (!renderer || !camera || !markersGroup) return
  const viewH = renderer.domElement.clientHeight || 1
  const worldPerPx = dist => 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / viewH
  const desiredPx = 42

  markersGroup.children.forEach(spr => {
    markersGroup.worldToLocal(tmpV.copy(spr.getWorldPosition(new THREE.Vector3())))

    const dist = camera.position.distanceTo(spr.getWorldPosition(new THREE.Vector3()))
    const h = desiredPx * worldPerPx(dist)

    spr.scale.set(h, h, 1)
  })
}

// 클릭 처리(Raycaster)
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

function onPointer(e) {
  const rect = renderer.domElement.getBoundingClientRect()

  mouse.x = ((e.clientX - rect.left) / rect.width) * 1.999 - 1
  mouse.y = -((e.clientY - rect.top) / rect.height) * 1.999 + 1
  raycaster.setFromCamera(mouse, camera)

  const hits = raycaster.intersectObjects(markersGroup.children, true)
  if (hits.length) {
    const obj = hits[0].object
    const key = obj.userData.key
    if (key) {
      showPath(currentKey, key)
      currentKey = key
    }
  }
}

// ======== 씬 구성 ========
function buildWarehouse() {
  // 바닥
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 22),
    new THREE.MeshPhongMaterial({ color: 0xffffff }),
  )

  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.01
  scene.add(ground)

  // 랙 셀
  const group = new THREE.Group()

  scene.add(group)

  const { cellW, cellD, gapX, gapZ, floorGapY, shelfThick } = DIM

  for (let c = 0; c < WAREHOUSE.cols; c++) {
    const letter = String.fromCharCode(65 + c)
    for (let rowNum = 1; rowNum <= WAREHOUSE.rows; rowNum++) {
      const floor = rowNum % 2 === 1 ? 0 : 1
      const pairIndex = Math.floor((rowNum - 1) / 2)
      const x = (c - (WAREHOUSE.cols - 1) / 2) * (cellW + gapX)
      const z = (pairIndex - (zLines - 1) / 2) * (cellD + gapZ)
      const y = floor * floorGapY + shelfThick / 2

      const key = `${letter}-${rowNum}`
      const g = new THREE.Group()

      g.position.set(x, y, z)

      const mat = new THREE.MeshPhongMaterial({
        color: colColors[c % colColors.length],
        transparent: true,
        opacity: 0.2,
      })

      const geo = new THREE.BoxGeometry(cellW, shelfThick, cellD)
      const mesh = new THREE.Mesh(geo, mat)

      g.add(mesh)

      // 옅은 위치 라벨
      const label = makeCellLabel(key)

      label.position.set(0, 0.42, 0)
      g.add(label)

      group.add(g)
      cellsMap.set(key, { group: g, mesh, label })
    }
  }
}

// 칸 라벨(옅게)
function makeCellLabel(text) {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  const fs = 16

  c.width = 200; c.height = 60
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  roundRect(ctx, 0, 0, 100, 30, 6); ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.stroke()
  ctx.fillStyle = '#333'; ctx.font = `600 ${fs}px system-ui, -apple-system, Segoe UI, Roboto`
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 10, 15)

  const tex = new THREE.CanvasTexture(c)

  tex.minFilter = THREE.LinearFilter

  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, opacity: 0.55 })
  const spr = new THREE.Sprite(mat)


  // 고정 스케일은 생략(작게)
  spr.scale.set(1.1, 0.35, 1)
  spr.renderOrder = 999
  
  return spr
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// ======== 라이프사이클 ========
function buildScene() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x8a8a8a)

  const w = mountRef.value.clientWidth
  const h = Math.max(320, mountRef.value.clientHeight || 560)

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000)
  camera.position.set(10, 9, 18)
  camera.lookAt(0, 1, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(w, h)
  mountRef.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 6
  controls.maxDistance = 40
  controls.target.set(0, 1, 0)

  scene.add(new THREE.AmbientLight(0xffffff, 0.75))

  const dir = new THREE.DirectionalLight(0xffffff, 0.6)

  dir.position.set(10, 15, 10)
  scene.add(dir)

  buildWarehouse()
  buildMarkers()

  // 초기 경로: 입구 → 첫 목적지
  if (demoOrder.value.length) {
    showPath(START_LOC, demoOrder.value[0])

    const p = gridToWorld(parseKey(demoOrder.value[0]))

    focusCameraTo(p)
  }

  // 이벤트
  renderer.domElement.addEventListener('pointerdown', onPointer)

  // Resize
  resizeObserver = new ResizeObserver(entries => {
    for (const e of entries) {
      const cw = e.contentRect.width
      const ch = Math.max(320, e.contentRect.height || 560)

      camera.aspect = cw / ch
      camera.updateProjectionMatrix()
      renderer.setSize(cw, ch)
    }
  })
  resizeObserver.observe(mountRef.value)

  animate()
}

function animate() {
  animId = requestAnimationFrame(animate)
  controls?.update()
  adjustMarkerScale()
  renderer.render(scene, camera)
}

onMounted(buildScene)

onBeforeUnmount(() => {
  if (animId) cancelAnimationFrame(animId)
  renderer?.domElement?.removeEventListener('pointerdown', onPointer)
  if (resizeObserver && mountRef.value) resizeObserver.unobserve(mountRef.value)
  controls?.dispose?.()
  renderer?.dispose?.()
  if (renderer?.domElement && mountRef.value) mountRef.value.removeChild(renderer.domElement)
  scene = null
  camera = null
  controls = null
  cellsMap.clear()
  pathGroup = null
  markersGroup = null
})

// ======== UI 액션 ========
function gotoPrev() {
  if (stepIndex <= 0) return
  const prevKey = stepIndex === 1 ? START_LOC : demoOrder.value[stepIndex - 2]
  const currKey = demoOrder.value[stepIndex - 1]

  showPath(prevKey, currKey)
  currentKey = currKey
  stepIndex--
}
function gotoNext() {
  if (stepIndex >= demoOrder.value.length) return
  const from = stepIndex === 0 ? START_LOC : demoOrder.value[stepIndex - 1]
  const to   = demoOrder.value[stepIndex]

  showPath(from, to)
  currentKey = to
  stepIndex++
}
</script>

<template>
  <VCard class="rounded-xl">
    <div class="d-flex align-center justify-space-between px-4 pt-3">
      <div class="text-subtitle-1 font-weight-medium">
        출고 동선 데모
      </div>
      <div class="d-flex align-center gap-2">
        <VBtn
          size="small"
          variant="tonal"
          :disabled="stepIndex<=0"
          @click="gotoPrev"
        >
          이전
        </VBtn>
        <VBtn
          size="small"
          variant="flat"
          color="primary"
          :disabled="stepIndex>=demoOrder.length"
          @click="gotoNext"
        >
          다음
        </VBtn>
      </div>
    </div>
    <VCardText class="pt-2">
      <div
        ref="mountRef"
        style="inline-size:100%; block-size:560px;"
      />

      <div class="mt-3 text-caption text-medium-emphasis">
        • 입구(시작): <strong>A-1</strong> → 주문 순서:
        <strong>{{ demoOrder.join(', ') }}</strong><br>
        • 마커를 클릭해도 해당 지점까지 경로가 그려집니다.
      </div>
    </VCardText>
  </VCard>
</template>
