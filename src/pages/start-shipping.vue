<!-- File: src/pages/start-shipping.vue -->
<script setup>
definePage({
  meta: { title: '배송 시작', icon: 'bx-package', requiresAuth: true },
})

import { startShipping } from '@/api/order'
import { Html5Qrcode } from 'html5-qrcode'
import { Capacitor } from '@capacitor/core'
import { Camera } from '@capacitor/camera'
import { onMounted, onUnmounted, ref } from 'vue'

/* =========================
   상태
========================= */
const scanner            = ref(null)        // Html5Qrcode 인스턴스
const isScanning         = ref(false)
const scanError          = ref('')
const isProcessing       = ref(false)
const showResultDialog   = ref(false)
const resultType         = ref('')          // 'success' | 'error'
const resultMessage      = ref('')
const resultOrderNumber  = ref('')
const cameras            = ref([])          // 디바이스 목록
const selectedCameraId   = ref(null)
const torchAvailable     = ref(false)
const torchOn            = ref(false)
const paused             = ref(false)

const lastScanAt         = ref(0)           // 중복 스캔 방지(쿨다운)
const SCAN_COOLDOWN_MS   = 1500

/* =========================
   카메라 제어
========================= */
async function enumerateCameras() {
  try {
    const list = await Html5Qrcode.getCameras()

    cameras.value = list || []
    if (!selectedCameraId.value && cameras.value.length) {
      // 후면 우선 선택
      const back = cameras.value.find(c => /back|rear|environment/i.test(c.label)) || cameras.value[0]

      selectedCameraId.value = back.id
    }
  } catch (e) {
    console.warn('카메라 목록 조회 실패:', e)
  }
}

async function requestCameraPermission() {
  // Capacitor 앱인 경우 권한 요청
  if (Capacitor.isNativePlatform()) {
    try {
      const permission = await Camera.requestPermissions({ permissions: ['camera'] })
      if (permission.camera === 'granted' || permission.camera === 'limited') {
        return true
      }
      scanError.value = '카메라 권한이 필요합니다. 설정에서 권한을 허용해주세요.'
      return false
    } catch (e) {
      console.warn('권한 요청 실패:', e)
      return false
    }
  }
  return true
}

async function startCamera() {
  try {
    scanError.value = ''

    // 권한 확인 및 요청
    const hasPermission = await requestCameraPermission()
    if (!hasPermission) {
      isScanning.value = false
      return
    }

    // 기존 인스턴스 정리
    if (scanner.value) await stopCamera()

    scanner.value = new Html5Qrcode('reader')

    const constraints = selectedCameraId.value
      ? { deviceId: { exact: selectedCameraId.value } }
      : { facingMode: 'environment' }

    const config = {
      fps: 12,
      qrbox: { width: 280, height: 280 },

      // 실내 형광등 밴딩 감소
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },

      // 화면 사이즈에 맞게
      formatsToSupport: [/* 기본 QR */],
    }

    await scanner.value.start(
      constraints,
      config,
      onScanSuccess,
      onScanFailure,
    )

    isScanning.value = true
    paused.value = false

    // torch 지원 탐지(일부 브라우저/기기)
    try {
      const track = scanner.value.getState()?.videoTrack
      const capabilities = track?.getCapabilities?.() || {}

      torchAvailable.value = !!capabilities.torch
    } catch { torchAvailable.value = false }
  } catch (err) {
    console.error('카메라 시작 실패:', err)

    const errorMsg = err?.message || err?.name || ''
    if (errorMsg.includes('NotAllowedError')) {
      scanError.value = '카메라 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.'
    } else if (errorMsg.includes('NotFoundError')) {
      scanError.value = '사용 가능한 카메라가 없습니다. 연결 상태를 확인해주세요.'
    } else if (errorMsg.includes('NotReadableError')) {
      scanError.value = '카메라를 사용할 수 없습니다. 다른 앱에서 사용 중일 수 있어요.'
    } else {
      scanError.value = `카메라를 시작할 수 없습니다: ${errorMsg || '알 수 없는 오류'}`
    }
    isScanning.value = false
  }
}

async function stopCamera() {
  try {
    if (!scanner.value) return
    await scanner.value.stop()
    await scanner.value.clear()
    scanner.value = null
  } catch (e) {
    console.warn('카메라 중지 실패:', e)
  } finally {
    isScanning.value = false
    paused.value = false
    torchOn.value = false
  }
}

