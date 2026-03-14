import uuid
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
import pinelabs
import payment_simulator
import agent
from mock_data import USER, PRODUCTS, get_product_by_id, get_best_offer_for_instrument


# ── In-memory product search cache ────────────────────────────
_product_search_cache: dict[str, dict] = {}


def _cache_products(products: list):
    """Add products to the in-memory cache so they can be looked up by ID."""
    for p in products:
        _product_search_cache[p["id"]] = p


def _get_product(product_id: str) -> dict:
    """Look up a product by ID — checks search cache first, then hardcoded catalog."""
    if product_id in _product_search_cache:
        return _product_search_cache[product_id]
    return get_product_by_id(product_id)


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


# ── Request models ──────────────────────────────────────────────

class ArmFailureRequest(BaseModel):
    error_code: str
    count: int = 1
    instrument_type: Optional[str] = None
    instrument_id: Optional[str] = None


class RemoveRuleRequest(BaseModel):
    index: int


class RecommendRequest(BaseModel):
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    product_price: Optional[int] = None


class PaymentExecuteRequest(BaseModel):
    instrument_id: Optional[str] = None
    product_id: Optional[str] = None


class SmartPayRequest(BaseModel):
    product_name: str
    product_price: int
    instrument_id: Optional[str] = None


class ProductSearchRequest(BaseModel):
    query: str


class AddInstrumentRequest(BaseModel):
    type: str  # "UPI", "Credit Card", "Debit Card"
    name: str  # e.g. "HDFC Regalia"
    handle: Optional[str] = None  # UPI handle
    last4: Optional[str] = None  # card last 4 digits
    icon: str = ""


# ── Data endpoints ──────────────────────────────────────────────

@app.get("/api/user")
async def get_user():
    return USER


@app.get("/api/products")
async def list_products():
    return {"products": PRODUCTS}


@app.get("/api/product/{product_id}")
async def get_product_endpoint(product_id: str):
    return _get_product(product_id)


@app.post("/api/products/search")
async def search_products(req: ProductSearchRequest):
    """Search for products using Claude AI — returns realistic Indian e-commerce results."""
    try:
        results = agent.search_products(req.query)
        # Cache results so they can be referenced by ID in payment flow
        _cache_products(results)
        return {"products": results, "query": req.query}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Product search failed: {str(e)}")


# ── Instrument endpoints ────────────────────────────────────────

@app.get("/api/instruments")
async def list_instruments():
    """List all active payment instruments from DB."""
    instruments = await db.get_instruments()
    return {"instruments": instruments}


@app.post("/api/instruments")
async def add_instrument(req: AddInstrumentRequest):
    """Add a new payment instrument."""
    inst = {
        "type": req.type,
        "name": req.name,
        "handle": req.handle,
        "last4": req.last4,
        "icon": req.icon,
        "success_rate": 0.9,
        "recent_failures": 0,
        "offers": {},
    }
    result = await db.insert_instrument(inst)
    return {"instrument": result}


@app.delete("/api/instruments/{instrument_id}")
async def remove_instrument(instrument_id: str):
    """Soft-delete a payment instrument."""
    deleted = await db.delete_instrument(instrument_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Instrument not found")
    return {"status": "deleted", "id": instrument_id}


# ── Demo control endpoints ──────────────────────────────────────

@app.post("/api/demo/arm-failure")
async def arm_failure(req: ArmFailureRequest):
    """Add a failure rule to the queue."""
    rule = payment_simulator.add_failure_rule(
        error_code=req.error_code,
        count=req.count,
        instrument_type=req.instrument_type,
        instrument_id=req.instrument_id,
    )
    return {"status": "armed", "rule": rule, **payment_simulator.get_status()}


@app.post("/api/demo/remove-rule")
async def remove_rule(req: RemoveRuleRequest):
    """Remove a specific rule by index."""
    removed = payment_simulator.remove_rule(req.index)
    if not removed:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"status": "removed", **payment_simulator.get_status()}


@app.post("/api/demo/clear")
async def clear_failure():
    payment_simulator.clear_failure()
    return {"status": "cleared"}


@app.get("/api/demo/status")
async def demo_status():
    return payment_simulator.get_status()


