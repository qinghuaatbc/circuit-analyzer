interface Element {
  type: string; name: string; pos: number; neg: number; value: number
}

const PAD = 40      // outer padding
const COL_W = 90    // horizontal spacing between top-rail nodes
const ROW_H = 90    // height of the circuit loop

interface Colors {
  bg: string; wire: string; bus: string; gnd: string
  nodeRing: string; nodeFill: string; nodeText: string
  gndRing: string; gndFill: string; gndText: string
  voltage: string; label: string; dot: string
}

function themeColors(theme?: string): Colors {
  if (theme === 'light') return {
    bg: '#ffffff', wire: '#24292f', bus: '#8c959f',
    gnd: '#24292f', nodeRing: '#0969da', nodeFill: '#ddf4ff',
    nodeText: '#0969da', gndRing: '#8c959f', gndFill: '#f0f2f5', gndText: '#8c959f',
    voltage: '#1a7f37', label: '#57606a', dot: '#0969da',
  }
  return {
    bg: '#161b22', wire: '#8b949e', bus: '#444c56',
    gnd: '#e6edf3', nodeRing: '#58a6ff', nodeFill: '#1f3a5f',
    nodeText: '#58a6ff', gndRing: '#484f58', gndFill: '#1a2a1a', gndText: '#484f58',
    voltage: '#7ee787', label: '#8b949e', dot: '#58a6ff',
  }
}