async function togglePause() {
  if (!scanner.value) return
  try {
    if (paused.value) {
      await scanner.value.resume()
      paused.value = false
    } else {
      await scanner.value.pause(true)
      paused.value = true
    }
  } catch (e) {
    console.warn('일시정지/재개 실패:', e)
  }
}

async function switchCamera(id) {
  if (id === selectedCameraId.value) return
  selectedCameraId.value = id
  await startCamera()
}

async function toggleTorch() {
  if (!scanner.value) return
  try {
    const track = scanner.value.getState()?.videoTrack

    await track.applyConstraints({ advanced: [{ torch: !torchOn.value }] })
    torchOn.value = !torchOn.value
  } catch (e) {
    console.warn('토치 제어 실패:', e)
    torchAvailable.value = false
  }
}

/* =========================
   스캔 처리
========================= */
function isValidOrder(decoded) {
  // 필요 시 주문번호 포맷 검증 로직(예: 숫자 6~12자리)
  return /^[A-Z0-9\-]{4,32}$/i.test(String(decoded || '').trim())
}

async function onScanSuccess(decodedText) {
  const now = Date.now()
  if (now - lastScanAt.value < SCAN_COOLDOWN_MS) return
  lastScanAt.value = now

  const text = String(decodedText || '').trim()
  if (!isValidOrder(text)) return

  if (isProcessing.value) return
  isProcessing.value = true

  try {
    await stopCamera() // 진동/소리 전에 정지 → 이중 호출 방지
    if (navigator?.vibrate) navigator.vibrate(60)

    await startShipping(text)

    resultType.value = 'success'
    resultMessage.value = '배송이 시작되었습니다'
    resultOrderNumber.value = text
  } catch (err) {
    console.error('배송 시작 실패:', err)
    resultType.value = 'error'
    resultMessage.value = err?.message || '배송 시작에 실패했습니다.'
    resultOrderNumber.value = text
  } finally {
    showResultDialog.value = true
    isProcessing.value = false
  }
}

function onScanFailure() {
  // 과도한 로그/토스트 방지를 위해 무시
}

/* =========================
   가시성 변화 대응(탭 이동)
========================= */
function handleVisibility() {
  if (document.hidden) {
    if (isScanning.value) togglePause().catch(() => {})
  } else if (scanner.value && paused.value) {
    togglePause().catch(() => {})
  }
}

/* =========================
   수동 입력
========================= */
const manualOrderNumber   = ref('')
const isManualProcessing  = ref(false)

async function handleManualSubmit() {
  const orderNum = manualOrderNumber.value.trim()
  if (!orderNum || isManualProcessing.value) return
  if (!isValidOrder(orderNum)) {
    resultType.value = 'error'
    resultMessage.value = '주문번호 형식이 올바르지 않습니다.'
    resultOrderNumber.value = orderNum
    showResultDialog.value = true
    
    return
  }

  try {
    isManualProcessing.value = true
    await startShipping(orderNum)

    resultType.value = 'success'
    resultMessage.value = '배송이 시작되었습니다'
    resultOrderNumber.value = orderNum
    showResultDialog.value = true
    manualOrderNumber.value = ''
  } catch (err) {
    console.error('배송 시작 실패:', err)
    resultType.value = 'error'
    resultMessage.value = err?.message || '배송 시작에 실패했습니다.'
    resultOrderNumber.value = orderNum
    showResultDialog.value = true
  } finally {
    isManualProcessing.value = false
  }
}

/* =========================
   결과 닫기 → 카메라 재시작
========================= */
function closeResultDialog() {
  showResultDialog.value = false
  resultMessage.value = ''
  resultOrderNumber.value = ''
  if (resultType.value === 'success') {
    setTimeout(() => { startCamera() }, 300)
  }
}

/* =========================
   라이프사이클
========================= */
onMounted(async () => {
  await enumerateCameras()
  await startCamera()
  document.addEventListener('visibilitychange', handleVisibility)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibility)
  stopCamera()
})
</script>

