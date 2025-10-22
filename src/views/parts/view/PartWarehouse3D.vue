<!-- File: src/views/parts/view/PartWarehouse3D.vue -->
<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * 스펙
 * - 열: A~E (5열)
 * - 행: 1..6 → (1,2)=z1 / (3,4)=z2 / (5,6)=z3
 * - 층: 홀수=1층, 짝수=2층 (같은 자리 z에서 y만 다름)
 * - 총 30칸
 * - location 예: "c-4"
 */

const props = defineProps({
  location: { type: String, default: '' }, // "c-4"
  cols: { type: Number, default: 5 },      // A..E
  rows: { type: Number, default: 6 },      // 1..6
})

const mountRef = ref(null)
let renderer, scene, camera, controls, gridGroup, animId, resizeObserver

// 전역 치수
const DIM = { cellW: 1.6, cellD: 1.0, gapX: 0.25, gapZ: 0.6, floorGapY: 1.4, shelfThick: 0.35 }

// 톤다운 열 색상
const colColors = [0x9a6161, 0xa97d56, 0x5f8263, 0x56779f, 0x6f5a89]

// 셀 조회용 맵: "A-1" → { group, mesh, label, halo?, outline? }
const cellsMap = new Map()

// 현재 하이라이트 상태
let activeKey = null
let pulsePhase = 0

// location 파서
function parseLocation(loc) {
  const m = (loc || '').trim().match(/^([A-Za-z])\s*-\s*(\d+)$/)
  if (!m) return null
  const letter = m[1].toUpperCase()
  let col = letter.charCodeAt(0) - 65
  if (col < 0 || col >= props.cols) col = 0
  const rowNum = Math.max(1, Math.min(props.rows, Number(m[2]) || 1))
  const floor = rowNum % 2 === 1 ? 0 : 1
  const pairIndex = Math.floor((rowNum - 1) / 2)
  return { letter, col, rowNum, floor, pairIndex }
}

// 둥근 사각형 path
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

// 라벨 스프라이트(항상 위)
function makeLabelSprite(text, { color = '#222', bg = 'rgba(255,255,255,0.95)', pad = 8, fontSize = 8, weight = 600 } = {}) {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.font = `${weight} ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif`
  const tw = ctx.measureText(text).width
  const w = Math.ceil((tw + pad * 2) * dpr)
  const h = Math.ceil((fontSize + pad * 2) * dpr)
  canvas.width = w
  canvas.height = h
  ctx.scale(dpr, dpr)
  ctx.fillStyle = bg
  roundRect(ctx, 0, 0, w / dpr, h / dpr, 6)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'
  ctx.stroke()
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.fillText(text, pad, (h / dpr) / 2)

  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  tex.anisotropy = 4
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    opacity: 0.9,        // 기본 라벨 투명도
  })
  const spr = new THREE.Sprite(mat)
  const scale = 0.012
  spr.scale.set((w / dpr) * scale, (h / dpr) * scale, 1)
  spr.renderOrder = 999
  return spr
}

// HALO 스프라이트(셀 그룹에 부착)
function makeHaloSprite() {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2)
  grd.addColorStop(0, 'rgba(47,128,237,0.55)')
  grd.addColorStop(0.6, 'rgba(47,128,237,0.25)')
  grd.addColorStop(1, 'rgba(47,128,237,0)')
  g.fillStyle = grd
  g.beginPath(); g.arc(size/2, size/2, size/2, 0, Math.PI*2); g.fill()

  const tex = new THREE.CanvasTexture(c)
  tex.minFilter = THREE.LinearFilter
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    opacity: 0.85,
  })
  const spr = new THREE.Sprite(mat)
  spr.scale.set(1.6, 1.6, 1)
  spr.renderOrder = 996
  return spr
}

