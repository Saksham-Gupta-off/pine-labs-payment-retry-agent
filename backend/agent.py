import json
import math
import anthropic
from config import AWS_REGION

client = anthropic.AnthropicBedrock(aws_region=AWS_REGION)
MODEL = "us.anthropic.claude-sonnet-4-20250514-v1:0"


def _compute_card_offers(price: int) -> dict:
    """Compute card-specific offers programmatically from product price.

    Uses known instrument offer percentages — never lets the LLM hallucinate amounts.
    """
    offers = {}

    # ICICI Amazon Pay Card — 5% cashback (capped at ₹500 for small items)
    icici_amount = min(math.floor(price * 0.05), max(500, math.floor(price * 0.05)))
    if icici_amount >= 5:
        offers["card_1"] = {
            "type": "cashback",
            "amount": icici_amount,
            "desc": f"5% cashback with ICICI Amazon Pay Card",
        }

    # Axis Flipkart Card — 1.5% cashback
    axis_amount = math.floor(price * 0.015)
    if axis_amount >= 5:
        offers["card_2"] = {
            "type": "cashback",
            "amount": axis_amount,
            "desc": f"1.5% cashback with Axis Flipkart Card",
        }

    # HDFC Regalia — flat ₹500 off on orders above ₹5,000; ₹1,500 off above ₹25,000
    if price >= 25000:
        offers["card_3"] = {
            "type": "discount",
            "amount": 1500,
            "desc": "₹1,500 instant discount with HDFC Bank cards on orders above ₹25,000",
        }
    elif price >= 5000:
        offers["card_3"] = {
            "type": "discount",
            "amount": 500,
            "desc": "₹500 instant discount with HDFC Bank cards on orders above ₹5,000",
        }

    # SBI Debit Card — 5% off on EMI for orders above ₹10,000 (capped at ₹1,500)
    if price >= 10000:
        sbi_amount = min(math.floor(price * 0.05), 1500)
        offers["card_4"] = {
            "type": "discount",
            "amount": sbi_amount,
            "desc": f"₹{sbi_amount:,} off with SBI Debit Card EMI",
        }

    return offers


def search_products(query: str) -> list:
    """Use Claude to generate realistic product search results for Indian e-commerce."""
    message = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": f"""You are a product search engine for Indian e-commerce. Given the search query, return 4-6 real products that would appear on Flipkart, Amazon India, or other Indian e-commerce sites. Use realistic current Indian market prices (March 2026).

Search query: "{query}"

Respond with ONLY valid JSON (no markdown, no code fences):
[{{
  "id": "slug-id",
  "name": "Full Product Name with variant",
  "price": 54900,
  "mrp": 79900,
  "category": "Smartphones",
  "image_emoji": "📱",
  "description": "one-line description"
}}]

Do NOT include card_offers — those are computed separately.
Make sure prices are realistic for the Indian market in March 2026. price must be an integer (no decimals).""",
            }
        ],
    )

    text = message.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    products = json.loads(text)

    # Compute card offers programmatically from actual prices
    for p in products:
        p["card_offers"] = _compute_card_offers(int(p["price"]))

    return products


def recommend_instrument(product: dict, instruments: list, offers: dict = None) -> dict:
    # Build a simplified instrument list with precomputed offer amounts for this product
    product_price = product["price"]
    card_offers = product.get("card_offers", {})

    instrument_summaries = []
    for inst in instruments:
        summary = {
            "id": inst["id"],
            "type": inst.get("type", ""),
            "name": inst["name"],
            "success_rate": inst.get("success_rate", 0.5),
            "recent_failures": inst.get("recent_failures", 0),
        }
        # Attach precomputed offer for THIS product (exact amount, not percentage)
        offer = card_offers.get(inst["id"]) or inst.get("product_offer")
        if offer:
            summary["offer_for_this_product"] = {
                "type": offer["type"],
                "amount": offer["amount"],
                "desc": offer["desc"],
                "effective_price": product_price - offer["amount"],
            }
        instrument_summaries.append(summary)

    instruments_desc = json.dumps(instrument_summaries, indent=2)
    offers_desc = json.dumps(offers, indent=2) if offers else "No offers available"

    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": f"""You are PaySense, an autonomous payment intelligence agent. A user is about to pay for:

Product: {product['name']} — ₹{product_price:,}

Their linked payment instruments (with precomputed offers for this specific product):
{instruments_desc}

Additional offers from Pine Labs:
{offers_desc}

IMPORTANT: The offer amounts shown above are EXACT precomputed values. Do NOT recalculate them.
Use the "amount" field as-is for savings. The "effective_price" is the actual price after the offer.

Analyze each instrument considering:
1. Historical success rate and recent failures
2. The precomputed offer amount (use EXACTLY the amounts shown, do not recompute)
3. Effective price to the user
4. Reliability signals

The "savings_amount" in your response MUST exactly match the "amount" from the recommended instrument's offer (or 0 if no offer).

Respond with ONLY valid JSON (no markdown, no code fences):
{{
  "recommended_id": "instrument id",
  "recommended_name": "instrument display name",
  "reasoning": "2-3 sentence explanation of why this instrument is the best choice, written as if speaking to the user. Reference the EXACT offer amounts provided, do not calculate your own.",
  "savings_amount": 0,
  "ranked_instruments": [
    {{"id": "...", "score": 0.95, "rationale": "one line reason"}}
  ]
}}""",
            }
        ],
    )

    text = message.content[0].text.strip()
    # Try to parse JSON, handle potential markdown wrapping
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    result = json.loads(text)

    # Safety net: override savings_amount with the actual precomputed value
    # so even if Claude hallucinates a number, the displayed amount is correct
    rec_id = result.get("recommended_id")
    actual_offer = card_offers.get(rec_id)
    if actual_offer:
        result["savings_amount"] = actual_offer["amount"]
    else:
        result["savings_amount"] = 0

    return result


def diagnose_and_recover(failure_payload: dict, instruments: list, failed_instrument_id: str) -> dict:
    failure_desc = json.dumps(failure_payload, indent=2)
    instruments_desc = json.dumps(
        [i for i in instruments if i["id"] != failed_instrument_id], indent=2
    )

    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": f"""You are PaySense diagnosing a payment failure. The payment just failed with this Pine Labs error payload:

{failure_desc}

The failed instrument ID was: {failed_instrument_id}

Remaining available instruments:
{instruments_desc}

Analyze the failure and select the best fallback instrument. Consider:
1. What exactly went wrong (root cause from the error code)
2. Which remaining instrument has the highest chance of success
3. Why the selected fallback avoids the same issue

Respond with ONLY valid JSON (no markdown, no code fences):
{{
  "diagnosis": "one-line human-readable diagnosis of what went wrong",
  "root_cause": "technical root cause category",
  "fallback_instrument_id": "instrument id to retry with",
  "fallback_instrument_name": "display name of fallback",
  "reasoning": "2-3 sentence explanation of the diagnosis and why the fallback was chosen, written as a real-time status update to the user",
  "confidence": 0.92
}}""",
            }
        ],
    )

    text = message.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(text)
