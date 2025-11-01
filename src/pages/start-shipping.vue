<!-- File: src/pages/start-shipping.vue -->
<script setup>
definePage({
  meta: {
    title: '배송 시작',
    icon: 'bx-package',
    requiresAuth: true,
  },
})
import { startShipping } from '@/api/order'
import { Html5Qrcode } from 'html5-qrcode'
import { onMounted, onUnmounted, ref } from 'vue'

/* 상태 */
const scanner = ref(null)
const isScanning = ref(false)
const scanError = ref('')
const successMessage = ref('')
const errorMessage = ref('')
const isProcessing = ref(false)

/* 카메라 시작 */
async function startCamera() {
  try {
    scanError.value = ''
    successMessage.value = ''
    errorMessage.value = ''
    
    console.log('카메라 시작 시도...')
    
    console.log('HTML5 QR 스캐너 초기화 중...')
    scanner.value = new Html5Qrcode('reader')
    
    const cameraConfig = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
    }
    
    console.log('HTML5 QR 스캐너 시작 중...')
    
    // HTML5 QR Code가 권한 팝업을 트리거하고 카메라를 시작합니다
    await scanner.value.start(
      { facingMode: 'environment' },
      cameraConfig,
      onScanSuccess,
      onScanFailure,
    )
    
    console.log('카메라 시작 성공!')
    isScanning.value = true
  } catch (err) {
    console.error('카메라 시작 실패:', err)
    console.error('에러 상세:', err.message, err.name, err.stack)
    
    // 에러 타입에 따라 다른 메시지 표시
    const errorMsg = err?.message || err?.name || ''
    
    if (errorMsg.includes('Permission denied') || errorMsg.includes('NotAllowedError')) {
      scanError.value = '카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.'
    } else if (errorMsg.includes('not found') || errorMsg.includes('NotFoundError')) {
      scanError.value = '카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.'
    } else if (errorMsg.includes('NotReadableError') || errorMsg.includes('could not start')) {
      scanError.value = '카메라에 접근할 수 없습니다. 다른 프로그램에서 카메라를 사용 중일 수 있습니다.'
    } else {
      scanError.value = `카메라를 시작할 수 없습니다: ${errorMsg || '알 수 없는 오류'}`
    }
    
    isScanning.value = false
  }
}

/* 카메라 중지 */
function stopCamera() {
  if (scanner.value) {
    scanner.value.stop().then(() => {
      scanner.value.clear()
      scanner.value = null
      isScanning.value = false
    }).catch(err => {
      console.error('카메라 중지 실패:', err)
    })
  }
}

/* QR 코드 인식 성공 */
async function onScanSuccess(decodedText, decodedResult) {
  if (isProcessing.value) return
  
  try {
    isProcessing.value = true
    stopCamera()
    
    // API 호출
    const result = await startShipping(decodedText)
    
    successMessage.value = `배송이 시작되었습니다: ${decodedText}`
    errorMessage.value = ''
    
    // 2초 후 다시 스캔 가능하도록
    setTimeout(() => {
      isProcessing.value = false
      successMessage.value = ''
      startCamera()
    }, 2000)
    
  } catch (err) {
    console.error('배송 시작 실패:', err)
    errorMessage.value = err?.message || '배송 시작에 실패했습니다.'
    successMessage.value = ''
    isProcessing.value = false
    
    // 3초 후 다시 시작
    setTimeout(() => {
      errorMessage.value = ''
      startCamera()
    }, 3000)
  }
}

/* QR 코드 인식 실패 */
function onScanFailure(error) {
  // 에러 메시지를 표시하지 않음 (너무 많이 출력됨)
}

/* 컴포넌트 언마운트 시 카메라 중지 */
onUnmounted(() => {
  stopCamera()
})

/* 수동 입력 처리 */
const manualOrderNumber = ref('')
const isManualProcessing = ref(false)

async function handleManualSubmit() {
  if (!manualOrderNumber.value.trim() || isManualProcessing.value) return
  
  try {
    isManualProcessing.value = true
    errorMessage.value = ''
    successMessage.value = ''
    
    const result = await startShipping(manualOrderNumber.value.trim())
    
    successMessage.value = `배송이 시작되었습니다: ${manualOrderNumber.value.trim()}`
    manualOrderNumber.value = ''
    
  } catch (err) {
    console.error('배송 시작 실패:', err)
    errorMessage.value = err?.message || '배송 시작에 실패했습니다.'
  } finally {
    isManualProcessing.value = false
  }
}

