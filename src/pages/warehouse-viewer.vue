<!-- File: src/pages/WarehouseViewer.vue -->
<template>
  <div class="warehouse-viewer">
    <!-- 로딩 / 에러 -->
    <div
      v-if="loading"
      class="loading-overlay"
    >
      <div class="loading-spinner">
        <div class="spinner" /><p>창고 모델을 로딩 중...</p>
      </div>
    </div>
    <div
      v-if="error"
      class="error-overlay"
    >
      <div class="error-message">
        <h3>오류 발생</h3><p>{{ error }}</p>
        <button
          class="retry-btn"
          @click="initScene"
        >
          다시 시도
        </button>
      </div>
    </div>

    <!-- 3D -->
    <canvas
      ref="canvasRef"
      class="warehouse-canvas"
    />

    <!-- 사이드 패널 -->
    <aside
      class="side-panel"
      :class="{ open: !!selectedRack }"
    >
      <header class="panel-header">
        <h3 v-if="selectedRack">
          {{ selectedRack.section }}{{ selectedRack.block !== undefined ? selectedRack.block : (selectedRack.bay ? (selectedRack.bay - 1) : '') }}
        </h3>
        <h3 v-else>
          랙 정보를 클릭하세요
        </h3>
        <button
          v-if="selectedRack"
          class="panel-close"
          @click="clearSelection"
        >
          ×
        </button>
      </header>
      <div
        v-if="selectedRack"
        class="panel-body"
      >
        <div class="kpi">
          <div><span class="k">위치</span><span class="v">{{ selectedRack.section }}{{ selectedRack.block !== undefined ? selectedRack.block : (selectedRack.bay - 1) }}</span></div>
          <div><span class="k">레벨</span><span class="v">{{ selectedRack.levels }}</span></div>
          <div><span class="k">적치깊이</span><span class="v">{{ selectedRack.depthType }}</span></div>
          <div><span class="k">좌표</span><span class="v">{{ selectedRack.position.x.toFixed(1) }}, {{ selectedRack.position.z.toFixed(1) }}</span></div>
        </div>
        <div class="list">
          <h4>구역 {{ selectedRack.section }}{{ selectedRack.block !== undefined ? selectedRack.block : (selectedRack.bay - 1) }} 부품 목록</h4>
          <div
            v-if="loadingParts"
            class="loading-parts"
          >
            부품 목록을 불러오는 중...
          </div>
          <div
            v-else-if="locationParts.length > 0"
            class="parts-list"
          >
            <div
              v-for="(locationData, idx) in locationParts"
              :key="idx"
              class="floor-group"
            >
              <div
                class="floor-header"
                @click="toggleFloor(idx)"
              >
                <VIcon
                  icon="bx-layer"
                  size="18"
                  class="floor-icon"
                />
                <h5 class="floor-title">
                  {{ locationData.floor }}층
                </h5>
                <VChip
                  size="small"
                  color="primary"
                  variant="tonal"
                  class="floor-count"
                >
                  {{ locationData.parts?.length || 0 }}개
                </VChip>
                <VIcon
                  :icon="locationData.collapsed ? 'bx-chevron-right' : 'bx-chevron-down'"
                  size="20"
                  class="floor-chevron"
                />
              </div>
              <VExpandTransition>
                <div
                  v-show="!locationData.collapsed"
                  class="parts-grid"
                >
                <div
                  v-for="part in locationData.parts"
                  :key="part.id"
                  class="part-card"
                  @click="goToPartDetail(part.id)"
                >
                  <div class="part-image-wrapper">
                    <img
                      v-if="part.image"
                      :src="part.image"
                      :alt="part.korName || part.name"
                      class="part-image"
                      @error="handleImageError"
                    >
                    <div
                      v-else
                      class="part-image-placeholder"
                    >
                      <VIcon
                        icon="bx-package"
                        size="24"
                      />
                    </div>
                  </div>
                  <div class="part-content">
                    <div class="part-name">
                      {{ part.korName || part.name }}
                    </div>
                    <div class="part-meta">
                      <div class="part-meta-row">
                        <VIcon
                          icon="bx-map"
                          size="14"
                          class="meta-icon"
                        />
                        <span class="part-location">{{ part.location }}</span>
                      </div>
                      <div class="part-meta-row">
                        <VIcon
                          icon="bx-box"
                          size="14"
                          class="meta-icon"
                        />
                        <span class="part-amount">재고: {{ part.amount || 0 }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              </VExpandTransition>
            </div>
          </div>
          <div
            v-else
            class="no-parts"
          >
            해당 구역에 등록된 부품이 없습니다.
          </div>
        </div>    
      </div>
    </aside>

      <!-- 우상단 컨트롤 -->
      <div class="control-panel">
        <div class="control-section">
        <h4>조작</h4>
        <div class="control-info">
          <p><strong>모드 전환</strong> F ({{ isFPS ? 'FPS' : 'Orbit' }})</p>
          <template v-if="!isFPS">
            <p><strong>마우스</strong> 좌: 회전 / 우: 팬 / 휠: 줌</p>
            <p><strong>키보드</strong> WASD 이동 · QE 상하 · R 리셋</p>
          </template>
          <template v-else>
            <p><strong>FPS</strong> WASD 이동 · Shift 달리기 · Space 점프 · Esc 해제</p>
            <p>캔버스를 클릭하면 포인터가 고정됩니다.</p>
          </template>
        </div>
        <div class="control-buttons">
          <button
            class="control-btn"
            @click="toggleWireframe"
          >
            {{ wireframeMode ? '와이어프레임 해제' : '와이어프레임 보기' }}
          </button>
          <button
            class="control-btn"
            @click="resetCamera"
          >
            카메라 리셋
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getLocationParts } from '@/api/parts'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

