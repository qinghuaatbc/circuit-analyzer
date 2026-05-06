interface Element {
  type: string; name: string; pos: number; neg: number; value: number
}

interface GridNode { id: number; col: number; row: number; x: number; y: number }

const CELL = 44 // grid cell size in px

export default function CircuitDiagram({ netlist, voltages }: { netlist: string; voltages?: number[] }) {
  const elements = parseNetlist(netlist)
  if (elements.length === 0) return null

  const { nodes, cols, rows } = gridLayout(elements)
  const W = (cols + 1) * CELL
  const H = (rows + 2) * CELL

  const nodePos = (id: number) => nodes.find(n => n.id === id)

  return (
    <div className="circuit-diagram">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
        style={{ background: '#0d1117', display: 'block' }}>
        
        {elements.map((el, i) => {
          const p1 = nodePos(el.pos)
          const p2 = nodePos(el.neg)
          if (!p1 || !p2) return null

          const isHorizontal = p1.row === p2.row
          const isVertical = p1.col === p2.col
          const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y

          if (!isHorizontal && !isVertical) {
            // L-shaped routing: horizontal then vertical
            const mx = x2, my = y1
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={mx} y2={my} stroke="#30363d" strokeWidth={2} />
                <line x1={mx} y1={my} x2={x2} y2={y2} stroke="#30363d" strokeWidth={2} />
                {drawComponent(el, mx, my, isVertical, true)}
                {dot(x1, y1)}{dot(x2, y2)}
                {label(el, (x1+x2)/2, (y1+y2)/2)}
              </g>
            )
          }

          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#30363d" strokeWidth={2} />
              {drawComponent(el, (x1+x2)/2, (y1+y2)/2, isHorizontal)}
              {dot(x1, y1)}{dot(x2, y2)}
              {label(el, (x1+x2)/2, (y1+y2)/2)}
            </g>
          )
        })}

        {/* Ground symbol */}
        {nodes.filter(n => n.id === 0).map(n => (
          <g key="gnd">
            <line x1={n.x-16} y1={n.y} x2={n.x+16} y2={n.y} stroke="#e6edf3" strokeWidth={2.5} />
            <line x1={n.x-10} y1={n.y+6} x2={n.x+10} y2={n.y+6} stroke="#e6edf3" strokeWidth={2} />
            <line x1={n.x-5} y1={n.y+12} x2={n.x+5} y2={n.y+12} stroke="#e6edf3" strokeWidth={1.5} />
          </g>
        ))}

        {/* Voltage labels */}
        {voltages && nodes.filter(n => n.id > 0).map(n => {
          const v = voltages[n.id - 1]
          return v !== undefined ? (
            <text key={`v${n.id}`} x={n.x} y={n.y - 12}
              textAnchor="middle" fill="#7ee787" fontSize={10} fontFamily="monospace" fontWeight="600">
              {v.toFixed(2)}V
            </text>
          ) : null
        })}
      </svg>
    </div>
  )
}

