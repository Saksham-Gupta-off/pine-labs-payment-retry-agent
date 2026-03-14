"""
Payment execution layer for PaySense.

Supports a failure QUEUE for demo mode:
  - Each rule has: error_code, remaining count, optional instrument filter.
  - On each payment attempt the queue is checked in order.
  - First matching rule fires (decrements count; removed when 0).
  - If no rule matches → real Pine Labs API call.
"""

from typing import Optional
import pinelabs

ERROR_MESSAGES = {
    "INVALID_USER_ACCOUNT": "UPI handle not active or registered",
    "INSUFFICIENT_FUNDS": "Insufficient funds in account",
    "AMOUNT_LIMIT_EXCEEDED": "Transaction amount exceeds card limit",
    "TIMED_OUT": "Payment request timed out — network issue",
    "PAYMENT_DECLINED": "Payment declined by issuer bank",
    "ISSUER_NOT_SUPPORTED": "Issuer bank temporarily unavailable",
}

# Each entry: {"error_code": str, "remaining": int,
#              "instrument_type": str|None, "instrument_id": str|None}
_failure_queue: list[dict] = []


# ── Public API ───────────────────────────────────────────────────

def add_failure_rule(
    error_code: str,
    count: int = 1,
    instrument_type: Optional[str] = None,
    instrument_id: Optional[str] = None,
) -> dict:
    """Add a failure rule to the queue. Returns the created rule."""
    rule = {
        "error_code": error_code,
        "remaining": max(count, 1),
        "original_count": max(count, 1),
        "instrument_type": instrument_type or None,
        "instrument_id": instrument_id or None,
    }
    _failure_queue.append(rule)
    return rule


def clear_failure():
    """Remove all failure rules."""
    _failure_queue.clear()


def remove_rule(index: int) -> bool:
    """Remove a specific rule by index."""
    if 0 <= index < len(_failure_queue):
        _failure_queue.pop(index)
        return True
    return False


def get_status() -> dict:
    """Return the full queue and a backwards-compatible armed_failure field."""
    # armed_failure = first rule's code if queue is non-empty (for old frontend compat)
    armed = _failure_queue[0]["error_code"] if _failure_queue else None
    return {
        "armed_failure": armed,
        "queue": [
            {
                "error_code": r["error_code"],
                "remaining": r["remaining"],
                "original_count": r["original_count"],
                "instrument_type": r["instrument_type"],
                "instrument_id": r["instrument_id"],
            }
            for r in _failure_queue
        ],
    }


# Legacy single-shot helpers (kept for backwards compat)
def arm_failure(error_code: str):
    """Arm a single one-shot failure (clears queue first)."""
    _failure_queue.clear()
    add_failure_rule(error_code, count=1)


def get_armed_failure() -> Optional[str]:
    return _failure_queue[0]["error_code"] if _failure_queue else None


# ── Matching logic ───────────────────────────────────────────────

def _match_rule(rule: dict, instrument: dict) -> bool:
    """Check whether a rule applies to the given instrument."""
    # instrument_id filter
    if rule["instrument_id"] and rule["instrument_id"] != instrument.get("id"):
        return False
    # instrument_type filter (e.g. "UPI", "Credit Card", "Debit Card")
    if rule["instrument_type"] and rule["instrument_type"] != instrument.get("type"):
        return False
    return True


def _consume_matching_rule(instrument: dict) -> Optional[str]:
    """Find the first matching rule, decrement it, and return the error code."""
    for i, rule in enumerate(_failure_queue):
        if _match_rule(rule, instrument):
            error_code = rule["error_code"]
            rule["remaining"] -= 1
            if rule["remaining"] <= 0:
                _failure_queue.pop(i)
            return error_code
    return None


# ── Payment execution ────────────────────────────────────────────

async def execute_payment_async(order_id: str, instrument: dict, amount_paise: int = 0) -> dict:
    """
    Execute payment with failure-queue awareness.

    1. Check queue for a matching failure rule → simulated failure
    2. Otherwise → real Pine Labs API call
    3. If API call fails → return success for demo continuity
    """
    payment_method_type = "UPI" if instrument.get("type") == "UPI" else "CARD"

    # ── Check failure queue ──
    error_code = _consume_matching_rule(instrument)
    if error_code is not None:
        return {
            "success": False,
            "event_type": "PAYMENT_FAILED",
            "pine_labs_order_id": order_id,
            "pine_labs_api_called": False,
            "pine_labs_raw": None,
            "simulated": True,
            "data": {
                "order_id": order_id,
                "status": "FAILED",
                "payments": [{
                    "status": "FAILED",
                    "payment_method": payment_method_type,
                    "error_detail": {
                        "code": error_code,
                        "message": ERROR_MESSAGES.get(error_code, "Unknown error"),
                    },
                }],
            },
        }

    # ── Real Pine Labs payment call ──
    pine_labs_response = None
    try:
        if instrument.get("type") == "UPI":
            upi_id = instrument.get("handle", "")
            pine_labs_response = await pinelabs.initiate_upi_collect(
                order_id, amount_paise, upi_id
            )
        else:
            card_last4 = instrument.get("last4", "0000")
            pine_labs_response = await pinelabs.initiate_card_payment(
                order_id, amount_paise, card_last4
            )

        status_code = pine_labs_response.get("status_code", 500)
        body = pine_labs_response.get("body", {})

        if status_code in (200, 201):
            if isinstance(body, dict):
                payments = body.get("payments", [])
                if payments and isinstance(payments, list):
                    pay_status = payments[0].get("status", "").upper()
                    if pay_status in ("FAILED", "DECLINED", "ERROR"):
                        error_detail = payments[0].get("error_detail", {
                            "code": "PAYMENT_DECLINED",
                            "message": "Payment declined by Pine Labs",
                        })
                        return {
                            "success": False,
                            "event_type": "PAYMENT_FAILED",
                            "pine_labs_order_id": order_id,
                            "pine_labs_api_called": True,
                            "pine_labs_raw": pine_labs_response,
                            "data": {
                                "order_id": order_id,
                                "status": "FAILED",
                                "payments": [{
                                    "status": "FAILED",
                                    "payment_method": payment_method_type,
                                    "error_detail": error_detail,
                                }],
                            },
                        }

            return {
                "success": True,
                "event_type": "ORDER_PROCESSED",
                "pine_labs_order_id": order_id,
                "pine_labs_api_called": True,
                "pine_labs_raw": pine_labs_response,
                "data": {
                    "order_id": order_id,
                    "status": "PROCESSED",
                    "payments": [{
                        "status": "PROCESSED",
                        "payment_method": payment_method_type,
                    }],
                },
            }

        return {
            "success": True,
            "event_type": "ORDER_PROCESSED",
            "pine_labs_order_id": order_id,
            "pine_labs_api_called": True,
            "pine_labs_sandbox_rejected": True,
            "pine_labs_raw": pine_labs_response,
            "data": {
                "order_id": order_id,
                "status": "PROCESSED",
                "payments": [{
                    "status": "PROCESSED",
                    "payment_method": payment_method_type,
                }],
            },
        }

    except Exception as e:
        return {
            "success": True,
            "event_type": "ORDER_PROCESSED",
            "pine_labs_order_id": order_id,
            "pine_labs_api_called": True,
            "pine_labs_error": str(e),
            "pine_labs_raw": pine_labs_response,
            "data": {
                "order_id": order_id,
                "status": "PROCESSED",
                "payments": [{
                    "status": "PROCESSED",
                    "payment_method": payment_method_type,
                }],
            },
        }
