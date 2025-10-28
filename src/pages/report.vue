<!-- File: src/pages/MonthlyReportSneat.vue -->
<script setup lang="ts">
import AppExportButton from '@/components/common/ExportToExcel.vue'
import { computed, ref, watch } from 'vue'
import VueApexCharts from 'vue3-apexcharts'

/* ========== 공통 상태 ========== */
const monthItems = ref([
  { label: '2025-10', value: '2025-10' },
  { label: '2025-09', value: '2025-09' },
  { label: '2025-08', value: '2025-08' },
])
const month = ref('2025-10')
const generatedAt = ref(new Date())

/* ========== 핵심 KPI (네 기존 값 유지) ========== */
const summary = ref({
  inbound: 412, outbound: 398, transfer: 62,
  cost: 128_500_000, value: 139_200_000,
  turnover: 4.2, leadtimeHr: 18.7,
})

type PartRow = { id:string; name:string; model:string; unitPrice:number; inQty?:number; outQty?:number }
const topInbound = ref<PartRow[]>([
  { id:'P-1102', name:'오일필터 A', model:'HX-20', unitPrice:12500, inQty:190 },
  { id:'P-2391', name:'브레이크 패드', model:'BR-12', unitPrice:42000, inQty:154 },
  { id:'P-0930', name:'와이퍼 블레이드', model:'W-26', unitPrice:9800, inQty:141 },
  { id:'P-5504', name:'에어필터 B', model:'AF-33', unitPrice:16300, inQty:120 },
  { id:'P-7740', name:'점화플러그', model:'SP-07', unitPrice:8700, inQty:110 },
])
const topOutbound = ref<PartRow[]>([
  { id:'P-2391', name:'브레이크 패드', model:'BR-12', unitPrice:42000, outQty:171 },
  { id:'P-1102', name:'오일필터 A', model:'HX-20', unitPrice:12500, outQty:166 },
  { id:'P-0930', name:'와이퍼 블레이드', model:'W-26', unitPrice:9800, outQty:149 },
  { id:'P-3321', name:'타이밍 벨트', model:'TB-15', unitPrice:68000, outQty:102 },
  { id:'P-7740', name:'점화플러그', model:'SP-07', unitPrice:8700, outQty:98  },
])

/* ========== 운영 데이터(리포트용 데모) ========== */
// 주차별 입/출/이 (네가 쓰던 stackedSeries 그대로)
const weeks = ['09-01','09-08','09-15','09-22','09-29','10-06','10-13']
const stackedSeries = ref([
  { name:'입고', data:[380,402,356,390,412,398,420] },
  { name:'출고', data:[340,361,325,372,398,410,385] },
  { name:'이동', data:[ 58, 61, 49, 55, 62, 57, 64] },
])

// 일자별 처리 추이(전체/출고/입고) – 간단 라인
const days = ['10/14','10/15','10/16','10/17','10/18','10/19','10/20']
const dailySeries = ref([
  { name:'출고', data:[2,11,9,3,2,2,11] },
  { name:'입고', data:[1,4,2,1,0,1,3] },
  { name:'이동', data:[0,1,2,1,1,0,1] },
])

// 거점(사이트)별 처리 비중 – 도넛 + 스택 가로바
const sites = ['본사창고','동부물류','서부물류','남부물류','협력창고']
const siteData = ref({
  total:[180,120,96,88,50],
  inbound:[72,44,38,26,15],
  outbound:[90,62,48,52,28],
  transfer:[18,14,10,10,7],
})

// 품절/지연 이벤트(데모용): 일자별 Stockout + Delay
const serviceSeries = ref([
  { name:'품절', data:[0,1,0,0,0,1,2] },
  { name:'지연', data:[1,2,1,0,1,1,1] },
])

/* ========== KPI/요약 계산 ========== */
const nf = new Intl.NumberFormat('ko-KR')
const cf = (v:number) => '₩' + nf.format(v)

const weeklyTotals = computed(() => weeks.map((_,i)=>
  (stackedSeries.value[0].data[i]||0)+(stackedSeries.value[1].data[i]||0)+(stackedSeries.value[2].data[i]||0)
))
const peakWeekIdx = computed(()=> weeklyTotals.value.indexOf(Math.max(...weeklyTotals.value)))
const lowWeekIdx  = computed(()=> weeklyTotals.value.indexOf(Math.min(...weeklyTotals.value)))
const peakWeek = computed(()=> weeks[peakWeekIdx.value])
const lowWeek  = computed(()=> weeks[lowWeekIdx.value])