export default function CircuitDiagram({ netlist, voltages, theme }: { netlist: string; voltages?: number[]; theme?: string }) {
  const elements = parseNetlist(netlist)
  const c = themeColors(theme)
  if (elements.length === 0) return null

  // Lay out nodes: all non-ground nodes on top rail, ground at bottom
  const allNodeIds = new Set<number>()
  for (const el of elements) { allNodeIds.add(el.pos); allNodeIds.add(el.neg) }
  const topNodes = Array.from(allNodeIds).filter(id => id !== 0).sort((a, b) => a - b)

  // x positions for top-rail nodes, leftmost at PAD+COL_W (leave room for left-side source)
  const topX = new Map<number, number>()
  topNodes.forEach((id, i) => topX.set(id, PAD + COL_W * (i + 1)))

  const topY = PAD
  const botY = PAD + ROW_H
  const leftX = PAD
  const rightX = PAD + COL_W * (topNodes.length + 1)

  // For elements touching ground: ground end sits directly below the non-ground node.
  // This makes vertical components (V, R to ground) draw straight down.
  const posOf = (id: number, otherId?: number): { x: number; y: number } => {
    if (id === 0) {
      const otherX = otherId !== undefined ? (topX.get(otherId) ?? leftX) : leftX
      return { x: otherX, y: botY }
    }
    return { x: topX.get(id) ?? leftX, y: topY }
  }

  // Count how many elements connect to each node for junction dots
  const nodeRefCount = new Map<number, number>()
  for (const el of elements) {
    nodeRefCount.set(el.pos, (nodeRefCount.get(el.pos) ?? 0) + 1)
    nodeRefCount.set(el.neg, (nodeRefCount.get(el.neg) ?? 0) + 1)
  }

  const W = rightX + PAD
  const H = botY + PAD + 20

  return (
    <div className="circuit-diagram">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
        style={{ background: c.bg, display: 'block' }}>

        {/* Ground bus */}
        <line x1={leftX} y1={botY} x2={rightX} y2={botY} stroke={c.bus} strokeWidth={2} strokeDasharray="4,3" />

        {elements.map((el, i) => {
          const p1 = posOf(el.pos, el.neg)
          const p2 = posOf(el.neg, el.pos)
          const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y
          const isVertical = x1 === x2
          const isHorizontal = y1 === y2

          if (isVertical) {
            const cy = (y1 + y2) / 2
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.wire} strokeWidth={2} />
                {drawComponent(el, x1, cy, false, false, c)}
                {(nodeRefCount.get(el.pos) ?? 0) >= 3 && dot(x1, y1, c)}
                {(nodeRefCount.get(el.neg) ?? 0) >= 3 && dot(x2, y2, c)}
                {label(el, x1 + 18, cy, c)}
              </g>
            )
          }

          if (isHorizontal) {
            const cx = (x1 + x2) / 2
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.wire} strokeWidth={2} />
                {drawComponent(el, cx, y1, true, false, c)}
                {(nodeRefCount.get(el.pos) ?? 0) >= 3 && dot(x1, y1, c)}
                {(nodeRefCount.get(el.neg) ?? 0) >= 3 && dot(x2, y2, c)}
                {label(el, cx, y1 - 4, c)}
              </g>
            )
          }

          // L-shaped routing for diagonal connections
          const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1)
          const mx = x2, my = y1
          const hCx = (x1 + mx) / 2, vCy = (my + y2) / 2
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={mx} y2={my} stroke={c.wire} strokeWidth={2} />
              <line x1={mx} y1={my} x2={x2} y2={y2} stroke={c.wire} strokeWidth={2} />
              {dx >= dy
                ? drawComponent(el, hCx, y1, true, false, c)
                : drawComponent(el, x2, vCy, false, false, c)}
              {(nodeRefCount.get(el.pos) ?? 0) >= 3 && dot(x1, y1, c)}
              {(nodeRefCount.get(el.neg) ?? 0) >= 3 && dot(x2, y2, c)}
              {label(el, hCx, y1 - 4, c)}
            </g>
          )
        })}

        {/* Ground symbols below each node that connects to ground */}
        {(() => {
          const gndXs = new Set<number>()
          for (const el of elements) {
            if (el.pos === 0) gndXs.add(topX.get(el.neg) ?? leftX)
            if (el.neg === 0) gndXs.add(topX.get(el.pos) ?? leftX)
          }
          return Array.from(gndXs).map(gx => (
            <g key={`gnd-${gx}`}>
              <line x1={gx-14} y1={botY+2} x2={gx+14} y2={botY+2} stroke={c.gnd} strokeWidth={2.5} />
              <line x1={gx-9} y1={botY+8} x2={gx+9} y2={botY+8} stroke={c.gnd} strokeWidth={2} />
              <line x1={gx-4} y1={botY+14} x2={gx+4} y2={botY+14} stroke={c.gnd} strokeWidth={1.5} />
            </g>
          ))
        })()}

        {/* Node number badges on top rail */}
        {topNodes.map(id => {
          const x = topX.get(id) ?? 0
          return (
            <g key={`n${id}`}>
              <circle cx={x} cy={topY} r={10} fill={c.nodeFill} stroke={c.nodeRing} strokeWidth={1.5} />
              <text x={x} y={topY} textAnchor="middle" dominantBaseline="central"
                fill={c.nodeText} fontSize={10} fontFamily="monospace" fontWeight="700">
                {id}
              </text>
            </g>
          )
        })}

        {/* Ground node badge */}
        {(() => {
          const gndXs = new Set<number>()
          for (const el of elements) {
            if (el.pos === 0) gndXs.add(topX.get(el.neg) ?? leftX)
            if (el.neg === 0) gndXs.add(topX.get(el.pos) ?? leftX)
          }
          return Array.from(gndXs).map(gx => (
            <g key={`n0-${gx}`}>
              <circle cx={gx} cy={botY} r={10} fill={c.gndFill} stroke={c.gndRing} strokeWidth={1.5} />
              <text x={gx} y={botY} textAnchor="middle" dominantBaseline="central"
                fill={c.gndText} fontSize={10} fontFamily="monospace" fontWeight="700">
                0
              </text>
            </g>
          ))
        })()}

        {/* Node voltage labels */}
        {voltages && topNodes.map(id => {
          const x = topX.get(id) ?? 0
          const v = voltages[id - 1]
          return v !== undefined ? (
            <text key={`v${id}`} x={x} y={topY - 16}
              textAnchor="middle" fill={c.voltage} fontSize={10} fontFamily="monospace" fontWeight="600">
              {v.toFixed(2)}V
            </text>
          ) : null
        })}
      </svg>
    </div>
  )
}

function drawComponent(el: Element, cx: number, cy: number, horizontal: boolean, angled = false, c?: Colors) {
  const componentColor = el.type === 'R'
    ? (c ? c.wire : '#e6edf3')
    : el.type === 'C' ? '#58a6ff'
    : el.type === 'L' ? '#7ee787'
    : '#ffa657'
  if (horizontal || angled) {
    return drawInline(el, cx, cy, componentColor)
  }
  return (
    <g transform={`rotate(90, ${cx}, ${cy})`}>
      {drawInline(el, cx, cy, componentColor)}
    </g>
  )
}