/* QR 코드 형식 정리 */
function formatOrderNumber(text) {
  // "#" 제거 또는 기타 정리
  return text.replace(/^#/, '').trim()
}

/* 페이지 로드 시 초기화 */
onMounted(() => {
  // 자동 시작하지 않음 - 사용자가 버튼을 눌러 시작
})
</script>

<template>
  <div class="page-container">
    <div class="start-shipping-wrapper">
      <VCard class="scanner-card">
        <VCardTitle class="text-center pa-6">
          <VIcon
            icon="bx-truck"
            size="48"
            color="primary"
            class="mb-3"
          />
          <div class="text-h5 mb-1">
            배송 시작
          </div>
          <div class="text-body-2 text-medium-emphasis">
            인보이스의 QR 코드를 스캔하세요
          </div>
        </VCardTitle>

        <VCardText class="text-center pa-6 pt-0">
          <!-- 에러 메시지 -->
          <VAlert
            v-if="errorMessage"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ errorMessage }}
          </VAlert>

          <!-- 성공 메시지 -->
          <VAlert
            v-if="successMessage"
            type="success"
            variant="tonal"
            class="mb-4"
          >
            {{ successMessage }}
          </VAlert>

          <!-- 카메라 권한 에러 -->
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

          <!-- QR 스캐너 영역 -->
          <div class="scanner-container">
            <div
              id="reader"
              class="qr-scanner"
            />
            <div
              v-if="!isScanning && !isProcessing"
              class="qr-scanner-placeholder"
            >
              <VIcon
                icon="bx-camera"
                size="64"
                color="grey"
              />
              <div class="text-body-1 text-medium-emphasis mt-4">
                카메라를 시작하려면 아래 버튼을 클릭하세요
              </div>
            </div>

            <!-- 스캔 가이드 오버레이 -->
            <div
              v-if="isScanning"
              class="scan-overlay"
            >
              <div class="scan-frame" />
              <div class="scan-corner scan-corner-tl" />
              <div class="scan-corner scan-corner-tr" />
              <div class="scan-corner scan-corner-bl" />
              <div class="scan-corner scan-corner-br" />
            </div>
          </div>

          <!-- 카메라 제어 버튼 -->
          <div class="camera-controls mt-4">
            <VBtn
              v-if="!isScanning && !isProcessing"
              color="primary"
              size="large"
              @click="startCamera"
            >
              <VIcon
                start
                icon="bx-video"
              />
              카메라 시작
            </VBtn>
            <VBtn
              v-else
              color="error"
              size="large"
              @click="stopCamera"
            >
              <VIcon
                start
                icon="bx-stop"
              />
              카메라 중지
            </VBtn>
          </div>
        </VCardText>
      </VCard>

      <!-- 수동 입력 섹션 -->
      <VCard class="manual-card mt-4">
        <VCardTitle class="pa-4">
          <div class="text-subtitle-1">
            수동 입력
          </div>
        </VCardTitle>
        <VCardText class="pa-4 pt-0">
          <div class="d-flex gap-2">
            <VTextField
              v-model="manualOrderNumber"
              label="주문번호 입력"
              placeholder="#123456"
              variant="outlined"
              density="comfortable"
              hide-details
              class="flex-grow-1"
              @keyup.enter="handleManualSubmit"
            />
            <VBtn
              color="primary"
              variant="elevated"
              :loading="isManualProcessing"
              :disabled="!manualOrderNumber.trim()"
              @click="handleManualSubmit"
            >
              <VIcon
                start
                icon="bx-check"
              />
              시작
            </VBtn>
          </div>
        </VCardText>
      </VCard>
    </div>
  </div>
</template>

<style scoped>
.page-container {
  min-height: calc(100vh - 120px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--erp-bg-primary);
}

.start-shipping-wrapper {
  width: 100%;
  max-width: 600px;
}

.scanner-card,
.manual-card {
  border-radius: 16px;
}

.scanner-container {
  position: relative;
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  border-radius: 12px;
  overflow: hidden;
  background: var(--erp-bg-secondary);
}

.qr-scanner {
  width: 100% !important;
  min-height: 300px !important;
  position: relative;
  z-index: 1;
}

/* html5-qrcode가 추가하는 내부 요소들 스타일링 */
.qr-scanner video,
.qr-scanner canvas {
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
  display: block !important;
}

.qr-scanner-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--erp-bg-tertiary);
  border-radius: 12px;
  z-index: 0;
}

.scan-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.scan-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 250px;
  height: 250px;
  border: 2px solid rgba(33, 150, 243, 0.3);
  border-radius: 12px;
}

.scan-corner {
  position: absolute;
  width: 24px;
  height: 24px;
  border: 3px solid rgb(33, 150, 243);
}

.scan-corner-tl {
  top: calc(50% - 125px);
  left: calc(50% - 125px);
  border-right: none;
  border-bottom: none;
  border-radius: 12px 0 0 0;
}

.scan-corner-tr {
  top: calc(50% - 125px);
  right: calc(50% - 125px);
  border-left: none;
  border-bottom: none;
  border-radius: 0 12px 0 0;
}

.scan-corner-bl {
  bottom: calc(50% - 125px);
  left: calc(50% - 125px);
  border-right: none;
  border-top: none;
  border-radius: 0 0 0 12px;
}

.scan-corner-br {
  bottom: calc(50% - 125px);
  right: calc(50% - 125px);
  border-left: none;
  border-top: none;
  border-radius: 0 0 12px 0;
}

.camera-controls {
  display: flex;
  justify-content: center;
}

.manual-card {
  background: var(--erp-bg-secondary);
}

@media (max-width: 600px) {
  .qr-scanner,
  .qr-scanner-placeholder {
    min-height: 250px;
  }

  .scan-frame {
    width: 200px;
    height: 200px;
  }

  .scan-corner {
    width: 20px;
    height: 20px;
  }
}
</style>