definePage({
  meta: {
    title: '3D 뷰어',
    icon: 'bx-cube',
    requiresAuth: true,
  },
})

/* ===== Router ===== */
const router = useRouter()

/* ===== State ===== */
const canvasRef = ref(null)
const loading = ref(true)
const error = ref('')
const modelInfo = ref({ vertices: 0, faces: 0 })
const wireframeMode = ref(false)

/* 이미지 에러 처리 */
function handleImageError(event) {
  event.target.style.display = 'none'
  if (event.target.parentElement) {
    event.target.parentElement.classList.add('has-error')
  }
}

/* 부품 상세 페이지로 이동 */
function goToPartDetail(partId) {
  if (!partId) return
  router.push({ name: 'part-detail-id', params: { id: String(partId) } })
}

/* 층별 토글 */
function toggleFloor(index) {
  if (locationParts.value[index]) {
    locationParts.value[index].collapsed = !locationParts.value[index].collapsed
  }
}

let scene, camera, renderer, controls, rootGroup
let hoverObj = null
let selectedObj = null
let raycaster, pointer
let resizeObserver

/* ----- FPS state ----- */
const isFPS = ref(false)
const pointerLocked = ref(false)
let fpsControls /** @type {PointerLockControls} */ = null
const keys = { w: false, a: false, s: false, d: false }
const clock = new THREE.Clock()
let velocity = new THREE.Vector3()

/* ===== Layout constants (이전과 동일, ZONE E 포함 / 벽면랙 제거 / 기둥 없음) ===== */
const MM = 0.001
const BAY = { W: 2400*MM, D_SINGLE: 1200*MM }
const RACK_GAP = 0.25, END_GAP = 0.35, MIN_R2R = 0.30
const BAY_PITCH = BAY.W + RACK_GAP
const AISLE = { MAIN: 3.8, SUB: 3.6, ZONE: 5.5, WALL: 2.0, PERIMETER: 2.4 }
const CLEAR = { END: END_GAP }
const SEGMENT = { BAYS: 5, GAP: 5.0 }
const DOCK_BUFFER = 10.0
const WALL_RACKS = { back: false, left: false, right: false }

const CENTER_GROUPS = [
  { name: 'ZONE A', bundles: 1, letter: 'A' },
  { name: 'ZONE B', bundles: 1, letter: 'B' },
  { name: 'ZONE C', bundles: 1, letter: 'C' },
  { name: 'ZONE D', bundles: 1, letter: 'D' },
  { name: 'ZONE E', bundles: 1, letter: 'E' },
]

const WORK = { size: { w: 12.0, d: 8.0 }, table: { w: 1.8, h: 0.9, d: 0.8 }, bufferFromRacks: 5.0 }

/* Entry / 선택 */
const ENTRANCE = new THREE.Vector3(0, 0.02, 0)
const selectedRack = ref(null)
const locationParts = ref([])
const loadingParts = ref(false)

/* 충돌용 AABB */
const colliders = []
let worldBounds = new THREE.Box3()

/* ===== Lights ===== */
function setupLights() {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x909090, 0.8)

  scene.add(hemi)

  const dir = new THREE.DirectionalLight(0xffffff, 0.9)

  dir.position.set(70, 90, 40); dir.castShadow = true
  dir.shadow.mapSize.set(2048, 2048)
  dir.shadow.camera.left = -400; dir.shadow.camera.right = 400
  dir.shadow.camera.top = 400;  dir.shadow.camera.bottom = -400
  scene.add(dir)
}

