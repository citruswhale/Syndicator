from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from typing import List
import uuid
from datetime import datetime, timezone
import pandas as pd
import time
import io
import csv

from algorithms.graph_builder import build_graph, build_visualization_data
from algorithms.cycle_detection import detect_cycles
from algorithms.smurfing import detect_smurfing
from algorithms.shell_detection import detect_shell_networks
from algorithms.scoring import calculate_suspicion_scores
from utils.data_generator import generate_sample_data

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="$yndicato₹ Financial Crime Detection Engine")
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Pattern labels and explanations for human-readable tooltips
PATTERN_LABELS = {
    'circular_fund_routing': 'Bounded Cycle Detection',
    'smurfing': 'Temporal Smurfing',
    'layered_shell': 'Layered Shell Network',
    'cycle_length_3': 'Cycle (3 nodes)',
    'cycle_length_4': 'Cycle (4 nodes)',
    'cycle_length_5': 'Cycle (5 nodes)',
    'high_velocity': 'High Velocity',
    'medium_velocity': 'Medium Velocity',
    'amount_degradation': 'Amount Degradation',
    'structured_timing': 'Structured Timing',
    'fan_in_smurfing': 'Fan-in Smurfing',
    'fan_out_smurfing': 'Fan-out Smurfing',
}

PATTERN_EXPLANATIONS = {
    'circular_fund_routing': 'Funds flow in a closed loop, a hallmark of circular fund laundering.',
    'smurfing': 'Multiple accounts deposit small amounts into this aggregator within a 72-hour window.',
    'layered_shell': 'Part of a chain of low-activity intermediaries creating opaque layers.',
    'cycle_length_3': 'Part of a 3-node circular fund routing cycle.',
    'cycle_length_4': 'Part of a 4-node circular fund routing cycle.',
    'cycle_length_5': 'Part of a 5-node circular fund routing cycle.',
    'high_velocity': 'Transactions occur rapidly (avg gap < 6 hours), suggesting urgency.',
    'medium_velocity': 'Transactions occur at moderate velocity (avg gap < 24 hours).',
    'amount_degradation': 'Amounts decrease at each hop, a classic laundering tell.',
    'structured_timing': 'Transaction timing is suspiciously regular, suggesting coordination.',
    'fan_in_smurfing': 'Multiple accounts funnelling money into a single aggregator.',
    'fan_out_smurfing': 'Single account dispersing funds to many receivers.',
}





def detect_false_positives(G):
    """Identify merchant and payroll accounts — false positive traps."""
    false_positives = {}
    for node in G.nodes():
        in_deg = G.in_degree(node)
        out_deg = G.out_degree(node)
        total_in = G.nodes[node].get('total_received', 0)
        total_out = G.nodes[node].get('total_sent', 0)
        fi = abs(total_in - total_out) / max(total_in, total_out, 1)

        if in_deg >= 10 and (out_deg <= 3 or in_deg > 3 * out_deg):
            false_positives[node] = {
                'type': 'merchant',
                'label': 'Merchant (False Positive)',
                'explanation': (
                    f'MERCHANT DETECTED: {in_deg} incoming payments from diverse sources '
                    f'with only {out_deg} outgoing. Accumulation ratio Fi={fi:.2f} is '
                    f'consistent with normal business payment collection. This account '
                    f'was correctly excluded from fraud flagging.'
                )
            }
        elif out_deg >= 10 and (in_deg <= 3 or out_deg > 3 * in_deg):
            false_positives[node] = {
                'type': 'payroll',
                'label': 'Payroll (False Positive)',
                'explanation': (
                    f'PAYROLL DETECTED: {in_deg} funding source(s) with {out_deg} '
                    f'outgoing disbursements. Dispersion ratio Fi={fi:.2f} is consistent '
                    f'with salary or payment distribution. This account was correctly '
                    f'excluded from fraud flagging.'
                )
            }
    return false_positives


