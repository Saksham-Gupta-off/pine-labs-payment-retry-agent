const API_BASE = "http://localhost:8000";

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_RECOMMENDATION") {
    fetchRecommendation(msg.product)
      .then(sendResponse)
      .catch((e) => sendResponse({ error: e.message }));
    return true; // async
  }

  if (msg.type === "SMART_PAY") {
    smartPay(msg.product, msg.instrumentId)
      .then(sendResponse)
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === "EXECUTE_PAYMENT") {
    executePayment(msg.instrumentId, msg.productId)
      .then(sendResponse)
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === "GET_INSTRUMENTS") {
    fetchInstruments()
      .then(sendResponse)
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === "GET_DASHBOARD") {
    fetchDashboard()
      .then(sendResponse)
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === "SEARCH_PRODUCTS") {
    searchProducts(msg.query)
      .then(sendResponse)
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === "OPEN_RECEIPT") {
    chrome.tabs.create({ url: chrome.runtime.getURL("receipt.html") });
  }

  if (msg.type === "PAYMENT_FAILED_NOTIFICATION") {
    // Show a Chrome notification when all instruments fail
    chrome.notifications.create("paysense-fail", {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "PaySense — Payment Failed",
      message: msg.summary || "All payment instruments failed.",
      priority: 2,
    });
  }

  if (msg.type === "LOG_CHECKOUT_DETECTED") {
    chrome.storage.local.set({
      lastCheckout: {
        site: msg.site,
        amount: msg.amount,
        product: msg.product,
        timestamp: Date.now(),
      },
    });
    chrome.action.setBadgeText({ text: "!", tabId: sender.tab?.id });
    chrome.action.setBadgeBackgroundColor({
      color: "#10b981",
      tabId: sender.tab?.id,
    });
  }
});

async function fetchRecommendation(product) {
  const resp = await fetch(`${API_BASE}/api/payment/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product_name: product.name,
      product_price: Math.round(product.price || 0),
    }),
  });
  return resp.json();
}

async function smartPay(product, instrumentId) {
  const resp = await fetch(`${API_BASE}/api/payment/smart-execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product_name: product.name,
      product_price: Math.round(product.price || 0),
      instrument_id: instrumentId || null,
    }),
  });
  return resp.json();
}

async function executePayment(instrumentId, productId) {
  const resp = await fetch(`${API_BASE}/api/payment/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instrument_id: instrumentId,
      product_id: productId,
    }),
  });
  return resp.json();
}

async function fetchInstruments() {
  const resp = await fetch(`${API_BASE}/api/instruments`);
  return resp.json();
}

async function fetchDashboard() {
  const resp = await fetch(`${API_BASE}/api/dashboard`);
  return resp.json();
}

async function searchProducts(query) {
  const resp = await fetch(`${API_BASE}/api/products/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return resp.json();
}