/* ===== Build ===== */
function buildWarehouse() {
  rootGroup = new THREE.Group(); scene.add(rootGroup)

  const rowPitch = BAY.D_SINGLE*2 + AISLE.SUB + MIN_R2R
  const segWidth = (SEGMENT.BAYS - 1) * BAY_PITCH + CLEAR.END*2
  const rowWidth = (segWidth + SEGMENT.GAP) * 4 - SEGMENT.GAP
  const totalWidth  = rowWidth + AISLE.PERIMETER*2 + 2.0

  const STAGING = 3.0

  const totalDepth =
    STAGING + AISLE.MAIN + DOCK_BUFFER +
    CENTER_GROUPS.reduce((s, g)=>s + g.bundles*rowPitch, 0) +
    (CENTER_GROUPS.length - 1) * AISLE.ZONE +
    AISLE.PERIMETER*2 + WORK.size.d + 3.0

  /* 바닥/벽 */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.ceil((totalWidth+2)/2)*2, Math.ceil((totalDepth+2)/2)*2),
    new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.96 }),
  )

  floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; rootGroup.add(floor)
  addWalls(totalWidth, totalDepth, 10)

  /* 월드 경계(AABB) - FPS 충돌에 사용 */
  worldBounds.set(
    new THREE.Vector3(-totalWidth/2 + 0.6, -1, -totalDepth/2 + 0.6),
    new THREE.Vector3( totalWidth/2 - 0.6,  6,  totalDepth/2 - 0.6),
  )

  const originZ = -totalDepth/2

  buildDockAndStaging(totalWidth, STAGING, 6, originZ + STAGING/2)
  drawAisleStripe(0, originZ + STAGING + AISLE.MAIN/2, totalWidth - 2, AISLE.MAIN)
  drawPerimeterStripes(totalWidth, totalDepth, AISLE.PERIMETER)

  /* 중앙 백투백 */
  const rowStartX = -rowWidth/2 + segWidth/2
  let zoneCursorZ = originZ + STAGING + AISLE.MAIN + DOCK_BUFFER + BAY.D_SINGLE + AISLE.PERIMETER + MIN_R2R/2
  CENTER_GROUPS.forEach((zone, zi) => {
    addZoneLabel(zone.name, 0, 5.2, zoneCursorZ + (rowPitch*zone.bundles)/2)
    for(let b=0;b<zone.bundles;b++){
      const centerZ = zoneCursorZ + b*rowPitch
      for(let seg=0; seg<4; seg++){
        const segCenterX = rowStartX + seg*(segWidth + SEGMENT.GAP)

        // 각 segment마다 blockOffset 계산: segment 0->0, 1->10, 2->20, 3->30
        const blockOffset = seg * 10

        buildBackToBackSegment(centerZ, segCenterX, SEGMENT.BAYS, zone.letter || zone.name.slice(-1), blockOffset)
      }
    }
    if (zi < CENTER_GROUPS.length-1) {
      drawAisleStripe(0, zoneCursorZ + zone.bundles*rowPitch + AISLE.ZONE/2, totalWidth - 2, AISLE.ZONE)
      zoneCursorZ += zone.bundles*rowPitch + AISLE.ZONE
    }
  })

  /* 작업대 */
  const workX = totalWidth/2 - WORK.size.w/2 - 1.0
  let workZ = (totalDepth/2) - WORK.size.d/2 - 1.0
  const lastCenterZ = zoneCursorZ - (CENTER_GROUPS[CENTER_GROUPS.length-1].bundles*rowPitch)
  if (Math.abs(workZ - lastCenterZ) < WORK.bufferFromRacks) workZ = lastCenterZ + WORK.bufferFromRacks
  buildWorkArea(workX, workZ)

  /* 입구 포인트 */
  ENTRANCE.set(0, 0.02, originZ + STAGING/2)

  const poi = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 24), new THREE.MeshStandardMaterial({ color: 0x2f9e44 }))

  poi.position.copy(ENTRANCE); poi.castShadow = true; rootGroup.add(poi)
  
  /* 보행로 생성 */
}

/* Walls */
function addWalls(w, d, h){
  const mat = new THREE.MeshStandardMaterial({ color: 0x667584, roughness: 1 })

  const mk = (W, H, D, x, y, z)=>{ const m = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mat)

    m.position.set(x, y, z); m.receiveShadow=true; rootGroup.add(m) }

  mk(w, h, .5, 0, h/2, -d/2)
  mk(w, h, .5, 0, h/2,  d/2)
  mk(.5, h, d, -w/2, h/2, 0)
  mk(.5, h, d,  w/2, h/2, 0)
}

/* Dock & staging */
function buildDockAndStaging(totalW, stagingD, doors, zCenter){
  drawHatch(0, zCenter, totalW-2, stagingD, 1.4)

  const laneW = 1.2, laneD = stagingD - 0.6
  const lanes = Math.floor((totalW - 4) / 1.5)
  for(let i=0;i<lanes;i++){
    const x = -totalW/2 + 2 + i*1.5
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(laneW, laneD), new THREE.MeshStandardMaterial({ color: 0xf1f5f9 }))

    plate.rotation.x = -Math.PI/2; plate.position.set(x, 0.006, zCenter); rootGroup.add(plate)
  }
}

/* Perimeter stripes */
function drawPerimeterStripes(totalW, totalD, width){
  drawAisleStripe(-totalW/2 + width/2, 0, width, totalD-2)
  drawAisleStripe( totalW/2 - width/2, 0, width, totalD-2)
  drawAisleStripe(0, -totalD/2 + width/2, totalW-2, width)
  drawAisleStripe(0,  totalD/2 - width/2, totalW-2, width)
}

/* Work area */
function buildWorkArea(cx, cz) {
  drawHatch(cx, cz, WORK.size.w, WORK.size.d, 1.2)

  const guard = new THREE.Mesh(new THREE.BoxGeometry(WORK.size.w + 0.2, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: 0xfbbf24 }))

  guard.position.set(cx, 0.07, cz - WORK.size.d/2 - 0.25); rootGroup.add(guard)

  const gap = 0.9, baseX = cx - WORK.size.w/2 + WORK.table.w/2 + 1.2, baseZ = cz
  for (let i=0;i<3;i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(WORK.table.w, WORK.table.h, WORK.table.d), new THREE.MeshStandardMaterial({ color: 0xf1f3f5, metalness: .05, roughness: .6 }))

    t.position.set(baseX + i*(WORK.table.w + gap), WORK.table.h/2, baseZ); t.castShadow = true; t.receiveShadow = true; rootGroup.add(t)
  }
}

