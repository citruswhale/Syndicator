# $yndicato₹ - Graph-Based Financial Crime Detection Engine

> Hackathon 2026 | Real-time graph analysis for identifying financial crime patterns

## Live Demo

[$yndicato₹ Live Demo](https://money-flow-ai.preview.emergentagent.com)

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **Data Processing** | Pandas (CSV ingestion & transformation) |
| **Graph Engine** | NetworkX 3.4+ (topological construction & algorithms) |
| **Frontend** | React 19, Tailwind CSS, Shadcn/UI |
| **Visualization** | react-force-graph-2d (WebGL-accelerated Canvas rendering) |
| **Charts** | Recharts |
| **Database** | MongoDB (Motor async driver) |

## System Architecture

```
[CSV Upload / Sample Gen]
        |
        v
+-------------------+       +-------------------+
|   FastAPI Server   | <---> |     MongoDB       |
|  (Analysis Engine) |       | (Result Storage)  |
+-------------------+       +-------------------+
        |
        v
+-------------------+
|  Graph Builder    |  -- NetworkX DiGraph from transactions
+-------------------+
   |        |        |
   v        v        v
[Cycles] [Smurfing] [Shell]   <-- Detection Algorithms
   |        |        |
   v        v        v
+-------------------+
| Suspicion Scoring |  -- Sigmoid-normalized weighted combination
+-------------------+
        |
        v
+-------------------+
| React Frontend    |  -- Interactive force-graph, tables, JSON
+-------------------+
```

## Algorithm Approach

### A. Circular Fund Routing (Cycle Detection)

Money loops back to the origin: `A -> B -> C -> ... -> A`

**Algorithm:** Bounded simple cycle enumeration using `nx.simple_cycles(G, length_bound=5)`.
- Pre-filters graph to only include edges with `total_amount >= $3,000`
- Restricts search to cycles of length 3-5
- Filters out ping-pong transfers (length 2)
- Capped at 100 unique cycles to prevent combinatorial explosion

**Time Complexity:** `O((V+E) * (C+1))` where C is bounded by length_bound. In practice, the pre-filtering reduces E significantly, yielding near-linear performance.

### B. Smurfing Patterns (Fan-in / Fan-out)

Multiple accounts deposit into an aggregator, which disperses funds within a temporal window.

**Algorithm (SMoTeF-inspired):**
1. Identify candidate aggregators: `in_degree >= 3` AND `out_degree >= 3`
2. **False Positive Filter:** Skip if `in_degree > 3 * out_degree` (merchant trap) or `out_degree > 3 * in_degree` (payroll trap)
3. Apply 48-hour sliding temporal window
4. Enforce temporal precedence: fan-in must precede fan-out

### C. Layered Shell Networks

Chains of 3+ hops where intermediate accounts have only 2-3 total transactions.

**Algorithm:**
1. Pre-compute undirected degree for all nodes. Flag `is_shell` if `degree <= 3`
2. Constrained DFS from non-shell sources, traversing only through shell nodes
3. If path reaches `depth >= 3` and exits to non-shell destination, flag the path

## Suspicion Score Methodology

Each flagged account receives a score in `[0, 100]` calculated as:

### Metrics

| Metric | Symbol | Description |
|---|---|---|
| Base Pattern Risk | `Bp` | Cycle=40, Smurfing=35, Shell=25 |
| Betweenness Centrality | `Bc` | Bridge node identification (0-1) |
| Flow Imbalance Ratio | `Fi` | `abs(in - out) / max(in, out)` |

### Flow Imbalance Ratio

```
Fi = |total_received - total_sent| / max(total_received, total_sent, 1)
```

- `Fi near 0` = Money mule ("Zero-Out" property) = **HIGH RISK**
- `Fi near 1` = Legitimate accumulation/disbursement = **LOW RISK**

### Final Score Calculation

```
fi_risk = 1.0 - Fi  (invert: low Fi = high risk)
raw_score = 0.5 * Bp + 0.3 * (Bc * 100) + 0.2 * (fi_risk * 100)
raw_score += 10 * (num_pattern_types - 1)  // multi-pattern bonus

Score = 100 / (1 + exp(-0.1 * (raw_score - 25)))
```

The logistic sigmoid normalizes the weighted combination strictly between 0 and 100.

### False Positive Traps

| Trap | Pattern | Why Safe |
|---|---|---|
| High-Volume Merchant | High In-Degree, Low Out-Degree | `Fi -> 1` (funds accumulate, not laundered) |
| Payroll Account | Low In-Degree, High Out-Degree | `Fi -> 1` (funds disburse legitimately) |

Both are filtered at the smurfing detection stage AND penalized by the Flow Imbalance Ratio in scoring.

## JSON Output Format

```json
{
  "suspicious_accounts": [
    {
      "account_id": "ACC-12345678",
      "suspicion_score": 92.38,
      "detected_patterns": ["circular_fund_routing", "smurfing"],
      "ring_id": "CYCLE-001"
    }
  ],
  "fraud_rings": [
    {
      "ring_id": "CYCLE-001",
      "member_accounts": ["ACC-12345678", "BNK-87654321", ...],
      "pattern_type": "circular_fund_routing",
      "risk_score": 67.5
    }
  ],
  "summary": {
    "total_accounts_analyzed": 1517,
    "suspicious_accounts_flagged": 397,
    "fraud_rings_detected": 116,
    "processing_time_seconds": 6.9345
  }
}
```

## Installation & Usage

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
# Set environment variables in .env
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend Setup
```bash
cd frontend
yarn install
yarn start
```

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/analyze` | Upload CSV, run analysis |
| POST | `/api/analyze-sample` | Generate 10K sample + analyze |
| GET | `/api/download-sample` | Download sample CSV |
| GET | `/api/analysis/{id}` | Get stored analysis |
| GET | `/api/analyses` | List all analyses |

## Known Limitations

- Cycle detection is capped at 100 cycles to maintain performance under 10 seconds
- Betweenness centrality uses approximate calculation (k=200 samples) for graphs with >500 nodes
- Shell network detection may miss chains where shell accounts have additional unrelated transactions
- The temporal window for smurfing is fixed at 48 hours (not configurable via UI)
- Graph visualization performance may degrade above 5,000 visible nodes in the browser

## Performance

| Dataset Size | Processing Time | Accounts | Rings Detected |
|---|---|---|---|
| 10,000 transactions | ~7 seconds | ~1,500 | ~100-120 |

---

Built with NetworkX, React, and FastAPI for RIFT 2026 Hackathon.
