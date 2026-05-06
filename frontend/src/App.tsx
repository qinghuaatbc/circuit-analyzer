import { useState, useCallback, useEffect } from 'react'
import { analyze, fetchExamples, AnalyzeResponse, NetlistExample } from './api/analyze'
import CircuitDiagram from './components/CircuitDiagram'

const defaultNetlist = `R1 1 2 1k
C1 2 0 1u
VAC1 1 0 1`

export default function App() {
  const [netlist, setNetlist] = useState(defaultNetlist)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [examples, setExamples] = useState<NetlistExample[]>([])
  const [showExamples, setShowExamples] = useState(false)

  useEffect(() => {
    fetchExamples().then(setExamples).catch(() => {})
  }, [])

  const handleAnalyze = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await analyze({ netlist })
      setResult(res)
    } catch (err: any) {
      setError(err.message || 'analysis failed')
    } finally {
      setLoading(false)
    }
  }, [netlist])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Circuit Analyzer</h1>
        <p className="subtitle">DC & AC analysis using Modified Nodal Analysis (MNA)</p>
      </header>

      <div className="main-layout">
        <div className="left-panel">
          <CircuitDiagram netlist={netlist} voltages={result?.dc?.v} />
          <div className="editor-header">
            <h2>Netlist</h2>
            <div className="editor-actions">
              <button className="btn-examples" onClick={() => setShowExamples(!showExamples)}>
                Examples ▾
              </button>
              <button className="btn-analyze" onClick={handleAnalyze} disabled={loading || !netlist.trim()}>
                {loading ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
          </div>

          {showExamples && (
            <div className="examples-dropdown">
              {examples.map((ex, i) => (
                <div key={i} className="example-item" onClick={() => { setNetlist(ex.netlist); setShowExamples(false) }}>
                  <span className="example-name">{ex.name}</span>
                </div>
              ))}
            </div>
          )}

          <textarea
            className="code-editor"
            value={netlist}
            onChange={(e) => setNetlist(e.target.value)}
            placeholder={`R1 1 0 1k\nR2 1 2 2k\nV1 2 0 5\n\nFormat: <type><name> <pos_node> <neg_node> <value>\nTypes: R, C, L, V, I, VAC`}
            spellCheck={false}
          />
          <div className="hints">
            <span>Suffixes: k=1e3, m=1e-3, u=1e-6, n=1e-9, p=1e-12</span>
          </div>
        </div>

        <div className="right-panel">
          {error && <div className="error-bar">{error}</div>}

          {result && (
            <div className="results">
              {result.dc && <DCView data={result.dc} />}
              {result.acSweep && <ACView data={result.acSweep} />}
              {!result.dc && !result.acSweep && (
                <div className="no-results">No results. Check netlist syntax.</div>
              )}
            </div>
          )}

          {!result && !error && (
            <div className="no-results">Write a netlist and click Analyze</div>
          )}
        </div>
      </div>
    </div>
  )
}

function DCView({ data }: { data: { v: number[]; i: number[] } }) {
  return (
    <div className="section">
      <h3>DC Analysis</h3>
      <div className="results-grid">
        <div className="result-card">
          <h4>Node Voltages</h4>
          <table className="result-table">
            <thead>
              <tr><th>Node</th><th>Voltage (V)</th></tr>
            </thead>
            <tbody>
              {data.v.map((v, i) => (
                <tr key={i}><td>{i + 1}</td><td className="num">{formatEng(v)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.i.length > 0 && (
          <div className="result-card">
            <h4>Source Currents</h4>
            <table className="result-table">
              <thead>
                <tr><th>#</th><th>Current (A)</th></tr>
              </thead>
              <tbody>
                {data.i.map((v, i) => (
                  <tr key={i}><td>{i + 1}</td><td className="num">{formatEng(v)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function ACView({ data }: { data: { frequencies: number[]; points: { v: { mag: number; phase: number }[] }[] } }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.points.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    const w = rect.width
    const h = rect.height
    const pad = { top: 20, right: 20, bottom: 30, left: 50 }

    // Magnitude plot (top half)
    const magH = h / 2

    // Find the first output node's magnitude response
    const v0Mags = data.points.map(p => p.v[0]?.mag || 0)
    const maxMag = Math.max(...v0Mags, 0.001)

    // Draw magnitude
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = '#58a6ff'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i < data.frequencies.length; i++) {
      const x = pad.left + (i / (data.frequencies.length - 1)) * (w - pad.left - pad.right)
      const y = pad.top + (1 - v0Mags[i] / maxMag) * (magH - pad.top - pad.bottom)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Labels
    ctx.fillStyle = '#8b949e'
    ctx.font = '12px sans-serif'
    ctx.fillText('Magnitude (V)', pad.left, 14)

    // Phase plot (bottom half)
    const v0Phases = data.points.map(p => p.v[0]?.phase || 0)
    const phaseOffset = magH
    ctx.strokeStyle = '#ffa657'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i < data.frequencies.length; i++) {
      const x = pad.left + (i / (data.frequencies.length - 1)) * (w - pad.left - pad.right)
      const y = phaseOffset + pad.top + (1 - (v0Phases[i] + 90) / 180) * (magH - pad.top - pad.bottom)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.fillStyle = '#8b949e'
    ctx.fillText('Phase (°)', pad.left, phaseOffset + 14)

    // Axis labels
    ctx.fillStyle = '#484f58'
    ctx.font = '10px sans-serif'
    ctx.fillText(`${fmtFreq(data.frequencies[0])}`, pad.left, h - 4)
    ctx.fillText(`${fmtFreq(data.frequencies[data.frequencies.length - 1])}`, w - pad.right - 40, h - 4)
    ctx.fillText('Frequency (Hz)', w / 2 - 30, h - 4)
  }, [data])

  return (
    <div className="section">
      <h3>AC Analysis</h3>
      <div className="bode-plot">
        <canvas ref={canvasRef} style={{ width: '100%', height: 260 }} />
      </div>
    </div>
  )
}

import React from 'react'

function formatEng(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1e6) return (v / 1e6).toFixed(3) + 'M'
  if (abs >= 1e3) return (v / 1e3).toFixed(3) + 'k'
  if (abs >= 1) return v.toFixed(3)
  if (abs >= 1e-3) return (v * 1e3).toFixed(3) + 'm'
  if (abs >= 1e-6) return (v * 1e6).toFixed(3) + 'µ'
  if (abs >= 1e-9) return (v * 1e9).toFixed(3) + 'n'
  return v.toExponential(3)
}

function fmtFreq(f: number): string {
  if (f >= 1e6) return (f / 1e6).toFixed(1) + 'MHz'
  if (f >= 1e3) return (f / 1e3).toFixed(1) + 'kHz'
  return f.toFixed(0) + 'Hz'
}
