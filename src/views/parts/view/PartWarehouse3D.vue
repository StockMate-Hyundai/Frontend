<!-- File: src/views/parts/view/PartWarehouse3D.vue -->
<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  location: { type: String, default: '' },
  highlightLocations: { type: Array, default: () => [] }, // 하이라이트할 위치 목록
  optimizedRoute: { type: Array, default: () => [] }, // 최적 경로 데이터
  fullPath: { type: Array, default: () => [] }, // 경로 좌표 배열 [{row, col}, ...]
  showGrid: { type: Boolean, default: false }, // 바닥 그리드 표시 여부
  gridCols: { type: Number, default: 25 }, // 그리드 가로 칸 수
  gridRows: { type: Number, default: 24 }, // 그리드 세로 칸 수
  pathfindingGrid: { type: Array, default: null }, // 경로 탐색 그리드 데이터
})

const mountRef = ref(null)
let renderer, scene, camera, controls, rootGroup, animId, resizeObserver
let highlightedRack = null
let arrowMarker = null
let arrowPhase = 0
let gridGroup = null
let pathGroup = null
let poiMarkersGroup = null
let totalWidth = 0
let totalDepth = 0
let animationFrameId = null
let isAnimating = false
let animationProgress = 0
let animationSpeed = 0.0012 // 애니메이션 속도 (더 느리게)
let currentStepIndex = -1 // 현재 경유지 인덱스
let isStepAnimationActive = false // 경유지별 애니메이션 활성화 상태
let initialCameraPosition = null // 초기 카메라 위치
let initialCameraTarget = null // 초기 카메라 타겟
let currentPositionMarker = null // 현재 위치 마커
let currentPathPosition = 0 // 경로상 현재 위치 (인덱스)
let isNavigationMode = false // 네비게이션 모드 여부

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

  totalWidth = rowWidth + AISLE.PERIMETER*2 + 2.0
  
  const STAGING = 3.0

  totalDepth =
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

        // zone당 40개 블록 (0-39)
        // 세그먼트 0: 앞면 0-4, 뒷면 5-9
        // 세그먼트 1: 앞면 10-14, 뒷면 15-19
        // 세그먼트 2: 앞면 20-24, 뒷면 25-29
        // 세그먼트 3: 앞면 30-34, 뒷면 35-39
        // 각 세그먼트당 5개 베이, 앞면 시작 번호
        const blockOffset = seg * 10  // 0, 10, 20, 30

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
  
  // 그리드 오버레이 추가
  if (props.showGrid) {
    if (props.pathfindingGrid) {
      drawPathfindingGrid()
    } else {
      drawFloorGrid()
    }
  } else {
    drawGridOverlay()
  }
  
  // 하이라이트할 위치가 있으면 표시
  if (props.highlightLocations && props.highlightLocations.length > 0) {
    highlightRacks(props.highlightLocations)
  }
  
  // 경로가 있으면 그리기
  if (props.fullPath && props.fullPath.length > 0) {
    drawPathFromFullPath(props.fullPath)
  } else if (props.optimizedRoute && props.optimizedRoute.length > 0) {
    drawPathFromRoute(props.optimizedRoute)
  }
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
    
    // 0-4번대가 문쪽 (centerZ - half), 5-9번대가 포장대쪽 (centerZ + half)
    // 앞면 랙: 문쪽 (블록 0-4, 10-14, 20-24, 30-34) - 작은 블록 번호
    const frontBlock = blockOffset + i
    const front = makeRackUnitFacingFront(zoneName, frontBlock, true)

    front.position.set(x, 0, centerZ - half) // 문쪽 (z가 작은 쪽)
    front.userData.zone = zoneName
    front.userData.block = frontBlock
    rootGroup.add(front)
    
    // 앞면 랙 라벨 추가 (랙 앞면에 붙임)
    const frontLabel = makeRackLabel(zoneName, frontBlock)

    frontLabel.position.set(x, 1.5, centerZ - half - 0.61) // 랙 앞면 중간 높이에 붙임
    frontLabel.rotation.y = Math.PI // 문쪽을 바라보도록
    frontLabel.lookAt(x, 1.5, centerZ - half - 1.0) // 카메라를 바라보도록
    rootGroup.add(frontLabel)
    
    // 뒷면 랙: 포장대쪽 (블록 5-9, 15-19, 25-29, 35-39) - 큰 블록 번호
    // 뒷면은 앞면보다 5 큰 번호 (예: 앞면 0-4 → 뒷면 5-9)
    const backBlock = blockOffset + i + 5
    const back = makeRackUnitFacingFront(zoneName, backBlock, true)

    back.position.set(x, 0, centerZ + half) // 포장대쪽 (z가 큰 쪽)
    back.rotation.y = Math.PI
    back.userData.zone = zoneName
    back.userData.block = backBlock
    rootGroup.add(back)
    
    // 뒷면 랙 라벨 추가 (랙 뒷면에 붙임)
    const backLabel = makeRackLabel(zoneName, backBlock)

    backLabel.position.set(x, 1.5, centerZ + half + 0.61) // 랙 뒷면 중간 높이에 붙임
    backLabel.lookAt(x, 1.5, centerZ + half + 1.0) // 카메라를 바라보도록
    rootGroup.add(backLabel)
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

// ===== 랙 라벨 생성 =====
function makeRackLabel(zoneName, blockNumber) {
  const canvas = document.createElement('canvas')

  canvas.width = 256
  canvas.height = 128

  const ctx = canvas.getContext('2d')
  
  // 배경 (연한 파란색 또는 주황색 - 첫 번째 큰 열 블록(0-9, 20-29)은 주황색)
  const isFirstColumn = (blockNumber >= 0 && blockNumber <= 9) || (blockNumber >= 20 && blockNumber <= 29)

  ctx.fillStyle = isFirstColumn ? '#FFA500' : '#ADD8E6' // 주황색 또는 연한 파란색
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  // 테두리
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 3
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4)
  
  // 텍스트
  ctx.fillStyle = '#000'
  ctx.font = 'bold 48px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const labelText = `${zoneName}${blockNumber}`

  ctx.fillText(labelText, canvas.width / 2, canvas.height / 2)

  const tex = new THREE.CanvasTexture(canvas)

  tex.needsUpdate = true
  
  // 랙 앞면에 붙일 수 있도록 더 큰 크기
  return new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.6),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }),
  )
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

  cone.position.set(0, 5.5, 0)
  cone.rotation.z = Math.PI
  cone.castShadow = true
  arrow.add(cone)
  
  // 실린더 부분 (화살표 막대) - 더 길게
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 3.0, 16),
    new THREE.MeshStandardMaterial({ color: 0xff0000 }),
  )

  cylinder.position.set(0, 4, 0)
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
let highlightedRacks = [] // 하이라이트된 랙들 배열

function highlightRacks(locations) {
  // 이전 하이라이트 제거
  highlightedRacks.forEach(rack => {
    setEmissive(rack, 0x000000)
  })
  highlightedRacks = []
  
  if (!locations || locations.length === 0) return
  
  // 각 location에 대해 랙 찾기
  locations.forEach(locData => {
    const loc = typeof locData === 'string' ? locData : locData.location
    if (!loc) return
    
    // location 파싱 (예: "A0-1" → zone='A', block=0, level=1)
    const m = loc.trim().match(/^([A-Z])(\d+)\s*-\s*(\d+)$/i)
    if (!m) {
      console.warn('Invalid location format:', loc)
      
      return
    }
    
    const zone = m[1].toUpperCase()
    const block = parseInt(m[2], 10)
    
    // 해당 랙 찾기
    rootGroup.traverse(obj => {
      if (obj.userData?.type === 'RACK') {
        const rackZone = obj.userData.zone || obj.userData.section
        const rackBlock = obj.userData.block
        
        // 랙 매칭
        if (rackZone === zone && rackBlock === block) {
          highlightedRacks.push(obj)
          setEmissive(obj, 0xffff00) // 노란색으로 하이라이트
        }
      }
    })
  })
}

function updateHighlight(loc) {
  // 단일 location 하이라이트 (기존 호환성)
  if (loc) {
    highlightRacks([loc])

    // 카메라를 해당 위치로 이동
    focusToLocation(loc)
  } else {
    highlightRacks([])

    // 화살표 마커 제거
    if (arrowMarker) {
      rootGroup.remove(arrowMarker)
      arrowMarker = null
    }
  }
}

