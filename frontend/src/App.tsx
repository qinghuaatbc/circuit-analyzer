import React, { useState, useCallback, useEffect } from 'react'
import { analyze, fetchExamples, AnalyzeResponse, NetlistExample } from './api/analyze'
import CircuitDiagram from './components/CircuitDiagram'

const i18n = {
  zh: {
    title: '电路分析器',
    subtitle: '使用节点分析法 (MNA) 进行 DC / AC 分析',
    netlist: 'Netlist',
    examples: '示例 ▾',
    analyze: '分析',
    analyzing: '分析中...',
    format: '格式',
    formatDesc: '名称 正节点 负节点 数值',
    formatExample: '例：R1 1 2 1k — R1 接在节点①和节点②之间，1kΩ',
    nodes: '节点',
    nodesDesc: '0 = 地 (GND)，其他数字为自定义编号，图中圆圈标注',
    types: '类型',
    typesDesc: 'R 电阻 · C 电容 · L 电感 · V 直流源 · VAC 交流源 · I 电流源',
    suffix: '单位',
    suffixDesc: 'k=10³  m=10⁻³  u=10⁻⁶  n=10⁻⁹  p=10⁻¹²',
    dcAnalysis: 'DC 分析',
    nodeVoltages: '节点电压',
    node: '节点',
    voltage: '电压 (V)',
    sourceCurrent: '电源电流',
    index: '序号',
    current: '电流 (A)',
    acAnalysis: 'AC 分析',
    magnitude: '幅度 (V)',
    phase: '相位 (°)',
    frequency: '频率 (Hz)',
    noResults: '无结果，请检查 Netlist 语法',
    writeAndAnalyze: '输入 Netlist 并点击分析',
  },
  en: {
    title: 'Circuit Analyzer',
    subtitle: 'DC & AC analysis using Modified Nodal Analysis (MNA)',
    netlist: 'Netlist',
    examples: 'Examples ▾',
    analyze: 'Analyze',
    analyzing: 'Analyzing...',
    format: 'Format',
    formatDesc: 'name  pos_node  neg_node  value',
    formatExample: 'e.g. R1 1 2 1k — R1 between node ① and ②, 1kΩ',
    nodes: 'Nodes',
    nodesDesc: '0 = GND, other numbers are custom node IDs shown as circles in diagram',
    types: 'Types',
    typesDesc: 'R resistor · C capacitor · L inductor · V DC source · VAC AC source · I current source',
    suffix: 'Suffix',
    suffixDesc: 'k=1e3  m=1e-3  u=1e-6  n=1e-9  p=1e-12',
    dcAnalysis: 'DC Analysis',
    nodeVoltages: 'Node Voltages',
    node: 'Node',
    voltage: 'Voltage (V)',
    sourceCurrent: 'Source Currents',
    index: '#',
    current: 'Current (A)',
    acAnalysis: 'AC Analysis',
    magnitude: 'Magnitude (V)',
    phase: 'Phase (°)',
    frequency: 'Frequency (Hz)',
    noResults: 'No results. Check netlist syntax.',
    writeAndAnalyze: 'Write a netlist and click Analyze',
  },
}

