"""Verify enriched pipeline output."""
import pandas as pd, json
from utils.data_generator import generate_sample_data
from algorithms.graph_builder import build_graph
from algorithms.cycle_detection import detect_cycles
from algorithms.smurfing import detect_smurfing
from algorithms.shell_detection import detect_shell_networks
from algorithms.scoring import calculate_suspicion_scores

txs = generate_sample_data()
df = pd.DataFrame(txs).rename(columns={
    'sender_id': 'sender_account',
    'receiver_id': 'receiver_account'
})
G = build_graph(df)
c = detect_cycles(G)
s = detect_smurfing(G, df)
sh = detect_shell_networks(G)
sc = calculate_suspicion_scores(G, c, s, sh)

rings = set(a['ring_id'] for a in sc)
pats = set()
for a in sc:
    pats.update(a['detected_patterns'])

print(f"C={len(c)} S={len(s)} SH={len(sh)}")
print(f"Accts={len(sc)} Rings={len(rings)}")
print(f"Rings: {sorted(rings)}")
print(f"Pats: {sorted(pats)}")
print()
for a in sc[:15]:
    print(json.dumps({
        'id': a['account_id'],
        'sc': a['suspicion_score'],
        'p': a['detected_patterns'],
        'r': a['ring_id']
    }, indent=None))