// location 문자열로부터 랙 위치 찾기
// useAislePosition: true면 통로 위치 반환, false면 랙 실제 위치 반환
function findRackPosition(location, useAislePosition = true) {
  if (!location || !rootGroup) return null
  
  // location 파싱 (예: "A0-1" → zone='A', block=0, level=1)
  // "A0" 형식도 처리할 수 있도록 수정
  let parsed = location.trim()
  if (!parsed.includes('-')) {
    // "A0" 형식이면 "A0-1"로 변환
    parsed = `${parsed}-1`
  }
  const m = parsed.match(/^([A-Z])(\d+)\s*-\s*(\d+)$/i)
  if (!m) {
    console.warn('Invalid location format:', location)
    
    return null
  }
  
  const zone = m[1].toUpperCase()
  const block = parseInt(m[2], 10)
  
  // 해당 랙 찾기
  let rackFound = null
  rootGroup.traverse(obj => {
    if (obj.userData?.type === 'RACK') {
      const rackZone = obj.userData.zone || obj.userData.section
      const rackBlock = obj.userData.block
      
      if (rackZone === zone && rackBlock === block) {
        rackFound = obj
      }
    }
  })
  
  if (!rackFound) return null
  
  // 랙의 월드 위치 가져오기
  // 랙의 위치는 이미 centerZ + half (앞면) 또는 centerZ - half (뒷면)에 있음
  const worldPos = new THREE.Vector3()

  rackFound.getWorldPosition(worldPos)
  
  // 랙의 실제 위치를 반환하는 경우
  if (!useAislePosition) {
    return {
      x: worldPos.x,
      y: worldPos.y, // 랙의 실제 높이
      z: worldPos.z,
    }
  }
  
  // 랙 앞쪽 통로 위치로 조정
  // 앞면 랙(0-19): centerZ + half 위치에 있음, 앞쪽은 +Z 방향 (라벨이 centerZ + half + 0.61에 있음)
  // 뒷면 랙(20-39): centerZ - half 위치에 있음, 앞쪽은 -Z 방향 (라벨이 centerZ - half - 0.61에 있음)
  // 통로는 랙 사이에 있으며, AISLE.SUB 너비
  const isFrontFace = block < 20
  
  // 랙 앞쪽 통로 위치 (통로 중앙)
  // 앞면 랙: 랙 위치(worldPos.z)에서 +Z 방향으로 AISLE.SUB/2만큼 이동
  // 뒷면 랙: 랙 위치(worldPos.z)에서 -Z 방향으로 AISLE.SUB/2만큼 이동
  const aisleOffset = AISLE.SUB / 2
  const offsetZ = isFrontFace ? aisleOffset : -aisleOffset
  
  return {
    x: worldPos.x,
    y: 0.1, // 바닥에서 약간 위
    z: worldPos.z + offsetZ,
  }
}

// location으로 카메라 포커스 및 화살표 마커 추가
function focusToLocation(location) {
  // 부품 상세에서는 랙의 실제 위치에 화살표 표시
  const rackPos = findRackPosition(location, false) // 랙 실제 위치
  if (!rackPos) return
  
  // 카메라는 통로 위치를 바라보도록 (통로 위치 계산)
  const aislePos = findRackPosition(location, true) // 통로 위치
  if (aislePos) {
    focusCameraTo(aislePos.x, aislePos.y, aislePos.z)
  }
  
  // 화살표 마커는 랙의 실제 위치에 표시 (바닥 위)
  addArrowMarker(new THREE.Vector3(rackPos.x, 0.5, rackPos.z))
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
  
  // 초기 카메라 위치 저장 (controls 생성 후)
  initialCameraPosition = camera.position.clone()
  initialCameraTarget = controls.target.clone()

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
  
  // 네비게이션 모드일 때 카메라 타겟과 위치를 부드럽게 따라가도록
  // 카메라 거리는 유지하면서 타겟만 따라가도록
  if (isNavigationMode && currentPositionMarker && camera && controls) {
    const currentPos = currentPositionMarker.position.clone()
    
    // 타겟만 부드럽게 따라가도록 (매우 부드럽게)
    controls.target.lerp(currentPos, 0.05)
    
    // 카메라 거리 유지 (점점 가까워지는 것 방지)
    // 현재 카메라와 타겟 사이의 거리를 계산
    const currentDistance = camera.position.distanceTo(controls.target)
    const desiredDistance = 35 // 원하는 거리 (높이와 비슷하게)
    
    // 거리가 너무 가까워지면 카메라를 뒤로 이동
    if (currentDistance < desiredDistance * 0.8) {
      const direction = new THREE.Vector3()
      direction.subVectors(camera.position, controls.target).normalize()
      
      // 원하는 거리로 카메라 위치 조정
      const desiredCameraPos = controls.target.clone().add(direction.multiplyScalar(desiredDistance))
      desiredCameraPos.y = 35 // 높이 유지
      camera.position.lerp(desiredCameraPos, 0.1)
    }
    
    controls.update()
  }
  
  // 화살표 위아래 움직임
  if (arrowMarker) {
    arrowPhase += 0.02

    const floatAmount = Math.sin(arrowPhase) * 0.3

    arrowMarker.position.y = arrowMarker.userData.baseY + floatAmount
  }
  
  // POI 마커 스케일 조정 (카메라 거리에 따라)
  if (poiMarkersGroup && camera) {
    poiMarkersGroup.children.forEach(marker => {
      if (marker.userData && marker.userData.baseScale !== undefined) {
        const distance = camera.position.distanceTo(marker.position)
        const baseDistance = 50 // 기준 거리 (이 거리에서 스케일 1.0)
        const minScale = 0.3 // 최소 스케일 (확대해도 최소한 보이도록)
        const maxScale = 3.0 // 최대 스케일 (축소해도 너무 크지 않도록)
        
        // 거리에 비례하여 스케일 조정 (거리가 멀수록(축소) 크게, 가까울수록(확대) 작게)
        let scale = (distance / baseDistance) * marker.userData.baseScale
        scale = Math.max(minScale, Math.min(maxScale, scale)) // 범위 제한
        
        marker.scale.setScalar(scale)
      }
    })
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
  
  // 그리드 그룹 정리
  if (gridGroup) {
    while (gridGroup.children.length) {
      const ch = gridGroup.children.pop()

      ch.geometry?.dispose?.()
      ch.material?.dispose?.()
    }
  }
  
  // 경로 그룹 정리
  clearPath()
  
  scene = null
  camera = null
  controls = null
  rootGroup = null
  highlightedRack = null
  arrowMarker = null
  gridGroup = null
  pathGroup = null
  highlightedRacks = []
})

// ===== 바닥 그리드 (가로 25칸, 세로 24칸) =====
function drawPathfindingGrid() {
  console.log('[drawPathfindingGrid] 호출됨')
  console.log('[drawPathfindingGrid] pathfindingGrid:', props.pathfindingGrid)
  
  if (!props.pathfindingGrid || !Array.isArray(props.pathfindingGrid)) {
    console.warn('[drawPathfindingGrid] pathfindingGrid가 없거나 배열이 아님')
    
    return
  }
  
  if (!rootGroup) {
    console.warn('[drawPathfindingGrid] rootGroup이 없음')
    
    return
  }
  
  if (!gridGroup) {
    gridGroup = new THREE.Group()
    rootGroup.add(gridGroup)
    console.log('[drawPathfindingGrid] gridGroup 생성')
  }
  
  // 기존 그리드 제거
  while (gridGroup.children.length) {
    const ch = gridGroup.children.pop()

    ch.geometry?.dispose?.()
    ch.material?.dispose?.()
  }
  
  const GRID_ROWS = props.pathfindingGrid.length
  const GRID_COLS = props.pathfindingGrid[0]?.length || 0
  
  console.log('[drawPathfindingGrid] 그리드 크기:', GRID_ROWS, 'x', GRID_COLS)
  
  if (GRID_ROWS === 0 || GRID_COLS === 0) {
    console.warn('[drawPathfindingGrid] 그리드 크기가 0')
    
    return
  }
  
  // 그리드 크기 계산
  const gridWidth = totalWidth
  const gridDepth = totalDepth
  const cellWidth = gridWidth / GRID_COLS
  const cellDepth = gridDepth / GRID_ROWS
  
  // 그리드 시작 위치 (중앙 기준)
  const startX = -gridWidth / 2
  const startZ = -gridDepth / 2
  
  // 그리드 선 재질
  const gridLineMaterial = new THREE.LineBasicMaterial({ color: 0x888888, linewidth: 1 })
  
  // 세로선
  for (let i = 0; i <= GRID_COLS; i++) {
    const x = startX + i * cellWidth

    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 0.02, startZ),
      new THREE.Vector3(x, 0.02, startZ + gridDepth),
    ])

    const line = new THREE.Line(geometry, gridLineMaterial)

    gridGroup.add(line)
  }
  
  // 가로선
  for (let i = 0; i <= GRID_ROWS; i++) {
    const z = startZ + i * cellDepth

    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(startX, 0.02, z),
      new THREE.Vector3(startX + gridWidth, 0.02, z),
    ])

    const line = new THREE.Line(geometry, gridLineMaterial)

    gridGroup.add(line)
  }
  
  // 각 셀의 내용 표시
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const cellValue = props.pathfindingGrid[row][col]
      const cellX = startX + col * cellWidth + cellWidth / 2
      const cellZ = startZ + row * cellDepth + cellDepth / 2
      
      // 'x' 장애물 표시 (빨간색 사각형)
      if (cellValue === 'x') {
        const obstacle = new THREE.Mesh(
          new THREE.PlaneGeometry(cellWidth * 0.8, cellDepth * 0.8),
          new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 }),
        )

        obstacle.rotation.x = -Math.PI / 2
        obstacle.position.set(cellX, 0.03, cellZ)
        gridGroup.add(obstacle)
        
        // 'X' 텍스트 라벨
        const canvas = document.createElement('canvas')

        canvas.width = 64
        canvas.height = 64

        const ctx = canvas.getContext('2d')

        ctx.fillStyle = '#ff0000'
        ctx.font = 'bold 48px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('X', 32, 32)

        const texture = new THREE.CanvasTexture(canvas)
        const labelMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true })

        const labelMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(0.3, 0.3),
          labelMaterial,
        )

        labelMesh.rotation.x = -Math.PI / 2
        labelMesh.position.set(cellX, 0.04, cellZ)
        gridGroup.add(labelMesh)
      }

      // 라벨 표시 (노란색 배경 + 라벨 텍스트)
      else if (cellValue !== 'o' && typeof cellValue === 'string' && cellValue.match(/^[A-E]\d+$/)) {
        const canvas = document.createElement('canvas')

        canvas.width = 128
        canvas.height = 64

        const ctx = canvas.getContext('2d')

        ctx.fillStyle = '#ffff00'
        ctx.fillRect(0, 0, 128, 64)
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 2
        ctx.strokeRect(1, 1, 126, 62)
        ctx.fillStyle = '#000'
        ctx.font = 'bold 24px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(cellValue, 64, 32)

        const texture = new THREE.CanvasTexture(canvas)
        const labelMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true })

        const labelMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(cellWidth * 0.7, cellDepth * 0.7),
          labelMaterial,
        )

        labelMesh.rotation.x = -Math.PI / 2
        labelMesh.position.set(cellX, 0.04, cellZ) 
        gridGroup.add(labelMesh)
      }
    }
  }
  
  console.log('[drawPathfindingGrid] 그리드 그리기 완료, 자식 개수:', gridGroup.children.length)
}

