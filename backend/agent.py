import json
import anthropic
from config import ANTHROPIC_API_KEY

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
MODEL = "claude-sonnet-4-20250514"


def recommend_instrument(product: dict, instruments: list, offers: dict = None) -> dict:
    instruments_desc = json.dumps(instruments, indent=2)
    offers_desc = json.dumps(offers, indent=2) if offers else "No offers available"

    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": f"""You are PaySense, an autonomous payment intelligence agent. A user is about to pay for:

Product: {product['name']} — ₹{product['price']}

Their linked payment instruments:
{instruments_desc}

Available offers from Pine Labs:
{offers_desc}

Analyze each instrument considering:
1. Historical success rate and recent failures
2. Available offers, cashback, or discounts
3. Cost to the user (lowest effective price)
4. Reliability signals

Respond with ONLY valid JSON (no markdown, no code fences):
{{
  "recommended_id": "instrument id",
  "recommended_name": "instrument display name",
  "reasoning": "2-3 sentence explanation of why this instrument is the best choice, written as if speaking to the user",
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
    return json.loads(text)


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
