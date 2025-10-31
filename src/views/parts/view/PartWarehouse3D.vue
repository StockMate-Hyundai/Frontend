<!-- File: src/views/parts/view/PartWarehouse3D.vue -->
<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  location: { type: String, default: '' },
})

const mountRef = ref(null)
let renderer, scene, camera, controls, rootGroup, animId, resizeObserver
let highlightedRack = null
let arrowMarker = null
let arrowPhase = 0

// 창고 레이아웃 상수
const MM = 0.001
const BAY = { W: 2400*MM, D_SINGLE: 1200*MM }
const RACK_GAP = 0.25
const END_GAP = 0.35
const MIN_R2R = 0.30
const BAY_PITCH = BAY.W + RACK_GAP
const AISLE = { MAIN: 3.8, SUB: 3.6, ZONE: 5.5, PERIMETER: 2.4 }
const SEGMENT = { BAYS: 5, GAP: 5.0 }
const DOCK_BUFFER = 10.0

const CENTER_GROUPS = [
  { name: 'ZONE A', bundles: 1, letter: 'A' },
  { name: 'ZONE B', bundles: 1, letter: 'B' },
  { name: 'ZONE C', bundles: 1, letter: 'C' },
  { name: 'ZONE D', bundles: 1, letter: 'D' },
  { name: 'ZONE E', bundles: 1, letter: 'E' },
]

const WORK = { size: { w: 12.0, d: 8.0 }, table: { w: 1.8, h: 0.9, d: 0.8 }, bufferFromRacks: 5.0 }

// ===== Lights =====
function setupLights() {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x909090, 0.8)

  scene.add(hemi)

  const dir = new THREE.DirectionalLight(0xffffff, 0.9)

  dir.position.set(70, 90, 40)
  dir.castShadow = true
  dir.shadow.mapSize.set(2048, 2048)
  dir.shadow.camera.left = -400
  dir.shadow.camera.right = 400
  dir.shadow.camera.top = 400
  dir.shadow.camera.bottom = -400
  scene.add(dir)
}

// ===== Build Warehouse =====
function buildWarehouse() {
  rootGroup = new THREE.Group()
  scene.add(rootGroup)

  const rowPitch = BAY.D_SINGLE*2 + AISLE.SUB + MIN_R2R
  const segWidth = (SEGMENT.BAYS - 1) * BAY_PITCH + END_GAP*2
  const rowWidth = (segWidth + SEGMENT.GAP) * 4 - SEGMENT.GAP
  const totalWidth = rowWidth + AISLE.PERIMETER*2 + 2.0
  
  const STAGING = 3.0

  const totalDepth =
    STAGING + AISLE.MAIN + DOCK_BUFFER +
    CENTER_GROUPS.reduce((s, g) => s + g.bundles*rowPitch, 0) +
    (CENTER_GROUPS.length - 1) * AISLE.ZONE +
    AISLE.PERIMETER*2 + WORK.size.d + 3.0

  /* 바닥/벽 */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.ceil((totalWidth+2)/2)*2, Math.ceil((totalDepth+2)/2)*2),
    new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.96 }),
  )

  floor.rotation.x = -Math.PI/2
  floor.receiveShadow = true
  rootGroup.add(floor)
  
  addWalls(totalWidth, totalDepth, 10)
  buildDockAndStaging(totalWidth, STAGING, 6, -totalDepth/2 + STAGING/2)
  drawAisleStripe(0, -totalDepth/2 + STAGING + AISLE.MAIN/2, totalWidth - 2, AISLE.MAIN)
  drawPerimeterStripes(totalWidth, totalDepth, AISLE.PERIMETER)

  /* 중앙 백투백 */
  const originZ = -totalDepth/2
  const rowStartX = -rowWidth/2 + segWidth/2
  let zoneCursorZ = originZ + STAGING + AISLE.MAIN + DOCK_BUFFER + BAY.D_SINGLE + AISLE.PERIMETER + MIN_R2R/2
  
  CENTER_GROUPS.forEach((zone, zi) => {
    addZoneLabel(zone.name, 0, 5.2, zoneCursorZ + (rowPitch*zone.bundles)/2)
    for (let b = 0; b < zone.bundles; b++) {
      const centerZ = zoneCursorZ + b*rowPitch
      for (let seg = 0; seg < 4; seg++) {
        const segCenterX = rowStartX + seg*(segWidth + SEGMENT.GAP)

        // zone당 40개 블록 (0-39): 앞면 0-19, 뒷면 20-39
        // 각 세그먼트당 5개 베이
        const blockOffset = seg * 5

        buildBackToBackSegment(centerZ, segCenterX, SEGMENT.BAYS, zone.letter, blockOffset)
      }
    }
    if (zi < CENTER_GROUPS.length-1) {
      drawAisleStripe(0, zoneCursorZ + zone.bundles*rowPitch + AISLE.ZONE/2, totalWidth - 2, AISLE.ZONE)
      zoneCursorZ += zone.bundles*rowPitch + AISLE.ZONE
    }
  })

  /* 작업대 */
  const workX = totalWidth/2 - WORK.size.w/2 - 1.0
  let workZ = totalDepth/2 - WORK.size.d/2 - 1.0
  const lastCenterZ = zoneCursorZ - (CENTER_GROUPS[CENTER_GROUPS.length-1].bundles*rowPitch)
  if (Math.abs(workZ - lastCenterZ) < WORK.bufferFromRacks) {
    workZ = lastCenterZ + WORK.bufferFromRacks
  }
  buildWorkArea(workX, workZ)

  /* 입구 포인트 */
  const entrance = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.2, 24),
    new THREE.MeshStandardMaterial({ color: 0x2f9e44 }),
  )

  entrance.position.set(0, 0.02, originZ + STAGING/2)
  entrance.castShadow = true
  rootGroup.add(entrance)
}

