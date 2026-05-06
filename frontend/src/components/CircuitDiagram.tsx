interface Element {
  type: string; name: string; pos: number; neg: number; value: number
}

interface Node { id: number; x: number; y: number; output?: boolean }

export default function CircuitDiagram({ netlist, voltages }: { netlist: string; voltages?: number[] }) {
  const elements = parseNetlist(netlist)
  if (elements.length === 0) return null

  const nodes = layoutHierarchical(elements)
  const svgW = 500; const svgH = 320

  // Find max node number for display
  const maxNode = Math.max(...nodes.map(n => n.id))

  return (
    <div className="circuit-diagram">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" height={220} style={{background:'#0d1117'}}>
        {elements.map((el, i) => {
          const p1 = nodes.find(n => n.id === el.pos)
          const p2 = nodes.find(n => n.id === el.neg)
          if (!p1 || !p2) return null
          const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2
          const dx = p2.x - p1.x, dy = p2.y - p1.y
          const angle = Math.atan2(dy, dx) * 180 / Math.PI
          const len = Math.sqrt(dx*dx + dy*dy)
          const segLen = 30 // length of the component symbol

          // Draw wire segments (component in middle, wires on sides)
          const midX = p1.x + dx * 0.5, midY = p1.y + dy * 0.5
          const halfSeg = segLen / len / 2
          const wx1 = p1.x + dx * (0.5 - halfSeg), wy1 = p1.y + dy * (0.5 - halfSeg)
          const wx2 = p1.x + dx * (0.5 + halfSeg), wy2 = p1.y + dy * (0.5 + halfSeg)

          // Determine component color
          const color = el.type === 'R' ? '#e6edf3' : el.type === 'C' ? '#58a6ff' : el.type === 'L' ? '#7ee787' : '#ffa657'

          return (
            <g key={i}>
              {/* Wires */}
              <line x1={p1.x} y1={p1.y} x2={wx1} y2={wy1} stroke="#30363d" strokeWidth={2} />
              <line x1={wx2} y1={wy2} x2={p2.x} y2={p2.y} stroke="#30363d" strokeWidth={2} />

              {/* Node dots */}
              {renderNodeDot(p1.x, p1.y)}
              {renderNodeDot(p2.x, p2.y)}

              {/* Component symbol */}
              <g transform={`translate(${midX},${midY}) rotate(${angle})`}>
                {el.type === 'R' && (
                  <>
                    <line x1={-segLen/2} y1={0} x2={-segLen/2+6} y2={0} stroke={color} strokeWidth={1.5} />
                    {zigzag(segLen-12, 5, color)}
                    <line x1={segLen/2-6} y1={0} x2={segLen/2} y2={0} stroke={color} strokeWidth={1.5} />
                  </>
                )}
                {el.type === 'C' && (
                  <>
                    <line x1={-segLen/2} y1={0} x2={-8} y2={0} stroke={color} strokeWidth={1.5} />
                    <line x1={-8} y1={-7} x2={-8} y2={7} stroke={color} strokeWidth={2.5} />
                    <line x1={8} y1={-7} x2={8} y2={7} stroke={color} strokeWidth={2.5} />
                    <line x1={8} y1={0} x2={segLen/2} y2={0} stroke={color} strokeWidth={1.5} />
                  </>
                )}
                {el.type === 'L' && (
                  <>
                    <line x1={-segLen/2} y1={0} x2={-segLen/2+6} y2={0} stroke={color} strokeWidth={1.5} />
                    {[0,1,2,3].map(j => (
                      <path key={j} d={`M ${-segLen/2+8+j*7} ${-6} Q ${-segLen/2+12+j*7} 0 ${-segLen/2+8+j*7} ${6}`}
                        fill="none" stroke={color} strokeWidth={2} />
                    ))}
                    <line x1={segLen/2-6} y1={0} x2={segLen/2} y2={0} stroke={color} strokeWidth={1.5} />
                  </>
                )}
                {(el.type === 'V' || el.type === 'VAC') && (
                  <>
                    <line x1={-segLen/2} y1={0} x2={-14} y2={0} stroke={color} strokeWidth={1.5} />
                    <circle cx={0} cy={0} r={14} fill="none" stroke={color} strokeWidth={2} />
                    <text x={0} y={1} textAnchor="middle" fill={color} fontSize={14} dominantBaseline="central" fontWeight="bold">
                      {el.type === 'VAC' ? '~' : '+'}
                    </text>
                    <line x1={14} y1={0} x2={segLen/2} y2={0} stroke={color} strokeWidth={1.5} />
                  </>
                )}
                {el.type === 'I' && (
                  <>
                    <line x1={-segLen/2} y1={0} x2={-10} y2={0} stroke={color} strokeWidth={1.5} />
                    <polygon points="-10,-7 10,0 -10,7" fill="none" stroke={color} strokeWidth={2} />
                    <line x1={10} y1={0} x2={segLen/2} y2={0} stroke={color} strokeWidth={1.5} />
                  </>
                )}
              </g>

              {/* Label */}
              <text x={midX} y={midY + (Math.abs(angle) > 45 ? 20 : -14)}
                textAnchor="middle" fill="#8b949e" fontSize={10} fontFamily="monospace">
                {el.name} {fmtVal(el.value)}
              </text>
            </g>
          )
        })}

        {/* Ground symbol */}
        {nodes.filter(n => n.id === 0).map(n => (
          <g key="gnd">
            <line x1={n.x-15} y1={n.y} x2={n.x+15} y2={n.y} stroke="#e6edf3" strokeWidth={2.5} />
            <line x1={n.x-10} y1={n.y+6} x2={n.x+10} y2={n.y+6} stroke="#e6edf3" strokeWidth={2} />
            <line x1={n.x-5} y1={n.y+12} x2={n.x+5} y2={n.y+12} stroke="#e6edf3" strokeWidth={1.5} />
          </g>
        ))}

        {/* Non-zero node labels */}
        {nodes.filter(n => n.id > 0).map(n => (
          n.output && (
            <text key={`vl-${n.id}`} x={n.x + 8} y={n.y - 8}
              fill="#7ee787" fontSize={11} fontFamily="monospace">
              {voltages && voltages[n.id-1] !== undefined ? voltages[n.id-1].toFixed(2)+'V' : `N${n.id}`}
            </text>
          )
        ))}
      </svg>
    </div>
  )
}

