/**
 * 창고 경로 탐색 알고리즘 (A* 알고리즘)
 * 38행 x 25열 그리드 기반
 */

// 그리드 크기 (38행 x 25열)
const GRID_ROWS = 38
const GRID_COLS = 25

// 시작점과 끝점 (3D와 맞춤)
// 문 쪽 3줄(row 0-2)은 모두 'o'이므로, row 0의 중앙에 위치
const START_POS = { row: 0, col: 12 }  // 문 위치 (S)
// 포장대는 하단에 위치 (row 37)
const END_POS = { row: 35, col: 20 }   // 포장대 위치 (E)

/**
 * 노드 클래스 (A* 알고리즘용)
 */
class Node {
  constructor(row, col) {
    this.row = row
    this.col = col
    this.g = 0 // 시작점부터의 실제 비용
    this.h = 0 // 목표까지의 휴리스틱 비용
    this.f = 0 // 총 비용 (g + h)
    this.parent = null
  }

  equals(other) {
    return this.row === other.row && this.col === other.col
  }
}

/**
 * 그리드 초기화
 * location 문자열 배열을 받아서 그리드 맵 생성
 */
function initializeGrid(locations = []) {
  const grid = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill('o'))
  
  // 문 쪽 3줄 (row 0, 1, 2)은 모두 'o'로 유지 (통로)
  // 이미 'o'로 초기화되어 있으므로 별도 처리 불필요
  
  // 랙 구조 생성 (Zone A-E)
  // 사진 기준:
  // Zone A: Rows 4-7 (baseRow = 4)
  // Zone B: Rows 9-12 (baseRow = 9)
  // Zone C: Rows 13-16 (baseRow = 13)
  // Zone D: Rows 17-20 (baseRow = 17)
  // Zone E: Rows 22-25 (baseRow = 22)
  
  const zoneRows = [7, 12, 17, 23, 28] // 각 Zone의 시작 행
  
  for (let zoneIndex = 0; zoneIndex < 5; zoneIndex++) {
    const baseRow = zoneRows[zoneIndex]
    const zone = String.fromCharCode(65 + zoneIndex) // A, B, C, D, E
    
    // 라벨 행: baseRow (앞면), baseRow + 3 (뒷면)
    // 장애물 행: baseRow + 1, baseRow + 2
    
    // Row baseRow: 앞면 라벨 (0-4, 10-14, 20-24, 30-34)
    // Row baseRow + 3: 뒷면 라벨 (5-9, 15-19, 25-29, 35-39)
    
    // 각 세그먼트는 6칸 간격 (25열 기준으로 조정 필요)
    // 통로 열: 0, 6, 12, 18, 24
    // 세그먼트당 5개 라벨 (col 1-5, 7-11, 13-17, 19-23)
    const segments = [
      { baseCol: 1, frontBlocks: [0, 1, 2, 3, 4], backBlocks: [5, 6, 7, 8, 9] },      // 세그먼트 0: 앞면 A0-A4, 뒷면 A5-A9
      { baseCol: 7, frontBlocks: [10, 11, 12, 13, 14], backBlocks: [15, 16, 17, 18, 19] }, // 세그먼트 1: 앞면 A10-A14, 뒷면 A15-A19
      { baseCol: 13, frontBlocks: [20, 21, 22, 23, 24], backBlocks: [25, 26, 27, 28, 29] }, // 세그먼트 2: 앞면 A20-A24, 뒷면 A25-A29
      { baseCol: 19, frontBlocks: [30, 31, 32, 33, 34], backBlocks: [35, 36, 37, 38, 39] }, // 세그먼트 3: 앞면 A30-A34, 뒷면 A35-A39
    ]
    
    for (let seg = 0; seg < segments.length; seg++) {
      const { baseCol, frontBlocks, backBlocks } = segments[seg]
      
      // 앞면 라벨 (0-4, 10-14, 20-24, 30-34)
      for (let i = 0; i < 5; i++) {
        const block = frontBlocks[i]
        const col = baseCol + i
        if (col < GRID_COLS) {
          grid[baseRow][col] = `${zone}${block}`
        }
      }
      
      // 뒷면 라벨 (5-9, 15-19, 25-29, 35-39)
      for (let i = 0; i < 5; i++) {
        const block = backBlocks[i]
        const col = baseCol + i
        if (col < GRID_COLS) {
          grid[baseRow + 3][col] = `${zone}${block}`
        }
      }
    }
    
    // 랙 코어 행 (baseRow + 1, baseRow + 2) - 'x' 장애물
    for (let col = 0; col < GRID_COLS; col++) {
      // 통로 열 (0, 6, 12, 18, 24)는 'o'로 유지
      if (col === 0 || col === 6 || col === 12 || col === 18 || col === 24) {
        // 통로는 그대로 'o' 유지
      } else {
        // 나머지는 모두 'x'로 표시 (장애물)
        grid[baseRow + 1][col] = 'x'
        grid[baseRow + 2][col] = 'x'
      }
    }
  }
  
  // 문 쪽 3줄 (row 0, 1, 2)은 모두 'o'로 유지 (통로)
  // 포장대 쪽도 모두 'o'로 유지 (통로)
  // 이미 초기화 시 모두 'o'로 설정되어 있으므로, 랙 구조가 이 부분을 덮어쓰지 않도록 확인
  // Zone A가 row 4부터 시작하므로 row 0-3은 자동으로 'o'로 유지됨
  
  // 장애물 위치를 맵에 저장
  const locationMap = new Map()
  
  // 각 location을 그리드 위치로 변환
  locations.forEach(location => {
    const pos = locationToGridPosition(location)
    if (pos) {
      locationMap.set(location, pos)
    }
  })
  
  // 그리드 초기화 완료
  return { grid, locationMap }
}

