<script setup>
import fleetImg from '@images/misc/fleet-car.png'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PerfectScrollbar } from 'vue3-perfect-scrollbar'
import { useDisplay } from 'vuetify'

/* 너가 쓰던 훅 그대로 사용 */
const { isLeftSidebarOpen } = useResponsiveLeftSidebar()
const vuetifyDisplay = useDisplay()

definePage({ meta: { layoutWrapperClasses: 'layout-content-height-fixed fleet-full-width' } })

/* UI용 더미 이미지/상태는 그대로 유지 */
const carImgs = ref([fleetImg, fleetImg, fleetImg, fleetImg])
const refCars = ref([]) // (지금은 3D 오브젝트가 아니라 사이드 포커스에만 사용)
const showPanel = ref([true, false, false, false])
const activeIndex = ref(0)

/* 차량 좌표(경도, 위도) – 기존 geojson 그대로 사용 */
const geojson = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [126.9784, 37.5665] } }, // 서울시청
    { type: 'Feature', geometry: { type: 'Point', coordinates: [127.0300, 37.5000] } }, // 강남
    { type: 'Feature', geometry: { type: 'Point', coordinates: [126.9600, 37.5800] } }, // 서대문
    { type: 'Feature', geometry: { type: 'Point', coordinates: [127.1000, 37.5200] } }, // 송파
  ],
}

/* 사이드 리스트 데이터 유지 */
const vehicleTrackingData = [
  { name: 'VOL-342808', location: 'Chelsea, NY, USA', progress: 88, driverName: 'Veronica Herman' },
  { name: 'VOL-954784', location: 'Lincoln Harbor, NY, USA', progress: 100, driverName: 'Myrtle Ullrich' },
  { name: 'VOL-342808', location: 'Midtown East, NY, USA', progress: 60, driverName: 'Barry Schowalter' },
  { name: 'VOL-343908', location: 'Hoboken, NY, USA', progress: 28, driverName: 'Helen Jacobs' },
]

/* XDWorld 전역 Module 참조용 */
let xdModuleLoaded = false
let cleanupScript = null
let basemap = null

/* 카메라 헬퍼: 경도/위도/고도 */
function moveCamera(lon, lat, altitude = 1000.0, withAnimation = true) {
  const camera = window.Module.getViewCamera()


  // tilt/limit 기본 설정
  camera.setPermitUnderGround(true)
  camera.setLimitTilt(-88.0)
  camera.setLimitAltitude(-1000.0)
  camera.setTilt(90.0)

  let pos = new Module.JSVector3D(lon, lat, altitude)	
  camera.setLocation(pos)		

  // camera.setTilt(30.0)
}

