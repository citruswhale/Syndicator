import pandas as pd
import numpy as np
from datetime import timedelta


def detect_smurfing(G, transactions_df, time_window_hours=72, min_fan=None):
    """
    Detect Smurfing Patterns using pure vectorized operations.
    
    Smurfing criteria (per spec):
    - Fan-in: 10+ senders → 1 receiver (aggregator)
    - Fan-out: 1 sender → 10+ receivers (disperser)
    - Temporal analysis: Transactions within a 72-hour window are more suspicious
    - FIR ≈ 0 (balanced flow = mule), reject FIR ≈ 1 (merchant/payroll)
    
    Returns enriched sub-patterns: fan_in_smurfing, fan_out_smurfing,
    high_velocity, medium_velocity, structured_timing
    """
    patterns = []
    ring_counter = 0

    # Convert timestamp and ensure string IDs to match graph nodes
    transactions_df = transactions_df.copy()
    transactions_df['sender_account'] = transactions_df['sender_account'].astype(str)
    transactions_df['receiver_account'] = transactions_df['receiver_account'].astype(str)
    transactions_df['ts'] = pd.to_datetime(transactions_df['timestamp'], format='mixed', errors='coerce')
    transactions_df = transactions_df.dropna(subset=['ts'])
    
    # Scale down the strict 10+ requirement for very small custom datasets
    if min_fan is None:
        min_fan = 10 if G.number_of_nodes() >= 1000 else 5

    # Pre-filter candidates: nodes with high fan-in OR high fan-out
    candidates = [
        node for node in G.nodes()
        if G.in_degree(node) >= min_fan or G.out_degree(node) >= min_fan
    ]
    
    if not candidates:
        return []
    
    # Pre-group and sort ALL transactions (do this once, not per node)
    incoming_dict = {
        name: group.sort_values('ts').reset_index(drop=True)
        for name, group in transactions_df.groupby('receiver_account')
        if name in candidates
    }
    
    outgoing_dict = {
        name: group.sort_values('ts').reset_index(drop=True)
        for name, group in transactions_df.groupby('sender_account')
        if name in candidates
    }
    
    window_td = timedelta(hours=time_window_hours)

    def _analyze_timing(times_array):
        """Analyze velocity and timing structure from transaction timestamps."""
        sub = []
        if len(times_array) < 2:
            return sub
        
        sorted_times = np.sort(times_array)
        gaps_hours = np.diff(sorted_times).astype('timedelta64[s]').astype(float) / 3600.0
        
        if len(gaps_hours) == 0:
            return sub
            
        avg_gap = np.mean(gaps_hours)
        
        if avg_gap < 6:
            sub.append('high_velocity')
        elif avg_gap < 24:
            sub.append('medium_velocity')
        
        # Structured timing: low coefficient of variation
        if len(gaps_hours) >= 2 and avg_gap > 0:
            cv = np.std(gaps_hours) / (avg_gap + 0.001)
            if cv < 0.5:
                sub.append('structured_timing')
        
        return sub

    for node in candidates:
        # Flow Imbalance Ratio filtering
        total_in = G.nodes[node].get('total_received', 0)
        total_out = G.nodes[node].get('total_sent', 0)
        denominator = max(total_in, total_out, 1)
        fir = abs(total_in - total_out) / denominator
        
        # Skip merchants and payroll (high FIR with skewed degrees)
        # Slightly relaxed from 0.7 to 0.75 for marginally better recall
        in_deg = G.in_degree(node)
        out_deg = G.out_degree(node)
        excluded = (in_deg > 3 * out_deg and fir > 0.90) or (out_deg > 3 * in_deg and fir > 0.90)
        if excluded:
            continue

        incoming = incoming_dict.get(node, pd.DataFrame())
        outgoing = outgoing_dict.get(node, pd.DataFrame())

        if incoming.empty and outgoing.empty:
            continue

        has_fan_in = not incoming.empty and len(incoming) >= min_fan
        has_fan_out = not outgoing.empty and len(outgoing) >= min_fan

        if not has_fan_in and not has_fan_out:
            continue

        in_times = incoming['ts'].values if not incoming.empty else np.array([])
        out_times = outgoing['ts'].values if not outgoing.empty else np.array([])

        found_pattern = False

        # Check fan-in + fan-out (classic smurfing: aggregate then disperse)
        if has_fan_in and not outgoing.empty:
            for out_idx, out_time in enumerate(out_times):
                window_start = out_time - window_td
                in_window = (in_times >= window_start) & (in_times <= out_time)
                fan_in_count = int(np.sum(in_window))

                if fan_in_count >= min_fan:
                    earliest_in = in_times[in_window].min()
                    out_window = (out_times >= earliest_in) & (out_times <= earliest_in + window_td)
                    fan_out_count = int(np.sum(out_window))

                    fan_in_tx = incoming[in_window]
                    fan_out_tx = outgoing[out_window]

                    # Variance check for payroll detection
                    if len(fan_out_tx) >= min_fan:
                        fan_out_amounts = fan_out_tx['amount'].values
                        variance = fan_out_amounts.std() / (fan_out_amounts.mean() + 1)
                        if variance < 0.005:  # Fix: Must be incredibly strict (0.005) so it ONLY catches true payroll
                            continue

                    member_accounts = list(set(
                        fan_in_tx['sender_account'].tolist() +
                        [node] +
                        fan_out_tx['receiver_account'].tolist()
                    ))
                    total_amount = float(fan_in_tx['amount'].sum() + fan_out_tx['amount'].sum())

                    # Sub-pattern analysis
                    sub_patterns = ['fan_in_smurfing']
                    if fan_out_count >= min_fan:
                        sub_patterns.append('fan_out_smurfing')
                    
                    all_times = np.concatenate([in_times[in_window], out_times[out_window]])
                    sub_patterns.extend(_analyze_timing(all_times))

                    ring_counter += 1
                    risk = min(100, 35 + len(member_accounts) * 3 + min(15, total_amount / 20000))
                    risk = min(100, risk + len(sub_patterns) * 2)

                    patterns.append({
                        'ring_id': f'SMURF-{ring_counter:03d}',
                        'aggregator': node,
                        'member_accounts': member_accounts,
                        'pattern_type': 'smurfing',
                        'detected_sub_patterns': sub_patterns,
                        'fan_in_count': fan_in_count,
                        'fan_out_count': fan_out_count,
                        'total_amount': round(total_amount, 2),
                        'risk_score': round(risk, 2)
                    })
                    found_pattern = True
                    break

                if found_pattern:
                    break

        # Pure fan-in (10+ senders within window, even if few outgoing)
        if not found_pattern and has_fan_in:
            for ref_time in in_times:
                window_end = ref_time + window_td
                in_window = (in_times >= ref_time) & (in_times <= window_end)
                fan_in_count = int(np.sum(in_window))

                if fan_in_count >= min_fan:
                    fan_in_tx = incoming[in_window]
                    member_accounts = list(set(
                        fan_in_tx['sender_account'].tolist() + [node]
                    ))
                    total_amount = float(fan_in_tx['amount'].sum())

                    sub_patterns = ['fan_in_smurfing']
                    sub_patterns.extend(_analyze_timing(in_times[in_window]))

                    ring_counter += 1
                    risk = min(100, 35 + len(member_accounts) * 3 + min(15, total_amount / 20000))
                    risk = min(100, risk + len(sub_patterns) * 2)

                    patterns.append({
                        'ring_id': f'SMURF-{ring_counter:03d}',
                        'aggregator': node,
                        'member_accounts': member_accounts,
                        'pattern_type': 'smurfing',
                        'detected_sub_patterns': sub_patterns,
                        'fan_in_count': fan_in_count,
                        'fan_out_count': 0,
                        'total_amount': round(total_amount, 2),
                        'risk_score': round(risk, 2)
                    })
                    found_pattern = True
                    break

        # Pure fan-out (1 sender → 10+ receivers within window)
        if not found_pattern and has_fan_out:
            for ref_time in out_times:
                window_end = ref_time + window_td
                out_window = (out_times >= ref_time) & (out_times <= window_end)
                fan_out_count = int(np.sum(out_window))

                if fan_out_count >= min_fan:
                    fan_out_tx = outgoing[out_window]

                    # Variance check for payroll detection
                    fan_out_amounts = fan_out_tx['amount'].values
                    variance = fan_out_amounts.std() / (fan_out_amounts.mean() + 1)
                    if variance < 0.08:
                        continue

                    member_accounts = list(set(
                        [node] + fan_out_tx['receiver_account'].tolist()
                    ))
                    total_amount = float(fan_out_tx['amount'].sum())

                    sub_patterns = ['fan_out_smurfing']
                    sub_patterns.extend(_analyze_timing(out_times[out_window]))

                    ring_counter += 1
                    risk = min(100, 35 + len(member_accounts) * 3 + min(15, total_amount / 20000))
                    risk = min(100, risk + len(sub_patterns) * 2)

                    patterns.append({
                        'ring_id': f'SMURF-{ring_counter:03d}',
                        'aggregator': node,
                        'member_accounts': member_accounts,
                        'pattern_type': 'smurfing',
                        'detected_sub_patterns': sub_patterns,
                        'fan_in_count': 0,
                        'fan_out_count': fan_out_count,
                        'total_amount': round(total_amount, 2),
                        'risk_score': round(risk, 2)
                    })
                    found_pattern = True
                    break

    return patterns
