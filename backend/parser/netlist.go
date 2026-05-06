package parser

import (
	"fmt"
	"math"
	"strconv"
	"strings"

	"circuit-analyzer/solver"
)

func Parse(netlist string) (*solver.Circuit, error) {
	c := &solver.Circuit{}
	maxNode := 0

	lines := strings.Split(netlist, "\n")
	for i, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, "//") {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) < 4 {
			return nil, fmt.Errorf("line %d: expected at least 4 fields, got %d", i+1, len(parts))
		}

		name := parts[0]
		prefix := strings.ToUpper(string(name[0]))

		pos, err := strconv.Atoi(parts[1])
		if err != nil {
			return nil, fmt.Errorf("line %d: invalid node number '%s'", i+1, parts[1])
		}
		neg, err := strconv.Atoi(parts[2])
		if err != nil {
			return nil, fmt.Errorf("line %d: invalid node number '%s'", i+1, parts[2])
		}

		if pos > maxNode {
			maxNode = pos
		}
		if neg > maxNode {
			maxNode = neg
		}

		elem := solver.Element{
			Name: name,
			Pos:  pos,
			Neg:  neg,
		}

		switch prefix {
		case "R":
			elem.Type = solver.Resistor
			elem.Value, err = parseValue(parts[3])
		case "C":
			elem.Type = solver.Capacitor
			elem.Value, err = parseValue(parts[3])
		case "L":
			elem.Type = solver.Inductor
			elem.Value, err = parseValue(parts[3])
		case "V":
			if strings.HasPrefix(strings.ToUpper(name), "VAC") {
				elem.Type = solver.ACSource
				elem.Value, err = parseValue(parts[3])
				if len(parts) > 4 {
					elem.ACMag, _ = parseValue(parts[4])
				} else {
					elem.ACMag = elem.Value
				}
				if len(parts) > 5 {
					phase, _ := strconv.ParseFloat(parts[5], 64)
					elem.ACPhase = phase * math.Pi / 180
				}
			} else {
				elem.Type = solver.VoltageSource
				elem.Value, err = parseValue(parts[3])
			}
		case "I":
			elem.Type = solver.CurrentSource
			elem.Value, err = parseValue(parts[3])
		default:
			return nil, fmt.Errorf("line %d: unknown element type '%s'", i+1, prefix)
		}

		if err != nil {
			return nil, fmt.Errorf("line %d: invalid value '%s'", i+1, parts[3])
		}

		c.Elements = append(c.Elements, elem)
	}

	c.NodeCnt = maxNode
	return c, nil
}

func parseValue(s string) (float64, error) {
	s = strings.ToLower(s)
	mult := 1.0

	if strings.HasSuffix(s, "k") {
		mult = 1e3
		s = s[:len(s)-1]
	} else if strings.HasSuffix(s, "m") {
		mult = 1e-3
		s = s[:len(s)-1]
	} else if strings.HasSuffix(s, "u") {
		mult = 1e-6
		s = s[:len(s)-1]
	} else if strings.HasSuffix(s, "n") {
		mult = 1e-9
		s = s[:len(s)-1]
	} else if strings.HasSuffix(s, "p") {
		mult = 1e-12
		s = s[:len(s)-1]
	} else if strings.HasSuffix(s, "meg") {
		mult = 1e6
		s = s[:len(s)-3]
	}

	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, err
	}
	return v * mult, nil
}
