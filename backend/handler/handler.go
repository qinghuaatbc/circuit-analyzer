package handler

import (
	"encoding/json"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"

	"circuit-analyzer/parser"
	"circuit-analyzer/solver"
)

type AnalyzeRequest struct {
	Netlist string  `json:"netlist"`
	FMin    float64 `json:"fMin"`
	FMax    float64 `json:"fMax"`
	Points  int     `json:"points"`
}

type AnalyzeResponse struct {
	DC      *DCResult       `json:"dc,omitempty"`
	ACSweep *ACSweepResult  `json:"acSweep,omitempty"`
}

type DCResult struct {
	V []float64 `json:"v"`
	I []float64 `json:"i"`
}

type ACSweepResult struct {
	Frequencies []float64    `json:"frequencies"`
	Points      []ACPoint   `json:"points"`
}

type ACPoint struct {
	V []Complex `json:"v"`
	I []Complex `json:"i"`
}

type Complex struct {
	Real float64 `json:"real"`
	Imag float64 `json:"imag"`
	Mag  float64 `json:"mag"`
	Phase float64 `json:"phase"`
}

func toComplex(c complex128) Complex {
	return Complex{
		Real:  real(c),
		Imag:  imag(c),
		Mag:   math.Sqrt(real(c)*real(c) + imag(c)*imag(c)),
		Phase: math.Atan2(imag(c), real(c)) * 180 / math.Pi,
	}
}

func HandleAnalyze(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var req AnalyzeRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	c, err := parser.Parse(req.Netlist)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	resp := &AnalyzeResponse{}

	// DC analysis
	if hasDC(c) {
		dc := solver.SolveDC(c)
		resp.DC = &DCResult{V: dc.V, I: dc.I}
	}

	// AC sweep
	if hasAC(c) {
		fMin := req.FMin
		fMax := req.FMax
		points := req.Points
		if fMin <= 0 {
			fMin = 10
		}
		if fMax <= 0 {
			fMax = 1e6
		}
		if points <= 0 {
			points = 100
		}
		sweep := solver.SolveACSweep(c, fMin, fMax, points)
		resp.ACSweep = &ACSweepResult{
			Frequencies: sweep.Frequencies,
		}
		for _, p := range sweep.Points {
			pt := ACPoint{
				V: make([]Complex, len(p.V)),
				I: make([]Complex, len(p.I)),
			}
			for i, v := range p.V {
				pt.V[i] = toComplex(v)
			}
			for i, v := range p.I {
				pt.I[i] = toComplex(v)
			}
			resp.ACSweep.Points = append(resp.ACSweep.Points, pt)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func hasDC(c *solver.Circuit) bool {
	hasR := false
	hasV := false
	hasI := false
	for _, e := range c.Elements {
		switch e.Type {
		case solver.Resistor:
			hasR = true
		case solver.VoltageSource:
			hasV = true
		case solver.CurrentSource:
			hasI = true
		}
	}
	return hasR || hasV || hasI
}

func hasAC(c *solver.Circuit) bool {
	hasACsrc := false
	hasC := false
	hasL := false
	for _, e := range c.Elements {
		switch e.Type {
		case solver.ACSource:
			hasACsrc = true
		case solver.Capacitor:
			hasC = true
		case solver.Inductor:
			hasL = true
		}
	}
	return hasACsrc || (hasC || hasL)
}

func HandleNetlistExamples(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	examples := []map[string]string{
		{
			"name": "Voltage Divider",
			"netlist": `R1 1 0 1k
R2 1 2 2k
V1 2 0 5`,
		},
		{
			"name": "RC Low-Pass Filter",
			"netlist": `R1 1 2 1k
C1 2 0 1u
VAC1 1 0 1`,
		},
		{
			"name": "RLC Circuit",
			"netlist": `R1 1 2 100
L1 2 3 10m
C1 3 0 1u
VAC1 1 0 1`,
		},
		{
			"name": "Wheatstone Bridge",
			"netlist": `R1 1 2 100
R2 2 0 200
R3 1 3 150
R4 3 0 300
R5 2 3 250
V1 1 0 12`,
		},
		{
			"name": "Current Divider",
			"netlist": `R1 1 0 100
R2 1 0 200
R3 1 0 300
I1 0 1 1`,
		},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(examples)
}

func HandleInfo(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"name":    "Circuit Analyzer",
		"version": "1.0.0",
		"about":   "DC/AC circuit analysis using Modified Nodal Analysis (MNA)",
	})
}

func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func parseInt(s string, defaultVal int) int {
	if s == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		n = defaultVal
	}
	if strings.HasPrefix(s, "http") {
		return defaultVal
	}
	return n
}