/* Back-to-back segment */
// blockOffset: 각 segment의 시작 block 번호 (segment 0->0, 1->10, 2->20, 3->30)
// 앞면: blockOffset + 0~4 (예: A0-A4), 뒷면: blockOffset + 5~9 (예: A5-A9)
function buildBackToBackSegment(centerZ, segmentCenterX, bays=5, section='C', blockOffset=0){
  const half = BAY.D_SINGLE + MIN_R2R/2
  const innerSpan = (bays-1)*BAY_PITCH
  const startX = segmentCenterX - innerSpan/2
  
  // 문쪽 (z가 작은 쪽, centerZ - half) = 앞면: blockOffset + 0~4
  // 포장대쪽 (z가 큰 쪽, centerZ + half) = 뒷면: blockOffset + 5~9
  for(let i=0;i<bays;i++){
    const x = startX + i*BAY_PITCH
    
    // 앞면 (문쪽): blockOffset + 0~4
    const frontBlock = blockOffset + i
    const front = makeRackUnitFacingFront(section, frontBlock + 1, true) // bay는 1부터 시작하므로 +1

    front.userData.block = frontBlock // block 정보 저장 (A0, A1, ...)
    front.position.set(x, 0, centerZ - half) // 문쪽 (z가 작은 쪽)
    rootGroup.add(front)

    // 뒷면 (포장대쪽): blockOffset + 5~9
    const backBlock = blockOffset + 5 + i
    const back = makeRackUnitFacingFront(section, backBlock + 1, true) // bay는 1부터 시작하므로 +1

    back.userData.block = backBlock // block 정보 저장 (A5, A6, ...)
    back.position.set(x, 0, centerZ + half) // 포장대쪽 (z가 큰 쪽)
    back.rotation.y = Math.PI
    rootGroup.add(back)
  }
}


/* 바닥/구역 표시 */
function drawAisleStripe(cx, cz, w, d){
  const g = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0xf6f7f9 }))

  g.rotation.x = -Math.PI/2; g.position.set(cx, 0.01, cz); rootGroup.add(g)
}
function drawHatch(cx, cz, w, d, pitch=1.5){
  const g = new THREE.Group()
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0xf7f1c8 }))

  plate.rotation.x = -Math.PI/2; plate.position.set(cx, 0.005, cz); g.add(plate)
  for(let x=-w/2; x<=w/2; x+=pitch){
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.06, d), new THREE.MeshBasicMaterial({ color: 0xe9c46a }))

    line.rotation.x = -Math.PI/2; line.position.set(cx + x, 0.006, cz); g.add(line)
  }
  rootGroup.add(g)
}

/* 라벨 */
function makeSectionLabel(text) {
  const canvas = document.createElement('canvas')

  canvas.width = 256; canvas.height = 128

  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8)
  ctx.fillStyle = '#000'; ctx.font = 'bold 52px Arial'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, canvas.width / 2, canvas.height / 2)

  const tex = new THREE.CanvasTexture(canvas)
  
  return new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.4), new THREE.MeshBasicMaterial({ map: tex, transparent: true }))
}
function addZoneLabel(text, x, y, z){
  const lbl = makeSectionLabel(text)

  lbl.scale.set(1.1, 1.1, 1); lbl.position.set(x, y, z); rootGroup.add(lbl)
}


