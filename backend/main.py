import uuid
import time
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import db
import pinelabs
import payment_simulator
import agent
from mock_data import USER, PRODUCT
from models import ArmFailureRequest, PaymentExecuteRequest


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_db()
    yield


app = FastAPI(title="PaySense API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Data endpoints ──────────────────────────────────────────────

@app.get("/api/user")
async def get_user():
    return USER


@app.get("/api/product")
async def get_product():
    return PRODUCT


# ── Demo control endpoints ──────────────────────────────────────

@app.post("/api/demo/arm-failure")
async def arm_failure(req: ArmFailureRequest):
    payment_simulator.arm_failure(req.error_code)
    return {"status": "armed", "error_code": req.error_code}


@app.post("/api/demo/clear")
async def clear_failure():
    payment_simulator.clear_failure()
    return {"status": "cleared"}


@app.get("/api/demo/status")
async def demo_status():
    armed = payment_simulator.get_armed_failure()
    return {"armed_failure": armed}


# ── Payment flow ────────────────────────────────────────────────

@app.post("/api/payment/recommend")
async def recommend_payment():
    """
    Step 1: Agent analyzes instruments and returns a recommendation.
    No payment is executed yet.
    """
    instruments = USER["instruments"]

    try:
        offers = await pinelabs.discover_offers(PRODUCT["price"] * 100)
    except Exception:
        offers = {}

    try:
        recommendation = agent.recommend_instrument(PRODUCT, instruments, offers)
    except Exception:
        best = max(instruments, key=lambda i: i["success_rate"])
        recommendation = {
            "recommended_id": best["id"],
            "recommended_name": best["name"],
            "reasoning": f"Selected {best['name']} based on highest success rate ({best['success_rate']*100:.0f}%).",
            "savings_amount": best.get("offer", {}).get("amount", 0),
            "ranked_instruments": [
                {"id": i["id"], "score": i["success_rate"], "rationale": f"{i['name']} — {i['success_rate']*100:.0f}% success rate"}
                for i in sorted(instruments, key=lambda x: x["success_rate"], reverse=True)
            ],
        }

    return {"recommendation": recommendation, "product": PRODUCT}


@app.post("/api/payment/execute")
async def execute_payment(req: PaymentExecuteRequest):
    """
    Step 2: Execute payment with chosen instrument.
    Handles failure detection, diagnosis, and auto-recovery.
    """
    start_time = time.time()
    instruments = USER["instruments"]

    chosen_id = req.instrument_id or instruments[0]["id"]
    chosen_instrument = next((i for i in instruments if i["id"] == chosen_id), instruments[0])

    flow_result = {
        "initial_attempt": None,
        "recovery": None,
        "order_id": None,
        "final_status": None,
        "traces": [],
        "total_time_ms": 0,
    }

    # Step 1: Create real Pine Labs order
    merchant_ref = f"PAYSENSE-{uuid.uuid4().hex[:12].upper()}"
    try:
        order = await pinelabs.create_order(
            amount_paise=PRODUCT["price"] * 100,
            customer={"email": USER["email"], "first_name": USER["first_name"],
                      "last_name": USER["last_name"], "phone": USER["phone"]},
            notes=PRODUCT["name"],
            merchant_order_ref=merchant_ref,
        )
        order_id = order.get("order_id", order.get("id", merchant_ref))
    except Exception:
        order_id = merchant_ref

    flow_result["order_id"] = order_id

    # Step 2: Attempt payment
    tx_id = str(uuid.uuid4())
    result = payment_simulator.execute_payment(order_id, chosen_instrument)

    tx_record = {
        "id": tx_id,
        "order_id": order_id,
        "amount": PRODUCT["price"],
        "instrument_id": chosen_id,
        "instrument_name": chosen_instrument["name"],
        "status": "SUCCESS" if result["success"] else "FAILED",
        "failure_code": None if result["success"] else result["data"]["payments"][0]["error_detail"]["code"],
        "retry_of": None,
    }
    await db.insert_transaction(tx_record)

    # Store recommendation trace (for the instrument the user chose)
    rec_trace_id = str(uuid.uuid4())
    await db.insert_trace({
        "id": rec_trace_id,
        "transaction_id": tx_id,
        "trace_type": "RECOMMENDATION",
        "reasoning": f"User selected {chosen_instrument['name']} for payment of ₹{PRODUCT['price']}",
        "instrument_selected": chosen_id,
    })
    flow_result["traces"].append({
        "id": rec_trace_id,
        "type": "RECOMMENDATION",
        "reasoning": f"User selected {chosen_instrument['name']} for payment of ₹{PRODUCT['price']}",
        "instrument": chosen_instrument["name"],
    })

    flow_result["initial_attempt"] = {
        "transaction_id": tx_id,
        "instrument_id": chosen_id,
        "instrument_name": chosen_instrument["name"],
        "status": tx_record["status"],
        "error": result["data"]["payments"][0].get("error_detail") if not result["success"] else None,
        "pine_labs_response": result,
    }

    # Step 3: If failed, agent diagnoses and recovers
    if not result["success"]:
        failure_payload = result

        try:
            diagnosis = agent.diagnose_and_recover(
                failure_payload, instruments, chosen_id
            )
        except Exception:
            remaining = [i for i in instruments if i["id"] != chosen_id]
            fallback = max(remaining, key=lambda i: i["success_rate"]) if remaining else instruments[0]
            error_code = result["data"]["payments"][0]["error_detail"]["code"]
            diagnosis = {
                "diagnosis": f"Payment failed with {error_code}",
                "root_cause": error_code,
                "fallback_instrument_id": fallback["id"],
                "fallback_instrument_name": fallback["name"],
                "reasoning": f"Switching to {fallback['name']} which has a {fallback['success_rate']*100:.0f}% success rate.",
                "confidence": 0.85,
            }

        # Store diagnosis trace
        diag_trace_id = str(uuid.uuid4())
        await db.insert_trace({
            "id": diag_trace_id,
            "transaction_id": tx_id,
            "trace_type": "DIAGNOSIS",
            "reasoning": diagnosis["reasoning"],
            "instrument_selected": diagnosis["fallback_instrument_id"],
        })
        flow_result["traces"].append({
            "id": diag_trace_id,
            "type": "DIAGNOSIS",
            "diagnosis": diagnosis["diagnosis"],
            "root_cause": diagnosis["root_cause"],
            "reasoning": diagnosis["reasoning"],
            "confidence": diagnosis.get("confidence", 0.9),
        })

        # Step 4: Retry with fallback
        fallback_id = diagnosis["fallback_instrument_id"]
        fallback_instrument = next((i for i in instruments if i["id"] == fallback_id), instruments[0])

        retry_tx_id = str(uuid.uuid4())
        retry_result = payment_simulator.execute_payment(order_id, fallback_instrument)

        retry_record = {
            "id": retry_tx_id,
            "order_id": order_id,
            "amount": PRODUCT["price"],
            "instrument_id": fallback_id,
            "instrument_name": fallback_instrument["name"],
            "status": "RECOVERED" if retry_result["success"] else "FAILED",
            "failure_code": None if retry_result["success"] else retry_result["data"]["payments"][0]["error_detail"].get("code"),
            "retry_of": tx_id,
        }
        await db.insert_transaction(retry_record)

        recovery_trace_id = str(uuid.uuid4())
        recovery_reasoning = f"Successfully recovered payment using {fallback_instrument['name']}. Original failure: {diagnosis['diagnosis']}"
        await db.insert_trace({
            "id": recovery_trace_id,
            "transaction_id": retry_tx_id,
            "trace_type": "RECOVERY",
            "reasoning": recovery_reasoning,
            "instrument_selected": fallback_id,
        })
        flow_result["traces"].append({
            "id": recovery_trace_id,
            "type": "RECOVERY",
            "instrument": fallback_instrument["name"],
            "status": retry_record["status"],
            "reasoning": recovery_reasoning,
        })

        flow_result["recovery"] = {
            "transaction_id": retry_tx_id,
            "instrument_id": fallback_id,
            "instrument_name": fallback_instrument["name"],
            "status": retry_record["status"],
            "diagnosis": diagnosis["diagnosis"],
            "reasoning": diagnosis["reasoning"],
            "pine_labs_response": retry_result,
        }

        flow_result["final_status"] = retry_record["status"]
    else:
        flow_result["final_status"] = "SUCCESS"

    flow_result["total_time_ms"] = int((time.time() - start_time) * 1000)
    return flow_result


# ── Transaction + Dashboard endpoints ───────────────────────────

@app.get("/api/transactions")
async def get_transactions():
    txns = await db.get_all_transactions()
    traces = await db.get_all_traces()
    return {"transactions": txns, "traces": traces}


@app.get("/api/dashboard")
async def get_dashboard():
    txns = await db.get_all_transactions()
    traces = await db.get_all_traces()

    total = len(txns)
    recoveries = len([t for t in txns if t["status"] == "RECOVERED"])
    successes = len([t for t in txns if t["status"] in ("SUCCESS", "RECOVERED")])
    failures_original = len([t for t in txns if t["retry_of"] is None and t["status"] == "FAILED"])

    # Money saved: count cashback from successful txns using instruments with offers
    money_saved = 0
    for t in txns:
        if t["status"] in ("SUCCESS", "RECOVERED"):
            inst = next((i for i in USER["instruments"] if i["id"] == t["instrument_id"]), None)
            if inst and "offer" in inst:
                money_saved += inst["offer"]["amount"]

    # Success rate "before" = without recovery (only first attempts)
    first_attempts = [t for t in txns if t["retry_of"] is None]
    before_success = len([t for t in first_attempts if t["status"] == "SUCCESS"])
    before_rate = (before_success / len(first_attempts) * 100) if first_attempts else 0

    # Success rate "after" = with recovery
    after_rate = (successes / total * 100) if total else 0

    return {
        "total_transactions": total,
        "successful_recoveries": recoveries,
        "money_saved": money_saved,
        "success_rate_before": round(before_rate, 1),
        "success_rate_after": round(after_rate, 1),
        "transactions": txns,
        "traces": traces,
    }


@app.delete("/api/transactions")
async def clear_transactions():
    """Clear all transactions and traces — for demo reset."""
    import aiosqlite
    async with aiosqlite.connect(db.DB_PATH) as conn:
        await conn.execute("DELETE FROM transactions")
        await conn.execute("DELETE FROM reasoning_traces")
        await conn.commit()
    return {"status": "cleared"}