const outInRatio = computed(() => {
  const sum=(a:number[])=>a.reduce((s,v)=>s+(v||0),0)
  const out=sum(stackedSeries.value[1].data)
  const inn=sum(stackedSeries.value[0].data)||1
  return (out/inn).toFixed(1)
})
const avgMove = computed(() => {
  const mv=stackedSeries.value[2].data
  return Math.round(mv.reduce((s,v)=>s+(v||0),0)/(mv.length||1))
})
const topSiteIdx = computed(()=> siteData.value.total.indexOf(Math.max(...siteData.value.total)))
const topSite = computed(()=> sites[topSiteIdx.value])
const siteShare = computed(()=> {
  const sum = siteData.value.total.reduce((s,v)=>s+v,0)||1
  return (siteData.value.total[topSiteIdx.value]/sum*100).toFixed(1)
})

/* ========== 차트 옵션(담백톤) ========== */
const base = { chart:{ toolbar:{show:false}, foreColor:'#374151' }, grid:{ borderColor:'#e5e7eb' }, dataLabels:{ enabled:false }, legend:{ position:'top' } }

const stackedOptions = ref({
  ...base, chart:{ ...base.chart, type:'bar', stacked:true },
  plotOptions:{ bar:{ columnWidth:'40%', borderRadius:6 } },
  colors:['#4f8cff','#60c5a8','#f6c453'],
  xaxis:{ categories:weeks, axisBorder:{show:false}, axisTicks:{show:false} },
  yaxis:{ title:{ text:'건수', style:{ color:'#6b7280' } } },
})

const lineOptions = (categories:string[]) => ({
  ...base, chart:{ ...base.chart, type:'line' },
  stroke:{ width:3, curve:'smooth' }, markers:{ size:3 },
  xaxis:{ categories, axisBorder:{show:false}, axisTicks:{show:false} },
  tooltip:{ y:{ formatter:(v:number)=> nf.format(v)+'건' } },
})

const donutOptions = ref({
  ...base, labels:sites, colors:['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6'],
  legend:{ position:'right' },
  plotOptions:{ pie:{ donut:{ size:'68%' } } },
  tooltip:{ y:{ formatter:(v:number)=> `${nf.format(v)}건` } },
})

const siteStackedHBar = ref({
  ...base, chart:{ ...base.chart, type:'bar', stacked:true },
  plotOptions:{ bar:{ horizontal:true, borderRadius:6, barHeight:'58%' } },
  colors:['#4f8cff','#60c5a8','#f6c453'],
  xaxis:{ categories:sites, axisBorder:{show:false}, axisTicks:{show:false} },
})

const barOptions = (categories:string[]) => ({
  ...base, chart:{ ...base.chart, type:'bar' },
  plotOptions:{ bar:{ columnWidth:'45%', borderRadius:6 } },
  xaxis:{ categories, axisBorder:{show:false}, axisTicks:{show:false} },
  colors:['#4f8cff'],
})