function drawFloorGrid() {
  if (!gridGroup) {
    gridGroup = new THREE.Group()
    rootGroup.add(gridGroup)
  }
  
  // 기존 그리드 제거
  while (gridGroup.children.length) {
    const ch = gridGroup.children.pop()

    ch.geometry?.dispose?.()
    ch.material?.dispose?.()
  }
  
  const cols = props.gridCols || 25
  const rows = props.gridRows || 24
  
  // 그리드 크기 계산 (바닥 전체를 덮도록)
  const gridWidth = totalWidth
  const gridDepth = totalDepth
  const cellWidth = gridWidth / cols
  const cellDepth = gridDepth / rows
  
  // 그리드 시작 위치 (중앙 기준)
  const startX = -gridWidth / 2
  const startZ = -gridDepth / 2
  
  // 그리드 선 재질
  const gridMaterial = new THREE.LineBasicMaterial({ color: 0xcccccc, linewidth: 1 })
  
  // 세로선 (가로 25칸이므로 26개 선)
  for (let i = 0; i <= cols; i++) {
    const x = startX + i * cellWidth

    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 0.02, startZ),
      new THREE.Vector3(x, 0.02, startZ + gridDepth),
    ])

    const line = new THREE.Line(geometry, gridMaterial)

    gridGroup.add(line)
  }
  
  // 가로선 (세로 24칸이므로 25개 선)
  for (let i = 0; i <= rows; i++) {
    const z = startZ + i * cellDepth

    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(startX, 0.02, z),
      new THREE.Vector3(startX + gridWidth, 0.02, z),
    ])

    const line = new THREE.Line(geometry, gridMaterial)

    gridGroup.add(line)
  }
}

// ===== 그리드 오버레이 (실제 창고 레이아웃 기반) =====
function drawGridOverlay() {
  if (!gridGroup) {
    gridGroup = new THREE.Group()
    rootGroup.add(gridGroup)
  }
  
  // 기존 그리드 제거
  while (gridGroup.children.length) {
    const ch = gridGroup.children.pop()

    ch.geometry?.dispose?.()
    ch.material?.dispose?.()
  }
  
  // 실제 창고 구조 기반 그리드 계산
  // 5개 ZONE (행) x 4개 세그먼트 (열) = 각 셀에 10개 랙 세트 (앞면 5개 + 뒷면 5개)
  const rowPitch = BAY.D_SINGLE*2 + AISLE.SUB + MIN_R2R
  const segWidth = (SEGMENT.BAYS - 1) * BAY_PITCH + END_GAP*2
  const rowWidth = (segWidth + SEGMENT.GAP) * 4 - SEGMENT.GAP
  const originZ = -totalDepth/2
  const STAGING = 3.0
  const rowStartX = -rowWidth/2 + segWidth/2
  
  // ZONE 시작 위치 계산
  let zoneCursorZ = originZ + STAGING + AISLE.MAIN + DOCK_BUFFER + BAY.D_SINGLE + AISLE.PERIMETER + MIN_R2R/2
  
  // 노란색 그리드 선
  const gridMaterial = new THREE.LineBasicMaterial({ color: 0xffd700, linewidth: 2 })
  
  // 세로선 (4개 세그먼트 + 양끝)
  const numCols = 4
  for (let col = 0; col <= numCols; col++) {
    let x
    if (col === 0) {
      // 첫 번째 세그먼트 왼쪽 경계
      x = rowStartX - segWidth/2 - SEGMENT.GAP/2
    } else if (col === numCols) {
      // 마지막 세그먼트 오른쪽 경계
      x = rowStartX + (numCols - 1) * (segWidth + SEGMENT.GAP) + segWidth/2 + SEGMENT.GAP/2
    } else {
      // 세그먼트 사이 경계
      x = rowStartX + (col - 0.5) * (segWidth + SEGMENT.GAP)
    }
    
    // ZONE 영역 전체를 포함하는 세로선
    const zoneStartZ = zoneCursorZ - BAY.D_SINGLE - AISLE.PERIMETER
    const zoneEndZ = zoneCursorZ + (CENTER_GROUPS.length - 1) * (rowPitch + AISLE.ZONE) + rowPitch + AISLE.PERIMETER
    
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 0.02, zoneStartZ),
      new THREE.Vector3(x, 0.02, zoneEndZ),
    ])

    const line = new THREE.Line(geometry, gridMaterial)

    gridGroup.add(line)
  }
  
  // 가로선 (5개 ZONE + ZONE 사이 + 양끝)
  const numRows = CENTER_GROUPS.length
  let currentZ = zoneCursorZ
  
  // 첫 번째 ZONE 위쪽 경계
  let topZ = currentZ - BAY.D_SINGLE - AISLE.PERIMETER
  const bottomBoundary = currentZ + (numRows - 1) * (rowPitch + AISLE.ZONE) + rowPitch + AISLE.PERIMETER
  
  for (let row = 0; row <= numRows; row++) {
    let z
    if (row === 0) {
      z = topZ
    } else if (row === numRows) {
      z = bottomBoundary
    } else {
      // ZONE 사이 경계
      const prevZoneZ = zoneCursorZ + (row - 1) * (rowPitch + AISLE.ZONE)

      z = prevZoneZ + rowPitch + AISLE.ZONE/2
    }
    
    const leftX = rowStartX - segWidth/2 - SEGMENT.GAP/2
    const rightX = rowStartX + (numCols - 1) * (segWidth + SEGMENT.GAP) + segWidth/2 + SEGMENT.GAP/2
    
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(leftX, 0.02, z),
      new THREE.Vector3(rightX, 0.02, z),
    ])

    const line = new THREE.Line(geometry, gridMaterial)

    gridGroup.add(line)
  }
  
  // 각 셀 내부에 랙 개수 표시 (선택사항)
  CENTER_GROUPS.forEach((zone, zi) => {
    const centerZ = zoneCursorZ + zi * (rowPitch + AISLE.ZONE)
    for (let seg = 0; seg < 4; seg++) {
      const segCenterX = rowStartX + seg*(segWidth + SEGMENT.GAP)

      // 셀 중심에 작은 텍스트/마커로 "10개" 표시할 수 있음 (선택사항)
    }
    if (zi < CENTER_GROUPS.length - 1) {
      zoneCursorZ += rowPitch + AISLE.ZONE
    }
  })
}


