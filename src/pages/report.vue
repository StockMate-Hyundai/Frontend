<!-- File: src/pages/MonthlyReportSneat.vue -->
<script setup lang="ts">
definePage({
  meta: {
    title: '리포트',
    icon: 'bx-bar-chart-alt-2',
    requiresAuth: true,
  },
})
import {
  getDailyCategorySalesReport,
  getDailyReport,
  getMonthlyReport,
  getTopSalesReport,
  getWarehouseReport,
  getWeeklyReport
} from '@/api/order'
import AppExportButton from '@/components/common/ExportToExcel.vue'
import { computed, onMounted, ref, watch } from 'vue'
import VueApexCharts from 'vue3-apexcharts'

/* ========== 공통 상태 ========== */
const monthItems = ref([
  { label: '2025-10', value: '2025-10' },
  { label: '2025-09', value: '2025-09' },
  { label: '2025-08', value: '2025-08' },
])
const month = ref('2025-10')
const generatedAt = ref(new Date())
const loading = ref(false)
const error = ref('')

/* ========== 핵심 KPI ========== */
const summary = ref({
  inbound: 0, outbound: 0, transfer: 0,
  cost: 0, value: 0,
  turnover: 0, leadtimeHr: 0,
})

type PartRow = { id:string; name:string; model:string; unitPrice:number; inQty?:number; outQty?:number }
const topInbound = ref<PartRow[]>([])
const topOutbound = ref<PartRow[]>([])

/* ========== 운영 데이터 ========== */
// 주차별 리포트 데이터
const weeks = ref([])
const stackedSeries = ref([
  { name:'주문', data:[] },
  { name:'출고', data:[] },
])

// 일자별 리포트 데이터
const days = ref([])
const dailySeries = ref([
  { name:'주문', data:[] },
  { name:'출고', data:[] },
])

// 창고별 리포트 데이터
const warehouseData = ref([])
const sites = ref(['A', 'B', 'C', 'D', 'E'])
const siteData = ref({
  total:[],
  inbound:[],
  outbound:[],
  transfer:[],
})

// TOP 매출/순이익 리포트 데이터
const topRevenueData = ref([])
const topProfitData = ref([])

/* ========== KPI/요약 계산 ========== */
const nf = new Intl.NumberFormat('ko-KR')
const cf = (v:number) => '₩' + nf.format(v)

const weeklyTotals = computed(() => weeks.value.map((_,i)=>
  (stackedSeries.value[0].data[i]||0)+(stackedSeries.value[1].data[i]||0)
))
const peakWeekIdx = computed(()=> {
  if (weeklyTotals.value.length === 0) return 0
  return weeklyTotals.value.indexOf(Math.max(...weeklyTotals.value))
})
const lowWeekIdx  = computed(()=> {
  if (weeklyTotals.value.length === 0) return 0
  return weeklyTotals.value.indexOf(Math.min(...weeklyTotals.value))
})
const peakWeek = computed(()=> weeks.value[peakWeekIdx.value] || '')
const lowWeek  = computed(()=> weeks.value[lowWeekIdx.value] || '')

const outInRatio = computed(() => {
  const sum=(a:number[])=>a.reduce((s,v)=>s+(v||0),0)
  const out=sum(stackedSeries.value[1].data)
  const inn=sum(stackedSeries.value[0].data)||1
  return (out/inn).toFixed(1)
})

const topSiteIdx = computed(()=> {
  if (siteData.value.total.length === 0) return 0
  return siteData.value.total.indexOf(Math.max(...siteData.value.total))
})
const topSite = computed(()=> sites.value[topSiteIdx.value] || '')
const siteShare = computed(()=> {
  const sum = siteData.value.total.reduce((s,v)=>s+v,0)||1
  if (siteData.value.total.length === 0) return '0'
  return (siteData.value.total[topSiteIdx.value]/sum*100).toFixed(1)
})

/* ========== 차트 옵션(담백톤) ========== */
const base = { chart:{ toolbar:{show:false}, foreColor:'#374151' }, grid:{ borderColor:'#e5e7eb' }, dataLabels:{ enabled:false }, legend:{ position:'top' } }