<template>
  <div class="page start-shipping">
    <!-- 헤더 -->
    <div class="header">
      <div class="header-left">
        <h6 class="title">
          배송 시작
        </h6>
        <p class="desc">
          QR 스캔 또는 주문번호 입력으로 배송을 시작하세요.
        </p>
      </div>
      <div class="header-right hidden-sm-and-down" />
    </div>

    <div class="grid">
      <!-- 스캐너 -->
      <VCard class="panel scanner">
        <VCardText class="px-6 pt-5 pb-2">
          <div class="panel-head">
            <div class="panel-title">
              <VIcon
                icon="bx-qr-scan"
                class="mr-2"
              /> QR 코드 스캔
            </div>

            <!-- 카메라 컨트롤 -->
            <div class="controls">
              <VSelect
                v-model="selectedCameraId"
                :items="cameras.map(c => ({ title: c.label || 'Camera', value: c.id }))"
                density="comfortable"
                variant="outlined"
                hide-details
                style="min-width: 220px"
                placeholder="카메라 선택"
                @update:model-value="switchCamera"
              />
              <VBtn
                v-if="torchAvailable"
                :color="torchOn ? 'warning' : 'default'"
                variant="tonal"
                @click="toggleTorch"
              >
                <VIcon
                  :icon="torchOn ? 'bx-bulb' : 'bx-bulb'"
                  start
                />
                {{ torchOn ? '토치 끄기' : '토치 켜기' }}
              </VBtn>
              <VBtn
                color="error"
                variant="tonal"
                @click="stopCamera"
              >
                <VIcon
                  start
                  icon="bx-stop"
                /> 중지
              </VBtn>
              <VBtn
                color="primary"
                variant="flat"
                class="ml-1"
                @click="startCamera"
              >
                <VIcon
                  start
                  icon="bx-video"
                /> 시작
              </VBtn>
            </div>
          </div>

          <VAlert
            v-if="scanError"
            type="warning"
            variant="tonal"
            class="mb-4"
          >
            <div class="d-flex align-center justify-space-between">
              <span>{{ scanError }}</span>
              <VBtn
                size="small"
                color="primary"
                variant="text"
                @click="startCamera"
              >
                다시 시도
              </VBtn>
            </div>
          </VAlert>

          <div class="scanner-wrap">
            <div
              id="reader"
              class="qr-scanner"
            />
            <div
              v-if="!isScanning && !isProcessing"
              class="placeholder"
            >
              <VIcon
                icon="bx-qr"
                size="120"
              />
              <p class="mt-3 text-medium-emphasis">
                카메라를 시작하면 자동으로 스캔합니다.
              </p>
            </div>

            <!-- 커스텀 스캔 프레임 -->
            <div
              v-if="isScanning"
              class="overlay"
            >
              <div class="frame">
                <div class="beam" />
              </div>
              <div class="corner tl" />
              <div class="corner tr" />
              <div class="corner bl" />
              <div class="corner br" />
            </div>
          </div>
        </VCardText>
      </VCard>

      <!-- 수동 입력 -->
      <VCard class="panel manual">
        <VCardText class="px-6 py-5">
          <div class="panel-title mb-4">
            <VIcon
              icon="bx-keyboard"
              class="mr-2"
            /> 수동 입력
          </div>

          <VTextField
            v-model="manualOrderNumber"
            label="주문번호"
            placeholder="예) SO-240915-001"
            variant="outlined"
            density="comfortable"
            hide-details="auto"
            class="mb-3"
            maxlength="32"
            :rules="[v => !v || /^[A-Za-z0-9\-]{4,32}$/.test(v) || '주문번호 형식이 올바르지 않습니다.']"
            @keyup.enter="handleManualSubmit"
          />
          <VBtn
            color="primary"
            variant="flat"
            size="large"
            block
            :loading="isManualProcessing"
            :disabled="!manualOrderNumber.trim()"
            @click="handleManualSubmit"
          >
            <VIcon
              start
              icon="bx-log-out"
            /> 배송 시작
          </VBtn>

          <VDivider class="my-6" />

          <div class="hints">
            <VIcon
              icon="bx-info-circle"
              class="mr-1"
            />
            팁: 빛 반사가 심하면 토치를 끄고, 카메라를 QR에 평행하게 맞춰주세요.
          </div>
        </VCardText>
      </VCard>
    </div>

    <!-- 결과 다이얼로그 -->
    <VDialog
      v-model="showResultDialog"
      max-width="460"
      persistent
    >
      <VCard class="elevation-0">
        <VCardTitle class="text-center pa-7 pb-3">
          <VAvatar
            :color="resultType === 'success' ? 'success' : 'error'"
            size="72"
            class="mb-4"
          >
            <VIcon
              :icon="resultType === 'success' ? 'bx-check' : 'bx-x'"
              size="44"
            />
          </VAvatar>
          <div
            class="text-h5 font-weight-bold"
            :class="resultType === 'success' ? 'text-success' : 'text-error'"
          >
            {{ resultMessage }}
          </div>
        </VCardTitle>

        <VCardText class="text-center px-7 pb-1">
          <div class="result-box">
            <div class="text-body-2 text-medium-emphasis mb-2">
              주문번호
            </div>
            <div class="text-h5 font-weight-bold">
              #{{ resultOrderNumber }}
            </div>
          </div>
        </VCardText>

        <VCardActions class="justify-center pb-6">
          <VBtn
            :color="resultType === 'success' ? 'success' : 'error'"
            variant="flat"
            size="large"
            min-width="120"
            @click="closeResultDialog"
          >
            확인
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.page.start-shipping {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px 12px;
}

