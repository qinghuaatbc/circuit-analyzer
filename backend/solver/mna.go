package solver

import "math"

type DCSolution struct {
	V []float64 // node voltages (index 0 = node 1, etc.)
	I []float64 // voltage source currents
}

func SolveDC(c *Circuit) *DCSolution {
	nNodes := c.NodeCnt
	nVS := countVoltageSources(c)
	nEq := nNodes + nVS

	// Build G matrix and I vector
	G := make([][]float64, nEq)
	for i := range G {
		G[i] = make([]float64, nEq)
	}
	I := make([]float64, nEq)

	// Stamp conductances (resistors)
	for _, e := range c.Elements {
		if e.Type == Resistor {
			g := 1.0 / e.Value
			if e.Pos > 0 {
				G[e.Pos-1][e.Pos-1] += g
			}
			if e.Neg > 0 {
				G[e.Neg-1][e.Neg-1] += g
			}
			if e.Pos > 0 && e.Neg > 0 {
				G[e.Pos-1][e.Neg-1] -= g
				G[e.Neg-1][e.Pos-1] -= g
			}
		}
	}

	// Stamp current sources
	vsIdx := 0
	for _, e := range c.Elements {
		switch e.Type {
		case CurrentSource:
			if e.Pos > 0 {
				I[e.Pos-1] += e.Value
			}
			if e.Neg > 0 {
				I[e.Neg-1] -= e.Value
			}
		case VoltageSource, ACSource:
			row := nNodes + vsIdx
			// Voltage equation: V(pos) - V(neg) = V
			if e.Pos > 0 {
				G[row][e.Pos-1] = 1
			}
			if e.Neg > 0 {
				G[row][e.Neg-1] = -1
			}
			if e.Pos > 0 {
				G[e.Pos-1][row] = 1
			}
			if e.Neg > 0 {
				G[e.Neg-1][row] = -1
			}
			I[row] = e.Value
			vsIdx++
		}
	}

	// Solve G·x = I
	x := solveGaussian(G, I)

	// Extract results
	nV := nNodes
	sol := &DCSolution{
		V: make([]float64, nV),
		I: make([]float64, nVS),
	}
	for i := 0; i < nV; i++ {
		sol.V[i] = x[i]
	}
	for i := 0; i < nVS; i++ {
		sol.I[i] = x[nV+i]
	}
	return sol
}

func countVoltageSources(c *Circuit) int {
	n := 0
	for _, e := range c.Elements {
		if e.Type == VoltageSource || e.Type == ACSource {
			n++
		}
	}
	return n
}

// Gaussian elimination with partial pivoting
func solveGaussian(A [][]float64, b []float64) []float64 {
	n := len(A)
	// Augmented matrix
	m := make([][]float64, n)
	for i := range m {
		m[i] = make([]float64, n+1)
		copy(m[i], A[i])
		m[i][n] = b[i]
	}

	for col := 0; col < n; col++ {
		// Partial pivoting
		maxVal := math.Abs(m[col][col])
		maxRow := col
		for row := col + 1; row < n; row++ {
			if math.Abs(m[row][col]) > maxVal {
				maxVal = math.Abs(m[row][col])
				maxRow = row
			}
		}
		m[col], m[maxRow] = m[maxRow], m[col]

		// Eliminate below
		for row := col + 1; row < n; row++ {
			factor := m[row][col] / m[col][col]
			for j := col; j <= n; j++ {
				m[row][j] -= factor * m[col][j]
			}
		}
	}

	// Back substitution
	x := make([]float64, n)
	for i := n - 1; i >= 0; i-- {
		sum := m[i][n]
		for j := i + 1; j < n; j++ {
			sum -= m[i][j] * x[j]
		}
		x[i] = sum / m[i][i]
	}
	return x
}