/* 사이드에서 위치 클릭 시 이동 */
const flyToLocation = (geolocation, index) => {
  activeIndex.value = index
  showPanel.value.fill(false)
  showPanel.value[index] = !showPanel.value[index]
  if (vuetifyDisplay.mdAndDown.value) isLeftSidebarOpen.value = false

  if (!xdModuleLoaded) return
  const [lon, lat] = geolocation

  moveCamera(lon, lat, 800.0, true)
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function createBoardImage(_canvas, _textOptions) {
  const fontname = _textOptions.font || "Consolas"
  const fontsize = _textOptions.fontSize || 16
  const padding = 12
  const radius = 10

  const ctx = _canvas.getContext("2d")

  ctx.font = fontsize + "px " + fontname

  const strlist = _textOptions.text.split("\n")

  // 텍스트 폭 계산
  let width = 0
  strlist.forEach(item => {
    const w = ctx.measureText(item).width
    if (w > width) width = w
  })

  const linecount = strlist.length

  const rectWidth = width + padding * 2
  const rectHeight = fontsize * linecount + padding * 2 + 10 // +10 말풍선 꼬리 공간

  // 캔버스 크기 세팅
  _canvas.width = rectWidth
  _canvas.height = rectHeight

  const ctx2 = _canvas.getContext("2d")

  // 그림자
  ctx2.shadowColor = "rgba(0,0,0,0.25)"
  ctx2.shadowBlur = 6
  ctx2.shadowOffsetX = 2
  ctx2.shadowOffsetY = 2

  // 배경 말풍선
  ctx2.fillStyle = _textOptions.backgroundColor || "rgba(29,78,216,0.9)" // 기본 파란
  roundedRect(ctx2, 0, 0, rectWidth, rectHeight - 10, radius)
  ctx2.fill()

  // 꼬리(삼각형)
  ctx2.beginPath()
  ctx2.moveTo(rectWidth / 2 - 8, rectHeight - 10)
  ctx2.lineTo(rectWidth / 2 + 8, rectHeight - 10)
  ctx2.lineTo(rectWidth / 2, rectHeight)
  ctx2.closePath()
  ctx2.fill()

  // 텍스트
  ctx2.font = fontsize + "px " + fontname
  ctx2.textBaseline = "top"
  ctx2.fillStyle = _textOptions.fontColor || "#fff"
  strlist.forEach((item, i) => {
    ctx2.fillText(item, rectWidth / 2 - width / 2, padding + fontsize * i)
  })

  return {
    width: rectWidth,
    height: rectHeight,
    data: ctx2.getImageData(0, 0, rectWidth, rectHeight).data,
  }
}


// ✅ POI 생성 함수 (이미지 → 캔버스 → ImageData)
function createPOI(_layer, _longitude, _latitude, _altitude, _imageSrc, _lineColor) {
	
  // Load POI image
  var img = new Image()
  img.onload = function() {

    // Draw the image on canvas after loading
    var canvas = document.createElement('canvas')
    var ctx = canvas.getContext('2d')
    canvas.width = img.width
    canvas.height = img.height
    ctx.drawImage(img, 0, 0)
    
    // Create the Point POI
    var point = Module.createPoint("POI_"+_layer.getObjectCount())
    point.setPosition(new Module.JSVector3D(_longitude, _latitude, _altitude))
    point.setImage(ctx.getImageData(0, 0, this.width, this.height).data, this.width, this.height)
    
    point.setMaxDistance(100000000000.0)   // 최대 1000km에서도 보이도록
    point.setMinDistance(0.0)         // 0m부터 보이도록
    // Set up vertical line for the POI
    point.setPositionLine(100.0, _lineColor)
    
    _layer.addObject(point, 0)
  }
  img.src = _imageSrc
}


/* 사이드 선택 상태에 따른 DOM 하이라이트 (UI만) */
watch(activeIndex, () => {
  refCars.value.forEach((car, index) => {
    if (!car) return
    if (index === activeIndex.value) car.classList.add('marker-focus')
    else car.classList.remove('marker-focus')
  })
})

onMounted(async () => {
  // XDWorld 스크립트 동적 로드
  await new Promise(resolve => setTimeout(resolve, 100)) // Vuetify 레이아웃 렌더 보장

  const script = document.createElement('script')

  script.src = 'https://cdn.xdworld.kr/latest/XDWorldEM.js'
  script.async = true

  // Module 오브젝트 주입
  window.Module = {
    locateFile: function (s) {
      return 'https://cdn.xdworld.kr/latest/' + s
    },
    postRun: function () {
      // 엔진 초기화
      window.Module.initialize({
        container: document.getElementById('map'), // 아래 template의 #map
        terrain: {
          dem: {
            url: "https://xdworld.vworld.kr",
            name: "dem",
            servername: "XDServer3d",
            encoding: true,
          },
          image: {
            url: "https://xdworld.vworld.kr",
            name: "tile",
            servername: "XDServer3d",
          },
        },
        worker: {
          use: true,
          path: './worker/XDWorldWorker.js',
          count: 5,
        },

        // vworld 기본키(데모). 상용키가 있으면 defaultKey 교체 가능
        defaultKey: "dJe!e!iaEpHmEpCrD5QpEQf2#FBrdzDmd(BQDQEQDJdaE(iB",
      })
      basemap = window.Module.GoogleMap()
      basemap.layername = 'normal'
      basemap.quality = 'high'
      basemap.zerolevelOffset = 1
      basemap.refresh()

      // 최초 카메라 위치(첫 차량 좌표)
      const [lon, lat] = geojson.features[0].geometry.coordinates

      window.Module.getViewCamera().moveLonLatAlt(lon, lat, 500, true)
      xdModuleLoaded = true

      // ✅ POI 레이어 생성
      const layerList = new window.Module.JSLayerList(true)
      const poiLayer = layerList.createLayer('POI_FLEET', window.Module.ELT_3DPOINT)

      console.log("layerList", layerList)


      // ✅ 첫 세팅 시 geojson 전부 찍기
      //    - 아이콘: fleetImg (Vite 번들 후 절대경로로 변환됨)
      //    - 라인 색: 보라(primary 톤 느낌). 필요하면 per-index로 바꿔도 됨.
      const lineColor = new window.Module.JSColor(200, 90, 58, 255) // (alpha,r,g,b)

      geojson.features.forEach((f, i) => {
        const [plon, plat] = f.geometry.coordinates

        let canvas = document.createElement("canvas")
        let boardImage = createBoardImage(canvas, {
          text: "가산점",
          font: "Consolas",
          fontSize: 16,
          fontColor: "#FFFFFF",
          backgroundColor: "#1D4ED8",
          outlineColor: "rgba(0, 0, 0, 0)",
          outlineWidth: 0,
        })
        let dataUrl = canvas.toDataURL()     // 이미지 경로처럼 사용 가능
        poiLayer.setMaxDistance(500000)   // 1,000,000km
        poiLayer.setMinDistance(0.0)
        createPOI(poiLayer, plon, plat, 14.0, dataUrl, lineColor)
      })

      // (선택) 여기서 3D 오브젝트/레이어 생성 가능
      // 예: 3D 그래프/아이콘 등을 추가하려면 아래 주석을 확장
      // createCarBillboards()
    },
  }

  document.body.appendChild(script)
  cleanupScript = () => {
    document.body.removeChild(script)
  }
})

onBeforeUnmount(() => {
  if (cleanupScript) cleanupScript()

  // XDWorld는 페이지 언마운트 시 엔진 종료 API가 있으면 호출
  if (window.Module && window.Module.terminate) {
    try { window.Module.terminate() } catch {}
  }
})
</script>

<template>
  <VLayout class="fleet-app-layout">
    <!-- 좌측 내비/목록 영역 (그대로) -->
    <VNavigationDrawer
      v-model="isLeftSidebarOpen"
      data-allow-mismatch
      width="360"
      absolute
      touchless
      location="start"
      border="none"
    >
      <VCard
        class="h-100 fleet-navigation-drawer"
        flat
      >
        <VCardItem>
          <VCardTitle> Fleet </VCardTitle>
          <template #append>
            <IconBtn
              class="d-lg-none navigation-close-btn"
              @click="isLeftSidebarOpen = !isLeftSidebarOpen"
            >
              <VIcon icon="bx-x" />
            </IconBtn>
          </template>
        </VCardItem>

        <PerfectScrollbar
          :options="{ wheelPropagation: false, suppressScrollX: true }"
          style="block-size: calc(100% - 60px)"
        >
          <VCardText class="pt-0">
            <div
              v-for="(vehicle, index) in vehicleTrackingData"
              :key="index"
              class="mb-6"
            >
              <div
                class="d-flex align-center justify-space-between cursor-pointer"
                @click="flyToLocation(geojson.features[index].geometry.coordinates, index)"
              >
                <div class="d-flex gap-x-4 align-center">
                  <VAvatar
                    icon="bx-car"
                    size="40"
                    variant="tonal"
                    color="secondary"
                  />
                  <div>
                    <div class="text-body-1 text-high-emphasis mb-1">
                      {{ vehicle.name }}
                    </div>
                    <div class="text-body-1">
                      {{ vehicle.location }}
                    </div>
                  </div>
                </div>
                <IconBtn size="small">
                  <VIcon
                    :icon="showPanel[index] ? 'bx-chevron-down' : $vuetify.locale.isRtl ? 'bx-chevron-left' : 'bx-chevron-right'"
                    class="text-high-emphasis"
                  />
                </IconBtn>
              </div>

              <VExpandTransition mode="out-in">
                <div v-show="showPanel[index]">
                  <div class="py-8">
                    <div class="d-flex justify-space-between mb-1">
                      <span class="text-body-1 text-high-emphasis">Delivery Process</span>
                      <span class="text-body-1">{{ vehicle.progress }}%</span>
                    </div>
                    <VProgressLinear
                      :model-value="vehicle.progress"
                      color="primary"
                      rounded
                      height="6"
                    />
                  </div>

                  <div>
                    <VTimeline
                      align="start"
                      truncate-line="both"
                      side="end"
                      density="compact"
                      line-thickness="1"
                      line-inset="6"
                      class="ps-2 v-timeline--variant-outlined fleet-timeline"
                    >
                      <VTimelineItem
                        icon="bx-check-circle"
                        dot-color="rgb(var(--v-theme-surface))"
                        icon-color="success"
                        fill-dot
                        size="20"
                        :elevation="0"
                      >
                        <div class="ps-1">
                          <div class="text-caption text-success">
                            TRACKING NUMBER CREATED
                          </div>
                          <div class="app-timeline-title">
                            {{ vehicle.driverName }}
                          </div>
                          <div class="text-body-2">
                            Sep 01, 7:53 AM
                          </div>
                        </div>
                      </VTimelineItem>

                      <VTimelineItem
                        icon="bx-check-circle"
                        dot-color="rgb(var(--v-theme-surface))"
                        icon-color="success"
                        fill-dot
                        size="20"
                        :elevation="0"
                      >
                        <div class="text-caption text-uppercase text-success">
                          OUT FOR DELIVERY
                        </div>
                        <div class="app-timeline-title">
                          Veronica Herman
                        </div>
                        <div class="text-body-2">
                          Sep 03, 8:02 AM
                        </div>
                      </VTimelineItem>

                      <VTimelineItem
                        icon="bx-map"
                        dot-color="rgb(var(--v-theme-surface))"
                        icon-color="primary"
                        fill-dot
                        size="20"
                        :elevation="0"
                      >
                        <div class="text-caption text-uppercase text-success">
                          ARRIVED
                        </div>
                        <div class="app-timeline-title">
                          Veronica Herman
                        </div>
                        <div class="text-body-2">
                          Sep 04, 8:18 AM
                        </div>
                      </VTimelineItem>
                    </VTimeline>
                  </div>
                </div>
              </VExpandTransition>
            </div>
          </VCardText>
        </PerfectScrollbar>
      </VCard>
    </VNavigationDrawer>

    <VMain>
      <div class="h-100">
        <IconBtn
          class="d-lg-none navigation-toggle-btn rounded-sm"
          variant="elevated"
          @click="isLeftSidebarOpen = true"
        >
          <VIcon icon="bx-menu" />
        </IconBtn>

        <!-- ✅ XDWorld가 들어갈 컨테이너 -->
        <div
          id="map"
          class="basemap"
        />

        <!-- (UI 강조용) 선택된 차량 이미지 하이라이트 – 3D 오브젝트는 아님 -->
        <img
          v-for="(car, index) in carImgs"
          :key="index"
          ref="refCars"
          :src="car"
          alt="car Img marker"
          height="42"
          width="20"
          style="display:none"
        >
      </div>
    </VMain>
  </VLayout>
</template>

<style lang="scss">
@use "@styles/variables/vuetify";
@use "@core/scss/base/mixins";

.fleet-app-layout {
  border-radius: vuetify.$card-border-radius;
  @include mixins.elevation(vuetify.$card-elevation);

  $sel-fleet-app-layout: &;

  @at-root {
    .skin--bordered {
      @include mixins.bordered-skin($sel-fleet-app-layout);
    }
  }
}

.navigation-toggle-btn {
  position: absolute;
  z-index: 1;
  inset-block-start: 1rem;
  inset-inline-start: 1rem;
}

.navigation-close-btn {
  position: absolute;
  z-index: 1;
  inset-block-start: 1rem;
  inset-inline-end: 1rem;
}

/* XDWorld 캔버스가 100% 차도록 */
.basemap {
  block-size: 100%;
  inline-size: 100%;
}

/* 선택 강조 (지금은 사이드 UI용) */
.marker-focus {
  filter: drop-shadow(0 0 7px rgb(var(--v-theme-primary)));
}

/* Mapbox 전용 컨트롤 숨김 CSS 제거됨 */

/* 좌측 타임라인 그림자 제거 커스터마이즈 유지 */
.fleet-navigation-drawer {
  .v-timeline .v-timeline-divider__dot .v-timeline-divider__inner-dot {
    box-shadow: none;
  }
}

.fleet-timeline {
  &.v-timeline .v-timeline-item:not(:last-child) {
    .v-timeline-item__body {
      margin-block-end: 0.25rem;
    }
  }
}

/* 화면 꽉 채우기 */
#map {
  block-size: 100vh !important;
}

/* fleet-full-width 클래스가 적용된 경우 Boxed 레이아웃 해제 */
.fleet-full-width {
  :deep(.layout-content-height-fixed) {
    max-width: none !important;
    padding: 0 !important;
  }

  #map {
    width: 100vw;   /* 브라우저 전체 가로 */
    height: 100vh;  /* 브라우저 전체 세로 */
  }
}
</style>