.header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  color: rgb(var(--v-theme-on-surface));
}

.desc {
  margin: 6px 0 0;
  font-size: 0.92rem;
  color: rgba(var(--v-theme-on-surface), 0.68);
}

.grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
  align-items: start;
}

.panel {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
  overflow: hidden;
}

.panel .panel-title {
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  display: flex;
  align-items: center;
  font-size: 1rem;
}

.panel.scanner .panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.panel.scanner .controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.scanner-wrap {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(var(--v-theme-on-surface), 0.03), rgba(var(--v-theme-on-surface), 0.06));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  height: 500px;
}

.qr-scanner {
  width: 100% !important;
  height: 500px !important;
  position: relative;
  z-index: 1;
}

.qr-scanner video,
.qr-scanner canvas {
  width: 100% !important;
  height: 500px !important;
  display: block !important;
  object-fit: cover !important;
}

/* 기본 qrbox 숨김 */
.qr-scanner :deep(#qr-shaded-region) { display: none !important; }

/* 플레이스홀더 */
.placeholder {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  opacity: .5; z-index: 0;
}

/* 오버레이(프레임 & 라인 애니메) */
.overlay { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
.frame {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: min(64%, 420px); aspect-ratio: 1;
}
.beam {
  position: absolute; left: 8%; right: 8%;
  height: 2px; background: rgba(33,150,243,.8);
  animation: beam 2.2s ease-in-out infinite;
}
@keyframes beam {
  0% { top: 10%; opacity: .2; }
  50% { top: 90%; opacity: .8; }
  100% { top: 10%; opacity: .2; }
}

.corner { position: absolute; width: 46px; height: 46px; border: 4px solid rgb(33,150,243); }
.corner.tl { top: calc(50% - min(32%, 210px)); left: calc(50% - min(32%, 210px)); border-right: 0; border-bottom: 0; border-radius: 14px 0 0 0; }
.corner.tr { top: calc(50% - min(32%, 210px)); right: calc(50% - min(32%, 210px)); border-left: 0; border-bottom: 0; border-radius: 0 14px 0 0; }
.corner.bl { bottom: calc(50% - min(32%, 210px)); left: calc(50% - min(32%, 210px)); border-right: 0; border-top: 0; border-radius: 0 0 0 14px; }
.corner.br { bottom: calc(50% - min(32%, 210px)); right: calc(50% - min(32%, 210px)); border-left: 0; border-top: 0; border-radius: 0 0 14px 0; }

/* 결과 박스 */
.result-box {
  background: rgba(var(--v-theme-on-surface), .04);
  border: 1px solid rgba(var(--v-theme-on-surface), .08);
  border-radius: 10px;
  padding: 18px;
}

/* 힌트 */
.hints { font-size: .9rem; color: rgba(var(--v-theme-on-surface), .7); display: flex; align-items: center; }

/* 반응형 */
@media (max-width: 1080px) {
  .grid { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .page.start-shipping { padding: 16px; gap: 14px; }
  .scanner-wrap { height: 320px !important; }
  .qr-scanner { height: 320px !important; }
  .qr-scanner video,
  .qr-scanner canvas { height: 320px !important; }
}
</style>