/* ===== Racks ===== */
const COLORS = { upright: 0x0d3b66, beam: 0xe67e22, shelf: 0x9aa0a6 }
function makeRackUnitFacingFront(section, bayNo, randomLoad=false) {
  const g = new THREE.Group()

  g.name = 'RACK_UNIT'
  g.userData = { type: 'RACK', section, bay: bayNo, levels: 4, depthType: '양면(백투백)', sampleSkus: [`${section}${bayNo}-ALT-0123`, `${section}${bayNo}-SUS-2088`, `${section}${bayNo}-ELC-7741`] }

  const H = 5.0, W = 2.4, D = 1.2
  const upr = new THREE.MeshStandardMaterial({ color: COLORS.upright, roughness: 0.7 })
  const beam= new THREE.MeshStandardMaterial({ color: COLORS.beam, metalness: .1, roughness: .5 })
  const shelf=new THREE.MeshStandardMaterial({ color: COLORS.shelf, roughness: .9 })
  const uprGeo = new THREE.BoxGeometry(0.14, H, 0.14)
  for (let z of [-D/2, +D/2]) for (let x of [-W/2, +W/2]) { const u = new THREE.Mesh(uprGeo, upr)

    u.position.set(x, H/2, z); u.castShadow=true; g.add(u) }
  for (let lv = 0; lv < 4; lv++) {
    const y = 0.9 + lv * 1.1
    const f = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, 0.1), beam)

    f.position.set(0, y, +D/2)

    const b = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, 0.1), beam)

    b.position.set(0, y, -D/2)

    const s = new THREE.Mesh(new THREE.BoxGeometry(W - 0.22, 0.06, D - 0.16), shelf)

    s.position.set(0, y - 0.02, 0); s.receiveShadow = true
    g.add(f, b, s)
    if (!randomLoad || Math.random() > 0.2) {
      const fill = Math.random()*0.25
      const box = makeBox(W - 0.28, 0.75 + fill, D - 0.24)

      box.position.set(0, y + 0.36 + fill/2, 0); g.add(box)
    }
  }

  // 충돌 AABB(여유 0.25m)
  const box3 = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, 2.5, 0), new THREE.Vector3(W+0.25, 5.0, D+0.25))

  g.userData.collider = { local: box3 }


  // 선택용 프록시
  const pick = new THREE.Mesh(new THREE.BoxGeometry(W, 6.2, D), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }))

  pick.position.set(0, 3.1, 0); pick.userData = { ...g.userData, isPickProxy: true, source: g }; g.add(pick)

  // 월드 AABB 등록은 추가 후에 수행
  setTimeout(()=>registerCollider(g), 0)
  
  return g
}
function makeSingleRackFacingIn(section, bayNo, randomLoad=false){
  const g = new THREE.Group()

  g.name = 'RACK_UNIT'
  g.userData = { type: 'RACK', section, bay: bayNo, levels: 3, depthType: '단면(벽면)', sampleSkus: [`${section}${bayNo}-WAL-1101`, `${section}${bayNo}-WAL-2202`] }

  const H = 4.6, W = 2.4, D = 1.2
  const upr = new THREE.MeshStandardMaterial({ color: COLORS.upright, roughness: 0.7 })
  const beam= new THREE.MeshStandardMaterial({ color: COLORS.beam, metalness: .1, roughness: .5 })
  const shelf=new THREE.MeshStandardMaterial({ color: COLORS.shelf, roughness: .9 })
  const uprGeo = new THREE.BoxGeometry(0.14, H, 0.14)
  for (let z of [-D/2, +D/2]) for (let x of [-W/2, +W/2]) { const u = new THREE.Mesh(uprGeo, upr)

    u.position.set(x, H/2, z); u.castShadow=true; g.add(u) }
  for (let lv = 0; lv < 3; lv++) {
    const y = 0.9 + lv * 1.1
    const f = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, 0.1), beam)

    f.position.set(0, y, +D/2)

    const b = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, 0.1), beam)

    b.position.set(0, y, -D/2)

    const s = new THREE.Mesh(new THREE.BoxGeometry(W - 0.22, 0.06, D - 0.16), shelf)

    s.position.set(0, y-0.02, 0); s.receiveShadow=true
    g.add(f, b, s)
  }
  const box3 = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, 2.3, 0), new THREE.Vector3(W+0.25, 4.6, D+0.25))

  g.userData.collider = { local: box3 }

  const pick = new THREE.Mesh(new THREE.BoxGeometry(W, 5.6, D), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }))

  pick.position.set(0, 2.8, 0); pick.userData = { ...g.userData, isPickProxy: true, source: g }; g.add(pick)
  setTimeout(()=>registerCollider(g), 0)
  
  return g
}

function registerCollider(mesh){
  // 로컬 박스를 월드 좌표로 변환해서 colliders에 등록
  if (!mesh?.userData?.collider) return
  const local = mesh.userData.collider.local.clone()
  const world = local.applyMatrix4(mesh.matrixWorld)

  colliders.push({ mesh, box: world })
}

/* Utils */
function makeBox(w, h, d) {
  const palette = [0xC4A484, 0xD3B08D, 0xD9B99B, 0xE0C097, 0xBFA27A]
  const mat = new THREE.MeshStandardMaterial({ color: palette[Math.floor(Math.random() * palette.length)], roughness: 0.85, metalness: 0.0 })
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)

  m.castShadow = true; m.receiveShadow = true 

  return m
}