function renderNodeDot(x: number, y: number) {
  return <circle cx={x} cy={y} r={3.5} fill="#58a6ff" stroke="#0d1117" strokeWidth={1.5} />
}

function zigzag(w: number, peaks: number, color: string) {
  const seg = w / (peaks * 2)
  let d = `M ${-w/2} 0`
  for (let i = 0; i < peaks; i++) {
    d += ` L ${-w/2 + seg + i*seg*2} ${-7} L ${-w/2 + seg*2 + i*seg*2} ${7}`
  }
  d += ` L ${w/2} 0`
  return <path d={d} fill="none" stroke={color} strokeWidth={2} />
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

function layoutHierarchical(elements: Element[]): Node[] {
  const placed = new Map<number, Node>()

  // Ground at bottom
  placed.set(0, { id: 0, x: 250, y: 290, output: false })
  if (placed.has(0)) placed.set(0, { id: 0, x: 250, y: 290, output: false })

  // Find connected components and voltage sources
  const connections = new Map<number, Set<number>>()
  const added = new Set<number>()

  for (const el of elements) {
    if (!connections.has(el.pos)) connections.set(el.pos, new Set())
    if (!connections.has(el.neg)) connections.set(el.neg, new Set())
    connections.get(el.pos)!.add(el.neg)
    connections.get(el.neg)!.add(el.pos)
  }

  // BFS to find level for each node
  const levels: number[] = []
  const queue: number[] = []
  
  // Start from ground
  if (connections.has(0)) {
    levels[0] = 1  // ground level
    queue.push(0)
  }

  // BFS
  while (queue.length > 0) {
    const node = queue.shift()!
    for (const neighbor of connections.get(node) || []) {
      if (levels[neighbor] === undefined) {
        const isGroundRelated = levels[node] === 0 || node === 0
        levels[neighbor] = levels[node] + (isGroundRelated ? 2 : 1)
        queue.push(neighbor)
      }
    }
  }

  // Assign level 0 to any unvisited nodes
  for (const [node] of connections) {
    if (levels[node] === undefined) {
      levels[node] = 0
    }
  }

  // Count nodes per level for horizontal spacing
  const perLevel = new Map<number, number>()
  const levelIndex = new Map<number, number>()
  for (const [node] of connections) {
    const lv = levels[node] || 0
    perLevel.set(lv, (perLevel.get(lv) || 0) + 1)
    levelIndex.set(node, (levelIndex.get(node) || 0))
  }

  // Track horizontal position within each level
  const levelCounters = new Map<number, number>()
  for (const [node] of connections) {
    const lv = levels[node] || 0
    levelCounters.set(lv, (levelCounters.get(lv) || 0))
  }

  const sortedNodes = Array.from(connections.keys()).sort((a, b) => {
    const la = levels[a] || 0, lb = levels[b] || 0
    if (la !== lb) return la - lb
    return a - b
  })

  for (const node of sortedNodes) {
    const lv = levels[node] || 0
    const cnt = levelCounters.get(lv) || 0
    const total = perLevel.get(lv) || 1
    const x = (cnt + 1) / (total + 1) * 500
    levelCounters.set(lv, cnt + 1)
    const y = lv === 0 ? 100 : lv === 1 ? 290 : (lv === 2 ? 100 : 100 + lv * 60)
    const isOutput = elements.some(e => e.neg === node && (e.type === 'R' || e.type === 'C' || e.type === 'L'))
    placed.set(node, { id: node, x: Math.max(40, Math.min(460, x)), y, output: isOutput })
  }

  return Array.from(placed.values()).sort((a, b) => a.id - b.id)
}

function fmtVal(v: number): string {
  if (v >= 1e6) return (v / 1e6).toFixed(0) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'k'
  if (v >= 1) return v.toFixed(0)
  if (v >= 1e-3) return (v * 1e3).toFixed(0) + 'm'
  if (v >= 1e-6) return (v * 1e6).toFixed(0) + 'u'
  return v.toExponential(0)
}
