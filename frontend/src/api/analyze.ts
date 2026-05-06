export interface AnalyzeRequest {
  netlist: string
  fMin?: number
  fMax?: number
  points?: number
}

export interface Complex {
  real: number
  imag: number
  mag: number
  phase: number
}

export interface DCResult {
  v: number[]
  i: number[]
}

export interface ACPoint {
  v: Complex[]
  i: Complex[]
}

export interface ACSweepResult {
  frequencies: number[]
  points: ACPoint[]
}

export interface AnalyzeResponse {
  dc?: DCResult
  acSweep?: ACSweepResult
}

export interface NetlistExample {
  name: string
  netlist: string
}

export async function analyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchExamples(): Promise<NetlistExample[]> {
  const res = await fetch('/api/examples')
  if (!res.ok) return []
  return res.json()
}