def generate_account_explanation(account, G):
    """Generate plain-English explanation for why an account was flagged."""
    parts = []
    fi = account.get('metrics', {}).get('flow_imbalance_ratio', 0)
    patterns = account.get('detected_patterns', [])

    for p_type in patterns:
        label = PATTERN_LABELS.get(p_type, p_type.replace('_', ' ').title())
        base = PATTERN_EXPLANATIONS.get(p_type, '')
        if base:
            parts.append(f'{label}: {base}')

    # Add flow imbalance context if it's low (mule-like)
    if fi < 0.2:
        parts.append(
            f'Flow imbalance is {fi:.4f} (near zero), '
            f'indicating a "zero-out" money mule where funds leave as fast as they arrive.'
        )

    return ' // '.join(parts) if parts else ''


def normalize_columns(df):
    """Normalize CSV column names to standard internal format."""
    col_map = {}
    for col in df.columns:
        lower = col.lower().strip()
        # Map sender_id (spec) to internal sender_account
        if lower in ('sender_id', 'sender', 'sender_account', 'from', 'from_account', 'source', 'source_account'):
            col_map[col] = 'sender_account'
        # Map receiver_id (spec) to internal receiver_account
        elif lower in ('receiver_id', 'receiver', 'receiver_account', 'to', 'to_account', 'target', 'target_account', 'destination'):
            col_map[col] = 'receiver_account'
        elif lower in ('amount', 'value', 'sum', 'transaction_amount'):
            col_map[col] = 'amount'
        elif lower in ('timestamp', 'date', 'time', 'datetime', 'created_at', 'transaction_date'):
            col_map[col] = 'timestamp'
        elif lower in ('transaction_id', 'tx_id', 'id', 'txn_id'):
            col_map[col] = 'transaction_id'
    return df.rename(columns=col_map)


