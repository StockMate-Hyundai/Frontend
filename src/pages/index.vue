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
  <div class="dashboard">
    <!-- 헤더 KPI -->
    <VCard class="px-5 py-4 mb-5">
      <div class="d-flex flex-wrap align-center justify-space-between gap-4">
        <div class="d-flex align-center gap-3">
          <VIcon icon="bx-bar-chart-alt-2" size="28" class="text-primary" />
          <div class="text-h6">실시간 대시보드</div>
          <VChip size="small" variant="tonal">Today</VChip>
        </div>
        <div class="d-flex align-center gap-3">
          <VBtn variant="tonal" color="primary"><VIcon start icon="bx-log-in"/>입고 처리</VBtn>
          <VBtn variant="tonal" color="info"><VIcon start icon="bx-log-out"/>출고 처리</VBtn>
        </div>
      </div>
    </VCard>

    <!-- KPI -->
    <div class="grid-5 gap-4 mb-5">
      <VCard v-for="(v,k) in {
        todayInbound:'오늘 입고',
        todayOutbound:'오늘 출고',
        inTransit:'이동 중',
        criticalAlerts:'긴급 알림',
        totalRevenue:'금일 매출'
      }" :key="k" class="px-4 py-3">
        <div class="d-flex align-center justify-space-between">
          <div>
            <div class="text-caption text-medium-emphasis">{{ v }}</div>
            <div class="text-h5 mt-1">
              <template v-if="k==='totalRevenue'">₩{{ nf.format(kpi[k]) }}</template>
              <template v-else>{{ nf.format(kpi[k]) }}건</template>
            </div>
          </div>
          <VAvatar variant="tonal" :color="k==='todayInbound'?'primary':k==='todayOutbound'?'info':k==='inTransit'?'warning':k==='totalRevenue'?'success':'error'">
            <VIcon :icon="k==='totalRevenue'?'bx-wallet':k==='todayInbound'?'bx-log-in':k==='todayOutbound'?'bx-log-out':k==='inTransit'?'bx-transfer':'bx-error-alt'" />
          </VAvatar>
        </div>
        <VueApexCharts :series="sparkSeries" :options="sparkOptions" height="60" type="line" class="mt-2" />
      </VCard>
    </div>

    <!-- ✦ 오늘 입출고 추이 -->
    <VCard class="px-5 py-4 mb-5">
      <div class="text-subtitle-1 mb-2">✦ 오늘 시간대별 입출고 추이</div>
      <VueApexCharts height="300" type="line" :options="lineOptions" :series="dailySeries" />
    </VCard>

    <!-- ✦ 거점/카테고리 -->
    <div class="grid-2 gap-4 mb-5">
      <VCard class="px-5 py-4">
        <div class="text-subtitle-1 mb-2">✦ 거점별 재고 비중</div>
        <VueApexCharts height="300" type="donut" :options="donutOptions" :series="siteInventory" />
      </VCard>
      <VCard class="px-5 py-4">
        <div class="text-subtitle-1 mb-2">✦ 카테고리별 판매량</div>
        <VueApexCharts height="300" type="bar" :options="barOptions" :series="[{ name:'판매', data:categorySales }]" />
      </VCard>
    </div>

    <!-- ✦ 알림 / 처리 이력 / Top 판매 -->
    <div class="grid-3 gap-4">
      <VCard class="px-4 py-3">
        <div class="text-subtitle-1 mb-3 d-flex align-center gap-2"><VIcon icon="bx-bell" class="text-warning" /> 실시간 알림</div>
        <!-- <VAlert v-for="a in alerts" :key="a.id" :type="a.type" variant="outlined" class="mb-2" :title="a.title" :text="a.text" /> -->
      </VCard>

      <VCard class="px-4 py-3">
        <div class="text-subtitle-1 mb-3 d-flex align-center gap-2"><VIcon icon="bx-time-five" class="text-info" /> 최근 처리 이력</div>
        <VTable density="compact">
          <thead>
            <tr><th>시간</th><th>구분</th><th>부품</th><th class="text-right">수량</th><th>담당</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in recent" :key="r.time+r.part">
              <td>{{ r.time }}</td>
              <td><VChip size="x-small" :color="chipColor(r.type)" variant="tonal">{{ r.type }}</VChip></td>
              <td class="text-truncate">{{ r.part }}</td>
              <td class="text-right">{{ nf.format(r.qty) }}</td>
              <td>{{ r.owner }}</td>
            </tr>
          </tbody>
        </VTable>
      </VCard>

      <VCard class="px-4 py-3">
        <div class="text-subtitle-1 mb-3 d-flex align-center gap-2"><VIcon icon="bx-trending-up" class="text-success" /> Top 판매 부품</div>
        <VTable density="compact">
          <thead>
            <tr><th>부품명</th><th class="text-right">판매수량</th><th class="text-right">매출</th></tr>
          </thead>
          <tbody>
            <tr v-for="t in topSales" :key="t.name">
              <td>{{ t.name }}</td>
              <td class="text-right">{{ nf.format(t.qty) }}</td>
              <td class="text-right">₩{{ nf.format(t.revenue) }}</td>
            </tr>
          </tbody>
        </VTable>
      </VCard>
    </div>
  </div>
</template>

<style scoped>
.dashboard{ max-width:1440px; margin-inline:auto; }
.grid-5{ display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:16px; }
.grid-3{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; }
.grid-2{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
.gap-4{ gap:16px; }
@media (max-width:1300px){ .grid-5{ grid-template-columns:repeat(3,1fr);} .grid-3{ grid-template-columns:repeat(2,1fr);} }
@media (max-width:960px){ .grid-5{ grid-template-columns:repeat(2,1fr);} .grid-3,.grid-2{ grid-template-columns:1fr;} }
.text-subtitle-1{ font-weight:700; color:#111827; }
</style>
