interface Element {
  type: string; name: string; pos: number; neg: number; value: number
}
interface Node { id: number; x: number; y: number }

export default function CircuitDiagram({ netlist, voltages }: { netlist: string; voltages?: number[] }) {
  const elements = parseNetlist(netlist)
  if (elements.length === 0) return null

  const W = 600, H = 260
  let nodes = layoutSmart(elements, W, H)

  // Center the circuit vertically
  const ys = nodes.map(n => n.y)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const cy = (minY + maxY) / 2
  const shift = H / 2 - cy
  if (Math.abs(shift) > 5) {
    nodes = nodes.map(n => ({ ...n, y: n.y + shift }))
  }

  return (
    <div className="circuit-diagram">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{background:'#0d1117', display:'block'}}>
        {elements.map((el, i) => {
          const p1 = nodes.find(n => n.id === el.pos)
          const p2 = nodes.find(n => n.id === el.neg)
          if (!p1 || !p2) return null
          const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2
          const dx = p2.x - p1.x, dy = p2.y - p1.y
          const angle = Math.atan2(dy, dx) * 180 / Math.PI
          const len = Math.sqrt(dx*dx + dy*dy)
          const halfSeg = 14 / len

          const wx1 = p1.x + dx * (0.5 - halfSeg), wy1 = p1.y + dy * (0.5 - halfSeg)
          const wx2 = p1.x + dx * (0.5 + halfSeg), wy2 = p1.y + dy * (0.5 + halfSeg)

          const color = el.type === 'R' ? '#e6edf3' : el.type === 'C' ? '#58a6ff' : el.type === 'L' ? '#7ee787' : '#ffa657'
          const symColor = el.type === 'R' ? '#e6edf3' : el.type === 'C' ? '#58a6ff' : el.type === 'L' ? '#7ee787' : '#ffa657'

          return (
            <g key={i}>
              <line x1={p1.x} y1={p1.y} x2={wx1} y2={wy1} stroke="#30363d" strokeWidth={2} />
              <line x1={wx2} y1={wy2} x2={p2.x} y2={p2.y} stroke="#30363d" strokeWidth={2} />
              {dot(p1.x, p1.y)}
              {dot(p2.x, p2.y)}

              <g transform={`translate(${mx},${my}) rotate(${angle})`}>
                {el.type === 'R' && (
                  <>
                    <line x1={-18} y1={0} x2={-14} y2={0} stroke={color} strokeWidth={1.5} />
                    <path d="M-14,0 L-10,-8 L-2,8 L6,-8 L14,0" fill="none" stroke={symColor} strokeWidth={2} />
                    <line x1={14} y1={0} x2={18} y2={0} stroke={color} strokeWidth={1.5} />
                  </>
                )}
                {el.type === 'C' && (
                  <>
                    <line x1={-18} y1={0} x2={-8} y2={0} stroke={color} strokeWidth={1.5} />
                    <line x1={-8} y1={-8} x2={-8} y2={8} stroke={symColor} strokeWidth={2.5} />
                    <line x1={8} y1={-8} x2={8} y2={8} stroke={symColor} strokeWidth={2.5} />
                    <line x1={8} y1={0} x2={18} y2={0} stroke={color} strokeWidth={1.5} />
                  </>
                )}
                {el.type === 'L' && (
                  <>
                    <line x1={-18} y1={0} x2={-14} y2={0} stroke={color} strokeWidth={1.5} />
                    {[0,1,2,3].map(j => (
                      <path key={j} d={`M ${-12+j*8} ${-7} Q ${-8+j*8} 0 ${-12+j*8} ${7}`}
                        fill="none" stroke={symColor} strokeWidth={2} />
                    ))}
                    <line x1={14} y1={0} x2={18} y2={0} stroke={color} strokeWidth={1.5} />
                  </>
                )}
                {(el.type === 'V' || el.type === 'VAC') && (
                  <>
                    <line x1={-18} y1={0} x2={-12} y2={0} stroke={color} strokeWidth={1.5} />
                    <circle cx={0} cy={0} r={12} fill="none" stroke={symColor} strokeWidth={2} />
                    <text x={0} y={0} textAnchor="middle" fill={symColor} fontSize={13} dominantBaseline="central" fontWeight="bold">
                      {el.type === 'VAC' ? '~' : 'V'}
                    </text>
                    <line x1={12} y1={0} x2={18} y2={0} stroke={color} strokeWidth={1.5} />
                  </>
                )}
                {el.type === 'I' && (
                  <>
                    <line x1={-18} y1={0} x2={-10} y2={0} stroke={color} strokeWidth={1.5} />
                    <polygon points="-10,-6 10,0 -10,6" fill="none" stroke={symColor} strokeWidth={2} />
                    <line x1={10} y1={0} x2={18} y2={0} stroke={color} strokeWidth={1.5} />
                  </>
                )}
              </g>

              <text x={mx} y={my + (Math.abs(angle) > 60 ? 22 : -14)}
                textAnchor="middle" fill="#8b949e" fontSize={10} fontFamily="monospace">
                {el.name} {fmtVal(el.value)}
              </text>
            </g>
          )
        })}

        {/* Ground */}
        {nodes.filter(n => n.id === 0).map(n => (
          <g key="gnd">
            {dot(n.x, n.y)}
            <line x1={n.x-16} y1={n.y} x2={n.x+16} y2={n.y} stroke="#e6edf3" strokeWidth={2.5} />
            <line x1={n.x-10} y1={n.y+6} x2={n.x+10} y2={n.y+6} stroke="#e6edf3" strokeWidth={2} />
            <line x1={n.x-5} y1={n.y+12} x2={n.x+5} y2={n.y+12} stroke="#e6edf3" strokeWidth={1.5} />
          </g>
        ))}

        {/* Voltage labels */}
        {voltages && nodes.filter(n => n.id > 0).map(n => {
          const v = voltages[n.id - 1]
          return v !== undefined ? (
            <text key={`v${n.id}`} x={n.x + 10} y={n.y - 8}
              fill="#7ee787" fontSize={11} fontFamily="monospace" fontWeight="600">
              {v.toFixed(2)}V
            </text>
          ) : null
        })}
      </svg>
    </div>
  )
}

