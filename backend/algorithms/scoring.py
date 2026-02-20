import networkx as nx
import math


class DisjointSetUnion:
    """
    Disjoint Set Union (DSU) with path compression and union by rank.
    Used for mathematically correct fraud ring unification.
    Near O(1) amortized time per operation.
    """
    def __init__(self):
        self.parent = {}
        self.rank = {}
    
    def find(self, x):
        """Find root with path compression."""
        if x not in self.parent:
            self.parent[x] = x
            self.rank[x] = 0
            return x
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # Path compression
        return self.parent[x]
    
    def union(self, x, y):
        """Union by rank."""
        root_x = self.find(x)
        root_y = self.find(y)
        
        if root_x == root_y:
            return
        
        # Union by rank
        if self.rank[root_x] < self.rank[root_y]:
            self.parent[root_x] = root_y
        elif self.rank[root_x] > self.rank[root_y]:
            self.parent[root_y] = root_x
        else:
            self.parent[root_y] = root_x
            self.rank[root_x] += 1
    
    def get_components(self):
        """Get all disjoint components."""
        components = {}
        for node in self.parent:
            root = self.find(node)
            components.setdefault(root, []).append(node)
        return list(components.values())


def calculate_suspicion_scores(G, cycles, smurfing_patterns, shell_patterns):
    """
    Calculate suspicion scores using enriched sub-patterns.
    
    Key features:
    1. DSU for fraud ring unification
    2. Subgraph-scoped Betweenness Centrality
    3. Flow Imbalance Ratio (FIR) for mule detection
    4. Granular detected_patterns from sub-pattern analysis
    
    Metrics:
    - Bp (Base Pattern Risk): Cycle=40, Smurfing=35, Shell=25
    - Bc (Betweenness Centrality): Bridge node identification
    - Fi (Flow Imbalance Ratio): |total_in - total_out| / max(total_in, total_out)
    
    Final Score: Sigmoid-normalized weighted combination
    Score = 100 / (1 + exp(-0.1 * (raw_score - 23)))
    """
    # Step 1: Collect all flagged accounts and build DSU
    dsu = DisjointSetUnion()
    account_patterns = {}
    account_sub_patterns = {}

    for cycle in cycles:
        sub_pats = cycle.get('detected_sub_patterns', ['circular_fund_routing'])
        for account in cycle['member_accounts']:
            account_patterns.setdefault(account, []).append({
                'type': 'circular_fund_routing',
                'ring_id': cycle['ring_id'],
                'base_risk': 40
            })
            account_sub_patterns.setdefault(account, set()).update(sub_pats)
        # Union all accounts in this cycle
        for i in range(len(cycle['member_accounts']) - 1):
            dsu.union(cycle['member_accounts'][i], cycle['member_accounts'][i + 1])

    for pattern in smurfing_patterns:
        sub_pats = pattern.get('detected_sub_patterns', ['fan_in_smurfing'])
        for account in pattern['member_accounts']:
            account_patterns.setdefault(account, []).append({
                'type': 'smurfing',
                'ring_id': pattern['ring_id'],
                'base_risk': 35
            })
            account_sub_patterns.setdefault(account, set()).update(sub_pats)
        # Union all accounts in this smurfing ring
        for i in range(len(pattern['member_accounts']) - 1):
            dsu.union(pattern['member_accounts'][i], pattern['member_accounts'][i + 1])

    for pattern in shell_patterns:
        sub_pats = pattern.get('detected_sub_patterns', ['layered_shell'])
        for account in pattern['member_accounts']:
            account_patterns.setdefault(account, []).append({
                'type': 'layered_shell',
                'ring_id': pattern['ring_id'],
                'base_risk': 25
            })
            account_sub_patterns.setdefault(account, set()).update(sub_pats)
        # Union all accounts in this shell chain
        for i in range(len(pattern['member_accounts']) - 1):
            dsu.union(pattern['member_accounts'][i], pattern['member_accounts'][i + 1])

    # Step 2: Build subgraph of flagged nodes + their 1-hop neighbors
    flagged_nodes = set(account_patterns.keys())
    neighbors = set()
    for node in flagged_nodes:
        if G.has_node(node):
            neighbors.update(G.predecessors(node))
            neighbors.update(G.successors(node))
    
    subgraph_nodes = flagged_nodes | neighbors
    
    if subgraph_nodes:
        G_sub = G.subgraph(subgraph_nodes).copy()
        
        if G_sub.number_of_nodes() > 100:
            k = min(100, G_sub.number_of_nodes())
            centrality = nx.betweenness_centrality(G_sub, normalized=True, k=k)
        else:
            centrality = nx.betweenness_centrality(G_sub, normalized=True)
    else:
        centrality = {}

    # Step 3: Calculate suspicion scores
    suspicious_accounts = []

    for account, patterns_list in account_patterns.items():
        bp = max(p['base_risk'] for p in patterns_list)
        bc = centrality.get(account, 0)

        total_in = G.nodes[account].get('total_received', 0) if G.has_node(account) else 0
        total_out = G.nodes[account].get('total_sent', 0) if G.has_node(account) else 0
        denominator = max(total_in, total_out, 1)
        fi = abs(total_in - total_out) / denominator
        fi_risk = 1.0 - fi  # Lower FI = higher risk (mule behavior)

        raw_score = 0.5 * bp + 0.3 * (bc * 100) + 0.2 * (fi_risk * 100)

        # Use granular sub-patterns as detected_patterns
        sub_pats = sorted(account_sub_patterns.get(account, set()))
        coarse_types = list(set(p['type'] for p in patterns_list))
        
        # Multi-pattern bonus (if in multiple coarse pattern types)
        raw_score += 10 * (len(coarse_types) - 1)
        
        # Sub-pattern richness bonus (more behavioral signals = more suspicious)
        raw_score += 1.5 * max(0, len(sub_pats) - 1)

        # Sigmoid normalization — center shifted to 10 for extra recall
        score = 100.0 / (1.0 + math.exp(-0.15 * (raw_score - 10)))
        score = round(min(99.99, max(0.01, score)), 2)

        # Get unified ring root from DSU (raw account ID, will be mapped below)
        unified_root = dsu.find(account)
        
        # Use sub-patterns as detected_patterns if available, else fall back to coarse types
        detected = sub_pats if sub_pats else coarse_types

        suspicious_accounts.append({
            'account_id': account,
            'suspicion_score': score,
            'detected_patterns': detected,
            'ring_id': unified_root,  # Placeholder — mapped to RING_XXX format below
            'metrics': {
                'betweenness_centrality': round(bc, 6),
                'flow_imbalance_ratio': round(fi, 4),
                'flow_imbalance_risk': round(fi_risk, 4),
                'base_pattern_risk': bp,
                'raw_score': round(raw_score, 2)
            },
            'total_received': round(total_in, 2),
            'total_sent': round(total_out, 2)
        })

    suspicious_accounts.sort(key=lambda x: x['suspicion_score'], reverse=True)

    # Map DSU roots to spec-compliant RING_XXX format
    root_to_ring = {}
    ring_counter = 0
    for acct in suspicious_accounts:
        root = acct['ring_id']  # Currently holds DSU root (an account ID)
        if root not in root_to_ring:
            ring_counter += 1
            root_to_ring[root] = f'RING_{ring_counter:03d}'
        acct['ring_id'] = root_to_ring[root]

    return suspicious_accounts
