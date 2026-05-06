package solver

import "fmt"

type ElementType int

const (
	Resistor ElementType = iota
	Capacitor
	Inductor
	VoltageSource
	CurrentSource
	ACSource
)

type Element struct {
	Type   ElementType
	Name   string
	Pos    int // positive node
	Neg    int // negative node
	Value  float64 // R, C, L, V, I value
	ACMag  float64 // AC magnitude (for AC source)
	ACPhase float64 // AC phase in radians
}

type Circuit struct {
	Elements []Element
	NodeCnt  int // number of nodes (excluding ground)
}

func (e Element) TypeName() string {
	switch e.Type {
	case Resistor:
		return "R"
	case Capacitor:
		return "C"
	case Inductor:
		return "L"
	case VoltageSource:
		return "V"
	case CurrentSource:
		return "I"
	case ACSource:
		return "VAC"
	}
	return "?"
}

func (c *Circuit) String() string {
	s := fmt.Sprintf("Circuit: %d nodes, %d elements\n", c.NodeCnt, len(c.Elements))
	for _, e := range c.Elements {
		s += fmt.Sprintf("  %s %s %d %d %g\n", e.TypeName(), e.Name, e.Pos, e.Neg, e.Value)
	}
	return s
}