const stackedOptions = computed(() => ({
  ...base, chart:{ ...base.chart, type:'bar', stacked:true },
  plotOptions:{ bar:{ columnWidth:'40%', borderRadius:6 } },
  colors:['#4f8cff','#60c5a8'],
  xaxis:{ categories:weeks.value, axisBorder:{show:false}, axisTicks:{show:false} },
  yaxis:{ title:{ text:'건수', style:{ color:'#6b7280' } } },
}))

const lineOptions = (categories:string[]) => ({
  ...base, chart:{ ...base.chart, type:'line' },
  stroke:{ width:3, curve:'smooth' }, markers:{ size:3 },
  xaxis:{ categories, axisBorder:{show:false}, axisTicks:{show:false} },
  tooltip:{ y:{ formatter:(v:number)=> nf.format(v)+'건' } },
})

const lineOptionsMoney = (categories:string[]) => ({
  ...base, chart:{ ...base.chart, type:'line' },
  stroke:{ width:3, curve:'smooth' }, markers:{ size:3 },
  xaxis:{ categories, axisBorder:{show:false}, axisTicks:{show:false} },
  tooltip:{ y:{ formatter:(v:number)=> cf(v) } },
})

const donutOptions = computed(() => ({
  ...base, labels:sites.value, colors:['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6'],
  legend:{ position:'right' },
  plotOptions:{ pie:{ donut:{ size:'68%' } } },
  tooltip:{ y:{ formatter:(v:number)=> `${nf.format(v)}건` } },
}))

const siteStackedHBar = computed(() => ({
  ...base, chart:{ ...base.chart, type:'bar', stacked:true },
  plotOptions:{ bar:{ horizontal:true, borderRadius:6, barHeight:'58%' } },
  colors:['#4f8cff','#60c5a8'],
  xaxis:{ categories:sites.value, axisBorder:{show:false}, axisTicks:{show:false} },
}))

const barOptions = (categories:string[]) => ({
  ...base, chart:{ ...base.chart, type:'bar' },
  plotOptions:{ bar:{ columnWidth:'45%', borderRadius:6 } },
  xaxis:{ categories, axisBorder:{show:false}, axisTicks:{show:false} },
  colors:['#4f8cff'],
})

/* ========== 리포트 데이터 로딩 ========== */
const loadReportData = async () => {
  try {
    loading.value = true
    error.value = ''
    generatedAt.value = new Date()
    
    const [year, monthStr] = month.value.split('-')
    const monthNum = parseInt(monthStr, 10)
    
    // 모든 리포트 API 병렬 호출
    const [
      monthlyRes,
      weeklyRes,
      warehouseRes,
      topSalesRes,
      dailyRes,
      dailyCategoryRes
    ] = await Promise.all([
      getMonthlyReport(year, monthNum),
      getWeeklyReport(year, monthNum),
      getWarehouseReport(year, monthNum),
      getTopSalesReport(year, monthNum),
      getDailyReport(year, monthNum),
      getDailyCategorySalesReport(year, monthNum)
    ])
    
    // 월별 리포트 데이터 처리
    if (monthlyRes.success && monthlyRes.data) {
      summary.value = {
        inbound: monthlyRes.data.totalOrderCount || 0,
        outbound: monthlyRes.data.totalShippedCount || 0,
        transfer: 0, // API에 없음
        cost: monthlyRes.data.totalCost || 0,
        value: monthlyRes.data.totalRevenue || 0,
        turnover: 0, // API에 없음
        leadtimeHr: 0, // API에 없음
      }
    }
    
    // 주차별 리포트 데이터 처리
    if (weeklyRes.success && weeklyRes.data) {
      const weeksData = weeklyRes.data.weeks || []
      weeks.value = weeksData.map(w => w.weekLabel || '')
      stackedSeries.value = [
        { name:'주문', data: weeksData.map(w => w.totalOrderCount || 0) },
        { name:'출고', data: weeksData.map(w => w.totalShippedCount || 0) },
      ]
    }
    
    // 창고별 리포트 데이터 처리
    if (warehouseRes.success && warehouseRes.data) {
      const warehouses = warehouseRes.data.warehouses || []
      warehouseData.value = warehouses
      siteData.value = {
        total: warehouses.map(w => w.totalOrderCount || 0),
        inbound: [],
        outbound: warehouses.map(w => w.totalShippedCount || 0),
        transfer: [],
      }
    }
    
    // TOP 매출/순이익 리포트 데이터 처리
    if (topSalesRes.success && topSalesRes.data) {
      topRevenueData.value = topSalesRes.data.topRevenue || []
      topProfitData.value = topSalesRes.data.topProfit || []
      
      // Top Inbound/Outbound 데이터 업데이트
      topInbound.value = topRevenueData.value.slice(0, 5).map((item, idx) => ({
        id: `P-${item.partId}`,
        name: item.partName || '',
        model: item.categoryName || '',
        unitPrice: item.unitPrice || 0,
        inQty: item.quantity || 0,
      }))
      
      topOutbound.value = topProfitData.value.slice(0, 5).map((item, idx) => ({
        id: `P-${item.partId}`,
        name: item.partName || '',
        model: item.categoryName || '',
        unitPrice: item.unitPrice || 0,
        outQty: item.quantity || 0,
      }))
    }
    
    // 일자별 리포트 데이터 처리
    if (dailyRes.success && dailyRes.data) {
      const daysData = dailyRes.data.days || []
      days.value = daysData.map(d => d.date || '').slice(0, 7) // 최근 7일만
      dailySeries.value = [
        { name:'주문', data: daysData.map(d => d.totalOrderCount || 0).slice(0, 7) },
        { name:'출고', data: daysData.map(d => d.totalShippedCount || 0).slice(0, 7) },
      ]
    }
    
    // 일자별 카테고리별 판매량 처리
    if (dailyCategoryRes.success && dailyCategoryRes.data) {
      const daysData = dailyCategoryRes.data.days || []
      // 카테고리별 판매량 데이터는 차트에서 사용할 수 있도록 처리
      // 여기서는 일단 기본 구조만 유지
    }
    
  } catch (err) {
    console.error('리포트 데이터 로딩 오류:', err)
    error.value = '리포트 데이터를 불러오는데 실패했습니다.'
  } finally {
    loading.value = false
  }
}

