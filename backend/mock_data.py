USER = {
    "name": "Arjun",
    "email": "arjun@example.com",
    "first_name": "Arjun",
    "last_name": "Mehta",
    "phone": "9876543210",
}

# Default instruments — used by db.py to seed the instruments table
DEFAULT_INSTRUMENTS = [
    {
        "id": "upi_1",
        "type": "UPI",
        "name": "PhonePe UPI",
        "handle": "arjun@okaxis",
        "last4": None,
        "icon": "phonepe",
        "success_rate": 0.72,
        "recent_failures": 3,
        "offers": {},
    },
    {
        "id": "card_1",
        "type": "Credit Card",
        "name": "ICICI Amazon Pay Card",
        "handle": None,
        "last4": "7821",
        "icon": "icici",
        "success_rate": 0.96,
        "recent_failures": 0,
        "offers": {
            "default": {
                "type": "cashback",
                "percent": 5,
                "desc": "5% unlimited cashback as Amazon Pay balance",
            },
        },
    },
    {
        "id": "card_2",
        "type": "Credit Card",
        "name": "Axis Flipkart Card",
        "handle": None,
        "last4": "4521",
        "icon": "axis",
        "success_rate": 0.93,
        "recent_failures": 0,
        "offers": {
            "default": {
                "type": "cashback",
                "percent": 1.5,
                "desc": "1.5% unlimited cashback on all spends",
            },
        },
    },
    {
        "id": "card_3",
        "type": "Credit Card",
        "name": "HDFC Regalia",
        "handle": None,
        "last4": "3356",
        "icon": "hdfc",
        "success_rate": 0.91,
        "recent_failures": 1,
        "offers": {},
    },
    {
        "id": "card_4",
        "type": "Debit Card",
        "name": "SBI Debit Card",
        "handle": None,
        "last4": "8834",
        "icon": "sbi",
        "success_rate": 0.85,
        "recent_failures": 1,
        "offers": {},
    },
]

# ── Product Catalog ─────────────────────────────────────────────
# Real prices and offers sourced from Flipkart, Amazon, and brand stores (March 2026)

