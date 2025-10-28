<!-- File: src/pages/DashboardOverview.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import VueApexCharts from 'vue3-apexcharts'

/* ===== KPI (오늘) ===== */
const kpi = ref({
  todayInbound: 18,
  todayOutbound: 22,
  inTransit: 7,
  criticalAlerts: 3,
  totalRevenue: 158_200_000,
})

/* ===== 실시간 처리량 스파크라인 ===== */
const sparkSeries = [{ name: '처리량', data: [2,3,4,5,3,6,5,4,7,6,5,8] }]
const sparkOptions = {
  chart: { type: 'line', sparkline: { enabled: true } },
  stroke: { width: 3, curve: 'smooth' },
  colors: ['#2563eb'],
}

/* ===== 오늘 입출고 추이 ===== */
const hours = ['09','10','11','12','13','14','15','16','17']
const dailySeries = ref([
  { name:'입고', data:[2,3,4,5,4,5,3,2,1] },
  { name:'출고', data:[1,2,3,4,5,6,7,6,5] },
])
const lineOptions = {
  chart:{ type:'line', toolbar:{ show:false } },
  stroke:{ width:3, curve:'smooth' },
  markers:{ size:3 },
  xaxis:{ categories:hours, title:{ text:'시간' } },
  tooltip:{ y:{ formatter:(v:number)=>`${v}건` } },
  colors:['#4f8cff','#60c5a8'],
}

/* ===== 거점별 재고(도넛) ===== */
const sites = ['본사창고','동부물류','서부물류','남부물류','협력창고']
const siteInventory = ref([480,320,220,200,140])
const donutOptions = {
  chart:{ type:'donut' },
  labels: sites,
  colors:['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6'],
  legend:{ position:'right' },
  plotOptions:{ pie:{ donut:{ size:'68%' } } },
  tooltip:{ y:{ formatter:(v:number)=> `${v}ea` } },
}

/* ===== 부품 카테고리별 판매 비중 ===== */
const categories = ['엔진', '브레이크', '전장', '소모품']
const categorySales = ref([820,640,420,300])
const barOptions = {
  chart:{ type:'bar', toolbar:{ show:false } },
  plotOptions:{ bar:{ columnWidth:'45%', borderRadius:6 } },
  xaxis:{ categories, axisBorder:{show:false}, axisTicks:{show:false} },
  colors:['#4f8cff'],
  tooltip:{ y:{ formatter:(v:number)=>`${v}건` } },
}

/* ===== 실시간 알림 ===== */
const alerts = ref([
  { id: 'A-01', type: 'warning', title: '안전재고 이하', text: '연료필터 C, 잔여 7ea (분당지점)' },
  { id: 'A-02', type: 'error',   title: '출고 지연',   text: 'BR-12 브레이크 패드, 2시간 초과' },
  { id: 'A-03', type: 'info',    title: '입고 완료',   text: '타이밍 벨트 TB-15, 본사 창고' },
])

/* ===== 최근 처리 이력 ===== */
type Row = { time:string; type:'입고'|'출고'|'이동'; part:string; qty:number; owner:string }
const recent = ref<Row[]>([
  { time:'15:21', type:'출고', part:'BR-12 브레이크 패드', qty:12, owner:'박성호' },
  { time:'15:05', type:'입고', part:'HX-20 오일필터 A',   qty:30, owner:'김유진' },
  { time:'14:52', type:'이동', part:'AF-33 에어필터 B',   qty:10, owner:'최지훈' },
  { time:'14:41', type:'출고', part:'W-26 와이퍼',        qty:20, owner:'이지수' },
])

/* ===== Top 부품 판매 ===== */
const topSales = ref([
  { name:'오일필터 A', qty:190, revenue:2_375_000 },
  { name:'오일필터 A', qty:190, revenue:2_375_000 },
  { name:'오일필터 A', qty:190, revenue:2_375_000 },
  { name:'브레이크 패드', qty:154, revenue:6_468_000 },
  { name:'와이퍼 블레이드', qty:141, revenue:1_382_000 },
])

const nf = new Intl.NumberFormat('ko-KR')
const chipColor = (t:Row['type']) => t==='입고'?'primary':t==='출고'?'info':'warning'
onMounted(()=>{})
</script>

