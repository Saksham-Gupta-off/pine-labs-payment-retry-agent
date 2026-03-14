import httpx
import time
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
    # Parse expires_at or default 55 min
    _token_cache["expires_at"] = now + 3300
    return data["access_token"]


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
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()


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
                headers={"Authorization": f"Bearer {token}"},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception:
        # Offer discovery is non-critical — return empty on failure
        return {"offers": []}