/**
 * location 문자열을 그리드 위치로 변환
 * 예: "A0" -> { row: 4, col: 1 }
 */
function locationToGridPosition(location) {
  if (!location || typeof location !== 'string') return null
  
  const match = location.match(/^([A-E])(\d+)$/i)
  if (!match) return null
  
  const zone = match[1].toUpperCase()
  const block = parseInt(match[2], 10)
  
  // Zone을 행으로 변환 (A=0, B=1, C=2, D=3, E=4)
  const zoneIndex = zone.charCodeAt(0) - 65
  if (zoneIndex < 0 || zoneIndex > 4) return null
  
  // 각 Zone의 시작 행 (3D와 맞춤)
  const zoneRows = [7, 12, 17, 23, 28]
  const baseRow = zoneRows[zoneIndex]
  
  // block에 따라 행과 열 결정
  // 앞면: 0-4, 10-14, 20-24, 30-34 (baseRow)
  // 뒷면: 5-9, 15-19, 25-29, 35-39 (baseRow + 3)
  // 각 세그먼트는 0-4 (앞면), 5-9 (뒷면) 또는 10-14 (앞면), 15-19 (뒷면) 등
  const isFront = (block % 10) < 5  // 0-4, 10-14, 20-24, 30-34는 앞면
  const row = isFront ? baseRow : baseRow + 3

  // block을 세그먼트와 인덱스로 변환
  // 세그먼트: 0-3 (0-4/5-9, 10-14/15-19, 20-24/25-29, 30-34/35-39)
  const segment = Math.floor(block / 10) // 0, 1, 2, 3
  const indexInSegment = block % 10 < 5 ? block % 10 : block % 10 - 5 // 앞면이면 0-4, 뒷면이면 0-4 (5-9를 0-4로 변환)
  
  // 각 세그먼트는 6칸 간격 (25열 기준: 0, 6, 12, 18, 24가 통로)
  // 세그먼트 0: baseCol 1 (A0-A4), 세그먼트 1: baseCol 7 (A10-A14)
  // 세그먼트 2: baseCol 13 (A20-A24), 세그먼트 3: baseCol 19 (A30-A34)
  const segmentCols = [1, 7, 13, 19]
  const baseCol = segmentCols[segment]
  const col = baseCol + indexInSegment
  
  return { row, col }
}

/**
 * 그리드 위치에서 가장 가까운 통로('o') 찾기
 * 라벨 위치에서 가장 가까운 통로로 이동해야 함 (라벨 위치 자체는 통과 불가능)
 */
function findNearestAisle(grid, row, col) {
  // 현재 위치가 통로('o')면 그대로 반환
  if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
    const currentCell = grid[row][col]
    if (currentCell === 'o') {
      return { row, col }
    }
  }
  
  // BFS로 가장 가까운 'o' 통로 찾기
  const queue = [{ row, col, distance: 0 }]
  const visited = new Set()

  visited.add(`${row},${col}`)
  
  const directions = [
    { row: -1, col: 0 },  // 상
    { row: 1, col: 0 },   // 하
    { row: 0, col: -1 },  // 좌
    { row: 0, col: 1 },   // 우
  ]
  
  while (queue.length > 0) {
    const current = queue.shift()
    
    // 인접한 셀 확인
    for (const dir of directions) {
      const newRow = current.row + dir.row
      const newCol = current.col + dir.col
      const key = `${newRow},${newCol}`
      
      if (newRow >= 0 && newRow < GRID_ROWS && 
          newCol >= 0 && newCol < GRID_COLS &&
          !visited.has(key)) {
        visited.add(key)
        
        const cellValue = grid[newRow][newCol]
        
        // 통로('o')를 찾으면 반환
        if (cellValue === 'o') {
          return { row: newRow, col: newCol }
        }
        
        // 라벨이나 다른 통과 가능한 셀은 계속 탐색 (통로를 찾을 때까지)
        if (isTraversable(cellValue)) {
          queue.push({ row: newRow, col: newCol, distance: current.distance + 1 })
        }
      }
    }
  }
  
  // 통로를 찾지 못하면 null 반환
  return null
}