// ===== 경로 그리기 =====
function locationToAislePosition(locationStr) {
  if (!locationStr || !rootGroup) return null
  
  // "문" 또는 "포장대" 처리
  if (locationStr === '문' || locationStr === 'door') {
    return getEntrancePosition()
  }
  if (locationStr === '포장대' || locationStr === 'packing') {
    return getWorkAreaPosition()
  }
  
  // location 파싱 (예: "A0-1" 또는 "A0")
  // "A0" 형식도 처리할 수 있도록 수정
  let parsed = locationStr.trim()
  if (!parsed.includes('-')) {
    // "A0" 형식이면 "A0-1"로 변환
    parsed = `${parsed}-1`
  }
  const m = parsed.match(/^([A-Z])(\d+)\s*-\s*(\d+)$/i)
  if (!m) {
    console.warn('Invalid location format:', locationStr)
    
    return null
  }
  
  const zone = m[1].toUpperCase()
  const block = parseInt(m[2], 10)
  
  // 해당 랙 찾기
  let rackFound = null
  rootGroup.traverse(obj => {
    if (obj.userData?.type === 'RACK') {
      const rackZone = obj.userData.zone || obj.userData.section
      const rackBlock = obj.userData.block
      
      if (rackZone === zone && rackBlock === block) {
        rackFound = obj
      }
    }
  })
  
  if (!rackFound) return null
  
  // 랙의 월드 위치 가져오기
  // 랙의 위치는 이미 centerZ + half (앞면) 또는 centerZ - half (뒷면)에 있음
  const worldPos = new THREE.Vector3()

  rackFound.getWorldPosition(worldPos)
  
  // 랙 앞쪽 통로 위치로 조정
  // 앞면 랙(0-19): centerZ + half 위치에 있음, 앞쪽은 +Z 방향
  // 뒷면 랙(20-39): centerZ - half 위치에 있음, 앞쪽은 -Z 방향
  // 통로는 랙 사이에 있으며, AISLE.SUB 너비
  const isFrontFace = block < 20
  
  // 랙 앞쪽 통로 위치 (통로 중앙)
  // 앞면 랙: 랙 위치에서 +Z 방향으로 AISLE.SUB/2만큼 이동
  // 뒷면 랙: 랙 위치에서 -Z 방향으로 AISLE.SUB/2만큼 이동
  const aisleOffset = AISLE.SUB / 2
  const offsetZ = isFrontFace ? aisleOffset : -aisleOffset
  
  return new THREE.Vector3(worldPos.x, 0.1, worldPos.z + offsetZ)
}

function getEntrancePosition() {
  const originZ = -totalDepth/2
  const STAGING = 3.0
  
  return new THREE.Vector3(0, 0.1, originZ + STAGING/2)
}

function getWorkAreaPosition() {
  const workX = totalWidth/2 - WORK.size.w/2 - 1.0
  let workZ = totalDepth/2 - WORK.size.d/2 - 1.0
  const originZ = -totalDepth/2
  const STAGING = 3.0
  const rowPitch = BAY.D_SINGLE*2 + AISLE.SUB + MIN_R2R
  let zoneCursorZ = originZ + STAGING + AISLE.MAIN + DOCK_BUFFER + BAY.D_SINGLE + AISLE.PERIMETER + MIN_R2R/2
  const lastCenterZ = zoneCursorZ + (CENTER_GROUPS.length - 1) * (rowPitch + AISLE.ZONE)
  if (Math.abs(workZ - lastCenterZ) < WORK.bufferFromRacks) {
    workZ = lastCenterZ + WORK.bufferFromRacks
  }
  
  return new THREE.Vector3(workX, 0.1, workZ)
}

// location을 격자 좌표로 변환
function locationToGridCoord(locationStr) {
  if (!locationStr) return null
  
  // "문" 또는 "포장대" 처리
  if (locationStr === '문' || locationStr === 'door') {
    return { type: 'entrance', row: -1, col: -1 }
  }
  if (locationStr === '포장대' || locationStr === 'packing') {
    return { type: 'workarea', row: -1, col: -1 }
  }
  
  // location 파싱 (예: "A0-1" 또는 "A0")
  // "A0" 형식도 처리할 수 있도록 수정
  let parsed = locationStr.trim()
  if (!parsed.includes('-')) {
    // "A0" 형식이면 "A0-1"로 변환
    parsed = `${parsed}-1`
  }
  const m = parsed.match(/^([A-Z])(\d+)\s*-\s*(\d+)$/i)
  if (!m) return null
  
  const zone = m[1].toUpperCase()
  const block = parseInt(m[2], 10)
  
  // zone을 row로 변환 (A=0, B=1, C=2, D=3, E=4)
  const row = CENTER_GROUPS.findIndex(g => g.letter === zone)
  if (row === -1) return null
  
  // block을 col(segment)로 변환
  // 각 zone당 40개 블록 (0-39): 앞면 0-19, 뒷면 20-39
  // 각 세그먼트당 5개 블록
  // 앞면: 0-4 -> seg 0, 5-9 -> seg 1, 10-14 -> seg 2, 15-19 -> seg 3
  // 뒷면: 20-24 -> seg 0, 25-29 -> seg 1, 30-34 -> seg 2, 35-39 -> seg 3
  const frontBlock = block < 20 ? block : block - 20
  const col = Math.floor(frontBlock / 5)
  
  return { type: 'rack', row, col, block }
}

// 격자 좌표를 월드 좌표로 변환 (통로 위치)
function gridToWorldCoord(gridCoord) {
  if (!gridCoord) return null
  
  if (gridCoord.type === 'entrance') {
    return getEntrancePosition()
  }
  if (gridCoord.type === 'workarea') {
    return getWorkAreaPosition()
  }
  
  // 랙의 경우: location으로 실제 랙 위치를 찾아서 통로 위치 계산
  if (gridCoord.type === 'rack' && gridCoord.block !== undefined) {
    // zone과 block을 이용해 location 문자열 재구성
    const zone = CENTER_GROUPS[gridCoord.row]?.letter
    if (!zone) return null
    
    // 저장된 block 사용
    const block = gridCoord.block
    
    // 해당 위치의 실제 랙을 찾아서 통로 위치 계산
    const locationStr = `${zone}${block}-1` // level은 임의로 1
    
    return locationToAislePosition(locationStr)
  }
  
  return null
}

// 두 격자 좌표 사이의 맨해튼 경로 생성
function generateManhattanPath(fromGrid, toGrid) {
  const points = []
  
  // 시작점
  let fromWorld = gridToWorldCoord(fromGrid)
  if (!fromWorld) return []
  
  // 끝점
  let toWorld = gridToWorldCoord(toGrid)
  if (!toWorld) return []
  
  // 문이나 포장대의 경우 가장 가까운 격자선으로 연결
  if (fromGrid.type === 'entrance' || fromGrid.type === 'workarea') {
    fromWorld = connectToNearestGridLine(fromWorld, toGrid)
  }
  if (toGrid.type === 'entrance' || toGrid.type === 'workarea') {
    toWorld = connectToNearestGridLine(toWorld, fromGrid)
  }
  
  // 맨해튼 경로: X 방향 먼저, 그 다음 Z 방향
  points.push(fromWorld.clone())
  
  // X 방향으로 먼저 이동
  if (Math.abs(fromWorld.x - toWorld.x) > 0.1) {
    points.push(new THREE.Vector3(toWorld.x, 0.1, fromWorld.z))
  }
  
  // Z 방향으로 이동
  if (Math.abs(fromWorld.z - toWorld.z) > 0.1) {
    points.push(toWorld.clone())
  } else if (points.length === 1) {
    // 이미 같은 위치에 있으면 끝점만 추가
    points.push(toWorld.clone())
  }
  
  return points
}

// 문이나 포장대를 가장 가까운 격자선으로 연결
function connectToNearestGridLine(pos, targetGrid) {
  if (targetGrid.type === 'rack') {
    // 랙의 격자선 위치로 연결
    const rowPitch = BAY.D_SINGLE*2 + AISLE.SUB + MIN_R2R
    const segWidth = (SEGMENT.BAYS - 1) * BAY_PITCH + END_GAP*2
    const rowWidth = (segWidth + SEGMENT.GAP) * 4 - SEGMENT.GAP
    const originZ = -totalDepth/2
    const STAGING = 3.0
    const rowStartX = -rowWidth/2 + segWidth/2
    
    let zoneCursorZ = originZ + STAGING + AISLE.MAIN + DOCK_BUFFER + BAY.D_SINGLE + AISLE.PERIMETER + MIN_R2R/2
    
    // targetGrid의 Z 위치 계산
    let targetZ = zoneCursorZ
    for (let i = 0; i < targetGrid.row; i++) {
      targetZ += rowPitch + (i < CENTER_GROUPS.length - 1 ? AISLE.ZONE : 0)
    }
    
    // targetGrid의 X 위치 계산
    const targetX = rowStartX + targetGrid.col * (segWidth + SEGMENT.GAP)
    
    // X 또는 Z 방향 중 더 가까운 방향으로 연결
    if (Math.abs(pos.x - targetX) < Math.abs(pos.z - targetZ)) {
      // X 방향으로 먼저 연결
      return new THREE.Vector3(targetX, 0.1, pos.z)
    } else {
      // Z 방향으로 먼저 연결
      return new THREE.Vector3(pos.x, 0.1, targetZ)
    }
  }
  
  return pos
}

/**
 * fullPath를 사용하여 경로 그리기 (pathfinding.js에서 계산한 실제 경로)
 * fullPath는 [{row, col}, {row, col}, ...] 형식
 */