# ── Payment flow ────────────────────────────────────────────────

@app.post("/api/payment/recommend")
async def recommend_payment(req: RecommendRequest):
    if req.product_name and req.product_price:
        # Direct product from extension — no Claude search needed
        from agent import _compute_card_offers
        product_id = f"ext-{uuid.uuid4().hex[:8]}"
        product = {
            "id": product_id,
            "name": req.product_name,
            "price": req.product_price,
            "mrp": req.product_price,
            "category": "External",
            "image_emoji": "🛒",
            "description": req.product_name,
            "card_offers": _compute_card_offers(req.product_price),
        }
        _product_search_cache[product_id] = product
    elif req.product_id:
        product = _get_product(req.product_id)
    else:
        product = PRODUCTS[0]
    instruments = await db.get_instruments()

    # Build instrument context with product-specific offers
    instruments_with_offers = []
    for inst in instruments:
        inst_copy = {**inst}
        card_offer = get_best_offer_for_instrument(product, inst["id"])
        if card_offer:
            inst_copy["product_offer"] = card_offer
        instruments_with_offers.append(inst_copy)

    try:
        offers = await pinelabs.discover_offers(product["price"] * 100)
    except Exception:
        offers = {}

    try:
        recommendation = agent.recommend_instrument(product, instruments_with_offers, offers)
    except Exception:
        # Fallback: pick best instrument considering offers
        best = max(instruments_with_offers, key=lambda i: i.get("success_rate", 0.5))
        best_offer = get_best_offer_for_instrument(product, best["id"])
        recommendation = {
            "recommended_id": best["id"],
            "recommended_name": best["name"],
            "reasoning": f"Selected {best['name']} based on highest success rate ({best.get('success_rate', 0.5)*100:.0f}%).",
            "savings_amount": best_offer["amount"] if best_offer else 0,
            "ranked_instruments": [
                {
                    "id": i["id"],
                    "score": i.get("success_rate", 0.5),
                    "rationale": f"{i['name']} — {i.get('success_rate', 0.5)*100:.0f}% success rate"
                    + (f", {get_best_offer_for_instrument(product, i['id'])['desc']}" if get_best_offer_for_instrument(product, i['id']) else ""),
                }
                for i in sorted(instruments_with_offers, key=lambda x: x.get("success_rate", 0.5), reverse=True)
            ],
        }

    return {"recommendation": recommendation, "product": product, "instruments": instruments_with_offers}


