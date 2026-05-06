package solver

import (
	"math"
	"math/cmplx"
)

type ACSolution struct {
	Frequency float64
	V         []complex128 // node voltages (complex)
	I         []complex128 // voltage source currents (complex)
}

type ACSweep struct {
	Frequencies []float64
	Points      []ACSolution
}

func SolveAC(c *Circuit, freq float64) *ACSolution {
	omega := 2 * math.Pi * freq
	nNodes := c.NodeCnt
	nVS := countVoltageSources(c)
	nEq := nNodes + nVS

	// Build complex G matrix and I vector
	G := make([][]complex128, nEq)
	for i := range G {
		G[i] = make([]complex128, nEq)
	}
	I := make([]complex128, nEq)

	// Stamp elements
	for _, e := range c.Elements {
		switch e.Type {
		case Resistor:
			g := complex(1.0/e.Value, 0)
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

		case Capacitor:
			g := complex(0, omega*e.Value)
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

		case Inductor:
			if e.Value != 0 {
				g := 1.0 / complex(0, omega*e.Value)
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

		case CurrentSource:
			v := complex(e.Value, 0)
			if e.Pos > 0 {
				I[e.Pos-1] += v
			}
			if e.Neg > 0 {
				I[e.Neg-1] -= v
			}

		case ACSource:
			v := cmplx.Rect(e.Value, e.ACPhase)
			row := nNodes + countVSBefore(c, e.Name)
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
			I[row] = v

		case VoltageSource:
			row := nNodes + countVSBefore(c, e.Name)
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
			I[row] = complex(e.Value, 0)
		}
	}

	// Solve complex system
	x := solveComplexGaussian(G, I)

	nV := nNodes
	sol := &ACSolution{
		Frequency: freq,
		V:         make([]complex128, nV),
		I:         make([]complex128, nVS),
	}
	for i := 0; i < nV; i++ {
		sol.V[i] = x[i]
	}
	for i := 0; i < nVS; i++ {
		sol.I[i] = x[nV+i]
	}
	return sol
}

func countVSBefore(c *Circuit, name string) int {
	n := 0
	for _, e := range c.Elements {
		if e.Name == name {
			return n
		}
		if e.Type == VoltageSource || e.Type == ACSource {
			n++
		}
	}
	return n
}

func SolveACSweep(c *Circuit, fMin, fMax float64, points int) *ACSweep {
	sweep := &ACSweep{}
	frequencies := logspace(fMin, fMax, points)
	for _, f := range frequencies {
		sol := SolveAC(c, f)
		sweep.Frequencies = append(sweep.Frequencies, f)
		sweep.Points = append(sweep.Points, *sol)
	}
	return sweep
}

func logspace(start, end float64, n int) []float64 {
	result := make([]float64, n)
	if n == 1 {
		result[0] = start
		return result
	}
	logStart := math.Log10(start)
	logEnd := math.Log10(end)
	for i := 0; i < n; i++ {
		result[i] = math.Pow(10, logStart+float64(i)*(logEnd-logStart)/float64(n-1))
	}
	return result
}

// Complex Gaussian elimination
func solveComplexGaussian(A [][]complex128, b []complex128) []complex128 {
	n := len(A)
	m := make([][]complex128, n)
	for i := range m {
		m[i] = make([]complex128, n+1)
		copy(m[i], A[i])
		m[i][n] = b[i]
	}

	for col := 0; col < n; col++ {
		maxVal := cmplx.Abs(m[col][col])
		maxRow := col
		for row := col + 1; row < n; row++ {
			if cmplx.Abs(m[row][col]) > maxVal {
				maxVal = cmplx.Abs(m[row][col])
				maxRow = row
			}
		}
		m[col], m[maxRow] = m[maxRow], m[col]

		for row := col + 1; row < n; row++ {
			if cmplx.Abs(m[col][col]) < 1e-15 {
				continue
			}
			factor := m[row][col] / m[col][col]
			for j := col; j <= n; j++ {
				m[row][j] -= factor * m[col][j]
			}
		}
	}

	x := make([]complex128, n)
	for i := n - 1; i >= 0; i-- {
		sum := m[i][n]
		for j := i + 1; j < n; j++ {
			sum -= m[i][j] * x[j]
		}
		if cmplx.Abs(m[i][i]) > 1e-15 {
			x[i] = sum / m[i][i]
		}
	}
	return x
}
