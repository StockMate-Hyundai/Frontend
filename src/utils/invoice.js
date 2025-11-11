import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import QRCode from 'qrcode'

/**
 * 주문 데이터를 기반으로 인보이스 PDF를 생성하고 반환합니다.
 * @param {Object} orderData - 주문 데이터
 * @param {Object} orderData.summary - 주문 요약 정보
 * @param {string} orderData.summary.orderNumber - 주문번호
 * @param {string} orderData.summary.createdAt - 주문일시
 * @param {string} orderData.summary.status - 주문상태
 * @param {Object} orderData.customerInfo - 고객 정보
 * @param {string} orderData.customerInfo.name - 지점명
 * @param {string} orderData.customerInfo.email - 이메일
 * @param {string} orderData.customerInfo.address - 주소
 * @param {Array} orderData.lineItems - 주문 항목 배열
 * @param {Function} fmtCurrency - 통화 포맷 함수
 * @param {Function} resolveOrderStatus - 주문 상태 해결 함수
 * @returns {Promise<jsPDF>} 생성된 PDF 객체
 */
export async function generateInvoicePDF(orderData) {
  const { summary, customerInfo, lineItems, fmtCurrency, resolveOrderStatus } = orderData

  // QR 코드 생성
  const qrDataUrl = await QRCode.toDataURL(summary.orderNumber, { width: 200, margin: 1 })
  
  // HTML 인보이스 생성
  const invoiceHTML = createInvoiceHTML({
    summary,
    customerInfo,
    lineItems,
    qrDataUrl,
    fmtCurrency,
    resolveOrderStatus,
  })
  
  // 임시 div 생성
  const div = document.createElement('div')
  div.innerHTML = invoiceHTML
  div.style.position = 'absolute'
  div.style.left = '-9999px'
  div.style.width = '794px' // A4 width in pixels (210mm at 96 DPI)
  div.style.background = 'white'
  document.body.appendChild(div)
  
  
  // html2canvas로 이미지 변환
  const canvas = await html2canvas(div, {
    width: 794,
    scale: 2,
    useCORS: true,
    letterRendering: true,
    logging: false,
    allowTaint: false,
  })
  
  document.body.removeChild(div)
  
  // PDF 생성 - 페이지 분할 로직 개선
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF('p', 'mm', 'a4')
  const imgWidth = 210 // A4 width in mm
  const pageHeight = 297 // A4 height in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  
  let position = 0
  let remainingHeight = imgHeight
  
  // 첫 페이지 추가
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
  remainingHeight -= pageHeight
  
  // 남은 높이가 있으면 추가 페이지 생성
  while (remainingHeight > 0) {
    position -= pageHeight // 다음 페이지 위치로 이동
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    remainingHeight -= pageHeight
  }
  
  return pdf
}

/**
 * 인보이스 HTML 생성
 */