/* ========== 월 변경시(데모) 소폭 변동 ========== */
watch(month, () => {
  generatedAt.value = new Date()
  summary.value.inbound  = 400 + Math.floor(Math.random()*40)
  summary.value.outbound = 380 + Math.floor(Math.random()*45)
  summary.value.transfer = 55  + Math.floor(Math.random()*12)
  summary.value.value    = 132_000_000 + Math.floor(Math.random()*10_000_000)
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
        <VSelect v-model="month" :items="monthItems" variant="outlined" density="comfortable" hide-details style="min-width:140px" />
        <AppExportButton :filename="`부품관리_월간보고서_${month}.xlsx`" :rows="[...topInbound, ...topOutbound]"
          :fields="[{key:'id',label:'ID'},{key:'name',label:'부품명'},{key:'model',label:'모델'},{key:'unitPrice',label:'단가'}]"
          text="엑셀 다운로드" />
      </div>
    </header>

    <!-- [요약] 핵심 KPI -->
    <section class="card gap-lg">
      <div class="lead">✦ 이번 달 처리량은 <span class="accent">{{ nf.format(summary.outbound+summary.inbound+summary.transfer) }}</span>건, 출고/입고 비율은 <span class="accent">{{ outInRatio }}</span>배입니다.</div>
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
    <section class="card">
      <div class="lead">✦ 주차별 처리량은 <span class="accent">{{ peakWeek }}</span>에 최대, <span class="accent">{{ lowWeek }}</span>에 최소입니다. 이동은 주당 평균 <span class="accent">{{ avgMove }}</span>건입니다.</div>
      <VueApexCharts type="bar" height="320" :options="stackedOptions" :series="stackedSeries" />
      <div class="note">출고/입고 비율 <b>{{ outInRatio }}</b>배로 재고 감소 압력이 존재합니다. 이동은 거점 재배치 목적의 소량·빈발 패턴을 보입니다.</div>
    </section>

    <!-- [처리] 일자별 추이 -->
    <section class="card">
      <div class="lead">✦ 일자별로는 <span class="accent">{{ days[1] }}</span>과 <span class="accent">{{ days[6] }}</span>에 피크가 관측됩니다.</div>
      <VueApexCharts type="line" height="300" :options="lineOptions(days)" :series="dailySeries" />
      <div class="note">출고가 이벤트/정비 예약 집중일에 동반 상승합니다. <span class="muted">단위: 건, 시간 지연에 따른 ±1h 오차 가능</span></div>
    </section>

    <!-- [거점] 거점별 처리 분포 -->
    <section class="card">
      <div class="lead">✦ 처리 비중이 가장 큰 거점은 <span class="accent">{{ topSite }}</span>(<span class="accent">{{ siteShare }}%</span>)이며, 출고 편중이 확인됩니다.</div>
      <div class="grid2">
        <VueApexCharts type="donut" height="300" :options="donutOptions" :series="siteData.total" />
        <VueApexCharts type="bar" height="300" :options="siteStackedHBar" :series="[
          {name:'입고',data:siteData.inbound},{name:'출고',data:siteData.outbound},{name:'이동',data:siteData.transfer}
        ]" />
      </div>
      <div class="note">상위 거점이 전체의 <b>{{ siteShare }}%</b>를 담당합니다. 피크일 전후로 인력·차량 배치 조정이 필요합니다.</div>
    </section>

    <!-- [재고] 재고가치 추세 -->
    <section class="card">
      <div class="lead">✦ 재고가치는 전월 대비 <span class="accent">상승</span>했으며, 안전재고 상향 영향이 반영되었습니다.</div>
      <VueApexCharts type="line" height="280" :options="lineOptions(['06','07','08','09','10'])"
        :series="[{ name:'재고가치', data:[129400000,131200000,130300000,134800000,summary.value] }]" />
      <div class="note">월말 스냅샷 × 표준단가(가중평균) 기준. 단가 갱신 시점 차이로 월 경계에서 소폭 차이가 발생할 수 있습니다.</div>
    </section>

    <!-- [서비스] 품절/지연 이벤트 -->
    <section class="card">
      <div class="lead">✦ 품절과 지연은 <span class="accent">{{ days[6] }}</span>에 집중되었으며, 주 중반에는 안정적입니다.</div>
      <VueApexCharts type="area" height="280" :options="lineOptions(days)" :series="serviceSeries" />
      <div class="note">지연은 SLA 초과(출고요청→실출고)로 정의. 품절은 판매/출고 요청 시 가용수량 0 이하인 경우로 산정합니다.</div>
    </section>

    <!-- [품목] Top 5 입고/출고 -->
    <section class="card">
      <div class="lead">✦ 출고 상위는 <span class="accent">{{ topOutbound[0]?.name }}</span>, 입고 상위는 <span class="accent">{{ topInbound[0]?.name }}</span>입니다.</div>
      <div class="two-col">
        <div class="table-card">
          <div class="table-title">Top 5 입고</div>
          <VTable density="compact" class="t">
            <thead><tr><th>ID</th><th>부품명</th><th>모델</th><th class="ta-r">입고</th><th class="ta-r">단가</th></tr></thead>
            <tbody>
              <tr v-for="r in topInbound" :key="r.id">
                <td>{{ r.id }}</td><td class="truncate">{{ r.name }}</td><td>{{ r.model }}</td>
                <td class="ta-r">{{ nf.format(r.inQty || 0) }}</td><td class="ta-r">{{ cf(r.unitPrice) }}</td>
              </tr>
            </tbody>
          </VTable>
        </div>
        <div class="table-card">
          <div class="table-title">Top 5 출고</div>
          <VTable density="compact" class="t">
            <thead><tr><th>ID</th><th>부품명</th><th>모델</th><th class="ta-r">출고</th><th class="ta-r">단가</th></tr></thead>
            <tbody>
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

    <!-- 푸터 -->
    <footer class="foot">
      <div>파일명: <b>{{ `부품관리_월간보고서_${month}.xlsx` }}</b></div>
      <AppExportButton :filename="`부품관리_월간보고서_${month}.xlsx`"
        :rows="[...topInbound, ...topOutbound]"
        :fields="[{key:'id',label:'ID'},{key:'name',label:'부품명'},{key:'model',label:'모델'},{key:'unitPrice',label:'단가'}]"
        text="엑셀 다운로드" />
    </footer>
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
.hdr{ display:flex; justify-content:space-between; align-items:center; margin:0 0 18px; }
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

/* 푸터 */
.foot{
  position:sticky; bottom:0; z-index:5;
  display:flex; justify-content:space-between; align-items:center;
  background:linear-gradient(180deg, rgba(247,249,252,.45), rgba(247,249,252,1));
  border-top:1px solid var(--line);
  padding:12px 16px; margin-top:24px; backdrop-filter: blur(6px);
}

/* 인쇄 */
@media print { .foot{ position:static; backdrop-filter:none; } }
</style>