function drawInline(el: Element, cx: number, cy: number, color: string) {
  const half = 12
  switch (el.type) {
    case 'R':
      return (
        <g>
          <line x1={cx-half} y1={cy} x2={cx-half+6} y2={cy} stroke={color} strokeWidth={1.5} />
          <path d={`M${cx-half+6},${cy} L${cx-6},${cy-8} L${cx+2},${cy+8} L${cx+10},${cy-8} L${cx+half-6},${cy}`}
            fill="none" stroke={color} strokeWidth={2} />
          <line x1={cx+half-6} y1={cy} x2={cx+half} y2={cy} stroke={color} strokeWidth={1.5} />
        </g>
      )
    case 'C':
      return (
        <g>
          <line x1={cx-half} y1={cy} x2={cx-7} y2={cy} stroke={color} strokeWidth={1.5} />
          <line x1={cx-7} y1={cy-8} x2={cx-7} y2={cy+8} stroke={color} strokeWidth={2.5} />
          <line x1={cx+7} y1={cy-8} x2={cx+7} y2={cy+8} stroke={color} strokeWidth={2.5} />
          <line x1={cx+7} y1={cy} x2={cx+half} y2={cy} stroke={color} strokeWidth={1.5} />
        </g>
      )
    case 'L':
      return (
        <g>
          <line x1={cx-half} y1={cy} x2={cx-10} y2={cy} stroke={color} strokeWidth={1.5} />
          {[0,1,2,3].map(j => (
            <path key={j} d={`M ${cx-8+j*7} ${cy-7} Q ${cx-4+j*7} ${cy} ${cx-8+j*7} ${cy+7}`}
              fill="none" stroke={color} strokeWidth={2} />
          ))}
          <line x1={cx+10} y1={cy} x2={cx+half} y2={cy} stroke={color} strokeWidth={1.5} />
        </g>
      )
    case 'V': case 'VAC':
      return (
        <g>
          <line x1={cx-half} y1={cy} x2={cx-11} y2={cy} stroke={color} strokeWidth={1.5} />
          <circle cx={cx} cy={cy} r={11} fill="none" stroke={color} strokeWidth={2} />
          <text x={cx} y={cy} textAnchor="middle" fill={color} fontSize={12}
            dominantBaseline="central" fontWeight="bold">
            {el.type === 'VAC' ? '~' : 'V'}
          </text>
          <line x1={cx+11} y1={cy} x2={cx+half} y2={cy} stroke={color} strokeWidth={1.5} />
        </g>
      )
    case 'I':
      return (
        <g>
          <line x1={cx-half} y1={cy} x2={cx-8} y2={cy} stroke={color} strokeWidth={1.5} />
          <polygon points={`${cx-8},${cy-6} ${cx+8},${cy} ${cx-8},${cy+6}`} fill="none" stroke={color} strokeWidth={2} />
          <line x1={cx+8} y1={cy} x2={cx+half} y2={cy} stroke={color} strokeWidth={1.5} />
        </g>
      )
    default:
      return null
  }
}

function label(el: Element, x: number, y: number, c?: Colors) {
  return (
    <text x={x} y={y - 6} textAnchor="middle" fill={c?.label ?? '#8b949e'} fontSize={9} fontFamily="monospace">
      {el.name} {fmtVal(el.value)}
    </text>
  )
}

function dot(x: number, y: number, c?: Colors) {
  return <circle cx={x} cy={y} r={3} fill={c?.dot ?? '#58a6ff'} stroke={c?.bg ?? '#0d1117'} strokeWidth={1.5} />
}

function parseNetlist(netlist: string): Element[] {
  const els: Element[] = []
  for (const line of netlist.split('\n')) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 4) continue
    if (parts[0].startsWith('#') || parts[0].startsWith('//')) continue
    const name = parts[0], prefix = name[0].toUpperCase()
    const pos = parseInt(parts[1]), neg = parseInt(parts[2])
    if (isNaN(pos) || isNaN(neg)) continue
    els.push({ type: prefix, name, pos, neg, value: parseValue(parts[3]) })
  }
  return els
}

function parseValue(s: string): number {
  const mult: Record<string, number> = { k: 1e3, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12 }
  const suffix = s.slice(-1).toLowerCase()
  const num = parseFloat(s)
  if (mult[suffix]) return num * mult[suffix]
  return num
}

function fmtVal(v: number): string {
  if (v >= 1e6) return (v / 1e6).toFixed(0) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'k'
  if (v >= 1) return v.toFixed(0)
  if (v >= 1e-6) return (v * 1e6).toFixed(0) + 'u'
  if (v >= 1e-9) return (v * 1e9).toFixed(0) + 'n'
  return v.toExponential(0)
}