<template>
  <div class="page-container dashboard-page">
    <!-- 헤더 섹션 -->
    <div class="filter-section">
      <div class="d-flex flex-wrap align-center justify-space-between gap-4">
        <div class="d-flex align-center gap-3">
          <VIcon icon="bx-bar-chart-alt-2" size="24" class="text-primary" />
          <div class="text-h6 text-high-emphasis">실시간 대시보드</div>
          <VChip size="small" variant="tonal" color="primary">Today</VChip>
        </div>
        <div class="d-flex align-center gap-3">
          <VBtn variant="flat" color="primary" size="small">
            <VIcon start icon="bx-log-in" size="16"/>
            입고 처리
          </VBtn>
          <VBtn variant="flat" color="info" size="small">
            <VIcon start icon="bx-log-out" size="16"/>
            출고 처리
          </VBtn>
        </div>
      </div>
    </div>

    <!-- 메인 콘텐츠 영역 -->
    <div class="dashboard-content">
      <!-- KPI 카드들 -->
      <div class="kpi-section">
        <div class="grid-5 gap-3">
          <VCard v-for="(v,k) in {
            todayInbound:'오늘 입고',
            todayOutbound:'오늘 출고',
            inTransit:'이동 중',
            criticalAlerts:'긴급 알림',
            totalRevenue:'금일 매출'
          }" :key="k" class="kpi-card">
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-caption text-medium-emphasis">{{ v }}</div>
                <div class="text-h6 mt-1">
                  <template v-if="k==='totalRevenue'">₩{{ nf.format(kpi[k]) }}</template>
                  <template v-else>{{ nf.format(kpi[k]) }}건</template>
                </div>
              </div>
              <VAvatar 
                size="40"
                variant="tonal" 
                :color="k==='todayInbound'?'primary':k==='todayOutbound'?'info':k==='inTransit'?'warning':k==='totalRevenue'?'success':'error'"
              >
                <VIcon 
                  :icon="k==='totalRevenue'?'bx-wallet':k==='todayInbound'?'bx-log-in':k==='todayOutbound'?'bx-log-out':k==='inTransit'?'bx-transfer':'bx-error-alt'" 
                  size="20"
                />
              </VAvatar>
            </div>
            <VueApexCharts :series="sparkSeries" :options="sparkOptions" height="50" type="line" class="mt-2" />
          </VCard>
        </div>
      </div>

      <!-- 차트 섹션 -->
      <div class="charts-section">
        <!-- 입출고 추이 차트 -->
        <VCard class="chart-card">
          <VCardTitle class="text-subtitle-1 text-high-emphasis">
            <VIcon icon="bx-trending-up" size="18" class="me-2" />
            오늘 시간대별 입출고 추이
          </VCardTitle>
          <VCardText class="pt-0">
            <VueApexCharts height="280" type="line" :options="lineOptions" :series="dailySeries" />
          </VCardText>
        </VCard>

        <!-- 거점/카테고리 차트 -->
        <div class="grid-2 gap-3">
          <VCard class="chart-card">
            <VCardTitle class="text-subtitle-1 text-high-emphasis">
              <VIcon icon="bx-package" size="18" class="me-2" />
              거점별 재고 비중
            </VCardTitle>
            <VCardText class="pt-0">
              <VueApexCharts height="280" type="donut" :options="donutOptions" :series="siteInventory" />
            </VCardText>
          </VCard>
          
          <VCard class="chart-card">
            <VCardTitle class="text-subtitle-1 text-high-emphasis">
              <VIcon icon="bx-bar-chart" size="18" class="me-2" />
              카테고리별 판매량
            </VCardTitle>
            <VCardText class="pt-0">
              <VueApexCharts height="280" type="bar" :options="barOptions" :series="[{ name:'판매', data:categorySales }]" />
            </VCardText>
          </VCard>
        </div>
      </div>

      <!-- 테이블 섹션 -->
      <div class="tables-section">
        <div class="grid-2 gap-3">
          <!-- 최근 처리 이력 -->
          <VCard class="table-card">
            <VCardTitle class="text-subtitle-1 text-high-emphasis">
              <VIcon icon="bx-time-five" size="18" class="me-2" />
              최근 처리 이력
            </VCardTitle>
            <VCardText class="pt-0">
              <VTable density="compact" class="erp-table">
                <thead>
                  <tr>
                    <th>시간</th>
                    <th>구분</th>
                    <th>부품</th>
                    <th class="text-right">수량</th>
                    <th>담당</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in recent" :key="r.time+r.part">
                    <td class="text-body-2">{{ r.time }}</td>
                    <td>
                      <VChip 
                        size="x-small" 
                        :color="chipColor(r.type)" 
                        variant="tonal"
                        class="status-chip"
                      >
                        {{ r.type }}
                      </VChip>
                    </td>
                    <td class="text-body-2 text-truncate">{{ r.part }}</td>
                    <td class="text-body-2 text-right">{{ nf.format(r.qty) }}</td>
                    <td class="text-body-2">{{ r.owner }}</td>
                  </tr>
                </tbody>
              </VTable>
            </VCardText>
          </VCard>

          <!-- Top 판매 부품 -->
          <VCard class="table-card">
            <VCardTitle class="text-subtitle-1 text-high-emphasis">
              <VIcon icon="bx-trending-up" size="18" class="me-2" />
              Top 판매 부품
            </VCardTitle>
            <VCardText class="pt-0">
              <VTable density="compact" class="erp-table">
                <thead>
                  <tr>
                    <th>부품명</th>
                    <th class="text-right">판매수량</th>
                    <th class="text-right">매출</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="t in topSales" :key="t.name">
                    <td class="text-body-2">{{ t.name }}</td>
                    <td class="text-body-2 text-right">{{ nf.format(t.qty) }}</td>
                    <td class="text-body-2 text-right font-weight-medium">₩{{ nf.format(t.revenue) }}</td>
                  </tr>
                </tbody>
              </VTable>
            </VCardText>
          </VCard>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 대시보드 레이아웃 */