function drawComponent(el: Element, cx: number, cy: number, horizontal: boolean, angled = false) {
  const color = el.type === 'R' ? '#e6edf3' : el.type === 'C' ? '#58a6ff' : el.type === 'L' ? '#7ee787' : '#ffa657'
  const sl = horizontal ? 1 : 0 // swap x/y sense

  if (angled) {
    // For L-shaped routing, draw component rotated based on orientation
    return drawInline(el, cx, cy, color)
  }

  return drawInline(el, cx, cy, color)
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

function label(el: Element, x: number, y: number) {
  return (
    <text x={x} y={y - 16} textAnchor="middle" fill="#8b949e" fontSize={9} fontFamily="monospace">
      {el.name} {fmtVal(el.value)}
    </text>
  )
}

function dot(x: number, y: number) {
  return <circle cx={x} cy={y} r={3} fill="#58a6ff" stroke="#0d1117" strokeWidth={1.5} />
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

function gridLayout(elements: Element[]): { nodes: GridNode[]; cols: number; rows: number } {
  const grid = new Map<number, { col: number; row: number }>()
  
  grid.set(0, { col: 0, row: 0 })

  let nextCol = 1
  let nextRow = 1
  const placed = new Set<number>([0])

  const vSources = elements.filter(e => e.type === 'V' || e.type === 'VAC')
  const passives = elements.filter(e => e.type !== 'V' && e.type !== 'VAC')

  for (const vs of vSources) {
    if (!placed.has(vs.pos) && vs.pos !== 0) {
      grid.set(vs.pos, { col: nextCol, row: 1 }); placed.add(vs.pos); nextCol++
    }
    if (!placed.has(vs.neg) && vs.neg !== 0) {
      grid.set(vs.neg, { col: nextCol, row: 1 }); placed.add(vs.neg); nextCol++
    }
  }
  if (nextCol === 1) nextCol = 2

  for (const el of passives) {
    const pPos = grid.get(el.pos)
    const pNeg = grid.get(el.neg)
    if (!pPos && !pNeg) {
      grid.set(el.pos, { col: nextCol, row: nextRow }); placed.add(el.pos); nextRow++
      grid.set(el.neg, { col: nextCol, row: nextRow }); placed.add(el.neg); nextRow++
      nextCol++
    } else if (!pPos) {
      const r = pNeg ? pNeg.row : nextRow
      grid.set(el.pos, { col: nextCol, row: r }); placed.add(el.pos); nextCol++
      nextRow = Math.max(nextRow, r + 1)
    } else if (!pNeg) {
      const r = pPos ? pPos.row : nextRow
      grid.set(el.neg, { col: nextCol, row: r }); placed.add(el.neg); nextCol++
      nextRow = Math.max(nextRow, r + 1)
    }
  }

  for (const el of elements) {
    if (!placed.has(el.pos) && el.pos !== 0) {
      grid.set(el.pos, { col: nextCol, row: nextRow }); placed.add(el.pos); nextRow++
    }
    if (!placed.has(el.neg) && el.neg !== 0) {
      grid.set(el.neg, { col: nextCol, row: nextRow }); placed.add(el.neg); nextRow++
    }
  }

  const entries = Array.from(grid.entries())
  const maxCol = Math.max(0, ...entries.map(([_, p]) => p.col))
  
  const byCol = new Map<number, { id: number; col: number }[]>()
  for (const [id, p] of entries) {
    if (!byCol.has(p.col)) byCol.set(p.col, [])
    byCol.get(p.col)!.push({ id, col: p.col })
  }

  const result: GridNode[] = []
  for (const [c, items] of byCol) {
    items.sort((a, b) => a.id - b.id)
    if (c === 0 && items.some(it => it.id === 0)) {
      for (const item of items) {
        if (item.id === 0) result.push({ id: 0, col: 0, row: 0, x: CELL, y: 0 })
      }
      continue
    }
    for (let i = 0; i < items.length; i++) {
      const r = i * 2 + 1
      result.push({ id: items[i].id, col: c, row: r, x: (c + 1) * CELL, y: (r + 1) * CELL })
    }
  }

  const maxRow = Math.max(0, ...result.map(n => n.row))
  return { nodes: result.sort((a, b) => a.id - b.id), cols: maxCol + 1, rows: maxRow + 2 }
}
    if (!placed.has(negNode) && negNode !== 0) {
      grid.set(negNode, { col: nextCol, row: 1 })
      placed.add(negNode)
      nextCol++
    }
  }
  if (nextCol === 1) nextCol = 2 // at least one column for source

  // Place passive elements, assigning new columns as needed
  for (const el of passives) {
    const pPos = grid.get(el.pos)
    const pNeg = grid.get(el.neg)

    if (!pPos && !pNeg) {
      // Both unplaced: assign new column
      grid.set(el.pos, { col: nextCol, row: nextRow })
      placed.add(el.pos)
      nextRow++
      grid.set(el.neg, { col: nextCol, row: nextRow })
      placed.add(el.neg)
      nextRow++
      nextCol++
    } else if (!pPos) {
      // pos unplaced: place it in a new column at the same row as neg
      const r = pNeg ? pNeg.row : nextRow
      grid.set(el.pos, { col: nextCol, row: r })
      placed.add(el.pos)
      nextCol++
      nextRow = Math.max(nextRow, r + 1)
    } else if (!pNeg) {
      // neg unplaced: place it in a new column
      const r = pPos ? pPos.row : nextRow
      grid.set(el.neg, { col: nextCol, row: r })
      placed.add(el.neg)
      nextCol++
      nextRow = Math.max(nextRow, r + 1)
    }
    // else: both already placed, skip
  }

  // Any remaining unplaced nodes
  for (const el of elements) {
    if (!placed.has(el.pos) && el.pos !== 0) {
      grid.set(el.pos, { col: nextCol, row: nextRow })
      placed.add(el.pos); nextRow++
    }
    if (!placed.has(el.neg) && el.neg !== 0) {
      grid.set(el.neg, { col: nextCol, row: nextRow })
      placed.add(el.neg); nextRow++
    }
  }

  // Build result, normalize rows
  const entries = Array.from(grid.entries())
  const maxCol = Math.max(0, ...entries.map(([_, p]) => p.col))
  
  // Group by column and assign rows 0,2,4... for even spacing
  const byCol = new Map<number, { id: number; col: number }[]>()
  for (const [id, p] of entries) {
    if (!byCol.has(p.col)) byCol.set(p.col, [])
    byCol.get(p.col)!.push({ id, col: p.col })
  }

  const result: GridNode[] = []
  for (const [c, items] of byCol) {
    items.sort((a, b) => a.id - b.id)
    if (c === 0 && items.some(it => it.id === 0)) {
      // Ground column: ground at bottom
      for (const item of items) {
        if (item.id === 0) result.push({ id: 0, col: 0, row: 0, x: CELL, y: 0 })
      }
      continue
    }
    // Spread items in this column: first item row=1, second row=3, etc.
    for (let i = 0; i < items.length; i++) {
      const r = i * 2 + 1
      result.push({
        id: items[i].id,
        col: c,
        row: r,
        x: (c + 1) * CELL,
        y: (r + 1) * CELL,
      })
    }
  }

  const maxRow = Math.max(0, ...result.map(n => n.row))
  return { nodes: result.sort((a, b) => a.id - b.id), cols: maxCol + 1, rows: maxRow + 2 }
}

  // BFS to assign grid positions
  const nodeSet = new Set<number>()
  for (const el of elements) { nodeSet.add(el.pos); nodeSet.add(el.neg) }

  const adj = new Map<number, Set<number>>()
  for (const el of elements) {
    if (!adj.has(el.pos)) adj.set(el.pos, new Set())
    if (!adj.has(el.neg)) adj.set(el.neg, new Set())
    adj.get(el.pos)!.add(el.neg)
    adj.get(el.neg)!.add(el.pos)
  }

  // Assign levels via BFS (col = signal flow)
  const col = new Map<number, number>()
  const row = new Map<number, number>()
  const usedRows = new Map<number, Set<number>>()

  // Find sources (voltage sources)
  let startNode = -1
  for (const el of elements) {
    if (el.type === 'V' || el.type === 'VAC') {
      startNode = el.pos !== 0 ? el.pos : el.neg
      break
    }
  }
  if (startNode === -1 || startNode === 0) {
    for (const n of nodeSet) { if (n !== 0) { startNode = n; break } }
  }

  // BFS from source
  const visited = new Set<number>()
  let queue: number[] = []
  if (startNode > 0) {
    col.set(startNode, 1)
    visited.add(startNode)
    queue.push(startNode)
  }

  // Also mark ground
  if (nodeSet.has(0)) {
    col.set(0, 0)
    row.set(0, 0)
    visited.add(0)
  }

  let maxCol = 0
  while (queue.length > 0) {
    const next: number[] = []
    for (const cur of queue) {
      const curCol = col.get(cur) || 0
      for (const nb of adj.get(cur) || []) {
        if (!visited.has(nb)) {
          visited.add(nb)
          col.set(nb, curCol + 1)
          maxCol = Math.max(maxCol, curCol + 1)
          next.push(nb)
        }
      }
    }
    queue = next
  }

  // Any unvisited nodes
  for (const n of nodeSet) {
    if (!visited.has(n)) {
      col.set(n, maxCol + 1)
      maxCol = Math.max(maxCol, maxCol + 1)
    }
  }

  // Assign rows within each column (avoid overlap)
  for (let c = 0; c <= maxCol; c++) {
    usedRows.set(c, new Set())
  }

  // Place ground at row 0, col 0
  if (nodeSet.has(0)) {
    col.set(0, 0); row.set(0, 0)
    usedRows.get(0)!.add(0)
  }

  // Place source 1 row below ground
  const colNodes = new Map<number, number[]>()
  for (const n of nodeSet) {
    const c = col.get(n) || 0
    if (!colNodes.has(c)) colNodes.set(c, [])
    colNodes.get(c)!.push(n)
  }

  for (let c = 1; c <= maxCol; c++) {
    const nodes = colNodes.get(c) || []
    // Sort by node number for determinism
    nodes.sort((a, b) => a - b)
    let r = 1
    for (const n of nodes) {
      // Check if this node connects to a node in column c-1 that's at a specific row
      const connectedCols: number[] = []
      for (const el of elements) {
        const other = el.pos === n ? el.neg : el.pos
        const oc = col.get(other)
        if (oc !== undefined && oc < c && oc >= 0) {
          const or = row.get(other) || 0
          connectedCols.push(or)
        }
      }

      // Try to match a connected node's row + sibling adjustment
      const prefer = connectedCols.length > 0 ? connectedCols[0] : r
      while (usedRows.get(c)!.has(prefer + r - 1)) { r++ }
      row.set(n, prefer + r - 1)
      usedRows.get(c)!.add(prefer + r - 1)
      r = prefer + r
    }
  }

  // Convert to pixel positions
  const gridNodes: GridNode[] = []
  for (const n of nodeSet) {
    const c = col.get(n) || 0
    const r = row.get(n) || 0
    gridNodes.push({
      id: n,
      col: c,
      row: r,
      x: (c + 1) * CELL,
      y: (r + 1) * CELL,
    })
  }

  // Compute grid dimensions
  const maxRow = Math.max(0, ...Array.from(row.values())) + 1
  return {
    nodes: gridNodes.sort((a, b) => a.id - b.id),
    cols: maxCol + 1,
    rows: maxRow + 1,
  }
}