/* ===== Interaction (선택) ===== */
function onPointerMove(e) {
  if (!renderer || isFPS.value) return
  const rect = renderer.domElement.getBoundingClientRect()

  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
}
function onClick(e) {
  if (!raycaster) return
  if (isFPS.value) { // FPS에서는 클릭 시 포인터락
    fpsControls.lock() 

    return
  }
  raycaster.setFromCamera(pointer, camera)

  const intersects = raycaster.intersectObjects(scene.children, true).filter(it =>
    it.object.userData?.type === 'RACK' || it.object.userData?.isPickProxy,
  )

  const obj = intersects[0]?.object
  if (obj) selectRack(obj)
}
async function selectRack(obj) {
  if (selectedObj) setEmissive(selectedObj, 0x000000)
  selectedObj = obj
  setEmissive(selectedObj, 0x00c2ff)

  const src = obj.userData.source ?? obj
  const { section, bay, levels, depthType, block } = src.userData
  const world = new THREE.Vector3()

  src.getWorldPosition(world)

  const blockNum = block !== undefined ? block : (bay ? bay - 1 : undefined)

  selectedRack.value = { section, bay, block: blockNum, levels, depthType, position: { x: world.x, z: world.z }, sampleSkus: src.userData.sampleSkus ?? [] }
  
  // 해당 location의 부품 목록 가져오기
  // warehouse-navigation 형식: "A0", "A1", "B0" 등 (section + block, block은 0부터 시작)
  // block 정보가 있으면 직접 사용, 없으면 bay-1로 계산
  if (section && (block !== undefined || bay)) {
    const blockNum = block !== undefined ? block : (bay - 1) // block이 있으면 사용, 없으면 bay-1로 계산
    const location = `${section}${blockNum}` // 예: "A0", "A1", "A5", "A10"

    loadingParts.value = true
    locationParts.value = []
    try {
      const parts = await getLocationParts(location)

      // 각 층에 collapsed 상태 추가 (기본값: false, 펼쳐진 상태)
      locationParts.value = parts.map(locationData => ({
        ...locationData,
        collapsed: false,
      }))
    } catch (error) {
      console.error('[selectRack] getLocationParts error:', error)
      locationParts.value = []
    } finally {
      loadingParts.value = false
    }
  }
}
function clearSelection() {
  if (selectedObj) setEmissive(selectedObj, 0x000000)
  selectedObj = null
  selectedRack.value = null
  locationParts.value = []
}
function setEmissive(target, color) {
  const root = target.userData.source ?? target

  root.traverse(obj => { if (obj.material && obj.material.emissive) obj.material.emissive.setHex(color) })
}

/* ===== 경로 ===== */

/* ===== FPS 모드 ===== */
function enableFPS(){
  if (isFPS.value) return
  isFPS.value = true

  // 오비트 비활성
  controls.enabled = false

  // 시작 위치/높이 (문 앞으로 이동하고 사람 눈높이로 설정)
  camera.position.set(ENTRANCE.x, 1.6, ENTRANCE.z) // 문 앞, 사람 눈높이 1.6m
  camera.rotation.set(0, Math.PI, 0) // 창고 내부 방향을 바라보도록 회전 (180도)

  // 포인터락 컨트롤 생성
  fpsControls = new PointerLockControls(camera, renderer.domElement)
  scene.add(fpsControls.getObject())

  // 포인터락 이벤트
  fpsControls.addEventListener('lock', ()=> {
    pointerLocked.value = true
  })
  fpsControls.addEventListener('unlock', ()=> {
    pointerLocked.value = false
  })
  
}
function disableFPS(){
  if (!isFPS.value) return
  isFPS.value = false
  pointerLocked.value = false
  fpsControls?.unlock?.()
  scene.remove(fpsControls.getObject())
  fpsControls.dispose()
  fpsControls = null
  controls.enabled = true
  
}
function toggleFPS(){ isFPS.value ? disableFPS() : enableFPS() }

/* 이동/충돌 업데이트 */
function updateFPS(delta){
  if (!fpsControls) return
  const speed = 1.5 // 느린 속도로 조정

  // 감속
  velocity.x -= velocity.x * 8.0 * delta
  velocity.z -= velocity.z * 8.0 * delta

  // 중력 (점프 제거)
  velocity.y = 0 // 항상 바닥에 붙어있음

  const dir = new THREE.Vector3()
  const forward = new THREE.Vector3()

  camera.getWorldDirection(forward); forward.y = 0; forward.normalize()

  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).negate().normalize()
  if (keys.w) dir.add(forward)
  if (keys.s) dir.add(forward.clone().multiplyScalar(-1))
  if (keys.a) dir.add(right) // A키를 오른쪽으로 변경
  if (keys.d) dir.add(right.clone().multiplyScalar(-1)) // D키를 왼쪽으로 변경
  if (dir.lengthSq()>0) dir.normalize()
  velocity.addScaledVector(dir, speed)

  // 디버깅: 키 입력 상태 확인
  if (keys.w || keys.a || keys.s || keys.d) {
  }

  // 이동 시도
  const next = camera.position.clone()

  next.x += velocity.x * delta
  next.z += velocity.z * delta
  
  next.y += velocity.y * delta

  // 바닥 고정 (사람 눈높이 유지)
  next.y = 1.6 // 항상 사람 눈높이 유지

  // 경계 체크
  if (!worldBounds.containsPoint(new THREE.Vector3(next.x, 0, camera.position.z))) velocity.x = 0; else camera.position.x = next.x
  if (!worldBounds.containsPoint(new THREE.Vector3(camera.position.x, 0, next.z))) velocity.z = 0; else camera.position.z = next.z

  // 랙 충돌(간단히 xz 포인트가 AABB 안이면 반사)
  const p = new THREE.Vector3(camera.position.x, 2.0, camera.position.z)
  for (const c of colliders){
    // 업데이트(랙은 정적이라 최초 등록만으로 충분하지만 안전하게)
    c.box.copy(c.mesh.userData.collider.local.clone().applyMatrix4(c.mesh.matrixWorld))
    if (c.box.containsPoint(p)){
      // 가장 가까운 면으로 밀어내기
      const size = new THREE.Vector3()

      c.box.getSize(size)

      const center = new THREE.Vector3()

      c.box.getCenter(center)

      const dx = (p.x - center.x) / (size.x/2)
      const dz = (p.z - center.z) / (size.z/2)
      if (Math.abs(dx) > Math.abs(dz)){
        camera.position.x = center.x + Math.sign(dx)*(size.x/2 + 0.05); velocity.x = 0
      } else {
        camera.position.z = center.z + Math.sign(dz)*(size.z/2 + 0.05); velocity.z = 0
      }
    }
  }
}