function drawPathFromFullPath(fullPath) {
  if (!fullPath || fullPath.length === 0) return
  
  console.log('[drawPathFromFullPath] 경로 그리기 시작, 점 개수:', fullPath.length)
  console.log('[drawPathFromFullPath] 처음 10개 점:', fullPath.slice(0, 10))
  
  // 기존 경로 제거
  if (pathGroup) {
    while (pathGroup.children.length) {
      const ch = pathGroup.children.pop()

      ch.geometry?.dispose?.()
      ch.material?.dispose?.()
    }
    rootGroup.remove(pathGroup)
  }
  
  pathGroup = new THREE.Group()
  pathGroup.name = 'NAVIGATION_PATH'
  rootGroup.add(pathGroup)
  
  // fullPath의 각 점을 월드 좌표로 변환
  const allPoints = []
  for (const point of fullPath) {
    if (!point || typeof point.row !== 'number' || typeof point.col !== 'number') {
      console.warn('[drawPathFromFullPath] 잘못된 점:', point)
      continue
    }
    
    // 그리드 좌표를 월드 좌표로 변환
    const worldPos = gridCoordToWorldCoord(point.row, point.col)
    if (worldPos) {
      allPoints.push(worldPos)
    }
  }
  
  if (allPoints.length < 2) {
    console.warn('[drawPathFromFullPath] 점이 부족합니다:', allPoints.length)
    
    return
  }
  
  console.log('[drawPathFromFullPath] 월드 좌표 변환 완료, 점 개수:', allPoints.length)
  
  // 경로를 바닥에서 약간 띄우기 (Y 좌표 조정)
  const pathHeight = 0.5 // 바닥에서 0.5m 위로

  allPoints.forEach(point => {
    point.y = pathHeight
  })
  
  // CatmullRomCurve3로 부드러운 곡선 생성
  const curve = new THREE.CatmullRomCurve3(allPoints, false, 'catmullrom', 0.0)
  const tube = new THREE.TubeGeometry(curve, Math.max(64, allPoints.length * 8), 0.15, 16, false)
  
  const mat = new THREE.MeshPhongMaterial({
    color: 0xff0000, // 빨간색
    emissive: 0x330000,
    transparent: true,
    opacity: 0.9,
  })
  
  const mesh = new THREE.Mesh(tube, mat)

  mesh.castShadow = true
  pathGroup.add(mesh)
  
  console.log('[drawPathFromFullPath] 경로 그리기 완료')
  
  // 경유지 순서 표시 (POI 마커)
  drawPOIMarkers()
}

/**
 * 경유지 순서를 표시하는 POI 마커 그리기
 */
function drawPOIMarkers() {
  // 기존 POI 마커 제거
  if (poiMarkersGroup) {
    while (poiMarkersGroup.children.length) {
      const ch = poiMarkersGroup.children.pop()
      
      ch.geometry?.dispose?.()
      ch.material?.dispose?.()
    }
    rootGroup.remove(poiMarkersGroup)
  }
  
  if (!props.optimizedRoute || props.optimizedRoute.length === 0) {
    return
  }
  
  poiMarkersGroup = new THREE.Group()
  poiMarkersGroup.name = 'POI_MARKERS'
  rootGroup.add(poiMarkersGroup)
  
  // 각 경유지에 순서 번호 표시
  props.optimizedRoute.forEach((step, index) => {
    const location = typeof step === 'string' ? step : step.location
    if (!location || location === '문' || location === '포장대') {
      // 문과 포장대는 스킵하거나 다른 방식으로 표시
      return
    }
    
    // location을 랙의 실제 월드 위치로 변환 (통로 위치가 아닌 랙 위치)
    const rackPos = findRackPosition(location, false) // useAislePosition = false: 랙의 실제 위치
    if (!rackPos) {
      console.warn(`[drawPOIMarkers] 랙 위치를 찾을 수 없음: ${location}`)
      
      return
    }
    
    // POI 마커 생성 (원형 배경 + 번호)
    const marker = createPOIMarker(index + 1, location)
    
    marker.position.set(rackPos.x, 7.5, rackPos.z) // 랙 위에 표시
    marker.userData.baseScale = 1.0 // 기본 스케일 저장
    poiMarkersGroup.add(marker)
  })
  
  console.log(`[drawPOIMarkers] POI 마커 ${props.optimizedRoute.length}개 생성 완료`)
}

/**
 * POI 마커 생성 (순서 번호와 위치 표시)
 */
function createPOIMarker(orderNumber, location) {
  const group = new THREE.Group()
  
  // Primary 색상 (프로젝트 primary: #1E40AF) - 더 진한 색상 사용
  const primaryColor = 0x1E40AF
  const primaryColorHex = '#1E40AF'
  const darkerPrimaryHex = '#031959' // 더 진한 primary 색상
  
  // 배경 원판 - 크기 증가 (축소해도 잘 보이도록)
  const circleRadius = 1.5 // 0.8에서 1.5로 증가
  const circleGeometry = new THREE.CircleGeometry(circleRadius, 32)
  
  const circleMaterial = new THREE.MeshBasicMaterial({
    color: primaryColor,
    transparent: true,
    opacity: 1.0, // 0.9에서 1.0으로 증가 (더 진하게)
    side: THREE.DoubleSide,
  })
  
  const circle = new THREE.Mesh(circleGeometry, circleMaterial)
  
  circle.rotation.x = -Math.PI / 2
  circle.position.y = 0
  group.add(circle)
  
  // 번호 텍스트 - 해상도와 크기 증가
  const canvas = document.createElement('canvas')
  
  canvas.width = 512 // 256에서 512로 증가
  canvas.height = 512
  
  const ctx = canvas.getContext('2d')
  
  // 배경 (더 진한 색상)
  ctx.fillStyle = darkerPrimaryHex
  ctx.beginPath()
  ctx.arc(256, 256, 240, 0, Math.PI * 2) // 반지름도 증가
  ctx.fill()
  
  // 테두리 (더 두껍게, 더 진한 색상)
  ctx.strokeStyle = '#0F1F5F' // 더 진한 테두리
  ctx.lineWidth = 20 // 16에서 20으로 증가
  ctx.stroke()
  
  // 흰색 내부 테두리 (대비 강화)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 8
  ctx.stroke()
  
  // 번호 텍스트 (더 크게)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 200px Arial' // 120px에서 200px로 증가
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(orderNumber.toString(), 256, 230) // 위치 조정
  
  // 위치 텍스트 (더 크게)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 60px Arial' // 40px에서 60px로 증가
  ctx.fillText(location, 256, 350) // 위치 조정
  
  const texture = new THREE.CanvasTexture(canvas)
  
  texture.needsUpdate = true
  
  const textMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
  })
  
  const textMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 3.0), // 1.6에서 3.0으로 증가
    textMaterial,
  )
  
  textMesh.rotation.x = -Math.PI / 2
  textMesh.position.y = 0.01
  group.add(textMesh)
  
  // 원기둥 기둥 (랙 위에 세우기) - 더 두껍게
  const poleGeometry = new THREE.CylinderGeometry(0.08, 0.08, 3.0, 16) // 반지름과 높이 증가
  
  const poleMaterial = new THREE.MeshBasicMaterial({
    color: primaryColor,
    transparent: true,
    opacity: 0.8,
  })
  
  const pole = new THREE.Mesh(poleGeometry, poleMaterial)
  
  pole.position.y = -1.5 // 높이 조정
  group.add(pole)
  
  return group
}

/**
 * 그리드 좌표를 월드 좌표로 변환
 * @param {number} row - 그리드 행 (0부터 시작)
 * @param {number} col - 그리드 열 (0부터 시작)
 * @returns {THREE.Vector3|null} 월드 좌표
 */
function gridCoordToWorldCoord(row, col) {
  // 그리드 크기 (pathfinding.js의 GRID_ROWS, GRID_COLS와 동일)
  const GRID_ROWS = props.gridRows || 38
  const GRID_COLS = props.gridCols || 25
  
  // 전체 창고 크기
  const gridWidth = totalWidth
  const gridDepth = totalDepth
  
  // 셀 크기
  const cellWidth = gridWidth / GRID_COLS
  const cellDepth = gridDepth / GRID_ROWS
  
  // 그리드 시작 위치 (중앙 기준)
  const startX = -gridWidth / 2
  const startZ = -gridDepth / 2
  
  // 셀 중앙 좌표
  const x = startX + col * cellWidth + cellWidth / 2
  const z = startZ + row * cellDepth + cellDepth / 2
  
  return new THREE.Vector3(x, 0, z)
}

