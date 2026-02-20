import networkx as nx


def detect_shell_networks(G, min_hops=3, max_shell_tx_count=None, max_hops=7, max_patterns=None):
    """
    Detect Layered Shell Networks.
    
    Spec: Look for chains of 3+ hops where intermediate accounts have only 2-3 total transactions.
    
    Algorithm:
    1. Pre-compute total transaction count per node (actual tx count, not degree)
    2. Flag nodes with total_tx_count <= max_shell_tx_count as shell candidates
    3. Constrained DFS from non-shell sources through shell nodes
    4. If path reaches depth >= min_hops and exits to non-shell destination, flag it
    
    Uses actual transaction counts (not graph degree) per spec.
    """
    patterns = []
    ring_counter = 0
    seen_paths = set()

    # Count actual transactions per node (not just unique counterparties)
    if max_patterns is None:
        N = G.number_of_nodes()
        max_patterns = max(10, int(0.15 * N)) if N < 1000 else max(100, int(0.05 * N))
        
    if max_shell_tx_count is None:
        max_shell_tx_count = 5 if G.number_of_nodes() < 1000 else 3

    tx_counts = {}
    for node in G.nodes():
        count = 0
        for _, _, d in G.in_edges(node, data=True):
            count += len(d.get('transactions', []))
        for _, _, d in G.out_edges(node, data=True):
            count += len(d.get('transactions', []))
        tx_counts[node] = count

    shell_accounts = {n for n, c in tx_counts.items() if c <= max_shell_tx_count}
    non_shell_accounts = {n for n, c in tx_counts.items() if c > max_shell_tx_count}

    def dfs_shell_path(current, visited, path, shell_depth):
        # Depth limit to prevent runaway DFS
        if shell_depth >= max_hops:
            return []
        
        results = []
        for neighbor in G.successors(current):
            if neighbor in visited:
                continue
            if neighbor in shell_accounts:
                results.extend(
                    dfs_shell_path(
                        neighbor,
                        visited | {neighbor},
                        path + [neighbor],
                        shell_depth + 1
                    )
                )
            elif shell_depth >= min_hops:
                results.append(path + [neighbor])
        return results

    for source in non_shell_accounts:
        if len(patterns) >= max_patterns:
            break

        for next_node in G.successors(source):
            if next_node not in shell_accounts:
                continue

            paths = dfs_shell_path(
                next_node,
                {source, next_node},
                [source, next_node],
                1
            )

            for path in paths:
                if len(patterns) >= max_patterns:
                    break

                path_key = tuple(path)
                if path_key in seen_paths:
                    continue
                seen_paths.add(path_key)

                shell_nodes = [n for n in path[1:-1] if n in shell_accounts]

                ring_counter += 1
                risk = min(100, 25 + len(shell_nodes) * 10 + min(15, len(path) * 3))

                patterns.append({
                    'ring_id': f'SHELL-{ring_counter:03d}',
                    'member_accounts': list(path),
                    'pattern_type': 'layered_shell',
                    'hop_count': len(path) - 1,
                    'shell_accounts': shell_nodes,
                    'risk_score': round(risk, 2)
                })

    return patterns
