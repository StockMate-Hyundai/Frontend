import { httpPublic } from '@/api/http-public'

// GET /api/v1/user/all?page={0-base}&size={n}
// 서버가 공개로 열어둔 엔드포인트 → 헤더 없이 호출
export async function apiGetUsersPublic({ page = 0, size = 20 } = {}) {
  const { data } = await httpPublic.get('/api/v1/user/all', { params: { page, size } })
  
  return data.data // { totalElements, totalPages, page, size, content[], last }
}

// 단건 조회 (공개로 열려있다면 동일 사용)
export async function apiGetUserByMemberIdPublic(memberId) {
  const { data } = await httpPublic.get(`/api/v1/user/${memberId}`)
  
  return data.data
}