function drawPathFromRoute(routeSteps) {
  if (!routeSteps || routeSteps.length === 0) return
  
  // 기존 경로 제거
  if (pathGroup) {
    while (pathGroup.children.length) {
      const ch = pathGroup.children.pop()

      ch.geometry?.dispose?.()
      ch.material?.dispose?.()
    }
    rootGroup.remove(pathGroup)
  }
  
  pathGroup = new THREE.Group()
  pathGroup.name = 'NAVIGATION_PATH'
  rootGroup.add(pathGroup)
  
  // 모든 경로 점들 생성 (맨해튼 경로)
  const allPoints = []
  
  for (let i = 0; i < routeSteps.length; i++) {
    const step = routeSteps[i]
    const location = typeof step === 'string' ? step : step.location
    if (!location) continue
    
    const currentGrid = locationToGridCoord(location)
    if (!currentGrid) continue
    
    // 마지막 점이 아니면 다음 점으로의 경로 생성
    if (i < routeSteps.length - 1) {
      const nextStep = routeSteps[i + 1]
      const nextLocation = typeof nextStep === 'string' ? nextStep : nextStep.location
      if (nextLocation) {
        const nextGrid = locationToGridCoord(nextLocation)
        if (nextGrid) {
          const segmentPoints = generateManhattanPath(currentGrid, nextGrid)

          // 첫 번째 점은 제외 (이전 경로의 마지막 점과 중복)
          if (allPoints.length > 0 && segmentPoints.length > 0) {
            segmentPoints.shift()
          }
          allPoints.push(...segmentPoints)
        }
      }
    } else {
      // 마지막 점은 직접 추가
      const worldPos = gridToWorldCoord(currentGrid)
      if (worldPos) {
        if (allPoints.length === 0 || !worldPos.equals(allPoints[allPoints.length - 1])) {
          allPoints.push(worldPos)
        }
      }
    }
  }
  
  if (allPoints.length < 2) return
  
  // 경로를 바닥에서 약간 띄우기 (Y 좌표 조정)
  const pathHeight = 0.5 // 바닥에서 0.5m 위로

  allPoints.forEach(point => {
    point.y = pathHeight
  })
  
  // CatmullRomCurve3로 부드러운 곡선 생성
  const curve = new THREE.CatmullRomCurve3(allPoints, false, 'catmullrom', 0.0)
  const tube = new THREE.TubeGeometry(curve, Math.max(64, allPoints.length * 8), 0.15, 16, false)
  
  const mat = new THREE.MeshPhongMaterial({
    color: 0xff0000, // 빨간색
    emissive: 0x330000,
    transparent: true,
    opacity: 0.9,
  })
  
  const mesh = new THREE.Mesh(tube, mat)

  mesh.castShadow = true
  pathGroup.add(mesh)
}

function clearPath() {
  if (pathGroup) {
    while (pathGroup.children.length) {
      const ch = pathGroup.children.pop()

      ch.geometry?.dispose?.()
      ch.material?.dispose?.()
    }
    rootGroup.remove(pathGroup)
    pathGroup = null
  }
  
  // POI 마커도 제거
  if (poiMarkersGroup) {
    while (poiMarkersGroup.children.length) {
      const ch = poiMarkersGroup.children.pop()

      ch.geometry?.dispose?.()
      ch.material?.dispose?.()
    }
    rootGroup.remove(poiMarkersGroup)
    poiMarkersGroup = null
  }
}

/**
 * 경로 애니메이션 함수들
 */
function startPathAnimation() {
  if (!props.fullPath || props.fullPath.length === 0) {
    console.warn('[startPathAnimation] 경로가 없습니다')
    
    return
  }
  
  if (isAnimating) {
    console.log('[startPathAnimation] 이미 애니메이션이 실행 중입니다')
    
    return
  }
  
  isAnimating = true
  animationProgress = 0
  
  // 애니메이션 루프
  function animate() {
    if (!isAnimating || !props.fullPath || props.fullPath.length === 0) {
      isAnimating = false
      
      return
    }
    
    // 경로를 따라 카메라 이동
    const totalPoints = props.fullPath.length
    const currentIndex = Math.floor(animationProgress * (totalPoints - 1))
    const nextIndex = Math.min(currentIndex + 1, totalPoints - 1)
    const t = (animationProgress * (totalPoints - 1)) % 1
    
    const currentPoint = props.fullPath[currentIndex]
    const nextPoint = props.fullPath[nextIndex]
    
    if (currentPoint && nextPoint) {
      const currentWorld = gridCoordToWorldCoord(currentPoint.row, currentPoint.col)
      const nextWorld = gridCoordToWorldCoord(nextPoint.row, nextPoint.col)
      
      if (currentWorld && nextWorld) {
        // 경로를 따라 부드럽게 이동
        const x = currentWorld.x + (nextWorld.x - currentWorld.x) * t
        const z = currentWorld.z + (nextWorld.z - currentWorld.z) * t
        const y = 15 // 카메라 높이
        
        // 카메라 위치 업데이트
        if (camera && controls) {
          camera.position.lerp(new THREE.Vector3(x, y, z), 0.1)
          controls.target.lerp(new THREE.Vector3(x, 0, z), 0.1)
        }
      }
    }
    
    animationProgress += animationSpeed
    if (animationProgress >= 1) {
      // 애니메이션 완료 - 반복하지 않음
      isAnimating = false
      animationProgress = 1
      console.log('[startPathAnimation] 경로 애니메이션 완료')
      
      return
    }
    
    animationFrameId = requestAnimationFrame(animate)
  }
  
  animate()
  console.log('[startPathAnimation] 경로 애니메이션 시작')
}

function stopPathAnimation() {
  isAnimating = false
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  console.log('[stopPathAnimation] 경로 애니메이션 중지')
}

function resetPathAnimation() {
  stopPathAnimation()
  animationProgress = 0
  console.log('[resetPathAnimation] 경로 애니메이션 리셋')
}

/**
 * 경유지별 단계 애니메이션 (각 경유지에서 멈춤)
 * 시작점(문)부터 끝점(포장대)까지 모든 경유지 포함
 * 자동으로 넘어가지 않고, nextStep()을 호출해야 다음으로 이동
 */
function startStepAnimation() {
  if (!props.optimizedRoute || props.optimizedRoute.length === 0) {
    console.warn('[startStepAnimation] 경유지가 없습니다')
    
    return
  }
  
  if (isStepAnimationActive) {
    console.log('[startStepAnimation] 이미 경유지별 애니메이션이 활성화되어 있습니다')
    
    return
  }
  
  isStepAnimationActive = true
  
  // 문이나 포장대가 아닌 첫 번째 실제 위치 찾기
  let firstRealIndex = -1
  for (let i = 0; i < props.optimizedRoute.length; i++) {
    const step = props.optimizedRoute[i]
    const location = typeof step === 'string' ? step : step.location
    if (location && location !== '문' && location !== 'door' && location !== '포장대' && location !== 'workarea') {
      firstRealIndex = i
      break
    }
  }
  
  if (firstRealIndex === -1) {
    console.warn('[startStepAnimation] 실제 경유지를 찾을 수 없습니다')
    currentStepIndex = -1
    nextStep() // 첫 번째로 이동 시도
  } else {
    currentStepIndex = firstRealIndex - 1 // nextStep() 호출 시 firstRealIndex로 이동
    nextStep()
  }
  
  console.log('[startStepAnimation] 경유지별 애니메이션 시작, 총 경로:', props.optimizedRoute.length, ', 첫 번째 실제 위치 인덱스:', firstRealIndex)
}

/**
 * 다음 경유지로 이동
 */
function nextStep() {
  if (!isStepAnimationActive || !props.optimizedRoute || props.optimizedRoute.length === 0) {
    return
  }
  
  currentStepIndex++
  
  if (currentStepIndex >= props.optimizedRoute.length) {
    console.log('[nextStep] 모든 경유지 방문 완료')
    isStepAnimationActive = false
    currentStepIndex = -1
    
    return
  }
  
  const step = props.optimizedRoute[currentStepIndex]
  if (!step) {
    nextStep() // 다음으로 건너뛰기
    
    return
  }
  
  const location = typeof step === 'string' ? step : step.location
  let targetPos = null
  let targetLook = null
  
  // 시작점(문)과 끝점(포장대) 처리
  if (location === '문' || location === 'door') {
    // 문 위치로 이동
    const entrancePos = getEntrancePosition()
    if (entrancePos && camera && controls) {
      targetPos = new THREE.Vector3(entrancePos.x, 15, entrancePos.z - 5)
      targetLook = new THREE.Vector3(entrancePos.x, 0, entrancePos.z)
    }
  } else if (location === '포장대' || location === 'workarea') {
    // 포장대 위치로 이동
    const workPos = getWorkAreaPosition()
    if (workPos && camera && controls) {
      targetPos = new THREE.Vector3(workPos.x, 15, workPos.z + 5)
      targetLook = new THREE.Vector3(workPos.x, 0, workPos.z)
    }
  } else {
    // 일반 경유지 위치로 카메라 이동
    const rackPos = findRackPosition(location, true) // 통로 위치
    if (rackPos && camera && controls) {
      targetPos = new THREE.Vector3(rackPos.x, 15, rackPos.z + 10)
      targetLook = new THREE.Vector3(rackPos.x, 0, rackPos.z)
    }
  }
  
  if (targetPos && targetLook && camera && controls) {
    isAnimating = true

    // 부드럽게 이동
    let t = 0
    const startPos = camera.position.clone()
    const startTarget = controls.target.clone()
    
    function move() {
      if (!isStepAnimationActive) {
        isAnimating = false
        
        return
      }
      
      t += 0.03 // 이동 속도 조절
      if (t >= 1) {
        t = 1
        isAnimating = false

        // 이동 완료 - 자동으로 다음으로 넘어가지 않음, 사용자가 버튼을 눌러야 함
        console.log(`[nextStep] 경유지 ${currentStepIndex + 1}/${props.optimizedRoute.length} 도달: ${location}`)
        
        return
      }
      
      camera.position.lerpVectors(startPos, targetPos, t)
      controls.target.lerpVectors(startTarget, targetLook, t)
      
      requestAnimationFrame(move)
    }
    
    move()
  } else {
    // 위치를 찾지 못했으면 다음으로
    console.warn(`[nextStep] 위치를 찾을 수 없음: ${location}`)
    nextStep()
  }
}

