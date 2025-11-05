/**
 * 웹 환경용 StepCounter 플러그인 (더미 구현)
 */
export class StepCounterWeb {
  async getSteps() {
    return { steps: 0 }
  }

  async startTracking() {
    return { initialSteps: 0 }
  }

  async stopTracking() {
    return {}
  }
}

