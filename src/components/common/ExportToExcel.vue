<script setup>
import { computed, ref } from 'vue'
import * as XLSX from 'xlsx'

/**
 * 재사용 가능한 엑셀 내보내기 버튼
 *
 * Props
 * - items?: Array<object>            // 이미 로드된 데이터(현재 화면 데이터)로 내보내기
 * - fields: Array<{ key, label }>    // 컬럼 매핑 (엑셀 헤더 정의)
 * - filename?: string                // 파일명 (기본: export-YYYYMMDD-HHmmss.xlsx)
 * - sheetName?: string               // 시트명 (기본: Sheet1)
 * - fetchAll?: () => Promise<Array<object>> // 전체 데이터 비동기 수집용(원하면 전달)
 * - transform?: (row) => object      // 한 행 변환(필드 후처리/포맷팅)
 *
 * Slots
 * - default: 버튼 커스텀 UI가 필요하면 슬롯으로 버튼을 대체 가능 (scoped { exporting })
 */

const props = defineProps({
  items: { type: Array, default: () => [] },
  fields: {
    type: Array,
    required: true, // [{ key: 'fullName', label: '이름' }, ...]
  },
  filename: { type: String, default: '' },
  sheetName: { type: String, default: 'Sheet1' },
  fetchAll: { type: Function, default: null },
  transform: { type: Function, default: null },
})

const emit = defineEmits(['exported', 'error'])

const exporting = ref(false)

const safeFilename = computed(() => {
  if (props.filename) return props.filename
  const pad = n => String(n).padStart(2, '0')
  const d = new Date()
  const tstamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  
  return `export-${tstamp}.xlsx`
})

function autoFitColumns(aoa) {
  // aoa: Array of Arrays (첫 줄은 헤더)
  const colCount = aoa[0]?.length ?? 0
  const widths = Array.from({ length: colCount }, () => ({ wch: 10 }))

  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < colCount; c++) {
      const cell = aoa[r]?.[c]
      const len = cell == null ? 0 : String(cell).length

      widths[c].wch = Math.max(widths[c].wch, len + 2) // padding
    }
  }
  
  return widths
}

async function onExport() {
  try {
    exporting.value = true

    // 1) 데이터 소스 결정: fetchAll → items
    let rows = []
    if (typeof props.fetchAll === 'function') {
      rows = await props.fetchAll()
    } else {
      rows = Array.isArray(props.items) ? props.items : []
    }

    // 2) fields 기준으로 매핑
    //    결과는 엑셀에 "label" 순서로 나감
    const mapped = rows.map(row => {
      // transform → fields 적용 전/후 원하는 위치에 써도 됨
      const src = typeof props.transform === 'function' ? props.transform(row) : row
      const obj = {}
      for (const f of props.fields) {
        obj[f.label] = src?.[f.key] ?? ''
      }
      
      return obj
    })

    if (!mapped.length) {
      emit('error', new Error('내보낼 데이터가 없습니다.'))
      exporting.value = false
      
      return
    }

    // 3) JSON → Sheet
    const ws = XLSX.utils.json_to_sheet(mapped, { skipHeader: false })

    // 3-1) 자동 컬럼 너비
    const header = props.fields.map(f => f.label)
    const body = mapped.map(row => header.map(h => row[h]))
    const aoa = [header, ...body]

    ws['!cols'] = autoFitColumns(aoa)

    // 4) 워크북/파일 저장
    const wb = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(wb, ws, props.sheetName || 'Sheet1')
    XLSX.writeFile(wb, safeFilename.value)

    emit('exported', { filename: safeFilename.value, count: mapped.length })
  } catch (err) {
    console.error('[ExportToExcel] error:', err)
    emit('error', err)
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <!-- 기본 버튼 제공. 커스텀이 필요하면 slot 사용 -->
  <slot
    :exporting="exporting"
    :export-fn="onExport"
  >
    <VBtn
      variant="tonal"
      color="secondary"
      prepend-icon="bx-export"
      :loading="exporting"
      @click="onExport"
    >
      내보내기
    </VBtn>
  </slot>
</template>