// 카메라 포커싱
function focusCameraTo(x, y, z, dist = 6.5) {
  if (!camera || !controls) return
  const target = new THREE.Vector3(x, y + 0.4, z)
  const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize()
  const newPos = new THREE.Vector3().addVectors(target, dir.multiplyScalar(dist))
  let t = 0
  const startPos = camera.position.clone()
  const startTarget = controls.target.clone()
  const step = () => {
    t += 0.15
    const k = Math.min(1, t)
    camera.position.lerpVectors(startPos, newPos, k)
    controls.target.lerpVectors(startTarget, target, k)
    if (k < 1) requestAnimationFrame(step)
  }
  step()
}

// 씬 구성
function buildScene() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x8a8a8a)

  const w = mountRef.value.clientWidth
  const h = Math.max(320, mountRef.value.clientHeight || 520)

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000)
  camera.position.set(10, 10, 18)
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

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 22),
    new THREE.MeshPhongMaterial({ color: 0xffffff })
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.01
  scene.add(ground)

  const { cellW, cellD, gapX, gapZ, floorGapY, shelfThick } = DIM
  const zLines = Math.ceil(props.rows / 2)

  gridGroup = new THREE.Group()
  scene.add(gridGroup)
  cellsMap.clear()

  // 30칸 생성: 칸마다 그룹을 만들고, 그룹에 선반/라벨 추가
  for (let c = 0; c < props.cols; c++) {
    const letter = String.fromCharCode(65 + c)
    for (let rowNum = 1; rowNum <= props.rows; rowNum++) {
      const floor = rowNum % 2 === 1 ? 0 : 1
      const pairIndex = Math.floor((rowNum - 1) / 2)

      const x = (c - (props.cols - 1) / 2) * (cellW + gapX)
      const z = (pairIndex - (zLines - 1) / 2) * (cellD + gapZ)
      const y = floor * floorGapY + shelfThick / 2

      const key = `${letter}-${rowNum}`

      const group = new THREE.Group()
      group.position.set(x, y, z)

      const shelfMat = new THREE.MeshPhongMaterial({
        color: colColors[c % colColors.length],
        transparent: true,
        opacity: 0.18, // 기본은 아주 옅게
      })
      const geo = new THREE.BoxGeometry(cellW, shelfThick, cellD)
      const mesh = new THREE.Mesh(geo, shelfMat)
      group.add(mesh)

      const label = makeLabelSprite(key)
      label.material.opacity = 0.7   
      label.material.transparent = true
      label.position.set(0, 0.42, 0)
      group.add(label)

      gridGroup.add(group)
      cellsMap.set(key, { group, mesh, label })
    }
  }

  updateHighlight(props.location)

  // 리사이즈
  resizeObserver = new ResizeObserver(entries => {
    for (const e of entries) {
      const cw = e.contentRect.width
      const ch = Math.max(320, e.contentRect.height || 520)
      camera.aspect = cw / ch
      camera.updateProjectionMatrix()
      renderer.setSize(cw, ch)
    }
  })
  resizeObserver.observe(mountRef.value)

  animate()
}

// 활성 셀 강조 설정/해제
function setCellHighlight(key, on) {
  const cell = cellsMap.get(key)
  if (!cell) return
  const { mesh, group } = cell

  if (on) {
    // 재질 강조
    mesh.material.opacity = 0.95
    mesh.material.color.set(0x2f80ed)
    mesh.material.emissive?.set?.(0x1b5dbf)
    mesh.material.needsUpdate = true

    // HALO가 없으면 생성해 부착
    if (!cell.halo) {
      cell.halo = makeHaloSprite()
      cell.halo.position.set(0, DIM.shelfThick * 0.55, 0)
      group.add(cell.halo)
    }
    cell.halo.visible = true

    // 테두리(깊이 테스트 끔, 살짝 위로 올려 z-fighting 방지)
    if (!cell.outline) {
      const edgeGeo = new THREE.EdgesGeometry(mesh.geometry)
      const edgeMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 2,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
      })
      cell.outline = new THREE.LineSegments(edgeGeo, edgeMat)
      cell.outline.position.y = 0.001 // 살짝 띄우기
      cell.outline.renderOrder = 995
      group.add(cell.outline)
    }
    cell.outline.visible = false
  } else {
    // 원복
    mesh.material.color.set(colColors[colorIndexOfKey(key)])
    mesh.material.opacity = 0.18
    mesh.material.emissive?.set?.(0x000000)
    mesh.material.needsUpdate = true

    if (cell.halo) cell.halo.visible = false
    if (cell.outline) cell.outline.visible = false
    // 그룹 위치/스케일 원복
    group.position.y = group.position.y - (group.userData._bob || 0)
    group.userData._bob = 0
    group.scale.set(1,1,1)
  }
}