@app.post("/api/payment/execute")
async def execute_payment(req: PaymentExecuteRequest):
    start_time = time.time()
    product = _get_product(req.product_id) if req.product_id else PRODUCTS[0]
    instruments = await db.get_instruments()

    chosen_id = req.instrument_id or instruments[0]["id"]
    chosen_instrument = next((i for i in instruments if i["id"] == chosen_id), instruments[0])
    chosen_offer = get_best_offer_for_instrument(product, chosen_id)

    flow_result = {
        "initial_attempt": None,
        "recovery": None,
        "order_id": None,
        "product": product,
        "final_status": None,
        "savings": 0,
        "traces": [],
        "total_time_ms": 0,
    }

    # Create real Pine Labs order
    merchant_ref = f"PAYSENSE-{uuid.uuid4().hex[:12].upper()}"
    try:
        order = await pinelabs.create_order(
            amount_paise=product["price"] * 100,
            customer={"email": USER["email"], "first_name": USER["first_name"],
                      "last_name": USER["last_name"], "phone": USER["phone"]},
            notes=product["name"],
            merchant_order_ref=merchant_ref,
        )
        # Pine Labs wraps response in "data" key
        order_data = order.get("data", order)
        order_id = order_data.get("order_id", order_data.get("id", merchant_ref))
    except Exception:
        order_id = merchant_ref

    flow_result["order_id"] = order_id

    # Attempt payment (now async-aware with real Pine Labs calls)
    tx_id = str(uuid.uuid4())
    result = await payment_simulator.execute_payment_async(order_id, chosen_instrument, product["price"] * 100)

    tx_record = {
        "id": tx_id,
        "order_id": order_id,
        "amount": product["price"],
        "instrument_id": chosen_id,
        "instrument_name": chosen_instrument["name"],
        "status": "SUCCESS" if result["success"] else "FAILED",
        "failure_code": None if result["success"] else result["data"]["payments"][0]["error_detail"]["code"],
        "retry_of": None,
    }
    await db.insert_transaction(tx_record)

    rec_trace_id = str(uuid.uuid4())
    offer_note = f" (saving ₹{chosen_offer['amount']} — {chosen_offer['desc']})" if chosen_offer else ""

    # Include Pine Labs API response in trace for reasoning panel
    pine_labs_note = ""
    if result.get("pine_labs_raw"):
        pine_labs_note = f" [Pine Labs response: {result.get('pine_labs_raw', {})}]"
    elif result.get("pine_labs_fallback"):
        pine_labs_note = " [Pine Labs sandbox unavailable — simulated success]"

    await db.insert_trace({
        "id": rec_trace_id,
        "transaction_id": tx_id,
        "trace_type": "RECOMMENDATION",
        "reasoning": f"User selected {chosen_instrument['name']} for payment of ₹{product['price']:,} on {product['name']}{offer_note}{pine_labs_note}",
        "instrument_selected": chosen_id,
    })
    flow_result["traces"].append({
        "id": rec_trace_id,
        "type": "RECOMMENDATION",
        "reasoning": f"User selected {chosen_instrument['name']} for payment of ₹{product['price']:,} on {product['name']}{offer_note}",
        "instrument": chosen_instrument["name"],
        "pine_labs_response": result.get("pine_labs_raw"),
    })

    flow_result["initial_attempt"] = {
        "transaction_id": tx_id,
        "instrument_id": chosen_id,
        "instrument_name": chosen_instrument["name"],
        "status": tx_record["status"],
        "error": result["data"]["payments"][0].get("error_detail") if not result["success"] else None,
        "pine_labs_response": result,
    }

    # If failed, agent diagnoses and recovers
    if not result["success"]:
        try:
            diagnosis = agent.diagnose_and_recover(
                result, instruments, chosen_id
            )
        except Exception:
            remaining = [i for i in instruments if i["id"] != chosen_id]
            fallback = max(remaining, key=lambda i: i.get("success_rate", 0.5)) if remaining else instruments[0]
            error_code = result["data"]["payments"][0]["error_detail"]["code"]
            diagnosis = {
                "diagnosis": f"Payment failed with {error_code}",
                "root_cause": error_code,
                "fallback_instrument_id": fallback["id"],
                "fallback_instrument_name": fallback["name"],
                "reasoning": f"Switching to {fallback['name']} which has a {fallback.get('success_rate', 0.5)*100:.0f}% success rate.",
                "confidence": 0.85,
            }

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

        # Retry with fallback — new payment attempt on the same order
        fallback_id = diagnosis["fallback_instrument_id"]
        fallback_instrument = next((i for i in instruments if i["id"] == fallback_id), instruments[0])
        fallback_offer = get_best_offer_for_instrument(product, fallback_id)

        retry_tx_id = str(uuid.uuid4())
        retry_result = await payment_simulator.execute_payment_async(order_id, fallback_instrument, product["price"] * 100)

        retry_record = {
            "id": retry_tx_id,
            "order_id": order_id,
            "amount": product["price"],
            "instrument_id": fallback_id,
            "instrument_name": fallback_instrument["name"],
            "status": "RECOVERED" if retry_result["success"] else "FAILED",
            "failure_code": None if retry_result["success"] else retry_result["data"]["payments"][0]["error_detail"].get("code"),
            "retry_of": tx_id,
        }
        await db.insert_transaction(retry_record)

        # Include Pine Labs response in recovery trace
        retry_pine_note = ""
        if retry_result.get("pine_labs_raw"):
            retry_pine_note = f" [Pine Labs recovery response: {retry_result.get('pine_labs_raw', {})}]"

        recovery_trace_id = str(uuid.uuid4())
        recovery_reasoning = f"Successfully recovered payment using {fallback_instrument['name']}. Original failure: {diagnosis['diagnosis']}{retry_pine_note}"
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
            "pine_labs_response": retry_result.get("pine_labs_raw"),
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
        flow_result["savings"] = fallback_offer["amount"] if fallback_offer and retry_result["success"] else 0
    else:
        flow_result["final_status"] = "SUCCESS"
        flow_result["savings"] = chosen_offer["amount"] if chosen_offer else 0

    flow_result["total_time_ms"] = int((time.time() - start_time) * 1000)
    return flow_result