/* ========== 월 변경시 데이터 재로딩 ========== */
watch(month, () => {
  loadReportData()
})

onMounted(() => {
  loadReportData()
})

// 카테고리별 판매 추이 (데모)
const categories = ['엔진', '브레이크', '전장', '소모품']
const categorySalesSeries = ref([
  { name:'엔진', data:[120,150,160,140,180,190,210] },
  { name:'브레이크', data:[100,110,120,105,130,125,140] },
  { name:'전장', data:[80,95,100,110,120,130,128] },
  { name:'소모품', data:[70,85,80,90,95,100,110] },
])
const topCategory = computed(() => {
  // 마지막 주 기준으로 가장 높은 카테고리
  const lastIndex = categorySalesSeries.value[0].data.length - 1
  const values = categorySalesSeries.value.map(s => s.data[lastIndex])
  const idx = values.indexOf(Math.max(...values))
  return categories[idx]
})
const growthRate = computed(() => 12.4) // 전월 대비 12.4% 증가 (데모)

// 매출 추이 (데모)
const salesDays = ['10/14','10/15','10/16','10/17','10/18','10/19','10/20']
const salesValues = ref([12000000,13500000,14000000,12500000,15000000,16200000,15700000])
const avgSales = computed(() => Math.round(salesValues.value.reduce((s,v)=>s+v,0)/salesValues.value.length))
const peakIdx = computed(()=> salesValues.value.indexOf(Math.max(...salesValues.value)))
const minIdx = computed(()=> salesValues.value.indexOf(Math.min(...salesValues.value)))
const peakSalesDate = computed(()=> salesDays[peakIdx.value])
const minSalesDate  = computed(()=> salesDays[minIdx.value])
const salesGrowth   = computed(()=> ((salesValues.value[peakIdx.value]-salesValues.value[minIdx.value]) / salesValues.value[minIdx.value] * 100).toFixed(1))

</script>