.dashboard-content {
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: calc(100vh - 120px);
}

/* 그리드 시스템 */
.grid-5 { 
  display: grid; 
  grid-template-columns: repeat(5, minmax(0, 1fr)); 
  gap: 12px; 
}

.grid-2 { 
  display: grid; 
  grid-template-columns: repeat(2, minmax(0, 1fr)); 
  gap: 12px; 
}

.gap-3 { 
  gap: 12px; 
}

/* 섹션별 스타일 */
.kpi-section {
  flex-shrink: 0;
}

.charts-section {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tables-section {
  flex: 1;
  min-height: 0;
}

/* 카드 스타일 */
.kpi-card {
  padding: 16px;
  transition: all 0.2s ease;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--erp-shadow-md);
}

.chart-card {
  padding: 16px;
}

.table-card {
  padding: 16px;
  height: 100%;
}

/* 테이블 스타일 */
.erp-table {
  background: transparent;
}

.erp-table :deep(.v-table__head th) {
  background: var(--erp-bg-tertiary);
  color: var(--erp-text-secondary);
  font-weight: 600;
  font-size: 0.75rem;
  padding: 8px 12px;
  border-bottom: 1px solid var(--erp-border-light);
}

.erp-table :deep(.v-table__body tr) {
  border-bottom: 1px solid var(--erp-border-light);
}

.erp-table :deep(.v-table__body tr:hover) {
  background: var(--erp-bg-secondary);
}

.erp-table :deep(.v-table__body td) {
  padding: 8px 12px;
  color: var(--erp-text-primary);
  font-size: 0.75rem;
}

/* 상태 칩 스타일 */
.status-chip {
  font-weight: 500;
  font-size: 0.7rem;
}

/* 반응형 */
@media (max-width: 1300px) { 
  .grid-5 { 
    grid-template-columns: repeat(3, 1fr); 
  } 
}

@media (max-width: 960px) { 
  .grid-5 { 
    grid-template-columns: repeat(2, 1fr); 
  } 
  
  .grid-2 { 
    grid-template-columns: 1fr; 
  }
  
  .dashboard-content {
    padding: 12px 16px;
  }
}

@media (max-width: 600px) {
  .grid-5 { 
    grid-template-columns: 1fr; 
  }
}
</style>