/* ===== Render/Camera/Resize ===== */
function animate() {
  requestAnimationFrame(animate)

  const delta = clock.getDelta()
  if (isFPS.value) updateFPS(delta)
  else controls?.update()

  if (raycaster && renderer && camera && !isFPS.value) {
    raycaster.setFromCamera(pointer, camera)

    const hits = raycaster.intersectObjects(scene.children, true).filter(it =>
      it.object.userData?.type === 'RACK' || it.object.userData?.isPickProxy,
    )

    const top = hits[0]?.object
    if (top && top !== hoverObj) {
      if (hoverObj && hoverObj !== selectedObj) setEmissive(hoverObj, 0x000000)
      hoverObj = top
      if (hoverObj !== selectedObj) setEmissive(hoverObj, 0x30e3ca)
    } else if (!top && hoverObj && hoverObj !== selectedObj) {
      setEmissive(hoverObj, 0x000000); hoverObj = null
    }
  }
  renderer?.render(scene, camera)
}
function resetCamera() {
  disableFPS()
  camera.position.set(54, 36, 64)
  controls.target.set(0, 0, 0)
  controls.update()
}
function toggleWireframe() {
  wireframeMode.value = !wireframeMode.value
  rootGroup.traverse(obj => { if (obj.isMesh && obj.material) obj.material.wireframe = wireframeMode.value })
}
function onWindowResize() {
  if (!renderer || !camera || !canvasRef.value) return
  const w = canvasRef.value.clientWidth, h = canvasRef.value.clientHeight

  camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h)
}

/* ===== Keyboard ===== */
function onKeyDown(e) {
  // 공통
  if (e.code === 'KeyF') { toggleFPS() 

    return }
  if (!camera) return
  if (isFPS.value){
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = true
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.s = true
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = true
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = true
    
    return
  }

  // Orbit 모드 이동키
  const s = 2.3
  const forward = new THREE.Vector3(), right = new THREE.Vector3()

  camera.getWorldDirection(forward); forward.y = 0; forward.normalize()
  right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).negate().normalize()
  switch (e.code) {
  case 'KeyW': case 'ArrowUp':   camera.position.addScaledVector(forward, s); controls.target.addScaledVector(forward, s); break
  case 'KeyS': case 'ArrowDown': camera.position.addScaledVector(forward, -s); controls.target.addScaledVector(forward, -s); break
  case 'KeyA': case 'ArrowLeft': camera.position.addScaledVector(right, -s); controls.target.addScaledVector(right, -s); break
  case 'KeyD': case 'ArrowRight':camera.position.addScaledVector(right, s); controls.target.addScaledVector(right, s); break
  case 'KeyQ': camera.position.y += s; controls.target.y += s; break
  case 'KeyE': camera.position.y -= s; controls.target.y -= s; break
  case 'KeyR': resetCamera(); break
  }
  controls.update()
}
function onKeyUp(e){
  if (!isFPS.value) return
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = false
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.s = false
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = false
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = false
}

/* ===== Stats ===== */
function updateModelInfo() {
  let v = 0, f = 0
  scene.traverse(child => {
    if (child.isMesh) {
      const geom = child.geometry
      if (!geom) return
      if (geom.attributes?.position) v += geom.attributes.position.count
      f += (geom.index ? geom.index.count : geom.attributes.position.count) / 3
    }
  })
  modelInfo.value = { vertices: Math.round(v), faces: Math.round(f) }
}

/* ===== Init ===== */
async function initScene() {
  try {
    loading.value = true; error.value = ''
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf4f6f8)
    scene.fog = new THREE.Fog(0xf4f6f8, 120, 260)

    const width = canvasRef.value.clientWidth, height = canvasRef.value.clientHeight

    camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 3000)
    camera.position.set(54, 36, 64)
    renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true, powerPreference: 'high-performance', alpha: false })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.dampingFactor = 0.08
    controls.minDistance = 18; controls.maxDistance = 180
    controls.target.set(0, 0, 0); controls.update()

    raycaster = new THREE.Raycaster(); pointer = new THREE.Vector2()

    setupLights()
    buildWarehouse()
    updateModelInfo(); animate()

    window.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('click', onClick)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('resize', onWindowResize)

    resizeObserver = new ResizeObserver(onWindowResize); resizeObserver.observe(canvasRef.value)
    loading.value = false
  } catch (e) {
    console.error(e); error.value = '렌더러 초기화에 실패했습니다.'; loading.value = false
  }
}

onMounted(initScene)
onUnmounted(() => {
  window.removeEventListener('pointermove', onPointerMove)
  renderer?.domElement?.removeEventListener('click', onClick)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('resize', onWindowResize)
  resizeObserver?.disconnect()
  scene?.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose?.()
    if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose?.()); else obj.material.dispose?.() }
  })
  renderer?.dispose()
})
</script>