<template>
  <div class="page-container report-page">
    <!-- 헤더 -->
    <header class="hdr">
      <div class="l">
        <div class="ttl">월간 운영 리포트</div>
        <div class="meta">기준: <b>{{ month }}</b> · 생성: {{ generatedAt.toLocaleString('ko-KR') }}</div>
      </div>
      <div class="r">
        <VSelect v-model="month" :items="monthItems" variant="outlined" density="comfortable" hide-details style="min-width:140px" :disabled="loading" />
        <AppExportButton :filename="`부품관리_월간보고서_${month}.xlsx`" :rows="[...topInbound, ...topOutbound]"
          :fields="[{key:'id',label:'ID'},{key:'name',label:'부품명'},{key:'model',label:'모델'},{key:'unitPrice',label:'단가'}]"
          text="엑셀 다운로드" />
      </div>
    </header>

    <!-- 에러 메시지 -->
    <VAlert
      v-if="error"
      type="error"
      variant="tonal"
      closable
      @click:close="error = ''"
      class="mb-4"
    >
      {{ error }}
    </VAlert>

    <!-- 로딩 상태 -->
    <div v-if="loading" class="d-flex justify-center align-center" style="min-height: 400px;">
      <VProgressCircular indeterminate color="primary" size="64" />
    </div>

    <!-- [요약] 핵심 KPI -->
    <section class="card gap-lg" v-if="!loading">
      <div class="lead">✦ 이번 달 주문량은 <span class="accent">{{ nf.format(summary.inbound) }}</span>건, 출고량은 <span class="accent">{{ nf.format(summary.outbound) }}</span>건입니다.</div>
      <div class="kpi-grid">
        <div class="kpi"><div class="kcap">입고</div><div class="kval">{{ nf.format(summary.inbound) }}건</div></div>
        <div class="kpi"><div class="kcap">출고</div><div class="kval">{{ nf.format(summary.outbound) }}건</div></div>
        <div class="kpi"><div class="kcap">이동</div><div class="kval">{{ nf.format(summary.transfer) }}건</div></div>
        <div class="kpi"><div class="kcap">재고가치</div><div class="kval">{{ cf(summary.value) }}</div></div>
        <div class="kpi"><div class="kcap">회전율</div><div class="kval">{{ summary.turnover.toFixed(1) }} 회/년</div></div>
        <div class="kpi"><div class="kcap">평균 처리소요</div><div class="kval">{{ summary.leadtimeHr.toFixed(1) }} h</div></div>
      </div>
      <div class="note">입/출/이 수치는 처리완료 기준(취소/반려 제외)이며, 회전율은 연간 출고원가 ÷ 평균재고액으로 산출했습니다.</div>
    </section>

    <!-- [처리] 주차별 입·출·이 -->
    <section class="card" v-if="!loading">
      <div class="lead">✦ 주차별 처리량은 <span class="accent">{{ peakWeek }}</span>에 최대, <span class="accent">{{ lowWeek }}</span>에 최소입니다.</div>
      <VueApexCharts v-if="weeks.length > 0" type="bar" height="320" :options="stackedOptions" :series="stackedSeries" />
      <div v-else class="d-flex justify-center align-center" style="height: 320px;">
        <span class="text-medium-emphasis">데이터가 없습니다</span>
      </div>
      <div class="note">출고/주문 비율 <b>{{ outInRatio }}</b>배입니다.</div>
    </section>

    <!-- [처리] 일자별 추이 -->
    <section class="card" v-if="!loading">
      <div class="lead">✦ 일자별 처리 추이</div>
      <VueApexCharts v-if="days.length > 0" type="line" height="300" :options="lineOptions(days)" :series="dailySeries" />
      <div v-else class="d-flex justify-center align-center" style="height: 300px;">
        <span class="text-medium-emphasis">데이터가 없습니다</span>
      </div>
      <div class="note">주문과 출고 추이를 확인할 수 있습니다. <span class="muted">단위: 건</span></div>
    </section>

    <!-- [거점] 거점별 처리 분포 -->
    <section class="card" v-if="!loading">
      <div class="lead">✦ 처리 비중이 가장 큰 창고는 <span class="accent">{{ topSite }}</span>(<span class="accent">{{ siteShare }}%</span>)입니다.</div>
      <div class="grid2">
        <VueApexCharts v-if="siteData.total.length > 0" type="donut" height="300" :options="donutOptions" :series="siteData.total" />
        <div v-else class="d-flex justify-center align-center" style="height: 300px;">
          <span class="text-medium-emphasis">데이터가 없습니다</span>
        </div>
        <VueApexCharts v-if="siteData.outbound.length > 0" type="bar" height="300" :options="siteStackedHBar" :series="[
          {name:'주문',data:siteData.total},{name:'출고',data:siteData.outbound}
        ]" />
        <div v-else class="d-flex justify-center align-center" style="height: 300px;">
          <span class="text-medium-emphasis">데이터가 없습니다</span>
        </div>
      </div>
      <div class="note">상위 창고가 전체의 <b>{{ siteShare }}%</b>를 담당합니다.</div>
    </section>

    <!-- [재고] 재고가치 추세 -->
    <section class="card">
      <div class="lead">✦ 재고가치는 전월 대비 <span class="accent">상승</span>했으며, 안전재고 상향 영향이 반영되었습니다.</div>
      <VueApexCharts type="line" height="280" :options="lineOptions(['06','07','08','09','10'])"
        :series="[{ name:'재고가치', data:[129400000,131200000,130300000,134800000,summary.value] }]" />
      <div class="note">월말 스냅샷 × 표준단가(가중평균) 기준. 단가 갱신 시점 차이로 월 경계에서 소폭 차이가 발생할 수 있습니다.</div>
    </section>

    <!-- [서비스] 품절/지연 이벤트 - API 데이터 없음으로 주석 처리 -->
    <!-- <section class="card">
      <div class="lead">✦ 품절과 지연 이벤트</div>
      <div class="note">API 데이터가 준비되면 추가됩니다.</div>
    </section> -->

    <!-- [품목] Top 5 입고/출고 -->
    <section class="card" v-if="!loading">
      <div class="lead" v-if="topOutbound.length > 0 || topInbound.length > 0">
        ✦ 출고 상위는 <span class="accent" v-if="topOutbound[0]?.name">{{ topOutbound[0]?.name }}</span><span v-else>-</span>, 
        입고 상위는 <span class="accent" v-if="topInbound[0]?.name">{{ topInbound[0]?.name }}</span><span v-else>-</span>입니다.
      </div>
      <div class="two-col">
        <div class="table-card">
          <div class="table-title">Top 5 매출량</div>
          <VTable density="compact" class="t">
            <thead><tr><th>ID</th><th>부품명</th><th>카테고리</th><th class="ta-r">판매량</th><th class="ta-r">단가</th></tr></thead>
            <tbody>
              <tr v-if="topInbound.length === 0">
                <td colspan="5" class="text-center py-4">데이터가 없습니다</td>
              </tr>
              <tr v-for="r in topInbound" :key="r.id">
                <td>{{ r.id }}</td><td class="truncate">{{ r.name }}</td><td>{{ r.model }}</td>
                <td class="ta-r">{{ nf.format(r.inQty || 0) }}</td><td class="ta-r">{{ cf(r.unitPrice) }}</td>
              </tr>
            </tbody>
          </VTable>
        </div>
        <div class="table-card">
          <div class="table-title">Top 5 순이익</div>
          <VTable density="compact" class="t">
            <thead><tr><th>ID</th><th>부품명</th><th>카테고리</th><th class="ta-r">판매량</th><th class="ta-r">단가</th></tr></thead>
            <tbody>
              <tr v-if="topOutbound.length === 0">
                <td colspan="5" class="text-center py-4">데이터가 없습니다</td>
              </tr>
              <tr v-for="r in topOutbound" :key="r.id">
                <td>{{ r.id }}</td><td class="truncate">{{ r.name }}</td><td>{{ r.model }}</td>
                <td class="ta-r">{{ nf.format(r.outQty || 0) }}</td><td class="ta-r">{{ cf(r.unitPrice) }}</td>
              </tr>
            </tbody>
          </VTable>
        </div>
      </div>
      <div class="note">상위 품목은 소모성 정비품 비중이 높아 주기적 보충이 필요합니다. 단가 상위 품목은 재고가치 변동에 영향이 큽니다.</div>
    </section>
