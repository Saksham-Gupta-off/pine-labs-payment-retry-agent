/**
 * PaySense Content Script
 * Detects checkout/payment pages on Indian e-commerce sites,
 * injects the PaySense widget, and handles autonomous payment with retry.
 */

(() => {
  const SITE_CONFIGS = {
    "flipkart.com": {
      checkoutPatterns: [/\/checkout/, /\/viewcart/, /\/payment/],
      priceSelectors: ["._30jeq3", "._16Jk6d", ".dyC4hf"],
      productSelectors: [".B_NuCI", "._35KyD6", ".KzDlHZ"],
    },
    "amazon.in": {
      checkoutPatterns: [/\/gp\/buy/, /\/checkout/, /\/cart/],
      priceSelectors: [
        ".a-price-whole",
        "#priceblock_ourprice",
        ".a-price .a-offscreen",
      ],
      productSelectors: ["#productTitle", ".a-truncate-cut"],
    },
    "myntra.com": {
      checkoutPatterns: [/\/checkout/, /\/cart/],
      priceSelectors: [".pdp-price strong", ".product-price"],
      productSelectors: [".pdp-name", ".product-title"],
    },
  };

  let widgetInjected = false;

  // ── State for the current payment flow ──
  let currentProduct = null;
  let currentPrice = null;
  let currentRecommendation = null;
  let currentInstruments = null;

  function getCurrentSite() {
    const host = window.location.hostname;
    for (const [site] of Object.entries(SITE_CONFIGS)) {
      if (host.includes(site)) return site;
    }
    return null;
  }

  function isCheckoutPage(site) {
    const config = SITE_CONFIGS[site];
    if (!config) return false;
    return config.checkoutPatterns.some((p) =>
      p.test(window.location.pathname)
    );
  }

  function extractPrice(site) {
    const config = SITE_CONFIGS[site];
    if (!config) return null;
    for (const sel of config.priceSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent.replace(/[^\d.]/g, "");
        const price = parseFloat(text);
        if (price > 0) return price;
      }
    }
    return null;
  }

  function extractProductName(site) {
    const config = SITE_CONFIGS[site];
    if (!config) return document.title;
    for (const sel of config.productSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    return document.title.split("|")[0].split("-")[0].trim();
  }

  // ── Widget injection ──

  function injectWidget(site, product, price) {
    if (widgetInjected) return;
    widgetInjected = true;
    currentProduct = product;
    currentPrice = price;

    const widget = document.createElement("div");
    widget.id = "paysense-widget";
    widget.innerHTML = `
      <div id="paysense-banner">
        <div class="paysense-header">
          <span class="paysense-logo">⚡ PaySense</span>
          <button id="paysense-close" title="Close">✕</button>
        </div>
        <div class="paysense-body">
          <div class="paysense-detected">
            <span class="paysense-label">Checkout detected</span>
            <span class="paysense-product">${product}</span>
            ${price ? `<span class="paysense-price">₹${price.toLocaleString()}</span>` : ""}
          </div>
          <button id="paysense-recommend-btn" class="paysense-btn">
            Get Smart Recommendation
          </button>
          <div id="paysense-result" style="display:none"></div>
        </div>
      </div>
    `;
    document.body.appendChild(widget);

    document
      .getElementById("paysense-close")
      .addEventListener("click", () => {
        widget.remove();
        widgetInjected = false;
      });

    document
      .getElementById("paysense-recommend-btn")
      .addEventListener("click", () => {
        getRecommendation(product, price);
      });

    chrome.runtime.sendMessage({
      type: "LOG_CHECKOUT_DETECTED",
      site,
      amount: price,
      product,
    });
  }

  // ── Get recommendation ──

  async function getRecommendation(product, price) {
    const btn = document.getElementById("paysense-recommend-btn");
    const resultDiv = document.getElementById("paysense-result");
    btn.textContent = "Analyzing...";
    btn.disabled = true;

    try {
      const resp = await chrome.runtime.sendMessage({
        type: "GET_RECOMMENDATION",
        product: { name: product, price: price || 0 },
      });

      if (resp.error) {
        resultDiv.innerHTML = `<div class="paysense-error">⚠ ${resp.error}<br><small>Make sure PaySense backend is running on localhost:8000</small></div>`;
        resultDiv.style.display = "block";
        btn.textContent = "Retry";
        btn.disabled = false;
        return;
      }

      currentRecommendation = resp.recommendation;
      currentInstruments = resp.instruments || [];
      const rec = resp.recommendation;
      const savings = rec.savings_amount || 0;

      let instrumentsHTML = "";
      if (rec.ranked_instruments) {
        instrumentsHTML = rec.ranked_instruments
          .slice(0, 4)
          .map((r, idx) => {
            const inst = currentInstruments.find((i) => i.id === r.id);
            const isRec = r.id === rec.recommended_id;
            return `
            <div class="paysense-instrument ${isRec ? "paysense-recommended" : ""}"
                 data-instrument-id="${r.id}"
                 style="animation-delay: ${idx * 100}ms">
              <span class="paysense-inst-name">${inst?.name || r.id}${isRec ? " ★" : ""}</span>
              <span class="paysense-inst-detail">${r.rationale}</span>
            </div>`;
          })
          .join("");
      }

      const effectivePrice = price ? price - savings : 0;

      resultDiv.innerHTML = `
        <div class="paysense-recommendation">
          <div class="paysense-reasoning">${rec.reasoning}</div>
          ${savings > 0 ? `<div class="paysense-savings">You save ₹${savings.toLocaleString()}</div>` : ""}
          <div class="paysense-instruments">${instrumentsHTML}</div>
          <button id="paysense-pay-btn" class="paysense-btn paysense-pay-btn"
                  data-instrument-id="${rec.recommended_id}">
            Pay ₹${effectivePrice > 0 ? effectivePrice.toLocaleString() : (price || 0).toLocaleString()} with ${rec.recommended_name}
          </button>
          <div class="paysense-pay-alt">or click any instrument above to pay with it</div>
          <div id="paysense-payment-status" style="display:none"></div>
        </div>`;

      resultDiv.style.display = "block";
      btn.style.display = "none";

      // Pay button click
      document
        .getElementById("paysense-pay-btn")
        .addEventListener("click", (e) => {
          const instId = e.currentTarget.dataset.instrumentId;
          startPayment(instId);
        });

      // Click on any instrument to pay with it
      resultDiv.querySelectorAll(".paysense-instrument").forEach((el) => {
        el.style.cursor = "pointer";
        el.addEventListener("click", () => {
          const instId = el.dataset.instrumentId;
          startPayment(instId);
        });
      });
    } catch (e) {
      resultDiv.innerHTML = `<div class="paysense-error">⚠ Connection failed. Is PaySense backend running?</div>`;
      resultDiv.style.display = "block";
      btn.textContent = "Retry";
      btn.disabled = false;
    }
  }

  // ── Payment execution ──

  async function startPayment(instrumentId) {
    const payBtn = document.getElementById("paysense-pay-btn");
    const statusDiv = document.getElementById("paysense-payment-status");

    // Disable interactions
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.textContent = "Processing...";
    }
    document.querySelectorAll(".paysense-instrument").forEach((el) => {
      el.style.pointerEvents = "none";
      el.style.opacity = "0.5";
    });

    // Show processing status with shimmer
    statusDiv.style.display = "block";
    statusDiv.innerHTML = `
      <div class="paysense-shimmer"></div>
      <div class="paysense-status-flow">
        <div class="paysense-status-step active" id="ps-step-process">
          <div class="paysense-step-dot pulsing"></div>
          <span>Processing payment...</span>
        </div>
      </div>`;

    try {
      const resp = await chrome.runtime.sendMessage({
        type: "SMART_PAY",
        product: { name: currentProduct, price: currentPrice || 0 },
        instrumentId: instrumentId,
      });

      if (resp.error) {
        showPaymentError(statusDiv, resp.error);
        resetPayButton(payBtn);
        return;
      }

      renderPaymentResult(statusDiv, payBtn, resp);
    } catch (e) {
      showPaymentError(
        statusDiv,
        "Connection to PaySense backend failed. Please check if it's running."
      );
      resetPayButton(payBtn);
    }
  }

  function renderPaymentResult(statusDiv, payBtn, result) {
    const attempts = result.attempts || [];
    const finalStatus = result.final_status;

    // Build the step-by-step flow
    let stepsHTML = "";

    for (const attempt of attempts) {
      const isSuccess =
        attempt.status === "SUCCESS" || attempt.status === "RECOVERED";
      const isFail = attempt.status === "FAILED";

      let stepClass = isSuccess ? "success" : "failed";
      let icon = isSuccess ? "✓" : "✕";
      let label = "";

      if (attempt.retried_same) {
        label = `Retried ${attempt.instrument_name}`;
      } else if (attempt.attempt_number === 1) {
        label = `Tried ${attempt.instrument_name}`;
      } else {
        label = `Switched to ${attempt.instrument_name}`;
      }

      if (isFail && attempt.error_message) {
        label += ` — ${attempt.error_message}`;
      }
      if (isSuccess) {
        label += " — Payment successful!";
      }

      const stepDelay = (attempts.indexOf(attempt)) * 200;
      stepsHTML += `
        <div class="paysense-status-step ${stepClass}" style="animation-delay: ${stepDelay}ms">
          <div class="paysense-step-dot">${icon}</div>
          <span>${label}</span>
        </div>`;
    }

    if (finalStatus === "SUCCESS" || finalStatus === "RECOVERED") {
      const savings = result.savings || 0;
      const finalInst = result.final_instrument || "your instrument";
      statusDiv.innerHTML = `
        <div class="paysense-status-flow">${stepsHTML}</div>
        <div class="paysense-success-card ps-glowing">
          <div class="paysense-success-icon">✓</div>
          <div class="paysense-success-text">Payment Complete</div>
          <div class="paysense-success-detail">
            Paid ₹${(currentPrice || 0).toLocaleString()} via ${finalInst}
            ${finalStatus === "RECOVERED" ? `<br><span class="paysense-recovered-badge">Auto-recovered by PaySense</span>` : ""}
            ${savings > 0 ? `<br><span class="paysense-savings">Saved ₹${savings.toLocaleString()}</span>` : ""}
          </div>
          <div class="paysense-success-order">Order: ${result.order_id || "N/A"}</div>
          <button id="paysense-view-receipt" class="paysense-btn" style="margin-top:10px">
            View Receipt
          </button>
        </div>`;
      if (payBtn) payBtn.style.display = "none";

      // Fire confetti
      launchConfetti(statusDiv.querySelector(".paysense-success-card"));

      // Store result and open receipt page
      const receiptData = {
        ...result,
        _product_name: currentProduct,
        _price: currentPrice,
        _timestamp: Date.now(),
      };
      chrome.storage.local.set({ lastPaymentResult: receiptData }, () => {
        document
          .getElementById("paysense-view-receipt")
          .addEventListener("click", () => {
            chrome.runtime.sendMessage({ type: "OPEN_RECEIPT" });
          });
        // Auto-open receipt after a short delay
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: "OPEN_RECEIPT" });
        }, 1500);
      });
    } else if (finalStatus === "ALL_FAILED") {
      const rc = result.root_cause || {};
      statusDiv.innerHTML = `
        <div class="paysense-status-flow">${stepsHTML}</div>
        <div class="paysense-fail-card">
          <div class="paysense-fail-icon">!</div>
          <div class="paysense-fail-text">Payment Failed</div>
          <div class="paysense-fail-detail">
            ${rc.summary || "All payment instruments were tried but none succeeded."}
          </div>
          <div class="paysense-fail-meta">
            ${rc.instruments_tried || 0} instruments tried across ${rc.total_attempts || 0} attempts
          </div>
          <button id="paysense-retry-all-btn" class="paysense-btn paysense-retry-btn">
            Try Again
          </button>
        </div>`;
      if (payBtn) payBtn.style.display = "none";

      // Retry button
      document
        .getElementById("paysense-retry-all-btn")
        .addEventListener("click", () => {
          // Reset and re-get recommendation
          statusDiv.style.display = "none";
          document.querySelectorAll(".paysense-instrument").forEach((el) => {
            el.style.pointerEvents = "";
            el.style.opacity = "";
          });
          const recBtn = document.getElementById("paysense-recommend-btn");
          if (recBtn) {
            recBtn.style.display = "";
            recBtn.textContent = "Get Smart Recommendation";
            recBtn.disabled = false;
          }
          const resultDiv = document.getElementById("paysense-result");
          if (resultDiv) resultDiv.style.display = "none";
        });

      // Also send a browser notification
      try {
        chrome.runtime.sendMessage({
          type: "PAYMENT_FAILED_NOTIFICATION",
          summary: rc.summary || "Payment failed on all instruments.",
        });
      } catch (_) {}
    }
  }

  function showPaymentError(statusDiv, message) {
    statusDiv.innerHTML = `
      <div class="paysense-fail-card">
        <div class="paysense-fail-icon">!</div>
        <div class="paysense-fail-text">Error</div>
        <div class="paysense-fail-detail">${message}</div>
      </div>`;
  }

  function resetPayButton(payBtn) {
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.textContent = "Try Again";
    }
    document.querySelectorAll(".paysense-instrument").forEach((el) => {
      el.style.pointerEvents = "";
      el.style.opacity = "";
    });
  }

  // ── Confetti ──

  function launchConfetti(anchor) {
    if (!anchor) return;
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444", "#06b6d4"];
    const rect = anchor.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const particles = Array.from({ length: 60 }, () => ({
      x: cx,
      y: cy,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.8) * 10 - 4,
      w: Math.random() * 6 + 3,
      h: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rv: (Math.random() - 0.5) * 12,
      alpha: 1,
    }));

    let frame = 0;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25;
        p.rotation += p.rv;
        p.alpha -= 0.012;
        if (p.alpha <= 0) continue;
        alive = true;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      frame++;
      if (alive && frame < 120) {
        requestAnimationFrame(draw);
      } else {
        canvas.remove();
      }
    }
    requestAnimationFrame(draw);
  }

  // ── Detection logic ──

  function detectAndInject() {
    const site = getCurrentSite();
    if (!site) return;

    if (isCheckoutPage(site)) {
      const price = extractPrice(site);
      const product = extractProductName(site);
      injectWidget(site, product, price);
      return;
    }

    const price = extractPrice(site);
    if (price && price > 100) {
      const product = extractProductName(site);
      injectWidget(site, product, price);
    }
  }

  detectAndInject();

  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      widgetInjected = false;
      const existing = document.getElementById("paysense-widget");
      if (existing) existing.remove();
      setTimeout(detectAndInject, 1000);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