function addWalls(w, d, h) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x667584, roughness: 1 })

  const mk = (W, H, D, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mat)

    m.position.set(x, y, z)
    m.receiveShadow = true
    rootGroup.add(m)
  }

  mk(w, h, .5, 0, h/2, -d/2)
  mk(w, h, .5, 0, h/2, d/2)
  mk(.5, h, d, -w/2, h/2, 0)
  mk(.5, h, d, w/2, h/2, 0)
}

function buildDockAndStaging(totalW, stagingD, doors, zCenter) {
  drawHatch(0, zCenter, totalW-2, stagingD, 1.4)

  const laneW = 1.2
  const laneD = stagingD - 0.6
  const lanes = Math.floor((totalW - 4) / 1.5)
  for (let i = 0; i < lanes; i++) {
    const x = -totalW/2 + 2 + i*1.5

    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(laneW, laneD),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9 }),
    )

    plate.rotation.x = -Math.PI/2
    plate.position.set(x, 0.006, zCenter)
    rootGroup.add(plate)
  }
}

function drawPerimeterStripes(totalW, totalD, width) {
  drawAisleStripe(-totalW/2 + width/2, 0, width, totalD-2)
  drawAisleStripe(totalW/2 - width/2, 0, width, totalD-2)
  drawAisleStripe(0, -totalD/2 + width/2, totalW-2, width)
  drawAisleStripe(0, totalD/2 - width/2, totalW-2, width)
}

function buildWorkArea(cx, cz) {
  drawHatch(cx, cz, WORK.size.w, WORK.size.d, 1.2)

  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(WORK.size.w + 0.2, 0.12, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24 }),
  )

  guard.position.set(cx, 0.07, cz - WORK.size.d/2 - 0.25)
  rootGroup.add(guard)
  
  const gap = 0.9
  const baseX = cx - WORK.size.w/2 + WORK.table.w/2 + 1.2
  const baseZ = cz
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(
      new THREE.BoxGeometry(WORK.table.w, WORK.table.h, WORK.table.d),
      new THREE.MeshStandardMaterial({ color: 0xf1f3f5, metalness: .05, roughness: .6 }),
    )

    t.position.set(baseX + i*(WORK.table.w + gap), WORK.table.h/2, baseZ)
    t.castShadow = true
    t.receiveShadow = true
    rootGroup.add(t)
  }
}

