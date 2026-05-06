interface Element {
  type: string
  name: string
  pos: number
  neg: number
  value: number
}

interface Node {
  id: number
  x: number
  y: number
}

export default function CircuitDiagram({ netlist, voltages }: { netlist: string; voltages?: number[] }) {
  const elements = parseNetlist(netlist)
  if (elements.length === 0) return null

  const nodes = layoutNodes(elements)
  const svgW = 400
  const svgH = 300

  return (
    <div className="circuit-diagram">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" height="200">
        {/* Grid dots */}
        {nodes.map(n => (
          <circle key={n.id} cx={n.x} cy={n.y} r={3} fill="#58a6ff" />
        ))}

        {/* Elements */}
        {elements.map((el, i) => {
          const p1 = nodes.find(n => n.id === el.pos)
          const p2 = nodes.find(n => n.id === el.neg)
          if (!p1 || !p2) return null

          const mx = (p1.x + p2.x) / 2
          const my = (p1.y + p2.y) / 2
          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI
          const len = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)

          return (
            <g key={i}>
              {/* Connecting wires */}
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#30363d" strokeWidth={2} />

              {/* Component symbol */}
              {el.type === 'R' && (
                <g transform={`translate(${mx},${my}) rotate(${angle})`}>
                  <rect x={-15} y={-4} width={30} height={8} fill="#161b22" stroke="#e6edf3" strokeWidth={1.5} rx={1} />
                </g>
              )}
              {el.type === 'C' && (
                <g transform={`translate(${mx},${my}) rotate(${angle})`}>
                  <line x1={-12} y1={-6} x2={-12} y2={6} stroke="#e6edf3" strokeWidth={2} />
                  <line x1={12} y1={-6} x2={12} y2={6} stroke="#e6edf3" strokeWidth={2} />
                </g>
              )}
              {el.type === 'L' && (
                <g transform={`translate(${mx},${my}) rotate(${angle})`}>
                  {[0,1,2,3].map(j => (
                    <path key={j} d={`M ${-12+j*8} ${-6} Q ${-8+j*8} 0 ${-12+j*8} ${6}`}
                      fill="none" stroke="#e6edf3" strokeWidth={1.5} />
                  ))}
                </g>
              )}
              {(el.type === 'V' || el.type === 'VAC') && (
                <g transform={`translate(${mx},${my}) rotate(${angle})`}>
                  <circle cx={0} cy={0} r={12} fill="none" stroke="#e6edf3" strokeWidth={1.5} />
                  <text x={0} y={1} textAnchor="middle" fill="#e6edf3" fontSize={10} dominantBaseline="central">
                    {el.type === 'VAC' ? '~' : '+'}
                  </text>
                </g>
              )}
              {el.type === 'I' && (
                <g transform={`translate(${mx},${my}) rotate(${angle})`}>
                  <polygon points="-8,-6 8,0 -8,6" fill="none" stroke="#e6edf3" strokeWidth={1.5} />
                </g>
              )}

              {/* Label */}
              <text
                x={mx} y={my + (Math.abs(angle) > 45 ? 20 : -12)}
                textAnchor="middle" fill="#8b949e" fontSize={10}
              >
                {el.name} {fmtVal(el.value)}
              </text>

              {/* Voltage */}
              {voltages && voltages[el.pos - 1] !== undefined && el.neg === 0 && (
                <text
                  x={p1.x + 10} y={p1.y - 10}
                  fill="#7ee787" fontSize={10}
                >
                  {voltages[el.pos - 1].toFixed(2)}V
                </text>
              )}
            </g>
          )
        })}

        {/* Ground symbols */}
        {nodes.filter(n => n.id === 0).map(n => (
          <g key="gnd">
            <line x1={n.x - 10} y1={n.y} x2={n.x + 10} y2={n.y} stroke="#e6edf3" strokeWidth={2} />
            <line x1={n.x - 6} y1={n.y + 5} x2={n.x + 6} y2={n.y + 5} stroke="#e6edf3" strokeWidth={1.5} />
            <line x1={n.x - 3} y1={n.y + 10} x2={n.x + 3} y2={n.y + 10} stroke="#e6edf3" strokeWidth={1} />
          </g>
        ))}
      </svg>
    </div>
  )
}

function parseNetlist(netlist: string): Element[] {
  const els: Element[] = []
  for (const line of netlist.split('\n')) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 4) continue
    if (parts[0].startsWith('#') || parts[0].startsWith('//')) continue
    const name = parts[0]
    const prefix = name[0].toUpperCase()
    const pos = parseInt(parts[1])
    const neg = parseInt(parts[2])
    const val = parseValue(parts[3])
    if (isNaN(pos) || isNaN(neg)) continue
    els.push({ type: prefix, name, pos, neg, value: val })
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

function layoutNodes(elements: Element[]): Node[] {
  const nodeSet = new Set<number>()
  elements.forEach(e => { nodeSet.add(e.pos); nodeSet.add(e.neg) })
  const nodeIds = Array.from(nodeSet).sort((a, b) => a - b)
  const nodes: Node[] = []
  const nodeCount = nodeIds.length
  const placed = new Map<number, Node>()

  // Ground at bottom center
  const gnd = nodeIds.find(n => n === 0)
  if (gnd !== undefined) {
    placed.set(0, { id: 0, x: 200, y: 250 })
  }

  // Place other nodes in a circle or horizontal line
  let i = 0
  for (const id of nodeIds) {
    if (id === 0) continue
    const angle = (i / (nodeCount - (gnd !== undefined ? 1 : 0))) * 2 * Math.PI - Math.PI / 2
    const cx = 200 + (id === 0 ? 0 : 120 * Math.cos(angle))
    const cy = (id === 0 ? 250 : 120 + 80 * Math.sin(angle))
    placed.set(id, { id, x: cx, y: cy })
    i++
  }

  for (const [id, n] of placed) nodes.push(n)
  return nodes.sort((a, b) => a.id - b.id)
}

function fmtVal(v: number): string {
  if (v >= 1e6) return (v / 1e6).toFixed(0) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'k'
  if (v >= 1) return v.toFixed(0)
  if (v >= 1e-3) return (v * 1e3).toFixed(0) + 'm'
  if (v >= 1e-6) return (v * 1e6).toFixed(0) + 'u'
  return v.toExponential(0)
}
