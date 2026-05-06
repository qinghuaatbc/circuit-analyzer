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
			"name": "分压器 Voltage Divider",
			"netlist": `R1 1 2 1k
R2 2 0 2k
V1 1 0 5`,
		},
		{
			"name": "串联电阻 Series Resistors",
			"netlist": `R1 1 2 100
R2 2 3 200
R3 3 0 300
V1 1 0 12`,
		},
		{
			"name": "并联电阻 Parallel Resistors",
			"netlist": `R1 1 0 100
R2 1 0 200
R3 1 0 300
V1 1 0 5`,
		},
		{
			"name": "内阻电池 Battery with Internal Resistance",
			"netlist": `Rint 1 2 0.5
Rload 2 0 10
V1 1 0 9`,
		},
		{
			"name": "RC 低通滤波 RC Low-Pass Filter",
			"netlist": `R1 1 2 1k
C1 2 0 1u
VAC1 1 0 1`,
		},
		{
			"name": "RC 高通滤波 RC High-Pass Filter",
			"netlist": `C1 1 2 1u
R1 2 0 1k
VAC1 1 0 1`,
		},
		{
			"name": "RL 低通滤波 RL Low-Pass Filter",
			"netlist": `R1 1 2 100
L1 2 0 10m
VAC1 1 0 1`,
		},
		{
			"name": "串联 RLC Series RLC",
			"netlist": `R1 1 2 10
L1 2 3 10m
C1 3 0 1u
VAC1 1 0 1`,
		},
		{
			"name": "并联 RLC Parallel RLC",
			"netlist": `R1 1 0 1k
L1 1 0 10m
C1 1 0 1u
VAC1 1 0 1`,
		},
		{
			"name": "LC 谐振 LC Resonance",
			"netlist": `L1 1 2 1m
C1 2 0 1u
R1 1 0 10k
VAC1 1 0 1`,
		},
		{
			"name": "惠斯通电桥 Wheatstone Bridge",
			"netlist": `R1 1 2 100
R2 2 0 200
R3 1 3 150
R4 3 0 300
R5 2 3 250
V1 1 0 12`,
		},
		{
			"name": "分流器 Current Divider",
			"netlist": `R1 1 0 100
R2 1 0 200
R3 1 0 300
I1 0 1 1`,
		},
		{
			"name": "T 型衰减器 T-Pad Attenuator",
			"netlist": `R1 1 2 100
R2 2 3 100
R3 2 0 200
Rload 3 0 600
V1 1 0 1`,
		},
		{
			"name": "π 型衰减器 Pi-Pad Attenuator",
			"netlist": `R1 1 0 300
R2 1 2 100
R3 2 0 300
Rload 2 0 600
V1 1 0 1`,
		},
		{
			"name": "二阶低通 2nd-Order Low-Pass",
			"netlist": `R1 1 2 1k
C1 2 0 10n
L1 2 3 10m
C2 3 0 10n
Rload 3 0 1k
VAC1 1 0 1`,
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