function buildBackToBackSegment(centerZ, segmentCenterX, bays = 5, zoneName = 'C', blockOffset = 0) {
  const half = BAY.D_SINGLE + MIN_R2R/2
  const innerSpan = (bays-1)*BAY_PITCH
  const startX = segmentCenterX - innerSpan/2
  for (let i = 0; i < bays; i++) {
    const x = startX + i*BAY_PITCH
    
    // 앞면 랙: 앞면방향 (블록 0-19)
    const frontBlock = blockOffset + i
    const front = makeRackUnitFacingFront(zoneName, frontBlock, true)

    front.position.set(x, 0, centerZ + half)
    front.userData.zone = zoneName
    front.userData.block = frontBlock
    rootGroup.add(front)
    
    // 뒷면 랙: 뒤집어서 (블록 20-39)
    const backBlock = blockOffset + i + 20
    const back = makeRackUnitFacingFront(zoneName, backBlock, true)

    back.position.set(x, 0, centerZ - half)
    back.rotation.y = Math.PI
    back.userData.zone = zoneName
    back.userData.block = backBlock
    rootGroup.add(back)
  }
}

function drawAisleStripe(cx, cz, w, d) {
  const g = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: 0xf6f7f9 }),
  )

  g.rotation.x = -Math.PI/2
  g.position.set(cx, 0.01, cz)
  rootGroup.add(g)
}

function drawHatch(cx, cz, w, d, pitch = 1.5) {
  const g = new THREE.Group()

  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: 0xf7f1c8 }),
  )

  plate.rotation.x = -Math.PI/2
  plate.position.set(cx, 0.005, cz)
  g.add(plate)
  
  for (let x = -w/2; x <= w/2; x += pitch) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.06, d),
      new THREE.MeshBasicMaterial({ color: 0xe9c46a }),
    )

    line.rotation.x = -Math.PI/2
    line.position.set(cx + x, 0.006, cz)
    g.add(line)
  }
  rootGroup.add(g)
}

function makeSectionLabel(text) {
  const canvas = document.createElement('canvas')

  canvas.width = 256
  canvas.height = 128

  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 4
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8)
  ctx.fillStyle = '#000'
  ctx.font = 'bold 52px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)

  const tex = new THREE.CanvasTexture(canvas)
  
  return new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 1.4),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
  )
}

function addZoneLabel(text, x, y, z) {
  const lbl = makeSectionLabel(text)

  lbl.scale.set(1.1, 1.1, 1)
  lbl.position.set(x, y, z)
  rootGroup.add(lbl)
}

// ===== Racks =====
const RACK_COLORS = { upright: 0x0d3b66, beam: 0xe67e22, shelf: 0x9aa0a6 }

