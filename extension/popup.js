const API_BASE = "http://localhost:8000";

const ICON_COLORS = {
  phonepe: "#7c3aed",
  icici: "#ea580c",
  axis: "#db2777",
  hdfc: "#2563eb",
  sbi: "#1e3a8a",
  gpay: "#16a34a",
  paytm: "#0284c7",
};

// Tab switching
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`panel-${tab.dataset.panel}`).classList.add("active");
  });
});

// Check backend connectivity
async function checkBackend() {
  const el = document.getElementById("backend-status");
  try {
    const resp = await fetch(`${API_BASE}/api/demo/status`);
    if (resp.ok) {
      el.textContent = "● Connected to PaySense backend";
      el.className = "backend-status connected";
    } else {
      throw new Error();
    }
  } catch {
    el.textContent = "● Backend offline — start with: uvicorn main:app --port 8000";
    el.className = "backend-status disconnected";
  }
}

// Load dashboard
async function loadDashboard() {
  try {
    const resp = await fetch(`${API_BASE}/api/dashboard`);
    const data = await resp.json();

    document.getElementById("stats").innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Transactions</div>
        <div class="stat-value blue">${data.total_transactions}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Recoveries</div>
        <div class="stat-value amber">${data.successful_recoveries}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Success Before</div>
        <div class="stat-value" style="color:#ef4444">${data.success_rate_before}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Success After</div>
        <div class="stat-value green">${data.success_rate_after}%</div>
      </div>
    `;

    const txns = (data.transactions || []).slice(0, 5);
    if (txns.length === 0) {
      document.getElementById("recent-txns").innerHTML = '<div class="empty">No transactions yet</div>';
    } else {
      document.getElementById("recent-txns").innerHTML = txns
        .map((t) => {
          const statusColor = t.status === "RECOVERED" ? "#f59e0b" : t.status === "SUCCESS" ? "#10b981" : "#ef4444";
          return `<div class="instrument">
            <div style="color:${statusColor};font-size:18px">${t.status === "FAILED" ? "✕" : "✓"}</div>
            <div style="flex:1">
              <div class="instrument-name">${t.instrument_name || t.instrument_id}</div>
              <div class="instrument-detail">₹${(t.amount || 0).toLocaleString()} · ${t.status}</div>
            </div>
          </div>`;
        })
        .join("");
    }
  } catch {
    document.getElementById("stats").innerHTML = '<div class="empty">Failed to load dashboard</div>';
  }
}

// Load instruments
async function loadInstruments() {
  try {
    const resp = await fetch(`${API_BASE}/api/instruments`);
    const data = await resp.json();
    const instruments = data.instruments || [];

    if (instruments.length === 0) {
      document.getElementById("instruments-list").innerHTML = '<div class="empty">No instruments configured</div>';
      return;
    }

    document.getElementById("instruments-list").innerHTML = instruments
      .map((inst) => {
        const color = ICON_COLORS[inst.icon] || "#6b7280";
        return `<div class="instrument">
          <div class="instrument-icon" style="background:${color}">
            ${(inst.icon || "?").slice(0, 3).toUpperCase()}
          </div>
          <div style="flex:1">
            <div class="instrument-name">${inst.name}</div>
            <div class="instrument-detail">${inst.type}${inst.last4 ? ` •••• ${inst.last4}` : ""}${inst.handle ? ` · ${inst.handle}` : ""}</div>
          </div>
        </div>`;
      })
      .join("");
  } catch {
    document.getElementById("instruments-list").innerHTML = '<div class="empty">Failed to load instruments</div>';
  }
}

// Search
document.getElementById("search-btn").addEventListener("click", doSearch);
document.getElementById("search-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});

async function doSearch() {
  const query = document.getElementById("search-input").value.trim();
  if (!query) return;

  const resultsDiv = document.getElementById("search-results");
  const recDiv = document.getElementById("search-recommendation");
  resultsDiv.innerHTML = '<div class="loading">Searching...</div>';
  recDiv.style.display = "none";

  try {
    const resp = await fetch(`${API_BASE}/api/products/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await resp.json();
    const products = data.products || [];

    if (products.length === 0) {
      resultsDiv.innerHTML = '<div class="empty">No products found</div>';
      return;
    }

    resultsDiv.innerHTML = products
      .map(
        (p) => `
      <div class="product-card" data-product-id="${p.id}" data-product-name="${p.name}" data-product-price="${p.price}">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:20px">${p.image_emoji || "📦"}</span>
          <div style="flex:1">
            <div class="product-name">${p.name}</div>
            <div>
              <span class="product-price">₹${p.price.toLocaleString()}</span>
              ${p.mrp > p.price ? `<span class="product-mrp">₹${p.mrp.toLocaleString()}</span>` : ""}
            </div>
          </div>
        </div>
      </div>`
      )
      .join("");

    // Add click handlers
    resultsDiv.querySelectorAll(".product-card").forEach((card) => {
      card.addEventListener("click", () => {
        getProductRecommendation(card.dataset.productId, card.dataset.productName);
      });
    });
  } catch {
    resultsDiv.innerHTML = '<div class="empty">Search failed — is backend running?</div>';
  }
}

async function getProductRecommendation(productId, productName) {
  const recDiv = document.getElementById("search-recommendation");
  recDiv.style.display = "block";
  recDiv.innerHTML = '<div class="loading">Getting recommendation...</div>';

  try {
    const resp = await fetch(`${API_BASE}/api/payment/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId }),
    });
    const data = await resp.json();
    const rec = data.recommendation;

    recDiv.innerHTML = `
      <div class="recommendation-box">
        <div class="reasoning">${rec.reasoning}</div>
        ${rec.savings_amount > 0 ? `<div class="savings">You save ₹${rec.savings_amount.toLocaleString()}</div>` : ""}
        <div class="use-tip">💡 Use <strong>${rec.recommended_name}</strong> when checking out for ${productName}</div>
      </div>`;
  } catch {
    recDiv.innerHTML = '<div class="empty">Failed to get recommendation</div>';
  }
}

// Initialize
checkBackend();
loadDashboard();
loadInstruments();
