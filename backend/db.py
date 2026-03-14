import aiosqlite
import os

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
"""


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(SCHEMA)
        await db.commit()


async def get_db():
    return await aiosqlite.connect(DB_PATH)


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
