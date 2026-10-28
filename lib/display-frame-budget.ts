// Measure a stable browser callback cadence; never impose an animation cap.
const displayRates = [30,48,50,60,72,75,80,90,100,120,144,165,180,240]

export class DisplayFrameBudget {
  milliseconds = 1000 / 60
  private previous = 0
  private intervals: number[] = []
  private calibrated = false
  private count = 0

  observe(now: number) {
    const delta = this.previous ? now - this.previous : 0
    this.previous = now
    if (delta < 3 || delta > 50) return
    this.intervals.push(delta)
    if (this.intervals.length > 120) this.intervals.shift()
    if (++this.count % 12 || this.intervals.length < 24) return
    const sorted = [...this.intervals].sort((a,b)=>a-b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const rate = displayRates.reduce((best,hz)=>Math.abs(1000/hz-median)<Math.abs(1000/best-median)?hz:best,60)
    const candidate = 1000 / rate
    // A few close callbacks during startup are not evidence of a fast display.
    const stable = this.intervals.filter(ms=>Math.abs(ms-candidate)<candidate*.15).length / this.intervals.length
    if (Math.abs(median-candidate)>candidate*.08 || stable<.65) return
    // Once a fast cadence is demonstrated, slow rendering must reduce pixel
    // cost rather than silently redefine the target to 60Hz.
    this.milliseconds = this.calibrated ? Math.min(this.milliseconds,candidate) : candidate
    this.calibrated = true
  }

  resume() { this.previous = 0 }
}