def run_analysis(df):
    """Core analysis pipeline - runs all detection algorithms and scoring."""
    start_time = time.time()

    df = normalize_columns(df)

    required = ['sender_account', 'receiver_account', 'amount', 'timestamp']
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}. Found columns: {list(df.columns)}")

    df['amount'] = pd.to_numeric(df['amount'], errors='coerce')
    df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
    df = df.dropna(subset=['sender_account', 'receiver_account', 'amount'])

    if 'transaction_id' not in df.columns:
        df['transaction_id'] = [f'TX-{i:06d}' for i in range(len(df))]

    logger.info(f"Processing {len(df)} transactions...")

    # Track timing for each stage
    stage_start = time.time()
    G = build_graph(df)
    graph_time = time.time() - stage_start
    logger.info(f"Graph built in {graph_time:.4f}s: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

    stage_start = time.time()
    cycles = detect_cycles(G)
    cycle_time = time.time() - stage_start
    logger.info(f"Cycles detected in {cycle_time:.4f}s: {len(cycles)} found")

    stage_start = time.time()
    smurfing_patterns = detect_smurfing(G, df)
    smurf_time = time.time() - stage_start
    logger.info(f"Smurfing patterns detected in {smurf_time:.4f}s: {len(smurfing_patterns)} found")

    stage_start = time.time()
    shell_patterns = detect_shell_networks(G)
    shell_time = time.time() - stage_start
    logger.info(f"Shell networks detected in {shell_time:.4f}s: {len(shell_patterns)} found")

    stage_start = time.time()
    suspicious_accounts = calculate_suspicion_scores(G, cycles, smurfing_patterns, shell_patterns)
    scoring_time = time.time() - stage_start
    logger.info(f"Scoring complete in {scoring_time:.4f}s: {len(suspicious_accounts)} suspicious accounts")

    # Add pattern labels and explanations to each suspicious account
    for acct in suspicious_accounts:
        acct['pattern_labels'] = [PATTERN_LABELS.get(p, p) for p in acct.get('detected_patterns', [])]
        acct['explanation'] = generate_account_explanation(acct, G)

    # Detect false positives (merchants, payroll)
    false_positives = detect_false_positives(G)
    logger.info(f"False positives identified: {len(false_positives)}")

    # Filter out false positives from suspicious accounts (consistency: don't flag what we exclude)
    suspicious_accounts = [
        a for a in suspicious_accounts
        if a['account_id'] not in false_positives
    ]

    fraud_rings = []
    ring_member_set = set()
    for pattern in cycles + smurfing_patterns + shell_patterns:
        fraud_rings.append({
            'ring_id': pattern['ring_id'],
            'member_accounts': pattern['member_accounts'],
            'pattern_type': pattern['pattern_type'],
            'risk_score': round(pattern['risk_score'], 2)
        })
        ring_member_set.update(pattern['member_accounts'])
    
    # Build timeline data for fraud rings
    timeline_data = build_timeline_data(df, ring_member_set)

    graph_data = build_visualization_data(G, suspicious_accounts, false_positives)

    processing_time = time.time() - start_time
    logger.info(f"Analysis complete in {processing_time:.4f}s (Graph: {graph_time:.2f}s, Cycles: {cycle_time:.2f}s, Smurf: {smurf_time:.2f}s, Shell: {shell_time:.2f}s, Score: {scoring_time:.2f}s)")

    false_positives_list = [
        {'account_id': k, **v} for k, v in false_positives.items()
    ]

    # Build spec-compliant JSON output (for download)
    spec_compliant_output = {
        'suspicious_accounts': [
            {
                'account_id': acct['account_id'],
                'suspicion_score': acct['suspicion_score'],
                'detected_patterns': acct['detected_patterns'],
                'ring_id': acct['ring_id']
            }
            for acct in suspicious_accounts
        ],
        'fraud_rings': [
            {
                'ring_id': ring['ring_id'],
                'member_accounts': ring['member_accounts'],
                'pattern_type': ring['pattern_type'],
                'risk_score': ring['risk_score']
            }
            for ring in fraud_rings
        ],
        'summary': {
            'total_accounts_analyzed': G.number_of_nodes(),
            'suspicious_accounts_flagged': len(suspicious_accounts),
            'fraud_rings_detected': len(fraud_rings),
            'processing_time_seconds': round(processing_time, 4)
        }
    }
    
    # Extended summary for UI (includes false positive count)
    extended_summary = {
        **spec_compliant_output['summary'],
        'false_positives_detected': len(false_positives_list)
    }
    
    # Extended data for frontend visualization only (not in JSON output)
    return {
        'suspicious_accounts': suspicious_accounts,  # Full data for UI (has pattern_labels, metrics, etc.)
        'fraud_rings': spec_compliant_output['fraud_rings'],
        'summary': extended_summary,  # Use extended summary with false positive count for UI
        'spec_compliant_json': spec_compliant_output,  # Exact spec format for download (no FP count)
        'timeline_data': timeline_data,  # Extra for UI
        'graph_data': graph_data,  # Extra for UI (includes false positive info in nodes)
        'false_positives': false_positives_list  # FP list for UI display
    }


def build_timeline_data(df, fraud_accounts):
    """
    Build timeline data showing temporal sequence of fraud transactions.
    Returns sorted list of transactions involving fraud ring members.
    """
    if not fraud_accounts:
        return []
    
    # Filter transactions involving fraud accounts
    fraud_txns = df[
        df['sender_account'].isin(fraud_accounts) | 
        df['receiver_account'].isin(fraud_accounts)
    ].copy()
    
    if fraud_txns.empty:
        return []
    
    # Sort by timestamp
    fraud_txns = fraud_txns.sort_values('timestamp')
    
    # Build timeline events
    timeline = []
    for _, row in fraud_txns.iterrows():
        timeline.append({
            'timestamp': row['timestamp'].isoformat() if pd.notna(row['timestamp']) else None,
            'transaction_id': str(row['transaction_id']),
            'sender': str(row['sender_account']),
            'receiver': str(row['receiver_account']),
            'amount': float(row['amount']),
            'unix_time': int(row['timestamp'].timestamp()) if pd.notna(row['timestamp']) else 0
        })
    
    return timeline


@api_router.get("/")
async def root():
    return {"message": "$yndicato₹ Financial Crime Detection Engine v1.0"}


@api_router.post("/analyze")
async def analyze_transactions(file: UploadFile = File(...)):
    """Upload CSV and run full graph-based analysis."""
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        results = await run_in_threadpool(run_analysis, df)

        doc = {
            'id': str(uuid.uuid4()),
            'created_at': datetime.now(timezone.utc).isoformat(),
            'filename': file.filename,
            'status': 'completed',
            **results
        }
        await db.analyses.insert_one(doc)
        doc.pop('_id', None)

        return doc
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@api_router.post("/analyze-sample")
async def analyze_sample():
    """Generate 10K sample transactions and run full analysis."""
    try:
        transactions = await run_in_threadpool(generate_sample_data, 10000, 1500)
        df = pd.DataFrame(transactions)
        results = await run_in_threadpool(run_analysis, df)

        doc = {
            'id': str(uuid.uuid4()),
            'created_at': datetime.now(timezone.utc).isoformat(),
            'filename': 'sample_data_10k.csv',
            'status': 'completed',
            'is_sample': True,
            **results
        }
        await db.analyses.insert_one(doc)
        doc.pop('_id', None)

        return doc
    except Exception as e:
        logger.error(f"Sample analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@api_router.get("/download-sample")
async def download_sample():
    """Generate and download sample CSV file with spec-compliant column names."""
    transactions = await run_in_threadpool(generate_sample_data, 10000, 1500)

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=['transaction_id', 'sender_id', 'receiver_id', 'amount', 'timestamp']
    )
    writer.writeheader()
    writer.writerows(transactions)

    csv_bytes = output.getvalue().encode()
    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=syndicator_sample_10k.csv"}
    )