function dot(x: number, y: number) {
  return <circle cx={x} cy={y} r={3.5} fill="#58a6ff" stroke="#0d1117" strokeWidth={1.5} />
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

function layoutSmart(elements: Element[], W: number, H: number): Node[] {
  const nodeMap = new Map<number, { x: number; y: number }>()

  // Ground at bottom center
  nodeMap.set(0, { x: W / 2, y: H - 15 })

  // Build adjacency
  const adj = new Map<number, number[]>()
  for (const el of elements) {
    if (!adj.has(el.pos)) adj.set(el.pos, [])
    if (!adj.has(el.neg)) adj.set(el.neg, [])
    adj.get(el.pos)!.push(el.neg)
    adj.get(el.neg)!.push(el.pos)
  }

  // Find source (voltage source or highest degree node)
  let source = -1
  for (const el of elements) {
    if (el.type === 'V' || el.type === 'VAC') {
      source = el.pos !== 0 ? el.pos : el.neg
      break
    }
  }
  if (source === -1 || source === 0) {
    for (const [id] of adj) {
      if (id !== 0) { source = id; break }
    }
  }

  // BFS levels
  const level = new Map<number, number>()
  if (source > 0) {
    level.set(source, 0)
    const q = [source]
    while (q.length > 0) {
      const cur = q.shift()!
      for (const nb of adj.get(cur) || []) {
        if (!level.has(nb) && nb !== 0) {
          level.set(nb, level.get(cur)! + 1)
          q.push(nb)
        }
      }
    }
  }

  // Assign positions by level
  const maxLevel = Math.max(0, ...level.values())
  const perLevel = new Map<number, number[]>()
  for (const [id, lv] of level) {
    if (!perLevel.has(lv)) perLevel.set(lv, [])
    perLevel.get(lv)!.push(id)
  }

  const topY = 35
  const bottomY = H - 45
  const yRange = bottomY - topY

  for (const [lv, ids] of perLevel) {
    const y = maxLevel > 0 ? topY + (lv / maxLevel) * yRange : topY + yRange / 2
    ids.sort((a, b) => a - b)
    for (let i = 0; i < ids.length; i++) {
      const x = W * (i + 1) / (ids.length + 1)
      nodeMap.set(ids[i], { x, y })
    }
  }

  // Source node on left if not already placed
  if (source > 0 && nodeMap.has(source)) {
    const p = nodeMap.get(source)!
    nodeMap.set(source, { x: Math.min(p.x, W * 0.25), y: p.y })
  }

  // Any unplaced nodes
  for (const [id] of adj) {
    if (!nodeMap.has(id)) {
      nodeMap.set(id, { x: W * 0.5, y: H * 0.4 })
    }
  }

  // Remove ground label by moving it to bottom
  if (nodeMap.has(0)) {
    nodeMap.set(0, { x: W / 2, y: H - 15 })
  }

  const result: Node[] = []
  for (const [id, p] of nodeMap) {
    result.push({ id, x: Math.max(25, Math.min(W - 25, p.x)), y: Math.max(10, Math.min(H - 20, p.y)) })
  }
  return result.sort((a, b) => a.id - b.id)
}

function fmtVal(v: number): string {
  if (v >= 1e6) return (v / 1e6).toFixed(0) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'k'
  if (v >= 1) return v.toFixed(0)
  if (v >= 1e-3) return (v * 1e3).toFixed(0) + 'm'
  if (v >= 1e-6) return (v * 1e6).toFixed(0) + 'u'
  return v.toExponential(0)
}
