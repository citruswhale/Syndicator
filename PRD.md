# RIFT - Graph-Based Financial Crime Detection Engine

## Original Problem Statement
Build a "Graph-Based Financial Crime Detection Engine" for RIFT 2026 Hackathon. Implements 3 graph algorithms: cycle detection (bounded enumeration), smurfing (SMoTeF fan-in/fan-out with temporal windows), shell networks (constrained DFS). Suspicion scoring via sigmoid-normalized weighted combination. False positive filtering for merchants/payroll.

## Architecture
- Backend: FastAPI + NetworkX + Pandas + MongoDB (Motor async)
- Frontend: React 19 + react-force-graph-2d + Tailwind + Shadcn/UI + Recharts
- Algorithms: cycle_detection.py, smurfing.py, shell_detection.py, scoring.py
- Data: data_generator.py for synthetic test data with planted patterns

## What's Been Implemented (Feb 2026)
### Iteration 1
- Full backend with all 3 detection algorithms + scoring
- 6-page frontend: Landing, Dashboard, Graph Explorer, Fraud Rings, Suspects, JSON Output
- Sample data generator (10K transactions with planted fraud patterns)
- MongoDB storage, All API endpoints tested (100% pass)

### Iteration 2
- Pattern labels on nodes (Bounded Cycle Detection, Temporal Smurfing, Layered Shell Network)
- False positive detection (Merchant/Payroll) with diamond shapes in graph, teal/green colors
- Rich hover tooltips with plain English explanations of why each node was flagged
- False Positives section on Suspects page and JSON Output page
- 5th stat card (FALSE POS.) on Dashboard
- METHOD column in suspects tables
- Graph Explorer legend with FP markers and filter option

## Prioritized Backlog
### P1 - Performance optimization (< 5s for 10K transactions)
### P2 - PDF report export, Historical analysis comparison
### P3 - Configurable algorithm parameters via UI, Real-time streaming