type Lang = 'zh' | 'en'
type Theme = 'dark' | 'light'

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
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('ca-lang') as Lang) || 'zh')
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('ca-theme') as Theme) || 'dark')

  const t = i18n[lang]

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ca-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('ca-lang', lang)
  }, [lang])

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

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  const toggleLang = () => setLang(l => l === 'zh' ? 'en' : 'zh')

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>{t.title}</h1>
          <p className="subtitle">{t.subtitle}</p>
        </div>
        <div className="header-controls">
          <button className="toggle-btn" onClick={toggleLang}>
            {lang === 'zh' ? 'EN' : '中文'}
          </button>
          <button className="toggle-btn" onClick={toggleTheme}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </header>

      <div className="main-layout">
        <div className="left-panel">
          <CircuitDiagram netlist={netlist} voltages={result?.dc?.v} theme={theme} />
          <div className="editor-header">
            <h2>{t.netlist}</h2>
            <div className="editor-actions">
              <button className="btn-examples" onClick={() => setShowExamples(!showExamples)}>
                {t.examples}
              </button>
              <button className="btn-analyze" onClick={handleAnalyze} disabled={loading || !netlist.trim()}>
                {loading ? t.analyzing : t.analyze}
              </button>
            </div>
          </div>

          {showExamples && (
            <div className="examples-dropdown">
              {examples.map((ex, i) => (
                <div key={i} className="example-item" onClick={() => { setNetlist(ex.netlist); setShowExamples(false); setResult(null) }}>
                  <span className="example-name">{ex.name}</span>
                </div>
              ))}
            </div>
          )}

          <textarea
            className="code-editor"
            value={netlist}
            onChange={(e) => setNetlist(e.target.value)}
            placeholder={`R1 1 0 1k\nR2 1 2 2k\nV1 2 0 5`}
            spellCheck={false}
          />
          <div className="hints">
            <div className="hint-format">
              <span className="hint-label">{t.format}</span>
              <code>{t.formatDesc}</code>
              <span className="hint-example">{t.formatExample}</span>
            </div>
            <div className="hint-nodes">
              <span className="hint-label">{t.nodes}</span>
              <span>{t.nodesDesc}</span>
            </div>
            <div className="hint-types">
              <span className="hint-label">{t.types}</span>
              <span>{t.typesDesc}</span>
            </div>
            <div className="hint-suffix">
              <span className="hint-label">{t.suffix}</span>
              <span>{t.suffixDesc}</span>
            </div>
          </div>
        </div>

        <div className="right-panel">
          {error && <div className="error-bar">{error}</div>}

          {result && (
            <div className="results">
              {result.dc && <DCView data={result.dc} t={t} />}
              {result.acSweep && <ACView data={result.acSweep} t={t} theme={theme} />}
              {!result.dc && !result.acSweep && (
                <div className="no-results">{t.noResults}</div>
              )}
            </div>
          )}

          {!result && !error && (
            <div className="no-results">{t.writeAndAnalyze}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function DCView({ data, t }: { data: { v: number[]; i: number[] }; t: typeof i18n['zh'] }) {
  return (
    <div className="section">
      <h3>{t.dcAnalysis}</h3>
      <div className="results-grid">
        <div className="result-card">
          <h4>{t.nodeVoltages}</h4>
          <table className="result-table">
            <thead>
              <tr><th>{t.node}</th><th>{t.voltage}</th></tr>
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
            <h4>{t.sourceCurrent}</h4>
            <table className="result-table">
              <thead>
                <tr><th>{t.index}</th><th>{t.current}</th></tr>
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

function ACView({ data, t, theme }: {
  data: { frequencies: number[]; points: { v: { mag: number; phase: number }[] }[] }
  t: typeof i18n['zh']
  theme: Theme
}) {
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

    const bgColor = theme === 'dark' ? '#161b22' : '#ffffff'
    const textColor = theme === 'dark' ? '#8b949e' : '#57606a'

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, w, h)

    const magH = h / 2
    const v0Mags = data.points.map(p => p.v[0]?.mag || 0)
    const maxMag = Math.max(...v0Mags, 0.001)

    ctx.strokeStyle = '#58a6ff'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i < data.frequencies.length; i++) {
      const x = pad.left + (i / (data.frequencies.length - 1)) * (w - pad.left - pad.right)
      const y = pad.top + (1 - v0Mags[i] / maxMag) * (magH - pad.top - pad.bottom)
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.stroke()

    ctx.fillStyle = textColor
    ctx.font = '12px sans-serif'
    ctx.fillText(t.magnitude, pad.left, 14)

    const v0Phases = data.points.map(p => p.v[0]?.phase || 0)
    const phaseOffset = magH
    ctx.strokeStyle = '#ffa657'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i < data.frequencies.length; i++) {
      const x = pad.left + (i / (data.frequencies.length - 1)) * (w - pad.left - pad.right)
      const y = phaseOffset + pad.top + (1 - (v0Phases[i] + 90) / 180) * (magH - pad.top - pad.bottom)
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.fillStyle = textColor
    ctx.fillText(t.phase, pad.left, phaseOffset + 14)

    ctx.fillStyle = textColor
    ctx.font = '10px sans-serif'
    ctx.fillText(fmtFreq(data.frequencies[0]), pad.left, h - 4)
    ctx.fillText(fmtFreq(data.frequencies[data.frequencies.length - 1]), w - pad.right - 40, h - 4)
    ctx.fillText(t.frequency, w / 2 - 30, h - 4)
  }, [data, t, theme])

  return (
    <div className="section">
      <h3>{t.acAnalysis}</h3>
      <div className="bode-plot">
        <canvas ref={canvasRef} style={{ width: '100%', height: 260 }} />
      </div>
    </div>
  )
}

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