function makeRackUnitFacingFront(section, bayNo, randomLoad = false) {
  const g = new THREE.Group()

  g.name = 'RACK_UNIT'
  g.userData = {
    type: 'RACK',
    section,
    bay: bayNo,
    levels: 4,
    depthType: '양면(백투백)',
    sampleSkus: [`${section}${bayNo}-ALT-0123`, `${section}${bayNo}-SUS-2088`, `${section}${bayNo}-ELC-7741`],
  }

  const H = 5.0
  const W = 2.4
  const D = 1.2
  const upr = new THREE.MeshStandardMaterial({ color: RACK_COLORS.upright, roughness: 0.7 })
  const beam = new THREE.MeshStandardMaterial({ color: RACK_COLORS.beam, metalness: .1, roughness: .5 })
  const shelf = new THREE.MeshStandardMaterial({ color: RACK_COLORS.shelf, roughness: .9 })
  const uprGeo = new THREE.BoxGeometry(0.14, H, 0.14)
  
  for (let z of [-D/2, +D/2]) {
    for (let x of [-W/2, +W/2]) {
      const u = new THREE.Mesh(uprGeo, upr)

      u.position.set(x, H/2, z)
      u.castShadow = true
      g.add(u)
    }
  }
  
  for (let lv = 0; lv < 4; lv++) {
    const y = 0.9 + lv * 1.1
    const f = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, 0.1), beam)

    f.position.set(0, y, +D/2)
    
    const b = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, 0.1), beam)

    b.position.set(0, y, -D/2)
    
    const s = new THREE.Mesh(new THREE.BoxGeometry(W - 0.22, 0.06, D - 0.16), shelf)

    s.position.set(0, y - 0.02, 0)
    s.receiveShadow = true
    g.add(f, b, s)
    
    if (!randomLoad || Math.random() > 0.2) {
      const fill = Math.random()*0.25
      const box = makeBox(W - 0.28, 0.75 + fill, D - 0.24)

      box.position.set(0, y + 0.36 + fill/2, 0)
      g.add(box)
    }
  }
  
  return g
}

function makeBox(w, h, d) {
  const palette = [0xC4A484, 0xD3B08D, 0xD9B99B, 0xE0C097, 0xBFA27A]

  const mat = new THREE.MeshStandardMaterial({
    color: palette[Math.floor(Math.random() * palette.length)],
    roughness: 0.85,
    metalness: 0.0,
  })

  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)

  m.castShadow = true
  m.receiveShadow = true
  
  return m
}

// ===== Arrow Marker =====
function createArrowMarker() {
  const arrow = new THREE.Group()
  
  // 원뿔 부분 (화살표 끝) - 더 크게
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.6, 1.2, 16),
    new THREE.MeshStandardMaterial({ color: 0xff0000 }),
  )

  cone.position.set(0, 0, 0)
  cone.rotation.z = Math.PI
  cone.castShadow = true
  arrow.add(cone)
  
  // 실린더 부분 (화살표 막대) - 더 길게
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 3.0, 16),
    new THREE.MeshStandardMaterial({ color: 0xff0000 }),
  )

  cylinder.position.set(0, -1.5, 0)
  cylinder.castShadow = true
  arrow.add(cylinder)
  
  return arrow
}

function addArrowMarker(position) {
  // 기존 화살표 제거
  if (arrowMarker) {
    rootGroup.remove(arrowMarker)
    arrowMarker = null
  }
  
  // 새 화살표 추가
  arrowMarker = createArrowMarker()
  arrowMarker.position.copy(position)
  arrowMarker.userData.baseY = position.y // 애니메이션용 기본 Y 위치 저장
  arrowPhase = 0 // 애니메이션 페이즈 리셋
  rootGroup.add(arrowMarker)
}

// ===== Highlight =====
function updateHighlight(loc) {
  // 이전 하이라이트 제거
  if (highlightedRack) {
    setEmissive(highlightedRack, 0x000000)
    highlightedRack = null
  }
  
  // 이전 화살표 제거
  if (arrowMarker) {
    rootGroup.remove(arrowMarker)
    arrowMarker = null
  }
  
  if (!loc) return
  
  // location 파싱 (예: "A0-1" → zone='A', block=0, level=1)
  // 형식: 알파벳(ZONE) + 숫자(블록 0-39) + "-" + 숫자(층 1-4)
  const m = loc.trim().match(/^([A-Z])(\d+)\s*-\s*(\d+)$/i)
  if (!m) {
    console.warn('Invalid location format:', loc)
    
    return
  }
  
  const zone = m[1].toUpperCase()
  const block = parseInt(m[2], 10)
  const level = parseInt(m[3], 10)
  
  // 해당 랙 찾기
  rootGroup.traverse(obj => {
    if (obj.userData?.type === 'RACK') {
      // userData에서 zone, block 정보 확인
      const rackZone = obj.userData.zone || obj.userData.section
      const rackBlock = obj.userData.block
      
      // 랙 매칭
      if (rackZone === zone && rackBlock === block) {
        highlightedRack = obj
        setEmissive(obj, 0x2f80ed)
        
        // 카메라 포커스
        const pos = new THREE.Vector3()

        obj.getWorldPosition(pos)
        
        // 랙 위에 화살표 위치 (랙 높이는 약 5m, 더 높게)
        const arrowPos = new THREE.Vector3(pos.x, pos.y + 5.0 + 2.5, pos.z)

        addArrowMarker(arrowPos)
        
        focusCameraTo(pos.x, pos.y, pos.z)
      }
    }
  })
}