<style scoped>
.warehouse-viewer { position: relative; width: 80vw; height: 82vh; overflow: hidden; }
.warehouse-canvas { width: 100%; height: 100%; display: block; cursor: crosshair; }

.loading-overlay, .error-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,.75);
  display: flex; align-items: center; justify-content: center; z-index: 20;
}
.loading-spinner { color: #fff; text-align: center; }
.spinner { width: 46px; height: 46px; border: 3px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px; }
@keyframes spin { to { transform: rotate(360deg); } }
.error-message { background: #fff; padding: 22px; border-radius: 10px; width: 320px; text-align: center; }
.retry-btn { background: #0d6efd; color: #fff; border: 0; padding: 8px 14px; border-radius: 6px; cursor: pointer; }

.fps-hint{
  position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  background:rgba(0,0,0,.6); color:#fff; padding:10px 14px; border-radius:8px; z-index:15;
  font-size:14px;
}

.control-panel {
  position: absolute; top: 16px; right: 20px; z-index: 10;
  background: rgba(0,0,0,.72); color: #fff; padding: 14px 16px; border-radius: 10px; width: 240px;
}
.control-section { margin-bottom: 10px; }
.control-section h4 { margin: 0 0 6px 0; font-size: 14px; color: #fff; }
.control-info p, .model-info p { margin: 3px 0; font-size: 12px; color: #d0d0d0; }
.control-buttons { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
.control-btn {
  background: rgba(255,255,255,.1); color: #fff; border: 1px solid rgba(255,255,255,.2);
  padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;
  transition: all 0.2s ease;
}
.control-btn:hover {
  background: rgba(255,255,255,.2); border-color: rgba(255,255,255,.4);
}

.side-panel {
  position: absolute; top: 0; left: 0; height: 100%; width: 0; overflow: hidden;
  background: rgba(255,255,255,.98); box-shadow: 2px 0 10px rgba(0,0,0,.12);
  transition: width .25s ease; z-index: 12;
}
.side-panel.open { width: 420px; }
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #eee; }
.panel-header h3 { font-size: 16px; margin: 0; }
.panel-close { border: 0; background: #f0f0f0; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; }
.panel-body { padding: 16px; }

.kpi { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; margin-bottom: 12px; }
.kpi .k { display: block; font-size: 12px; color: #6c757d; }
.kpi .v { display: block; font-weight: 600; font-size: 14px; }

.list h4 { margin: 0 0 16px; font-size: 15px; font-weight: 600; color: #212529; }
.list ul { margin: 0; padding-left: 16px; }
.list li { font-size: 13px; margin: 2px 0; }

.loading-parts, .no-parts {
  padding: 20px;
  text-align: center;
  color: #6c757d;
  font-size: 13px;
}

.parts-list {
  max-height: 450px;
  overflow-y: auto;
  padding-right: 4px;
}

/* 스크롤바 스타일링 */
.parts-list::-webkit-scrollbar {
  width: 6px;
}

.parts-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.parts-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.parts-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.floor-group {
  margin-bottom: 24px;
}

.floor-group:last-child {
  margin-bottom: 0;
}

.floor-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e9ecef;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
  padding: 8px;
  margin: -8px -8px 12px -8px;
  border-radius: 6px;
}

.floor-header:hover {
  background-color: #f8f9fa;
}

.floor-icon {
  color: #0d6efd;
}

.floor-title {
  font-size: 14px;
  font-weight: 600;
  color: #212529;
  margin: 0;
  flex: 1;
}

.floor-count {
  font-size: 11px;
  height: 20px;
}

.floor-chevron {
  color: #6c757d;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.parts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.part-card {
  background: #ffffff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
  cursor: pointer;
}

.part-card:hover {
  border-color: #0d6efd;
  box-shadow: 0 2px 8px rgba(13, 110, 253, 0.15);
  transform: translateY(-2px);
}

.part-image-wrapper {
  width: 100%;
  height: 120px;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.part-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s ease;
}

.part-card:hover .part-image {
  transform: scale(1.05);
}

.part-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #adb5bd;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}

.part-image-wrapper.has-error .part-image-placeholder {
  display: flex;
}

.part-content {
  padding: 12px;
}

.part-name {
  font-size: 13px;
  font-weight: 500;
  color: #212529;
  margin-bottom: 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  min-height: 36px;
}

.part-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.part-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #6c757d;
}

.meta-icon {
  color: #adb5bd;
  flex-shrink: 0;
}

.part-location {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 10px;
  background: #f8f9fa;
  padding: 2px 6px;
  border-radius: 4px;
}

.part-amount {
  font-weight: 600;
  color: #198754;
}

.btns { display: flex; gap: 8px; margin: 14px 0 8px; flex-wrap: wrap; }
.primary { background: #0d6efd; color: #fff; border: 0; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; }
.ghost { background: #f3f4f6; color: #333; border: 0; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; }

.hint { color: #6c757d; font-size: 12px; margin-top: 8px; }
</style>
