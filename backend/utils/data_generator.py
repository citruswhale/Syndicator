import random
import string
from datetime import datetime, timedelta


def _gen_id():
    prefix = random.choice(['ACC', 'ACCT', 'BNK', 'WAL'])
    num = ''.join(random.choices(string.digits, k=8))
    return f"{prefix}-{num}"


def generate_sample_data(num_transactions=10000, num_accounts=1500):
    """
    Generate synthetic transaction data with planted fraud patterns.
    
    All pattern pools are NON-OVERLAPPING to ensure distinct fraud rings.
    
    Includes:
    - 6 circular fund routing cycles (3-5 members, with amount degradation + timing)
    - 6 smurfing patterns (aggregators with 10-15 fan-in/fan-out)
    - 6 shell network chains (3-5 shell intermediaries)
    - False positive traps: 1 merchant, 1 payroll account
    - Normal background transactions
    """
    random.seed(42)
    accounts = [_gen_id() for _ in range(num_accounts)]
    transactions = []
    base_time = datetime(2024, 1, 1)

    # ===================================================================
    # POOL ALLOCATION (non-overlapping to ensure distinct rings)
    # ===================================================================
    # Pool A: accounts[0:200]     → cycle members
    # Pool B: accounts[200:210]   → smurfing aggregators
    # Pool C: accounts[210:410]   → smurfing fan-in senders
    # Pool D: accounts[410:610]   → smurfing fan-out receivers
    # Pool E: accounts[610:650]   → shell sources + destinations
    # Pool F: fresh _gen_id()     → shell intermediaries (not in main pool)
    # Pool G: accounts[700:900]   → false positive traps
    # Pool H: accounts[900:]      → normal background transactions

    # --- 1. CIRCULAR FUND ROUTING (6 cycles, varied lengths) ---
    forced_lengths = [3, 4, 3, 5, 4, 3]  # Ensure variety in cycle sizes
    for i in range(6):
        cycle_len = forced_lengths[i]
        # Each cycle draws from a distinct slice of Pool A
        slice_start = i * 20
        cycle = random.sample(accounts[slice_start:slice_start + 20], cycle_len)
        
        cycle_base_time = base_time + timedelta(days=i * 7)
        
        for j in range(cycle_len):
            # Amount degradation: each hop slightly less than the previous
            base_amount = random.uniform(15000, 50000) - j * random.uniform(200, 500)
            
            for k in range(random.randint(2, 4)):
                # Structured timing: transactions spaced evenly (~2-4 hours apart)
                tx_time = cycle_base_time + timedelta(
                    hours=j * 3 + k * random.uniform(0.5, 1.5)
                )
                transactions.append({
                    'transaction_id': f'TX-CYC-{i:02d}-{j}-{k}',
                    'sender_id': cycle[j],
                    'receiver_id': cycle[(j + 1) % cycle_len],
                    'amount': round(max(1000, base_amount + random.uniform(-500, 500)), 2),
                    'timestamp': tx_time.isoformat()
                })

    # --- 2. SMURFING PATTERNS (6 aggregators, 10-15 fan-in/fan-out) ---
    for i in range(6):
        aggregator = accounts[200 + i]
        
        # Each smurfing pattern draws from distinct slices of Pool C and D
        fan_in_slice_start = 210 + i * 30
        fan_out_slice_start = 410 + i * 30
        
        fan_in_count = random.randint(10, 15)
        fan_out_count = random.randint(10, 15)
        
        fan_in_accs = random.sample(
            accounts[fan_in_slice_start:fan_in_slice_start + 30],
            min(fan_in_count, 30)
        )
        fan_out_accs = random.sample(
            accounts[fan_out_slice_start:fan_out_slice_start + 30],
            min(fan_out_count, 30)
        )

        base_fan_time = base_time + timedelta(days=random.randint(1, 20))

        # Fan-in: many accounts send to aggregator within a tight window
        for idx, src in enumerate(fan_in_accs):
            transactions.append({
                'transaction_id': f'TX-SMF-IN-{i:02d}-{src[-4:]}',
                'sender_id': src,
                'receiver_id': aggregator,
                'amount': round(random.uniform(1000, 9000), 2),
                'timestamp': (base_fan_time + timedelta(
                    minutes=idx * 30 + random.randint(0, 10)  # ~30 min apart (structured)
                )).isoformat()
            })

        # Fan-out: aggregator disperses to many accounts
        for idx, dst in enumerate(fan_out_accs):
            transactions.append({
                'transaction_id': f'TX-SMF-OUT-{i:02d}-{dst[-4:]}',
                'sender_id': aggregator,
                'receiver_id': dst,
                'amount': round(random.uniform(1000, 9000), 2),
                'timestamp': (base_fan_time + timedelta(
                    hours=random.randint(12, 36),
                    minutes=idx * 20 + random.randint(0, 10)
                )).isoformat()
            })

    # --- 3. SHELL NETWORKS (6 chains, distinct accounts) ---
    shell_pool = []
    for i in range(6):
        source = accounts[610 + i * 2]
        destination = accounts[611 + i * 2]
        num_shells = random.randint(3, 5)
        shells = [_gen_id() for _ in range(num_shells)]  # Fresh IDs (Pool F)
        shell_pool.extend(shells)

        chain = [source] + shells + [destination]

        for j in range(len(chain) - 1):
            transactions.append({
                'transaction_id': f'TX-SHL-{i:02d}-{j}',
                'sender_id': chain[j],
                'receiver_id': chain[j + 1],
                'amount': round(random.uniform(10000, 100000), 2),
                'timestamp': (base_time + timedelta(
                    days=i * 2, hours=j * 2
                )).isoformat()
            })

        # Give source and destination normal transaction activity
        # so they register as non-shell (high tx count) nodes
        for k in range(5):
            peer = random.choice(accounts[900:])
            transactions.append({
                'transaction_id': f'TX-SHL-NORM-{i:02d}-S-{k}',
                'sender_id': source,
                'receiver_id': peer,
                'amount': round(random.uniform(500, 5000), 2),
                'timestamp': (base_time + timedelta(
                    days=random.randint(0, 30)
                )).isoformat()
            })
            transactions.append({
                'transaction_id': f'TX-SHL-NORM-{i:02d}-D-{k}',
                'sender_id': peer,
                'receiver_id': destination,
                'amount': round(random.uniform(500, 5000), 2),
                'timestamp': (base_time + timedelta(
                    days=random.randint(0, 30)
                )).isoformat()
            })

    # --- 4. FALSE POSITIVE TRAPS ---

    # Merchant: many incoming, very few outgoing
    merchant = accounts[700]
    for k in range(50):
        sender = random.choice(accounts[750:850])
        transactions.append({
            'transaction_id': f'TX-MERCH-{k:03d}',
            'sender_id': sender,
            'receiver_id': merchant,
            'amount': round(random.uniform(10, 500), 2),
            'timestamp': (base_time + timedelta(
                days=random.randint(0, 30),
                hours=random.randint(0, 23)
            )).isoformat()
        })
    for k in range(2):
        transactions.append({
            'transaction_id': f'TX-MERCH-OUT-{k}',
            'sender_id': merchant,
            'receiver_id': random.choice(accounts[850:900]),
            'amount': round(random.uniform(5000, 10000), 2),
            'timestamp': (base_time + timedelta(
                days=random.randint(0, 30)
            )).isoformat()
        })

    # Payroll: few incoming, many outgoing with uniform amounts
    payroll = accounts[701]
    for k in range(2):
        transactions.append({
            'transaction_id': f'TX-PAY-IN-{k}',
            'sender_id': random.choice(accounts[850:900]),
            'receiver_id': payroll,
            'amount': round(random.uniform(50000, 200000), 2),
            'timestamp': (base_time + timedelta(
                days=random.randint(0, 30)
            )).isoformat()
        })
    for k in range(50):
        transactions.append({
            'transaction_id': f'TX-PAY-OUT-{k:03d}',
            'sender_id': payroll,
            'receiver_id': random.choice(accounts[750:850]),
            'amount': round(random.uniform(3800, 4200), 2),  # Nearly uniform (payroll signature)
            'timestamp': (base_time + timedelta(
                days=random.randint(0, 30),
                hours=random.randint(0, 23)
            )).isoformat()
        })

    # --- 5. NORMAL TRANSACTIONS ---
    all_accounts = accounts + shell_pool
    remaining = num_transactions - len(transactions)
    for i in range(max(0, remaining)):
        sender = random.choice(accounts[900:])  # Pool H only
        receiver = random.choice(accounts[900:])
        while receiver == sender:
            receiver = random.choice(accounts[900:])
        transactions.append({
            'transaction_id': f'TX-N-{i:06d}',
            'sender_id': sender,
            'receiver_id': receiver,
            'amount': round(random.uniform(10, 10000), 2),
            'timestamp': (base_time + timedelta(
                days=random.randint(0, 30),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59)
            )).isoformat()
        })

    random.shuffle(transactions)
    return transactions