/**
 * 휴리스틱 함수 (맨해튼 거리)
 */
function heuristic(node, goal) {
  return Math.abs(node.row - goal.row) + Math.abs(node.col - goal.col)
}

/**
 * 셀이 통과 가능한지 확인
 * 'o' (통로)와 라벨(A0, B15 등)은 통과 가능
 * 'x'만 장애물
 */
function isTraversable(cellValue) {
  if (cellValue === 'o') return true
  if (cellValue === 'x') return false

  // 라벨이 있는 셀 (A0, B15 등)은 통과 가능
  if (typeof cellValue === 'string' && cellValue.match(/^[A-E]\d+$/)) {
    return true
  }
  
  return false
}

/**
 * 인접 노드 찾기 (상하좌우)
 * 통로('o')와 라벨 셀은 통과 가능, 'x'만 장애물
 */
function getNeighbors(grid, node) {
  const neighbors = []

  const directions = [
    { row: -1, col: 0 },  // 상
    { row: 1, col: 0 },   // 하
    { row: 0, col: -1 },  // 좌
    { row: 0, col: 1 },   // 우
  ]
  
  for (const dir of directions) {
    const newRow = node.row + dir.row
    const newCol = node.col + dir.col
    
    // 그리드 범위 확인
    if (newRow >= 0 && newRow < GRID_ROWS && 
        newCol >= 0 && newCol < GRID_COLS) {
      
      const cellValue = grid[newRow][newCol]
      
      // 통로('o')와 라벨 셀은 통과 가능
      // 'x'만 장애물로 처리
      if (isTraversable(cellValue)) {
        neighbors.push(new Node(newRow, newCol))
      } else {
        // 디버깅: 'x' 장애물을 만났을 때 로그 (너무 많으면 제거)
        // console.log(`[getNeighbors] 장애물 발견: [${newRow}, ${newCol}] = "${cellValue}"`)
      }
    }
  }
  
  return neighbors
}

/**
 * A* 경로 탐색 알고리즘
 */