/**
 * 이전 경유지로 이동
 */
function previousStep() {
  if (!isStepAnimationActive || !props.optimizedRoute || props.optimizedRoute.length === 0) {
    return
  }
  
  if (currentStepIndex <= 0) {
    console.log('[previousStep] 첫 번째 경유지입니다')
    
    return
  }
  
  currentStepIndex--

  const step = props.optimizedRoute[currentStepIndex]
  if (!step) {
    previousStep() // 이전으로 건너뛰기
    
    return
  }
  
  const location = typeof step === 'string' ? step : step.location
  let targetPos = null
  let targetLook = null
  
  // 시작점(문)과 끝점(포장대) 처리
  if (location === '문' || location === 'door') {
    const entrancePos = getEntrancePosition()
    if (entrancePos && camera && controls) {
      targetPos = new THREE.Vector3(entrancePos.x, 15, entrancePos.z - 5)
      targetLook = new THREE.Vector3(entrancePos.x, 0, entrancePos.z)
    }
  } else if (location === '포장대' || location === 'workarea') {
    const workPos = getWorkAreaPosition()
    if (workPos && camera && controls) {
      targetPos = new THREE.Vector3(workPos.x, 15, workPos.z + 5)
      targetLook = new THREE.Vector3(workPos.x, 0, workPos.z)
    }
  } else {
    const rackPos = findRackPosition(location, true)
    if (rackPos && camera && controls) {
      targetPos = new THREE.Vector3(rackPos.x, 15, rackPos.z + 10)
      targetLook = new THREE.Vector3(rackPos.x, 0, rackPos.z)
    }
  }
  
  if (targetPos && targetLook && camera && controls) {
    isAnimating = true
    let t = 0
    const startPos = camera.position.clone()
    const startTarget = controls.target.clone()
    
    function move() {
      if (!isStepAnimationActive) {
        isAnimating = false
        
        return
      }
      
      t += 0.03
      if (t >= 1) {
        t = 1
        isAnimating = false
        console.log(`[previousStep] 경유지 ${currentStepIndex + 1}/${props.optimizedRoute.length} 도달: ${location}`)
        
        return
      }
      
      camera.position.lerpVectors(startPos, targetPos, t)
      controls.target.lerpVectors(startTarget, targetLook, t)
      
      requestAnimationFrame(move)
    }
    
    move()
  }
}

/**
 * 경유지별 애니메이션 중지
 */
function stopStepAnimation() {
  isStepAnimationActive = false
  isAnimating = false
  currentStepIndex = -1
  console.log('[stopStepAnimation] 경유지별 애니메이션 중지')
}

/**
 * 카메라를 초기 위치로 리셋
 */
function resetCamera() {
  if (!camera || !controls || !initialCameraPosition || !initialCameraTarget) {
    console.warn('[resetCamera] 카메라 또는 초기 위치가 없습니다')
    
    return
  }
  
  // 부드럽게 초기 위치로 이동
  const startPos = camera.position.clone()
  const startTarget = controls.target.clone()
  
  let t = 0

  const step = () => {
    t += 0.05

    const k = Math.min(1, t)
    
    camera.position.lerpVectors(startPos, initialCameraPosition, k)
    controls.target.lerpVectors(startTarget, initialCameraTarget, k)
    
    if (k < 1) {
      requestAnimationFrame(step)
    } else {
      controls.update()
      console.log('[resetCamera] 카메라 리셋 완료')
    }
  }
  
  step()
}

/**
 * 현재 위치 마커 표시/숨김
 */
function showCurrentPosition(show) {
  if (!rootGroup) return
  
  if (show) {
    // 기존 마커 제거
    if (currentPositionMarker) {
      rootGroup.remove(currentPositionMarker)
      currentPositionMarker = null
    }
    
    // 시작 위치에 현재 위치 마커 생성
    if (!props.fullPath || props.fullPath.length === 0) {
      console.warn('[showCurrentPosition] 경로가 없습니다')
      return
    }
    
    // fullPath의 첫 번째 위치 사용 (문일 수도 있지만 네비게이션 시작점)
    const startPoint = props.fullPath[0]
    if (!startPoint) return
    
    const worldPos = gridCoordToWorldCoord(startPoint.row, startPoint.col)
    if (!worldPos) return
    
    // 현재 위치 마커 생성 (빨간색 원 또는 화살표)
    const marker = createCurrentPositionMarker()
    marker.position.set(worldPos.x, 0.5, worldPos.z)
    rootGroup.add(marker)
    currentPositionMarker = marker
    currentPathPosition = 0
    
    console.log('[showCurrentPosition] 현재 위치 마커 표시:', worldPos)
  } else {
    // 마커 제거
    if (currentPositionMarker) {
      rootGroup.remove(currentPositionMarker)
      currentPositionMarker = null
    }
    currentPathPosition = 0
  }
}

/**
 * 현재 위치 마커 생성
 */
function createCurrentPositionMarker() {
  const group = new THREE.Group()
  
  // 빨간색 원형 마커 (현재 위치 표시)
  const circleGeometry = new THREE.CircleGeometry(0.6, 32)
  const circleMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  })
  const circle = new THREE.Mesh(circleGeometry, circleMaterial)
  circle.rotation.x = -Math.PI / 2
  group.add(circle)
  
  // 중심점 (작은 구)
  const sphereGeometry = new THREE.SphereGeometry(0.15, 16, 16)
  const sphereMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
  })
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
  sphere.position.y = 0.01
  group.add(sphere)
  
  // 상단 화살표 (방향 표시용)
  const arrowGeometry = new THREE.ConeGeometry(0.2, 0.8, 8)
  const arrowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
  })
  const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial)
  arrow.position.y = 0.5
  group.add(arrow)
  
  return group
}

/**
 * 스탭에 따라 경로를 따라 이동
 * @param {number} steps - 현재 스탭 수
 * @param {boolean} stepChanged - 스탭이 변경되었는지 여부
 */
function moveAlongPathBySteps(steps, stepChanged = true) {
  if (!props.fullPath || props.fullPath.length === 0 || !currentPositionMarker) {
    return
  }
  
  // 스탭당 이동할 거리 (예: 1스탭 = 0.7m)
  const stepDistance = 0.7 // 미터
  
  // 경로를 따라 이동할 총 거리 계산
  let totalDistance = 0
  let targetIndex = 0
  let targetPos = null
  let nextWorldPos = null
  
  // 경로의 시작부터 스탭만큼 이동한 위치 찾기
  for (let i = 0; i < props.fullPath.length - 1; i++) {
    const currentPoint = props.fullPath[i]
    const nextPoint = props.fullPath[i + 1]
    
    const currentWorld = gridCoordToWorldCoord(currentPoint.row, currentPoint.col)
    const nextWorld = gridCoordToWorldCoord(nextPoint.row, nextPoint.col)
    
    if (!currentWorld || !nextWorld) continue
    
    const segmentDistance = currentWorld.distanceTo(nextWorld)
    const remainingSteps = steps * stepDistance - totalDistance
    
    if (totalDistance + segmentDistance >= steps * stepDistance) {
      // 이 세그먼트 내에서 목표 위치 계산
      const t = remainingSteps / segmentDistance
      targetPos = new THREE.Vector3()
      targetPos.lerpVectors(currentWorld, nextWorld, t)
      targetPos.y = 0.5
      targetIndex = i
      
      // 다음 위치도 저장 (방향 계산용)
      nextWorldPos = nextWorld.clone()
      nextWorldPos.y = 0.5
      break
    }
    
    totalDistance += segmentDistance
    targetIndex = i + 1
  }
  
  // 경로 끝에 도달했으면 마지막 위치로
  if (!targetPos || targetIndex >= props.fullPath.length - 1) {
    const lastPoint = props.fullPath[props.fullPath.length - 1]
    const lastWorld = gridCoordToWorldCoord(lastPoint.row, lastPoint.col)
    if (lastWorld) {
      targetPos = lastWorld.clone()
      targetPos.y = 0.5
      currentPositionMarker.position.copy(targetPos)
      currentPathPosition = props.fullPath.length - 1
      return
    }
  }
  
  if (targetPos) {
    // 마커 위치 업데이트
    currentPositionMarker.position.copy(targetPos)
    currentPathPosition = targetIndex
    
    // 화살표 방향 업데이트 (다음 위치를 향하도록)
    if (nextWorldPos && currentPositionMarker.children.length > 2) {
      const arrow = currentPositionMarker.children[2] // 화살표는 세 번째 자식
      const direction = new THREE.Vector3()
      direction.subVectors(nextWorldPos, targetPos).normalize()
      
      // Y축 회전 계산 (XZ 평면에서의 각도)
      const angle = Math.atan2(direction.x, direction.z)
      arrow.rotation.y = angle
    }
    
    // 네비게이션 모드일 때 스탭이 변경되면 카메라 위치 자연스럽게 이동
    if (isNavigationMode && camera && controls && stepChanged) {
      // 이동 방향이 화면 위쪽을 향하도록 카메라 위치 조정
      const direction = new THREE.Vector3()
      if (nextWorldPos) {
        direction.subVectors(nextWorldPos, targetPos).normalize()
      } else {
        // 다음 위치가 없으면 현재 방향 유지
        return
      }
      
      const cameraHeight = 40 // 카메라 높이 증가 (35 -> 40)
      const cameraOffset = direction.clone().multiplyScalar(-15) // 이동 방향 반대로 15m 뒤로 (더 멀리)
      const desiredCameraPos = targetPos.clone().add(cameraOffset)
      desiredCameraPos.y = cameraHeight
      
      // 카메라 위치를 부드럽게 이동 (더 큰 lerp factor로 한번에 확 움직이되 자연스럽게)
      camera.position.lerp(desiredCameraPos, 0.6)
      
      // 타겟은 항상 현재 위치 (정중앙) - 더 빠르게 따라가도록
      controls.target.lerp(targetPos, 0.6)
      controls.update()
    }
  }
}