PRODUCTS = [
    {
        "id": "boat-airdopes-141",
        "name": "boAt Airdopes 141",
        "price": 1299,
        "mrp": 4490,
        "category": "Electronics",
        "image_emoji": "🎧",
        "description": "Wireless earbuds with 42H playtime, ENx™ noise cancellation, and BEAST™ mode for gaming.",
        "card_offers": {
            "card_1": {"type": "cashback", "amount": 65, "desc": "5% cashback with ICICI Amazon Pay Card"},
            "card_2": {"type": "cashback", "amount": 20, "desc": "1.5% cashback with Axis Flipkart Card"},
        },
    },
    {
        "id": "iphone-15-128gb",
        "name": "Apple iPhone 15 (128 GB, Blue)",
        "price": 54900,
        "mrp": 79900,
        "category": "Smartphones",
        "image_emoji": "📱",
        "description": "A16 Bionic chip, 48MP camera with 2x telephoto, Dynamic Island, USB-C, and Ceramic Shield front.",
        "card_offers": {
            "card_1": {"type": "cashback", "amount": 2745, "desc": "5% cashback with ICICI Amazon Pay Card"},
            "card_2": {"type": "discount", "amount": 3315, "desc": "₹3,315 instant discount with Axis Flipkart Card"},
            "card_3": {"type": "discount", "amount": 6000, "desc": "₹6,000 instant discount with HDFC Bank cards"},
        },
    },
    {
        "id": "samsung-s24-ultra",
        "name": "Samsung Galaxy S24 Ultra (256 GB, Titanium Black)",
        "price": 108799,
        "mrp": 134999,
        "category": "Smartphones",
        "image_emoji": "📱",
        "description": "Snapdragon 8 Gen 3, 200MP camera with ProVisual Engine, Galaxy AI, S Pen built-in, 5000mAh battery.",
        "card_offers": {
            "card_1": {"type": "cashback", "amount": 5440, "desc": "5% cashback with ICICI Amazon Pay Card"},
            "card_3": {"type": "discount", "amount": 8000, "desc": "₹8,000 instant discount with HDFC Bank cards"},
            "card_4": {"type": "discount", "amount": 4000, "desc": "₹4,000 off with SBI Debit Card EMI"},
        },
    },
    {
        "id": "sony-wh1000xm5",
        "name": "Sony WH-1000XM5 (Black)",
        "price": 27989,
        "mrp": 34990,
        "category": "Electronics",
        "image_emoji": "🎧",
        "description": "Industry-leading noise cancellation, 30hr battery, crystal-clear hands-free calling, multipoint connection.",
        "card_offers": {
            "card_1": {"type": "cashback", "amount": 1400, "desc": "5% cashback with ICICI Amazon Pay Card"},
            "card_2": {"type": "cashback", "amount": 420, "desc": "1.5% cashback with Axis Flipkart Card"},
        },
    },
    {
        "id": "macbook-air-m3",
        "name": "MacBook Air M3 (13\", 8GB, 256GB, Midnight)",
        "price": 99900,
        "mrp": 114900,
        "category": "Laptops",
        "image_emoji": "💻",
        "description": "Apple M3 chip, 8-core CPU, 10-core GPU, 18hr battery, Liquid Retina display, MagSafe charging.",
        "card_offers": {
            "card_1": {"type": "cashback", "amount": 4995, "desc": "5% cashback with ICICI Amazon Pay Card"},
            "card_2": {"type": "cashback", "amount": 4000, "desc": "₹4,000 instant cashback with Axis Bank cards"},
        },
    },
    {
        "id": "nike-jordan-1-mid",
        "name": "Nike Air Jordan 1 Mid SE",
        "price": 12295,
        "mrp": 14995,
        "category": "Footwear",
        "image_emoji": "👟",
        "description": "Iconic sneaker with Air cushioning, leather and synthetic upper, rubber outsole. Colourway: Black/Red.",
        "card_offers": {
            "card_2": {"type": "cashback", "amount": 200, "desc": "Flat ₹200 off with Flipkart Axis Card on orders above ₹2,500"},
        },
    },
    {
        "id": "ps5-slim",
        "name": "Sony PlayStation 5 Slim (Disc Edition)",
        "price": 49990,
        "mrp": 54990,
        "category": "Gaming",
        "image_emoji": "🎮",
        "description": "Custom AMD Zen 2, 825GB SSD, 4K gaming at 120fps, DualSense controller, Ray Tracing.",
        "card_offers": {
            "card_1": {"type": "cashback", "amount": 2500, "desc": "5% cashback with ICICI Amazon Pay Card"},
            "card_3": {"type": "discount", "amount": 3000, "desc": "₹3,000 instant discount with HDFC cards"},
        },
    },
    {
        "id": "dyson-v12",
        "name": "Dyson V12 Detect Slim Vacuum",
        "price": 52900,
        "mrp": 58900,
        "category": "Home",
        "image_emoji": "🏠",
        "description": "Laser Slim Fluffy cleaner head, piezo sensor for dust detection, LCD screen, 60 min runtime.",
        "card_offers": {
            "card_1": {"type": "cashback", "amount": 2645, "desc": "5% cashback with ICICI Amazon Pay Card"},
            "card_3": {"type": "discount", "amount": 5000, "desc": "₹5,000 instant discount with HDFC Bank cards"},
        },
    },
]

# Default product shown on checkout
PRODUCT = PRODUCTS[0]


def get_product_by_id(product_id: str):
    return next((p for p in PRODUCTS if p["id"] == product_id), PRODUCTS[0])


def get_best_offer_for_instrument(product: dict, instrument_id: str):
    """Return the best card-specific offer for this instrument on this product, or None."""
    card_offers = product.get("card_offers", {})
    return card_offers.get(instrument_id)