function astarPathfinding(grid, start, goal) {
  // 시작점과 목표점이 유효한지 확인 (통로('o')여야 함)
  if (start.row < 0 || start.row >= GRID_ROWS || start.col < 0 || start.col >= GRID_COLS) {
    console.error('[astarPathfinding] 시작점이 그리드 범위를 벗어남:', start)
    
    return null
  }
  if (goal.row < 0 || goal.row >= GRID_ROWS || goal.col < 0 || goal.col >= GRID_COLS) {
    console.error('[astarPathfinding] 목표점이 그리드 범위를 벗어남:', goal)
    
    return null
  }
  
  const startCell = grid[start.row][start.col]
  const goalCell = grid[goal.row][goal.col]
  
  if (!isTraversable(startCell)) {
    console.error('[astarPathfinding] 시작점이 장애물입니다:', { start, cellValue: startCell })
    
    return null
  }
  if (!isTraversable(goalCell)) {
    console.error('[astarPathfinding] 목표점이 장애물입니다:', { goal, cellValue: goalCell })
    
    return null
  }
  
  const openSet = []
  const closedSet = new Set()
  
  const startNode = new Node(start.row, start.col)
  const goalNode = new Node(goal.row, goal.col)
  
  startNode.g = 0
  startNode.h = heuristic(startNode, goalNode)
  startNode.f = startNode.g + startNode.h
  
  openSet.push(startNode)
  
  while (openSet.length > 0) {
    // f 값이 가장 작은 노드 선택
    let currentIndex = 0
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[currentIndex].f) {
        currentIndex = i
      }
    }
    
    const current = openSet.splice(currentIndex, 1)[0]

    closedSet.add(`${current.row},${current.col}`)
    
    // 목표에 도달했으면 경로 재구성
    if (current.equals(goalNode)) {
      const path = []
      let node = current
      
      while (node) {
        path.unshift({ row: node.row, col: node.col })
        node = node.parent
      }
      
      // 경로 검증: 모든 점이 통과 가능한지 확인
      const invalidPoints = []
      for (const p of path) {
        const cellValue = grid[p.row][p.col]
        if (!isTraversable(cellValue)) {
          invalidPoints.push({ point: p, cellValue })
          console.error('[astarPathfinding] 경로에 장애물 발견:', { 
            row: p.row, 
            col: p.col, 
            cellValue,
            grid: grid[p.row] ? grid[p.row].slice(Math.max(0, p.col - 2), Math.min(GRID_COLS, p.col + 3)) : 'N/A',
          })
        }
      }
      
      if (invalidPoints.length > 0) {
        console.error('[astarPathfinding] 경로 검증 실패 - 장애물 통과:', invalidPoints)
        console.error('[astarPathfinding] 전체 경로:', path)
        
        return null
      }
      
      return path
    }
    
    // 인접 노드 확인
    const neighbors = getNeighbors(grid, current)
    
    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.row},${neighbor.col}`
      
      if (closedSet.has(neighborKey)) {
        continue
      }
      
      const tentativeG = current.g + 1
      
      // openSet에 있는지 확인
      let inOpenSet = false
      let existingNode = null
      
      for (const node of openSet) {
        if (node.equals(neighbor)) {
          inOpenSet = true
          existingNode = node
          break
        }
      }
      
      if (!inOpenSet) {
        neighbor.g = tentativeG
        neighbor.h = heuristic(neighbor, goalNode)
        neighbor.f = neighbor.g + neighbor.h
        neighbor.parent = current
        openSet.push(neighbor)
      } else if (tentativeG < existingNode.g) {
        existingNode.g = tentativeG
        existingNode.f = existingNode.g + existingNode.h
        existingNode.parent = current
      }
    }
  }
  
  // 경로를 찾지 못함
  return null
}

/**
 * 최적 경로 계산
 * @param {string[]} locations - 방문할 location 배열 (예: ['A0', 'B15', 'C5'])
 * @returns {Object} 경로 정보
 */
export function calculateOptimalPath(locations = []) {
  const { grid, locationMap } = initializeGrid(locations)
  
  const fullPath = []
  let currentPos = START_POS
  
  // 시작점이 통과 가능한지 확인
  if (!isTraversable(grid[currentPos.row][currentPos.col])) {
    console.error('[calculateOptimalPath] 시작점이 장애물입니다:', { 
      pos: currentPos, 
      cellValue: grid[currentPos.row][currentPos.col], 
    })


    // 시작점을 가장 가까운 통로로 이동
    const nearestAisle = findNearestAisle(grid, currentPos.row, currentPos.col)
    if (nearestAisle) {
      currentPos = nearestAisle
      console.log('[calculateOptimalPath] 시작점을 통로로 이동:', currentPos)
    } else {
      throw new Error('시작점 근처에 통로를 찾을 수 없습니다')
    }
  }
  
  // 각 location을 순서대로 방문
  for (const location of locations) {
    const locationPos = locationMap.get(location)
    if (!locationPos) {
      console.warn('[calculateOptimalPath] location을 찾을 수 없음:', location)
      continue
    }
    
    // 해당 location의 가장 가까운 통로 찾기
    const aislePos = findNearestAisle(grid, locationPos.row, locationPos.col)
    if (!aislePos) {
      console.warn('[calculateOptimalPath] location 근처 통로를 찾을 수 없음:', location)
      continue
    }
    
    // 경로 탐색
    const path = astarPathfinding(grid, currentPos, aislePos)
    if (path && path.length > 0) {
      // 경로 검증: 모든 점이 통과 가능한지 확인
      const invalidInPath = []

      path.forEach((p, idx) => {
        const cellValue = grid[p.row][p.col]
        if (!isTraversable(cellValue)) {
          invalidInPath.push({ index: idx, point: p, cellValue })
          console.error(`[calculateOptimalPath] 경로 점 ${idx} [${p.row},${p.col}] = "${cellValue}" (장애물)`)
        }
      })
      
      if (invalidInPath.length > 0) {
        console.error('[calculateOptimalPath] 경로에 장애물이 포함됨:', invalidInPath)
        console.error('[calculateOptimalPath] 전체 경로:', path.map(p => `[${p.row},${p.col}]=${grid[p.row][p.col]}`))
        throw new Error(`경로에 장애물이 포함되어 있습니다: ${invalidInPath[0].point}`)
      }
      
      // 첫 번째 점 제외 (이전 경로의 마지막 점과 중복)
      if (fullPath.length > 0) {
        path.shift()
      }
      fullPath.push(...path)
      currentPos = aislePos
    } else {
      console.error(`[calculateOptimalPath] 경로를 찾을 수 없음: [${currentPos.row},${currentPos.col}] -> [${aislePos.row},${aislePos.col}]`)
      throw new Error(`경로를 찾을 수 없습니다: ${location}`)
    }
  }
  
  // 마지막으로 끝점(E)으로 이동
  const finalPath = astarPathfinding(grid, currentPos, END_POS)
  if (finalPath && finalPath.length > 0) {
    // 경로 검증
    const invalidInFinal = finalPath.filter(p => !isTraversable(grid[p.row][p.col]))
    if (invalidInFinal.length > 0) {
      console.error('[calculateOptimalPath] 최종 경로에 장애물이 포함됨:', invalidInFinal)
      throw new Error(`최종 경로에 장애물이 포함되어 있습니다`)
    }
    
    if (fullPath.length > 0) {
      finalPath.shift()
    }
    fullPath.push(...finalPath)
  } else {
    console.error('[calculateOptimalPath] 끝점으로의 경로를 찾을 수 없음')
    throw new Error('끝점으로의 경로를 찾을 수 없습니다')
  }
  
  // 경로를 location 문자열 형태로 변환
  const routeSteps = []
  
  // 시작점
  routeSteps.push({ location: '문', row: START_POS.row, col: START_POS.col })
  
  // 각 location 방문
  for (const location of locations) {
    const locationPos = locationMap.get(location)
    if (locationPos) {
      const aislePos = findNearestAisle(grid, locationPos.row, locationPos.col)
      if (aislePos) {
        routeSteps.push({ location, row: aislePos.row, col: aislePos.col })
      }
    }
  }
  
  // 끝점
  routeSteps.push({ location: '포장대', row: END_POS.row, col: END_POS.col })
  
  // 경로 검증: fullPath의 모든 점이 통과 가능한지 확인
  const invalidPoints = []

  fullPath.forEach((point, index) => {
    if (point.row < 0 || point.row >= GRID_ROWS || point.col < 0 || point.col >= GRID_COLS) {
      invalidPoints.push({
        index,
        point,
        reason: '범위 초과',
        cellValue: 'N/A',
      })
      console.error(`[calculateOptimalPath] 경로 점 ${index} 범위 초과: [${point.row},${point.col}]`)
    } else {
      const cellValue = grid[point.row][point.col]
      if (!isTraversable(cellValue)) {
        invalidPoints.push({
          index,
          point: { row: point.row, col: point.col },
          reason: cellValue === 'x' ? 'x 장애물' : `비통과 가능 셀 (${cellValue})`,
          cellValue: cellValue,

          // 주변 셀 정보도 출력
          neighbors: {
            up: point.row > 0 ? grid[point.row - 1][point.col] : 'N/A',
            down: point.row < GRID_ROWS - 1 ? grid[point.row + 1][point.col] : 'N/A',
            left: point.col > 0 ? grid[point.row][point.col - 1] : 'N/A',
            right: point.col < GRID_COLS - 1 ? grid[point.row][point.col + 1] : 'N/A',
          },
        })
        console.error(`[calculateOptimalPath] 경로 점 ${index} 장애물 통과: [${point.row},${point.col}] = "${cellValue}"`)
      }
    }
  })
  
  if (invalidPoints.length > 0) {
    console.error('[calculateOptimalPath] ⚠️ 경로에 장애물 통과 지점 발견!')
    console.error('[calculateOptimalPath] 장애물 개수:', invalidPoints.length)
    console.error('[calculateOptimalPath] 첫 10개 장애물 상세 정보:', invalidPoints.slice(0, 10))
    
    // 각 장애물 위치의 그리드 정보 출력
    invalidPoints.slice(0, 5).forEach((invalid, idx) => {
      console.error(`[장애물 ${idx + 1}] 위치: [${invalid.point.row}, ${invalid.point.col}], 셀 값: "${invalid.cellValue}", 이유: ${invalid.reason}`)
      console.error(`  주변: 위=${invalid.neighbors.up}, 아래=${invalid.neighbors.down}, 왼쪽=${invalid.neighbors.left}, 오른쪽=${invalid.neighbors.right}`)
    })
    
    // 장애물을 통과하는 경로는 제거
    throw new Error(`경로에 장애물이 포함되어 있습니다. 장애물 개수: ${invalidPoints.length}, 첫 번째 위치: [${invalidPoints[0].point.row}, ${invalidPoints[0].point.col}]`)
  }
  
  return {
    optimizedRoute: routeSteps,
    fullPath: fullPath, // 전체 경로 좌표 배열 [{row, col}, ...]
    totalDistance: fullPath.length,
    grid: grid, // 디버깅용
  }
}

