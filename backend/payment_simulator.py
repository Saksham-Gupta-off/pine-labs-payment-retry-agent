from typing import Optional

# Pine Labs error code → human message mapping
ERROR_MESSAGES = {
    "INVALID_USER_ACCOUNT": "UPI handle not active or registered",
    "INSUFFICIENT_FUNDS": "Insufficient funds in account",
    "AMOUNT_LIMIT_EXCEEDED": "Transaction amount exceeds card limit",
    "TIMED_OUT": "Payment request timed out — network issue",
    "PAYMENT_DECLINED": "Payment declined by issuer bank",
    "ISSUER_NOT_SUPPORTED": "Issuer bank temporarily unavailable",
}

# In-memory state
_armed_failure: Optional[str] = None


def arm_failure(error_code: str):
    global _armed_failure
    _armed_failure = error_code


def clear_failure():
    global _armed_failure
    _armed_failure = None


def get_armed_failure() -> Optional[str]:
    return _armed_failure


def execute_payment(order_id: str, instrument: dict) -> dict:
    """
    Simulate payment execution. If a failure is armed, return a Pine Labs-format
    failure response and consume the armed failure. Otherwise return success.
    """
    global _armed_failure

    if _armed_failure is not None:
        error_code = _armed_failure
        _armed_failure = None  # consume — one-shot

        payment_method = "UPI" if instrument["type"] == "UPI" else "CARD"
        return {
            "success": False,
            "event_type": "PAYMENT_FAILED",
            "data": {
                "order_id": order_id,
                "status": "FAILED",
                "payments": [
                    {
                        "status": "FAILED",
                        "payment_method": payment_method,
                        "error_detail": {
                            "code": error_code,
                            "message": ERROR_MESSAGES.get(
                                error_code, "Unknown error"
                            ),
                        },
                    }
                ],
            },
        }

    # Success path
    payment_method = "UPI" if instrument["type"] == "UPI" else "CARD"
    return {
        "success": True,
        "event_type": "ORDER_PROCESSED",
        "data": {
            "order_id": order_id,
            "status": "PROCESSED",
            "payments": [
                {
                    "status": "PROCESSED",
                    "payment_method": payment_method,
                }
            ],
        },
    }