@api_router.get("/analysis/{analysis_id}")
async def get_analysis(analysis_id: str):
    """Get stored analysis results by ID."""
    doc = await db.analyses.find_one({"id": analysis_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return doc


@api_router.get("/analysis/{analysis_id}/download")
async def download_analysis_json(analysis_id: str):
    """Download spec-compliant JSON output (exact format per hackathon spec)."""
    doc = await db.analyses.find_one({"id": analysis_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    # Return only spec-compliant fields
    spec_json = doc.get('spec_compliant_json', {
        'suspicious_accounts': doc.get('suspicious_accounts', []),
        'fraud_rings': doc.get('fraud_rings', []),
        'summary': doc.get('summary', {})
    })
    
    # Clean suspicious_accounts to have ONLY required fields
    if 'suspicious_accounts' in spec_json:
        spec_json['suspicious_accounts'] = [
            {
                'account_id': acct.get('account_id'),
                'suspicion_score': acct.get('suspicion_score'),
                'detected_patterns': acct.get('detected_patterns', []),
                'ring_id': acct.get('ring_id')
            }
            for acct in spec_json['suspicious_accounts']
        ]
    
    # Clean fraud_rings to have ONLY required fields
    if 'fraud_rings' in spec_json:
        spec_json['fraud_rings'] = [
            {
                'ring_id': ring.get('ring_id'),
                'member_accounts': ring.get('member_accounts', []),
                'pattern_type': ring.get('pattern_type'),
                'risk_score': ring.get('risk_score')
            }
            for ring in spec_json['fraud_rings']
        ]
    
    # Clean summary to have ONLY required fields
    if 'summary' in spec_json:
        summary = spec_json['summary']
        spec_json['summary'] = {
            'total_accounts_analyzed': summary.get('total_accounts_analyzed'),
            'suspicious_accounts_flagged': summary.get('suspicious_accounts_flagged'),
            'fraud_rings_detected': summary.get('fraud_rings_detected'),
            'processing_time_seconds': summary.get('processing_time_seconds')
        }
    
    return spec_json


@api_router.get("/analyses")
async def list_analyses():
    """List all past analyses (without heavy data)."""
    docs = await db.analyses.find(
        {},
        {"_id": 0, "graph_data": 0, "suspicious_accounts": 0, "fraud_rings": 0}
    ).sort("created_at", -1).to_list(100)
    return docs


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