function setEmissive(target, color) {
  target.traverse(obj => {
    if (obj.isMesh && obj.material) {
      // MeshStandardMaterial의 경우 emissive 속성 설정
      if (obj.material.type === 'MeshStandardMaterial' || obj.material.type === 'MeshPhongMaterial') {
        if (!obj.material.emissive) {
          obj.material.emissive = new THREE.Color(0x000000)
        }
        obj.material.emissive.setHex(color)
        obj.material.emissiveIntensity = color === 0x000000 ? 0 : 0.5
        obj.material.needsUpdate = true
      }
    }
  })
}

function focusCameraTo(x, y, z, dist = 35) {
  if (!camera || !controls) return
  
  const target = new THREE.Vector3(x, y + 2, z)
  
  // 부드럽게 카메라 이동
  let t = 0
  const startPos = camera.position.clone()
  const startTarget = controls.target.clone()
  
  const step = () => {
    t += 0.03

    const k = Math.min(1, t)

    camera.position.lerpVectors(startPos, target.clone().add(new THREE.Vector3(0, 15, 15)), k)
    controls.target.lerpVectors(startTarget, target, k)
    if (k < 1) requestAnimationFrame(step)
  }

  step()
}

// ===== Scene Setup =====
function buildScene() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf4f6f8)
  scene.fog = new THREE.Fog(0xf4f6f8, 120, 260)

  const w = mountRef.value.clientWidth
  const h = Math.max(400, mountRef.value.clientHeight || 520)

  camera = new THREE.PerspectiveCamera(58, w / h, 0.1, 3000)
  camera.position.set(54, 36, 64)
  
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  mountRef.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 18
  controls.maxDistance = 180
  controls.target.set(0, 0, 0)
  controls.update()

  setupLights()
  buildWarehouse()
  updateHighlight(props.location)

  resizeObserver = new ResizeObserver(() => {
    const w = mountRef.value.clientWidth
    const h = Math.max(400, mountRef.value.clientHeight || 520)

    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  })
  resizeObserver.observe(mountRef.value)

  animate()
}

// ===== Animation =====
function animate() {
  animId = requestAnimationFrame(animate)
  
  // 화살표 위아래 움직임
  if (arrowMarker) {
    arrowPhase += 0.02

    const floatAmount = Math.sin(arrowPhase) * 0.3

    arrowMarker.position.y = arrowMarker.userData.baseY + floatAmount
  }
  
  controls?.update()
  renderer.render(scene, camera)
}

// ===== Lifecycle =====
onMounted(() => {
  if (!mountRef.value) return
  buildScene()
})

onBeforeUnmount(() => {
  if (animId) cancelAnimationFrame(animId)
  if (resizeObserver && mountRef.value) resizeObserver.unobserve(mountRef.value)
  controls?.dispose?.()
  renderer?.dispose?.()
  if (renderer?.domElement && mountRef.value) {
    mountRef.value.removeChild(renderer.domElement)
  }
  scene = null
  camera = null
  controls = null
  rootGroup = null
  highlightedRack = null
  arrowMarker = null
})

watch(() => props.location, v => updateHighlight(v))
</script>

<template>
  <div
    ref="mountRef"
    style="width: 100%; height: 72vh; border-radius: 8px; overflow: hidden;"
  />
</template>
