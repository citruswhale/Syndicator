import networkx as nx
import numpy as np


def detect_cycles(G, min_length=3, max_length=5, max_cycles=100, min_edge_amount=100):
    """
    Detect Circular Fund Routing patterns (spec: cycles of length 3 to 5).
    
    Returns each cycle with behavioral sub-patterns:
    - cycle_length_N: topology
    - high_velocity / medium_velocity: time between hops
    - amount_degradation: amounts decrease at each hop
    - structured_timing: evenly spaced transactions
    """
    # Work on a copy, pre-filtering edges below min amount to reduce noise
    H = G.copy()
    if min_edge_amount > 0:
        low_edges = [(u, v) for u, v, d in H.edges(data=True)
                     if d.get('total_amount', 0) < min_edge_amount]
        H.remove_edges_from(low_edges)

    # k-core peeling (iteratively remove dead ends)
    changed = True
    while changed:
        changed = False
        to_remove = [n for n in H.nodes() if H.in_degree(n) == 0 or H.out_degree(n) == 0]
        if to_remove:
            H.remove_nodes_from(to_remove)
            changed = True
    
    if H.number_of_nodes() == 0:
        return []
    
    # Tarjan's SCC
    sccs = [scc for scc in nx.strongly_connected_components(H) if len(scc) >= min_length]
    
    if not sccs:
        return []
    
    cycles = []
    seen_cycles = set()
    ring_counter = 0

    for scc in sccs:
        H_scc = H.subgraph(scc).copy()
        
        try:
            for cycle in nx.simple_cycles(H_scc, length_bound=max_length):
                if len(cycle) < min_length:
                    continue

                cycle_key = tuple(sorted(cycle))
                if cycle_key in seen_cycles:
                    continue
                seen_cycles.add(cycle_key)

                # --- Analyze behavioral sub-patterns ---
                sub_patterns = [f'cycle_length_{len(cycle)}']
                
                edge_amounts = []
                edge_timestamps = []
                total_amount = 0.0
                
                for i in range(len(cycle)):
                    src = cycle[i]
                    dst = cycle[(i + 1) % len(cycle)]
                    if G.has_edge(src, dst):
                        edge_data = G[src][dst]
                        edge_amt = edge_data.get('total_amount', 0)
                        total_amount += edge_amt
                        edge_amounts.append(edge_amt)
                        
                        # Get timestamps from edge transactions
                        txs = edge_data.get('transactions', [])
                        for tx in txs:
                            ts_str = tx.get('timestamp', '')
                            if ts_str:
                                edge_timestamps.append(ts_str)

                # Amount degradation: each hop's amount is less than the previous
                if len(edge_amounts) >= 2:
                    degrading = all(
                        edge_amounts[i] > edge_amounts[i + 1]
                        for i in range(len(edge_amounts) - 1)
                    )
                    if degrading:
                        sub_patterns.append('amount_degradation')

                # Velocity analysis: parse timestamps and measure time gaps
                if edge_timestamps:
                    try:
                        from datetime import datetime
                        parsed_times = []
                        for ts in edge_timestamps:
                            for fmt in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S.%f'):
                                try:
                                    parsed_times.append(datetime.fromisoformat(ts.replace('Z', '')))
                                    break
                                except (ValueError, AttributeError):
                                    continue
                        
                        if len(parsed_times) >= 2:
                            parsed_times.sort()
                            gaps_hours = [
                                (parsed_times[i+1] - parsed_times[i]).total_seconds() / 3600.0
                                for i in range(len(parsed_times) - 1)
                            ]
                            avg_gap = np.mean(gaps_hours) if gaps_hours else float('inf')
                            
                            # High velocity: avg gap < 6 hours
                            if avg_gap < 6:
                                sub_patterns.append('high_velocity')
                            elif avg_gap < 24:
                                sub_patterns.append('medium_velocity')
                            
                            # Structured timing: low variance in gaps (evenly spaced)
                            if len(gaps_hours) >= 2:
                                gap_std = np.std(gaps_hours)
                                gap_mean = np.mean(gaps_hours)
                                if gap_mean > 0 and (gap_std / (gap_mean + 0.001)) < 0.5:
                                    sub_patterns.append('structured_timing')
                    except Exception:
                        pass

                ring_counter += 1
                risk = min(100, 40 + len(cycle) * 5 + min(20, total_amount / 10000))
                
                # Bonus for more behavioral signals
                risk = min(100, risk + len(sub_patterns) * 2)

                cycles.append({
                    'ring_id': f'CYCLE-{ring_counter:03d}',
                    'member_accounts': list(cycle),
                    'pattern_type': 'circular_fund_routing',
                    'detected_sub_patterns': sub_patterns,
                    'cycle_length': len(cycle),
                    'total_amount': round(total_amount, 2),
                    'risk_score': round(risk, 2)
                })

                if len(cycles) >= max_cycles:
                    break
        except Exception:
            continue
        
        if len(cycles) >= max_cycles:
            break

    return cycles