let lastFixedStep = -1 // 마지막으로 위치 고정한 스텝

/**
 * 네비게이션 모드에서 카메라를 위치를 따라가도록 설정
 * 위에서 90도로 내려보면서 이동 방향이 화면 위쪽을 향하도록 회전
 */
function followCameraToPosition(position, nextPosition, forceFix = false) {
  if (!camera || !controls) return
  
  // 이동 방향 계산 (현재 위치에서 다음 위치로)
  const direction = new THREE.Vector3()
  direction.subVectors(nextPosition, position).normalize()
  
  // 위에서 내려보는 높이 (90도 top-down view) - 더 멀리 조정
  const cameraHeight = 40 // 카메라 높이 (35 -> 40으로 증가)
  
  // 이동 방향이 화면 위쪽(음의 Z 방향)을 향하도록 카메라 위치 계산
  // 이동 방향의 반대 방향으로 카메라를 배치하여 이동 방향이 위로 오도록
  const cameraOffset = direction.clone().multiplyScalar(-15) // 이동 방향 반대로 15m 뒤로 (더 멀리)
  const cameraPosition = position.clone().add(cameraOffset)
  cameraPosition.y = cameraHeight
  
  // 카메라 타겟: 현재 위치 (정중앙에 위치)
  const cameraTarget = position.clone()
  
  // 강제 고정이거나 스탭이 변경되었을 때만 위치 고정
  const lerpFactor = forceFix ? 0.5 : 0.15 // 강제 고정 시 더 빠르게, 평소에는 부드럽게
  
  // 카메라 위치 업데이트
  camera.position.lerp(cameraPosition, lerpFactor)
  
  // OrbitControls 타겟 업데이트 (항상 정중앙에 위치)
  controls.target.lerp(cameraTarget, lerpFactor)
  
  // 카메라가 이동 방향을 향하도록 회전 (위에서 내려보는 각도 유지)
  controls.update()
}

/**
 * 네비게이션 모드 시작
 */
function startNavigationMode() {
  isNavigationMode = true
  lastFixedStep = -1
  
  if (currentPositionMarker) {
    const pos = currentPositionMarker.position.clone()
    let nextPos = pos.clone()
    
    // 다음 위치 찾기 (fullPath에서)
    if (props.fullPath && props.fullPath.length > 1) {
      // 첫 번째 실제 위치 찾기 (문이 아닌)
      for (let i = 1; i < props.fullPath.length; i++) {
        const nextPoint = props.fullPath[i]
        const nextWorld = gridCoordToWorldCoord(nextPoint.row, nextPoint.col)
        if (nextWorld) {
          nextPos.copy(nextWorld)
          nextPos.y = 0.5
          break
        }
      }
    }
    
    // 즉시 카메라를 시작 위치로 이동 (정중앙에, 이동 방향이 위로 오도록)
    followCameraToPositionImmediate(pos, nextPos)
  }
  // OrbitControls 활성화 유지 (사용자가 수동 조작 가능)
  if (controls) {
    controls.enabled = true
  }
}

/**
 * 즉시 카메라를 위치로 이동 (정중앙에, 이동 방향이 위로 오도록)
 */
function followCameraToPositionImmediate(position, nextPosition) {
  if (!camera || !controls) return
  
  // 이동 방향 계산
  const direction = new THREE.Vector3()
  direction.subVectors(nextPosition, position).normalize()
  
  // 위에서 내려보는 높이 (90도 top-down view) - 더 멀리 조정
  const cameraHeight = 40 // 카메라 높이 (35 -> 40으로 증가)
  
  // 이동 방향의 반대 방향으로 카메라를 배치하여 이동 방향이 위로 오도록
  const cameraOffset = direction.clone().multiplyScalar(-15) // 이동 방향 반대로 15m 뒤로 (더 멀리)
  const cameraPosition = position.clone().add(cameraOffset)
  cameraPosition.y = cameraHeight
  
  // 카메라 타겟: 현재 위치 (정중앙)
  const cameraTarget = position.clone()
  
  // 즉시 이동
  camera.position.copy(cameraPosition)
  controls.target.copy(cameraTarget)
  controls.update()
}

/**
 * 네비게이션 모드 종료
 */
function stopNavigationMode() {
  isNavigationMode = false
  // OrbitControls 다시 활성화
  if (controls) {
    controls.enabled = true
  }
}

/**
 * 경로가 완료되었는지 확인
 */
function isPathComplete() {
  if (!props.fullPath || props.fullPath.length === 0) return true
  return currentPathPosition >= props.fullPath.length - 1
}

// 메서드를 expose
defineExpose({
  highlightRacks,
  clearPath,
  startPathAnimation,
  stopPathAnimation,
  resetPathAnimation,
  startStepAnimation,
  nextStep,
  previousStep,
  stopStepAnimation,
  resetCamera,
  showCurrentPosition,
  moveAlongPathBySteps,
  isPathComplete,
  startNavigationMode,
  stopNavigationMode,
  getCurrentStepIndex: () => currentStepIndex,
  getIsStepAnimationActive: () => isStepAnimationActive,
})

watch(() => props.location, v => updateHighlight(v))
watch(() => props.highlightLocations, newLocations => {
  highlightRacks(newLocations || [])
}, { deep: true })
watch(() => props.fullPath, newPath => {
  if (newPath && newPath.length > 0) {
    console.log('[watch fullPath] fullPath 변경됨, 점 개수:', newPath.length)
    drawPathFromFullPath(newPath)

    // POI 마커도 다시 그리기
    if (props.optimizedRoute && props.optimizedRoute.length > 0) {
      drawPOIMarkers()
    }
  } else if (props.optimizedRoute && props.optimizedRoute.length > 0) {
    drawPathFromRoute(props.optimizedRoute)
    drawPOIMarkers()
  } else {
    clearPath()
  }
}, { deep: true })

watch(() => props.optimizedRoute, newRoute => {
  // POI 마커 다시 그리기
  if (newRoute && newRoute.length > 0) {
    drawPOIMarkers()
  } else {
    // POI 마커 제거
    if (poiMarkersGroup) {
      while (poiMarkersGroup.children.length) {
        const ch = poiMarkersGroup.children.pop()

        ch.geometry?.dispose?.()
        ch.material?.dispose?.()
      }
      rootGroup.remove(poiMarkersGroup)
      poiMarkersGroup = null
    }
  }
  
  // fullPath가 없을 때만 optimizedRoute 사용
  if (!props.fullPath || props.fullPath.length === 0) {
    if (newRoute && newRoute.length > 0) {
      drawPathFromRoute(newRoute)
      drawPOIMarkers()
    } else {
      clearPath()
    }
  }
}, { deep: true })
watch(() => props.showGrid, show => {
  console.log('[watch showGrid] 변경됨:', show, 'pathfindingGrid:', props.pathfindingGrid)
  if (show) {
    if (props.pathfindingGrid && Array.isArray(props.pathfindingGrid) && props.pathfindingGrid.length > 0) {
      console.log('[watch showGrid] pathfindingGrid로 그리기')
      drawPathfindingGrid()
    } else {
      console.log('[watch showGrid] 일반 그리드로 그리기')
      drawFloorGrid()
    }
  } else {
    drawGridOverlay()
  }
})

watch(() => props.pathfindingGrid, newGrid => {
  console.log('[watch pathfindingGrid] 변경됨:', newGrid)
  if (props.showGrid && newGrid && Array.isArray(newGrid) && newGrid.length > 0) {
    console.log('[watch pathfindingGrid] 그리드 그리기 시작')
    drawPathfindingGrid()
  }
}, { deep: true, immediate: false })
</script>

<template>
  <div
    ref="mountRef"
    style="width: 100%; height: 80vh; border-radius: 8px; overflow: hidden;"
  />
</template>
