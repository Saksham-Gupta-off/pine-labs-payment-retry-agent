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


async def _seed_instruments():
    from mock_data import DEFAULT_INSTRUMENTS
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT COUNT(*) FROM instruments")
        count = (await cursor.fetchone())[0]
        if count == 0:
            for inst in DEFAULT_INSTRUMENTS:
                await db.execute(
                    """INSERT INTO instruments (id, type, name, handle, last4, icon, is_active, success_rate, recent_failures, offers)
                       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)""",
                    (
                        inst["id"],
                        inst["type"],
                        inst["name"],
                        inst.get("handle"),
                        inst.get("last4"),
                        inst.get("icon", ""),
                        inst.get("success_rate", 0.9),
                        inst.get("recent_failures", 0),
                        json.dumps(inst.get("offers", {})),
                    ),
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
            """INSERT INTO instruments (id, type, name, handle, last4, icon, is_active, success_rate, recent_failures, offers)
               VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)""",
            (
                inst_id,
                inst["type"],
                inst["name"],
                inst.get("handle"),
                inst.get("last4"),
                inst.get("icon", ""),
                inst.get("success_rate", 0.9),
                inst.get("recent_failures", 0),
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


# ── Transaction helpers ────────────────────────────────────────

async def insert_transaction(tx: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO transactions (id, order_id, amount, instrument_id, instrument_name, status, failure_code, retry_of)
               VALUES (:id, :order_id, :amount, :instrument_id, :instrument_name, :status, :failure_code, :retry_of)""",
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