<!-- [판매분석] 카테고리별 판매 추이 -->
<section class="card">
  <div class="lead">
    ✦ <span class="accent">{{ topCategory }}</span> 카테고리가 가장 많이 판매되었으며,
    전월 대비 <span class="accent">{{ growthRate }}%</span> 증가했습니다.
  </div>
  <VueApexCharts type="line" height="300" :options="lineOptions(categories)" :series="categorySalesSeries" />
  <div class="note">
    전체적으로 엔진/전장 부품 비중이 높고, 소모품류는 주 단위 변동이 큽니다.
    <span class="muted">단위: 건, 전월 대비 증감률은 판매수량 기준.</span>
  </div>
</section>

<!-- [매출분석] 일자별 매출 추이 -->
<section class="card">
  <div class="lead">
    ✦ 총 매출은 <span class="accent">{{ peakSalesDate }}</span>에 가장 높았으며,
    전일 대비 <span class="accent">{{ salesGrowth }}%</span> 상승했습니다.
  </div>
  <VueApexCharts type="area" height="300" :options="lineOptions(salesDays)" :series="[{ name:'매출', data:salesValues }]" />
  <div class="note">
    일평균 매출은 <b>{{ avgSales.toLocaleString('ko-KR') }}</b>원이며,
    최고 매출일은 {{ peakSalesDate }}, 최저 매출일은 {{ minSalesDate }}입니다.
    <span class="muted">매출은 출고완료 기준이며 부가세 제외 금액.</span>
  </div>
