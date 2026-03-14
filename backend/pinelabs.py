import httpx
import time
import uuid
from config import PINELABS_CLIENT_ID, PINELABS_CLIENT_SECRET, PINELABS_BASE_URL

_token_cache = {"access_token": None, "expires_at": 0}


async def get_token() -> str:
    now = time.time()
    if _token_cache["access_token"] and _token_cache["expires_at"] > now + 60:
        return _token_cache["access_token"]

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PINELABS_BASE_URL}/api/auth/v1/token",
            json={
                "client_id": PINELABS_CLIENT_ID,
                "client_secret": PINELABS_CLIENT_SECRET,
                "grant_type": "client_credentials",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

    _token_cache["access_token"] = data["access_token"]
    _token_cache["expires_at"] = now + 3300
    return data["access_token"]


def _request_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Request-ID": str(uuid.uuid4()),
        "Request-Timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
    }


async def create_order(amount_paise: int, customer: dict, notes: str, merchant_order_ref: str) -> dict:
    token = await get_token()
    payload = {
        "merchant_order_reference": merchant_order_ref,
        "type": "CHARGE",
        "order_amount": {"value": amount_paise, "currency": "INR"},
        "purchase_details": {
            "customer": {
                "email_id": customer.get("email", "arjun@example.com"),
                "first_name": customer.get("first_name", "Arjun"),
                "last_name": customer.get("last_name", "Mehta"),
                "customer_phone": customer.get("phone", "9876543210"),
            }
        },
        "notes": notes,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PINELABS_BASE_URL}/api/pay/v1/orders",
            json=payload,
            headers=_request_headers(token),
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()


async def get_order_status(order_id: str) -> dict:
    token = await get_token()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{PINELABS_BASE_URL}/api/pay/v1/orders/{order_id}",
            headers=_request_headers(token),
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()


async def initiate_upi_collect(order_id: str, amount_paise: int, upi_id: str) -> dict:
    """Initiate a UPI collect payment on a Pine Labs order."""
    token = await get_token()
    payload = {
        "payments": [
            {
                "merchant_payment_reference": f"PAY-{uuid.uuid4().hex[:16].upper()}",
                "payment_method": "UPI",
                "payment_amount": {"value": amount_paise, "currency": "INR"},
                "payment_option": {
                    "upi_details": {
                        "txn_mode": "COLLECT",
                        "upi_id": upi_id,
                    }
                },
            }
        ]
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PINELABS_BASE_URL}/api/pay/v1/orders/{order_id}/payments",
            json=payload,
            headers=_request_headers(token),
            timeout=20,
        )
        return {"status_code": resp.status_code, "body": resp.json() if resp.status_code < 500 else resp.text}


async def initiate_card_payment(order_id: str, amount_paise: int, card_last4: str) -> dict:
    """Initiate a card payment on a Pine Labs order.
    In sandbox, we send tokenized card details — real card data never touches our server.
    """
    token = await get_token()
    payload = {
        "payments": [
            {
                "merchant_payment_reference": f"PAY-{uuid.uuid4().hex[:16].upper()}",
                "payment_method": "CARD",
                "payment_amount": {"value": amount_paise, "currency": "INR"},
                "payment_option": {
                    "card_details": {
                        "last4_digit": card_last4,
                    }
                },
            }
        ]
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PINELABS_BASE_URL}/api/pay/v1/orders/{order_id}/payments",
            json=payload,
            headers=_request_headers(token),
            timeout=20,
        )
        return {"status_code": resp.status_code, "body": resp.json() if resp.status_code < 500 else resp.text}


async def discover_offers(amount_paise: int) -> dict:
    token = await get_token()
    payload = {
        "order_amount": {"value": amount_paise, "currency": "INR"},
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{PINELABS_BASE_URL}/api/affordability/v1/offer/discovery",
                json=payload,
                headers=_request_headers(token),
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception:
        return {"offers": []}