// key에서 열 인덱스 추출
function colorIndexOfKey(key) {
  const letter = key.charCodeAt(0) - 65
  return (letter >= 0 && letter < props.cols) ? letter % colColors.length : 0
}

// 하이라이트 갱신
function updateHighlight(loc) {
  const parsed = parseLocation(loc)
  // 이전 활성 해제
  if (activeKey) setCellHighlight(activeKey, false)

  if (!parsed) {
    activeKey = null
    return
  }

  const key = `${parsed.letter}-${parsed.rowNum}`
  const cell = cellsMap.get(key)
  if (!cell) {
    activeKey = null
    return
  }

  // 활성 적용
  setCellHighlight(key, true)
  activeKey = key
  pulsePhase = 0

  // 카메라 포커스
  const { group } = cell
  const worldPos = new THREE.Vector3()
  group.getWorldPosition(worldPos)
  focusCameraTo(worldPos.x, worldPos.y, worldPos.z)
}

// 루프
function animate() {
  animId = requestAnimationFrame(animate)
  controls?.update()

  // 활성 칸만 위아래로 천천히 튕김
  if (activeKey) {
    const cell = cellsMap.get(activeKey)
    if (cell) {
      // 느린 주기
      pulsePhase += 0.04

      // 목표 바운스(진폭 약 0.08m)
      const targetBob = Math.sin(pulsePhase * 0.9) * 0.08

      // 이전 바운스를 저장해 두고, 부드럽게 보간
      const prevBob = cell.group.userData._bob ?? 0
      const nextBob = prevBob + (targetBob - prevBob) * 0.08  // 감쇠 보간

      // 이전 보정 제거 후 새 값 적용
      cell.group.position.y -= prevBob
      cell.group.position.y += nextBob
      cell.group.userData._bob = nextBob

      cell.group.scale.set(1.1, 1.2, 1.1)

      // 효과는 살짝만 호흡
      if (cell.halo) {
        const breathe = 0.03 * Math.sin(pulsePhase)
        cell.halo.scale.set(1.6 + breathe, 1.6 + breathe, 1)
        cell.halo.material.opacity = 0.8 + 0.05 * Math.sin(pulsePhase)
      }
      if (cell.outline) {
        cell.outline.material.opacity = 0.9 + 0.05 * Math.abs(Math.sin(pulsePhase))
      }
    }
  }

  renderer.render(scene, camera)
}


// 생명주기
onMounted(() => {
  if (!mountRef.value) return
  buildScene()

  // 초기 포커스(타이밍 보완)
  if (props.location) {
    const p = parseLocation(props.location)
    if (p) {
      const key = `${p.letter}-${p.rowNum}`
      const cell = cellsMap.get(key)
      if (cell) {
        const pos = new THREE.Vector3()
        cell.group.getWorldPosition(pos)
        focusCameraTo(pos.x, pos.y, pos.z)
      }
    }
  }
})

onBeforeUnmount(() => {
  if (animId) cancelAnimationFrame(animId)
  if (resizeObserver && mountRef.value) resizeObserver.unobserve(mountRef.value)
  controls?.dispose?.()
  renderer?.dispose?.()
  if (renderer?.domElement && mountRef.value) mountRef.value.removeChild(renderer.domElement)
  scene = null
  camera = null
  controls = null
  gridGroup = null
  cellsMap.clear()
  activeKey = null
})

watch(() => props.location, v => updateHighlight(v))
</script>

<template>
  <div ref="mountRef" style="inline-size:100%; block-size:520px;"></div>
</template>