</section>
  </div>
</template>

<style scoped>
:root { --paper:#fff; --ink:#0f172a; --muted:#6b7280; --line:#e6eaf2; --accent:#1a73e8; --bg:#f7f9fc; }

.page-container.report-page{ 
  max-width:1280px; 
  margin:0 auto; 
  padding:16px 12px 64px; 
  color:var(--ink); 
  height: auto !important;
  min-height: 100vh !important;
  overflow-y: auto !important;
}
.hdr{ display:flex; justify-content:space-between; align-items:center; margin:0 0 8px; }
.hdr .ttl{ font-size:20px; font-weight:800; letter-spacing:.2px; }
.hdr .meta{ margin-top:4px; font-size:13px; color:var(--muted); }
.hdr .r{ display:flex; gap:12px; align-items:center; }

.card{
  background:#fff; border:1px solid var(--line); border-radius:14px;
  padding:22px 24px; margin:22px 0;   /* ← 섹션 간 충분한 간격 */
  box-shadow:0 2px 14px rgba(16,24,40,.04);
}

/* ✦ 한 줄 요약 */
.lead{
  font-size:16.5px; line-height:1.7; font-weight:700;
  margin:2px 0 16px;                   /* 카드 내부 위아래 숨통 */
}
.accent{ color:var(--accent); font-weight:800; }

/* 회색 설명 패널 */
.note{
  margin-top:18px; padding:14px 16px; border-radius:12px;
  background:#f6f7f9; border:1px solid rgba(0,0,0,.06);
  font-size:13.5px; line-height:1.7; color:#1f2937;
}
.note .muted{ color:var(--muted); }

/* KPI */
.kpi-grid{
  display:grid; gap:16px; grid-template-columns:repeat(6,1fr);
}
.kpi{
  background:#fafbff; border:1px solid #eef2ff; border-radius:12px;
  padding:14px; min-height:84px;
}
.kcap{ font-size:12.5px; color:var(--muted); }
.kval{ margin-top:6px; font-size:18px; font-weight:800; }
.gap-lg{ padding-bottom:18px; }  /* 카드 하단 살짝 더 여백 */
@media (max-width:1100px){ .kpi-grid{ grid-template-columns:repeat(3,1fr);} }
@media (max-width:780px){ .kpi-grid{ grid-template-columns:repeat(2,1fr);} }

/* 표 레이아웃 */
.two-col{ display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:6px; }
.table-card{ border:1px solid var(--line); border-radius:12px; padding:14px; background:#fff; }
.table-title{ font-size:14px; font-weight:800; margin-bottom:8px; }
.t{ width:100%; border-collapse:separate; border-spacing:0; }
.t thead th{ font-size:12.5px; color:#6b7280; font-weight:700; border-bottom:1px solid var(--line); padding:9px 10px; }
.t tbody td{ padding:9px 10px; border-bottom:1px solid #f1f3f6; font-size:13.5px; }
.t .truncate{ max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ta-r{ text-align:right; }
@media (max-width:980px){ .two-col{ grid-template-columns:1fr; } }

/* 2열 차트 */
.grid2{ display:grid; grid-template-columns: 1fr 1fr; gap:18px; }
@media (max-width:960px){ .grid2{ grid-template-columns:1fr; } }

</style>