# ── Smart Pay (extension) ──────────────────────────────────────

# Transient errors worth retrying with the same instrument
_TRANSIENT_ERRORS = {"TIMED_OUT", "ISSUER_NOT_SUPPORTED", "PAYMENT_DECLINED"}


@app.post("/api/payment/smart-execute")
async def smart_execute_payment(req: SmartPayRequest):
    """Full autonomous payment flow for the extension.

    Strategy:
      1. Try the chosen instrument.
      2. If it fails with a transient error → retry same instrument once.
      3. If non-transient or second failure → Claude diagnoses, try fallbacks in order.
      4. If ALL instruments exhausted → return ALL_FAILED with root cause.
    """
    from agent import _compute_card_offers

    start_time = time.time()

    # Build product
    product_id = f"ext-{uuid.uuid4().hex[:8]}"
    product = {
        "id": product_id,
        "name": req.product_name,
        "price": req.product_price,
        "mrp": req.product_price,
        "category": "External",
        "image_emoji": "🛒",
        "description": req.product_name,
        "card_offers": _compute_card_offers(req.product_price),
    }
    _product_search_cache[product_id] = product

    instruments = await db.get_instruments()
    if not instruments:
        raise HTTPException(status_code=400, detail="No payment instruments configured")

    chosen_id = req.instrument_id or instruments[0]["id"]
    # Build ordered list: chosen first, then remaining sorted by success_rate
    remaining = [i for i in instruments if i["id"] != chosen_id]
    remaining.sort(key=lambda i: i.get("success_rate", 0.5), reverse=True)
    chosen_instrument = next((i for i in instruments if i["id"] == chosen_id), instruments[0])
    instrument_queue = [chosen_instrument] + remaining

    # Create Pine Labs order
    merchant_ref = f"PAYSENSE-{uuid.uuid4().hex[:12].upper()}"
    try:
        order = await pinelabs.create_order(
            amount_paise=req.product_price * 100,
            customer={"email": USER["email"], "first_name": USER["first_name"],
                      "last_name": USER["last_name"], "phone": USER["phone"]},
            notes=req.product_name,
            merchant_order_ref=merchant_ref,
        )
        order_data = order.get("data", order)
        order_id = order_data.get("order_id", order_data.get("id", merchant_ref))
    except Exception:
        order_id = merchant_ref

    flow = {
        "order_id": order_id,
        "product": product,
        "attempts": [],
        "final_status": None,
        "final_instrument": None,
        "savings": 0,
        "root_cause": None,
        "total_time_ms": 0,
    }

    first_tx_id = None
    last_error_code = None
    last_error_msg = None

    for idx, inst in enumerate(instrument_queue):
        is_first = idx == 0
        # For the first instrument, allow one extra retry on transient errors
        max_tries = 2 if is_first else 1

        for attempt_num in range(max_tries):
            tx_id = str(uuid.uuid4())
            if first_tx_id is None:
                first_tx_id = tx_id

            result = await payment_simulator.execute_payment_async(
                order_id, inst, req.product_price * 100
            )

            success = result["success"]
            error_code = None
            error_msg = None
            if not success:
                err = result["data"]["payments"][0]["error_detail"]
                error_code = err.get("code", "UNKNOWN")
                error_msg = err.get("message", "Unknown error")
                last_error_code = error_code
                last_error_msg = error_msg

            status = "SUCCESS" if success else "FAILED"
            if success and not is_first:
                status = "RECOVERED"

            tx_record = {
                "id": tx_id,
                "order_id": order_id,
                "amount": req.product_price,
                "instrument_id": inst["id"],
                "instrument_name": inst["name"],
                "status": status,
                "failure_code": error_code,
                "retry_of": first_tx_id if not is_first else None,
            }
            await db.insert_transaction(tx_record)

            attempt_info = {
                "transaction_id": tx_id,
                "instrument_id": inst["id"],
                "instrument_name": inst["name"],
                "status": status,
                "error_code": error_code,
                "error_message": error_msg,
                "attempt_number": len(flow["attempts"]) + 1,
                "retried_same": is_first and attempt_num > 0,
            }
            flow["attempts"].append(attempt_info)

            # Store trace
            trace_type = "RECOMMENDATION" if is_first and attempt_num == 0 else (
                "RETRY_SAME" if is_first and attempt_num > 0 else "RECOVERY"
            )
            await db.insert_trace({
                "id": str(uuid.uuid4()),
                "transaction_id": tx_id,
                "trace_type": trace_type,
                "reasoning": (
                    f"{'Retrying' if attempt_num > 0 else 'Attempting'} payment with {inst['name']}. "
                    + (f"Error: {error_code} — {error_msg}" if error_code else f"Status: {status}")
                ),
                "instrument_selected": inst["id"],
            })

            if success:
                offer = get_best_offer_for_instrument(product, inst["id"])
                flow["final_status"] = status
                flow["final_instrument"] = inst["name"]
                flow["savings"] = offer["amount"] if offer else 0
                flow["total_time_ms"] = int((time.time() - start_time) * 1000)
                return flow

            # If transient error and first instrument, retry same
            if is_first and attempt_num == 0 and error_code in _TRANSIENT_ERRORS:
                continue  # will retry same instrument
            else:
                break  # move to next instrument

        # Before trying next instrument, get Claude diagnosis (only once, after first instrument fails)
        if is_first and idx < len(instrument_queue) - 1:
            try:
                diagnosis = agent.diagnose_and_recover(result, instruments, inst["id"])
                # Reorder remaining queue based on Claude's recommendation
                fallback_id = diagnosis.get("fallback_instrument_id")
                if fallback_id:
                    fb = next((i for i in remaining if i["id"] == fallback_id), None)
                    if fb:
                        remaining.remove(fb)
                        remaining.insert(0, fb)
                        instrument_queue = [chosen_instrument] + remaining

                await db.insert_trace({
                    "id": str(uuid.uuid4()),
                    "transaction_id": tx_id,
                    "trace_type": "DIAGNOSIS",
                    "reasoning": diagnosis.get("reasoning", "Agent diagnosis"),
                    "instrument_selected": fallback_id,
                })
            except Exception:
                pass  # continue with default ordering

    # ALL instruments failed
    flow["final_status"] = "ALL_FAILED"
    flow["root_cause"] = {
        "last_error_code": last_error_code,
        "last_error_message": last_error_msg,
        "instruments_tried": len(set(a["instrument_id"] for a in flow["attempts"])),
        "total_attempts": len(flow["attempts"]),
        "summary": f"Payment failed across all {len(set(a['instrument_id'] for a in flow['attempts']))} instruments. "
                   f"Last error: {last_error_code} — {last_error_msg}",
    }
    flow["total_time_ms"] = int((time.time() - start_time) * 1000)
    return flow


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

    # Success rate "before" = without recovery (only first attempts)
    first_attempts = [t for t in txns if t["retry_of"] is None]
    before_success = len([t for t in first_attempts if t["status"] == "SUCCESS"])
    before_rate = (before_success / len(first_attempts) * 100) if first_attempts else 0

    # Success rate "after" = with recovery
    after_rate = (successes / total * 100) if total else 0

    return {
        "total_transactions": total,
        "successful_recoveries": recoveries,
        "money_saved": 0,  # computed client-side from flow results now
        "success_rate_before": round(before_rate, 1),
        "success_rate_after": round(after_rate, 1),
        "transactions": txns,
        "traces": traces,
    }


@app.delete("/api/transactions")
async def clear_transactions():
    import aiosqlite
    async with aiosqlite.connect(db.DB_PATH) as conn:
        await conn.execute("DELETE FROM transactions")
        await conn.execute("DELETE FROM reasoning_traces")
        await conn.commit()
    return {"status": "cleared"}
