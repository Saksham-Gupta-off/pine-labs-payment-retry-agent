import aiosqlite
import json
import os
import uuid

DB_PATH = os.path.join(os.path.dirname(__file__), "paysense.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    amount INTEGER,
    instrument_id TEXT,
    instrument_name TEXT DEFAULT '',
    status TEXT,
    failure_code TEXT,
    retry_of TEXT,
    savings INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reasoning_traces (
    id TEXT PRIMARY KEY,
    transaction_id TEXT,
    trace_type TEXT,
    reasoning TEXT,
    instrument_selected TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS instruments (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    handle TEXT,
    last4 TEXT,
    icon TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    success_rate REAL DEFAULT 0.9,
    recent_failures INTEGER DEFAULT 0,
    total_attempts INTEGER DEFAULT 10,
    total_successes INTEGER DEFAULT 8,
    offers TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(SCHEMA)
        await db.commit()
    # Seed instruments if table is empty
    await _seed_instruments()
    # Seed dummy transactions for demo
    await _seed_dummy_transactions()


async def _seed_instruments():
    from mock_data import DEFAULT_INSTRUMENTS
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT COUNT(*) FROM instruments")
        count = (await cursor.fetchone())[0]
        if count == 0:
            for inst in DEFAULT_INSTRUMENTS:
                await db.execute(
                    """INSERT INTO instruments (id, type, name, handle, last4, icon, is_active, success_rate, recent_failures, total_attempts, total_successes, offers)
                       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)""",
                    (
                        inst["id"],
                        inst["type"],
                        inst["name"],
                        inst.get("handle"),
                        inst.get("last4"),
                        inst.get("icon", ""),
                        inst.get("success_rate", 0.9),
                        inst.get("recent_failures", 0),
                        inst.get("total_attempts", 10),
                        inst.get("total_successes", 8),
                        json.dumps(inst.get("offers", {})),
                    ),
                )
            await db.commit()


async def _seed_dummy_transactions():
    """Seed realistic dummy transactions so the dashboard looks populated on first load."""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT COUNT(*) FROM transactions")
        count = (await cursor.fetchone())[0]
        if count > 0:
            return

        # fmt: off
        dummy_txns = [
            # ── Successful payment: boAt Airdopes via ICICI card ──
            {"id": "demo-tx-001", "order_id": "PAYSENSE-A1B2C3D4E5F6", "amount": 1299, "instrument_id": "card_1", "instrument_name": "ICICI Amazon Pay Card", "status": "SUCCESS", "failure_code": None, "retry_of": None, "savings": 65},

            # ── Failed + recovered: iPhone via PhonePe UPI → HDFC Regalia ──
            {"id": "demo-tx-002", "order_id": "PAYSENSE-F7E8D9C0B1A2", "amount": 54900, "instrument_id": "upi_2", "instrument_name": "PhonePe UPI", "status": "FAILED", "failure_code": "UPI_HANDLE_INACTIVE", "retry_of": None, "savings": 0},
            {"id": "demo-tx-003", "order_id": "PAYSENSE-F7E8D9C0B1A2", "amount": 54900, "instrument_id": "card_3", "instrument_name": "HDFC Regalia", "status": "RECOVERED", "failure_code": None, "retry_of": "demo-tx-002", "savings": 6000},

            # ── Successful payment: Sony headphones via Axis card ──
            {"id": "demo-tx-004", "order_id": "PAYSENSE-1A2B3C4D5E6F", "amount": 27989, "instrument_id": "card_2", "instrument_name": "Axis Flipkart Card", "status": "SUCCESS", "failure_code": None, "retry_of": None, "savings": 420},

            # ── Failed + recovered: PS5 via GPay UPI → ICICI card ──
            {"id": "demo-tx-005", "order_id": "PAYSENSE-9F8E7D6C5B4A", "amount": 49990, "instrument_id": "upi_1", "instrument_name": "GPay UPI", "status": "FAILED", "failure_code": "ISSUER_BANK_DOWN", "retry_of": None, "savings": 0},
            {"id": "demo-tx-006", "order_id": "PAYSENSE-9F8E7D6C5B4A", "amount": 49990, "instrument_id": "card_1", "instrument_name": "ICICI Amazon Pay Card", "status": "RECOVERED", "failure_code": None, "retry_of": "demo-tx-005", "savings": 2500},

            # ── Successful: Nike Jordan via GPay ──
            {"id": "demo-tx-007", "order_id": "PAYSENSE-3D4E5F6A7B8C", "amount": 12295, "instrument_id": "upi_1", "instrument_name": "GPay UPI", "status": "SUCCESS", "failure_code": None, "retry_of": None, "savings": 0},

            # ── Failed + recovered: MacBook via SBI debit → Axis card ──
            {"id": "demo-tx-008", "order_id": "PAYSENSE-C9D8E7F6A5B4", "amount": 99900, "instrument_id": "card_4", "instrument_name": "SBI Debit Card", "status": "FAILED", "failure_code": "CARD_LIMIT_EXCEEDED", "retry_of": None, "savings": 0},
            {"id": "demo-tx-009", "order_id": "PAYSENSE-C9D8E7F6A5B4", "amount": 99900, "instrument_id": "card_2", "instrument_name": "Axis Flipkart Card", "status": "RECOVERED", "failure_code": None, "retry_of": "demo-tx-008", "savings": 4000},

            # ── Successful: Dyson via HDFC Regalia ──
            {"id": "demo-tx-010", "order_id": "PAYSENSE-7A8B9C0D1E2F", "amount": 52900, "instrument_id": "card_3", "instrument_name": "HDFC Regalia", "status": "SUCCESS", "failure_code": None, "retry_of": None, "savings": 5000},

            # ── Successful: Samsung S24 via ICICI card ──
            {"id": "demo-tx-011", "order_id": "PAYSENSE-2E3F4A5B6C7D", "amount": 108799, "instrument_id": "card_1", "instrument_name": "ICICI Amazon Pay Card", "status": "SUCCESS", "failure_code": None, "retry_of": None, "savings": 5440},

            # ── Failed + recovered: boAt earbuds via PhonePe → GPay ──
            {"id": "demo-tx-012", "order_id": "PAYSENSE-D1E2F3A4B5C6", "amount": 1299, "instrument_id": "upi_2", "instrument_name": "PhonePe UPI", "status": "FAILED", "failure_code": "TIMED_OUT", "retry_of": None, "savings": 0},
            {"id": "demo-tx-013", "order_id": "PAYSENSE-D1E2F3A4B5C6", "amount": 1299, "instrument_id": "upi_1", "instrument_name": "GPay UPI", "status": "RECOVERED", "failure_code": None, "retry_of": "demo-tx-012", "savings": 0},

            # ── Successful: Paytm card purchase ──
            {"id": "demo-tx-014", "order_id": "PAYSENSE-E5F6A7B8C9D0", "amount": 3499, "instrument_id": "card_5", "instrument_name": "Paytm HDFC Select", "status": "SUCCESS", "failure_code": None, "retry_of": None, "savings": 70},
        ]
        # fmt: on

        for tx in dummy_txns:
            await db.execute(
                """INSERT INTO transactions (id, order_id, amount, instrument_id, instrument_name, status, failure_code, retry_of, savings)
                   VALUES (:id, :order_id, :amount, :instrument_id, :instrument_name, :status, :failure_code, :retry_of, :savings)""",
                tx,
            )

        # Reasoning traces for the dummy transactions
        dummy_traces = [
            {"id": "demo-tr-001", "transaction_id": "demo-tx-001", "trace_type": "RECOMMENDATION",
             "reasoning": "ICICI Amazon Pay Card selected — 96% success rate, 5% cashback saves ₹65 on boAt Airdopes 141. No recent failures.",
             "instrument_selected": "card_1"},

            {"id": "demo-tr-002", "transaction_id": "demo-tx-002", "trace_type": "RECOMMENDATION",
             "reasoning": "PhonePe UPI selected for iPhone 15 — user's preferred UPI handle for quick payments.",
             "instrument_selected": "upi_2"},
            {"id": "demo-tr-003", "transaction_id": "demo-tx-002", "trace_type": "DIAGNOSIS",
             "reasoning": "Payment failed: UPI handle arjun@ybl is inactive or unreachable. PhonePe UPI had 4 recent failures — likely persistent issue. Switching to HDFC Regalia which offers ₹6,000 instant discount and has 91% success rate.",
             "instrument_selected": "card_3"},
            {"id": "demo-tr-004", "transaction_id": "demo-tx-003", "trace_type": "RECOVERY",
             "reasoning": "Successfully recovered payment using HDFC Regalia. Original failure: UPI_HANDLE_INACTIVE on PhonePe UPI. Customer saved ₹6,000 via HDFC instant discount.",
             "instrument_selected": "card_3"},

            {"id": "demo-tr-005", "transaction_id": "demo-tx-004", "trace_type": "RECOMMENDATION",
             "reasoning": "Axis Flipkart Card chosen for Sony WH-1000XM5 — 93% success rate, ₹420 cashback at 1.5%. ICICI card has higher cashback (₹1,400) but user recently used Axis for this category.",
             "instrument_selected": "card_2"},

            {"id": "demo-tr-006", "transaction_id": "demo-tx-005", "trace_type": "RECOMMENDATION",
             "reasoning": "GPay UPI selected for PS5 Slim — user prefers UPI for gaming purchases under ₹50,000.",
             "instrument_selected": "upi_1"},
            {"id": "demo-tr-007", "transaction_id": "demo-tx-005", "trace_type": "DIAGNOSIS",
             "reasoning": "SBI Bank gateway is down (ISSUER_BANK_DOWN). This affects GPay UPI routed via SBI. Switching to ICICI Amazon Pay Card — 96% success rate, ₹2,500 cashback on PS5.",
             "instrument_selected": "card_1"},
            {"id": "demo-tr-008", "transaction_id": "demo-tx-006", "trace_type": "RECOVERY",
             "reasoning": "Payment recovered via ICICI Amazon Pay Card. Root cause: SBI issuer bank downtime affected GPay UPI. Recovery saved ₹2,500 in cashback.",
             "instrument_selected": "card_1"},

            {"id": "demo-tr-009", "transaction_id": "demo-tx-007", "trace_type": "RECOMMENDATION",
             "reasoning": "GPay UPI selected for Nike Jordan 1 — amount under ₹15,000, UPI preferred for this range. SBI gateway recovered since last failure.",
             "instrument_selected": "upi_1"},

            {"id": "demo-tr-010", "transaction_id": "demo-tx-008", "trace_type": "RECOMMENDATION",
             "reasoning": "SBI Debit Card selected for MacBook Air M3 — user requested debit card payment.",
             "instrument_selected": "card_4"},
            {"id": "demo-tr-011", "transaction_id": "demo-tx-008", "trace_type": "DIAGNOSIS",
             "reasoning": "SBI Debit Card hit daily transaction limit (CARD_LIMIT_EXCEEDED) — ₹99,900 exceeds typical debit card single-txn limit of ₹50,000. Switching to Axis Flipkart Card with ₹4,000 cashback and 93% success rate.",
             "instrument_selected": "card_2"},
            {"id": "demo-tr-012", "transaction_id": "demo-tx-009", "trace_type": "RECOVERY",
             "reasoning": "Recovered via Axis Flipkart Card. Root cause: SBI debit card limit exceeded for high-value purchase. Credit card has no single-txn limit. Saved ₹4,000.",
             "instrument_selected": "card_2"},

            {"id": "demo-tr-013", "transaction_id": "demo-tx-010", "trace_type": "RECOMMENDATION",
             "reasoning": "HDFC Regalia selected for Dyson V12 — ₹5,000 instant discount (best offer), 91% success rate. ICICI cashback is ₹2,645 (lower savings).",
             "instrument_selected": "card_3"},

            {"id": "demo-tr-014", "transaction_id": "demo-tx-011", "trace_type": "RECOMMENDATION",
             "reasoning": "ICICI Amazon Pay Card selected for Samsung S24 Ultra — ₹5,440 cashback (5%), highest savings among all instruments. 96% success rate with 0 recent failures.",
             "instrument_selected": "card_1"},

            {"id": "demo-tr-015", "transaction_id": "demo-tx-012", "trace_type": "DIAGNOSIS",
             "reasoning": "PhonePe UPI timed out (TIMED_OUT). Network latency detected. Switching to GPay UPI routed through SBI — different payment rail may avoid the timeout.",
             "instrument_selected": "upi_1"},
            {"id": "demo-tr-016", "transaction_id": "demo-tx-013", "trace_type": "RECOVERY",
             "reasoning": "Recovered via GPay UPI. PhonePe timeout was likely network-specific — GPay uses a different PSP rail. No savings on this order.",
             "instrument_selected": "upi_1"},

            {"id": "demo-tr-017", "transaction_id": "demo-tx-014", "trace_type": "RECOMMENDATION",
             "reasoning": "Paytm HDFC Select chosen — 2% cashback saves ₹70, 88% success rate. Good fit for mid-range purchases.",
             "instrument_selected": "card_5"},
        ]

        for tr in dummy_traces:
            await db.execute(
                """INSERT INTO reasoning_traces (id, transaction_id, trace_type, reasoning, instrument_selected)
                   VALUES (:id, :transaction_id, :trace_type, :reasoning, :instrument_selected)""",
                tr,
            )

        await db.commit()


async def get_db():
    return await aiosqlite.connect(DB_PATH)


# ── Instrument CRUD ────────────────────────────────────────────

async def get_instruments():
    """Return all active instruments as dicts (with offers parsed from JSON)."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM instruments WHERE is_active = 1 ORDER BY created_at"
        )
        rows = await cursor.fetchall()
        results = []
        for row in rows:
            d = dict(row)
            # Parse offers JSON string back to dict
            try:
                d["offers"] = json.loads(d.get("offers") or "{}")
            except (json.JSONDecodeError, TypeError):
                d["offers"] = {}
            results.append(d)
        return results


async def insert_instrument(inst: dict) -> dict:
    """Insert a new instrument and return it."""
    inst_id = inst.get("id", f"inst_{uuid.uuid4().hex[:8]}")
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO instruments (id, type, name, handle, last4, icon, is_active, success_rate, recent_failures, total_attempts, total_successes, offers)
               VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)""",
            (
                inst_id,
                inst["type"],
                inst["name"],
                inst.get("handle"),
                inst.get("last4"),
                inst.get("icon", ""),
                inst.get("success_rate", 0.9),
                inst.get("recent_failures", 0),
                inst.get("total_attempts", 10),
                inst.get("total_successes", 8),
                json.dumps(inst.get("offers", {})),
            ),
        )
        await db.commit()
    return {**inst, "id": inst_id, "is_active": 1}


async def delete_instrument(inst_id: str) -> bool:
    """Soft-delete an instrument (set is_active=0). Returns True if found."""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "UPDATE instruments SET is_active = 0 WHERE id = ?", (inst_id,)
        )
        await db.commit()
        return cursor.rowcount > 0


async def update_instrument_stats(instrument_id: str, success: bool):
    """Update instrument success_rate and recent_failures after a transaction."""
    async with aiosqlite.connect(DB_PATH) as db:
        if success:
            await db.execute(
                """UPDATE instruments
                   SET total_attempts = total_attempts + 1,
                       total_successes = total_successes + 1,
                       success_rate = CAST(total_successes + 1 AS REAL) / (total_attempts + 1),
                       recent_failures = 0
                   WHERE id = ?""",
                (instrument_id,),
            )
        else:
            await db.execute(
                """UPDATE instruments
                   SET total_attempts = total_attempts + 1,
                       success_rate = CAST(total_successes AS REAL) / (total_attempts + 1),
                       recent_failures = recent_failures + 1
                   WHERE id = ?""",
                (instrument_id,),
            )
        await db.commit()


# ── Transaction helpers ────────────────────────────────────────

async def insert_transaction(tx: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO transactions (id, order_id, amount, instrument_id, instrument_name, status, failure_code, retry_of, savings)
               VALUES (:id, :order_id, :amount, :instrument_id, :instrument_name, :status, :failure_code, :retry_of, :savings)""",
            tx,
        )
        await db.commit()


async def update_transaction_status(tx_id: str, status: str, failure_code: str = None):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE transactions SET status = ?, failure_code = ? WHERE id = ?",
            (status, failure_code, tx_id),
        )
        await db.commit()


async def insert_trace(trace: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO reasoning_traces (id, transaction_id, trace_type, reasoning, instrument_selected)
               VALUES (:id, :transaction_id, :trace_type, :reasoning, :instrument_selected)""",
            trace,
        )
        await db.commit()


async def get_all_transactions():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM transactions ORDER BY created_at DESC"
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def get_all_traces():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM reasoning_traces ORDER BY created_at DESC"
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