function createInvoiceHTML({ summary, customerInfo, lineItems, qrDataUrl, fmtCurrency, resolveOrderStatus }) {
  // 영수증 계산: 합계금액 -> 부가세액 -> 공급가액
  const totalAmount = Number(summary.totalPrice) || 0
  const vatAmount = Math.floor(Number(totalAmount) * 10 / 110)
  const supplyAmount = totalAmount - vatAmount
  
  return `
    <div style="font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; padding: 40px; background: white; page-break-inside: avoid;">
      <div style="position: relative; text-align: center; margin-bottom: 30px; page-break-inside: avoid;">
        <h1 style="font-size: 28px; margin: 0; color: #2563eb;">주문 인보이스</h1>
        <div style="position: absolute; top: 0; right: 0; text-align: right;">
          <div style="font-size: 12px; color: #666; margin-bottom: 5px;">주문번호 QR</div>
          <img src="${qrDataUrl}" style="width: 100px; height: 100px;" alt="QR Code" />
        </div>
      </div>
      
      <div style="margin-bottom: 30px; page-break-inside: avoid;">
        <h2 style="font-size: 16px; margin-bottom: 10px; color: #333;">주문 정보</h2>
        <div style="line-height: 1.8;">
          <div><strong>주문번호:</strong> ${summary.orderNumber}</div>
          <div><strong>주문일시:</strong> ${new Date(summary.createdAt).toLocaleString('ko-KR')}</div>
          <div><strong>주문상태:</strong> ${resolveOrderStatus(summary.status).text}</div>
        </div>
      </div>
      
      <div style="margin-bottom: 30px; page-break-inside: avoid;">
        <h2 style="font-size: 16px; margin-bottom: 10px; color: #333;">고객 정보</h2>
        <div style="line-height: 1.8;">
          <div><strong>지점명:</strong> ${customerInfo.name}</div>
          <div><strong>이메일:</strong> ${customerInfo.email}</div>
          <div><strong>주소:</strong> ${customerInfo.address}</div>
        </div>
      </div>
      
      <div style="margin-bottom: 30px;">
        <h2 style="font-size: 16px; margin-bottom: 10px; color: #333;">주문 상세</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f8f9fa; border-bottom: 2px solid #e0e0e0; page-break-inside: avoid;">
              <th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600;">부품명</th>
              <th style="padding: 12px; text-align: center; font-size: 14px; font-weight: 600; width: 10%;">수량</th>
              <th style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600; width: 15%;">단가</th>
              <th style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600; width: 15%;">합계</th>
            </tr>
          </thead>
          <tbody>
            ${lineItems.map(item => {
              return `
              <tr style="border-bottom: 1px solid #e0e0e0; page-break-inside: avoid;">
                <td style="padding: 12px; font-size: 13px;">${item.productName}</td>
                <td style="padding: 12px; text-align: center; font-size: 13px;">${item.quantity}</td>
                <td style="padding: 12px; text-align: right; font-size: 13px;">₩${fmtCurrency(item.price)}</td>
                <td style="padding: 12px; text-align: right; font-size: 13px;">₩${fmtCurrency(item.price * item.quantity)}</td>
              </tr>
            `}).join('')}
          </tbody>
          <tfoot style="page-break-inside: avoid;">
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td colspan="3" style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600;">합계금액:</td>
              <td style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600;">₩${fmtCurrency(totalAmount)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td colspan="3" style="padding: 12px; text-align: right; font-size: 14px;">부가세액:</td>
              <td style="padding: 12px; text-align: right; font-size: 14px;">₩${fmtCurrency(vatAmount)}</td>
            </tr>
            <tr style="background: #f8f9fa; border-top: 2px solid #2563eb;">
              <td colspan="3" style="padding: 12px; text-align: right; font-size: 16px; font-weight: bold;">공급가액:</td>
              <td style="padding: 12px; text-align: right; font-size: 16px; font-weight: bold; color: #2563eb;">₩${fmtCurrency(supplyAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `
}

/**
 * 주문 상세 데이터를 인보이스 생성에 필요한 형태로 변환
 */
export function transformOrderDataForInvoice(orderDetail) {
  const summary = {
    orderNumber: orderDetail?.orderNumber || `#${orderDetail?.orderId}`,
    createdAt: orderDetail?.createdAt || '',
    status: orderDetail?.orderStatus || null,
    totalPrice: orderDetail?.totalPrice || 0,
  }

  const u = orderDetail?.userInfo ?? {}
  const customerInfo = {
    name: u?.storeName || u?.owner || u?.email || '-',
    email: u?.email || '-',
    address: u?.address || '-',
  }

  const items = Array.isArray(orderDetail?.orderItems) ? orderDetail.orderItems : []
  const lineItems = items.map(x => {
    const pd = x?.partDetail ?? {}
    const name = pd?.korName || pd?.name || pd?.engName || `#${x?.partId}`
    const price = pd?.price ?? 0
    const qty = x?.amount ?? 0
    
    return {
      productName: name,
      price,
      quantity: qty,
    }
  })

  return { summary, customerInfo, lineItems }
}

