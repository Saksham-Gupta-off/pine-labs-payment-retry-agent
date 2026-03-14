(() => {
  chrome.storage.local.get("lastPaymentResult", ({ lastPaymentResult }) => {
    if (!lastPaymentResult) return;

    const r = lastPaymentResult;
    const product = r.product || {};
    const attempts = r.attempts || [];
    const finalStatus = r.final_status;
    const isSuccess = finalStatus === "SUCCESS";
    const isRecovered = finalStatus === "RECOVERED";
    const isFailed = finalStatus === "ALL_FAILED";
    const statusClass = isRecovered ? "recovered" : isSuccess ? "success" : "failed";

    const price = product.price || r._price || 0;
    const productName = product.name || r._product_name || "Product";
    const savings = r.savings || 0;
    const effectivePrice = savings > 0 ? price - savings : price;
    const orderId = r.order_id || "N/A";
    const finalInstrument = r.final_instrument || "—";
    const totalTime = r.total_time_ms ? (r.total_time_ms / 1000).toFixed(1) + "s" : "—";
    const timestamp = r._timestamp
      ? new Date(r._timestamp).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

    // Build timeline
    let timelineHTML = "";
    if (attempts.length > 1 || isFailed) {
      timelineHTML = `<div class="card rcpt-animate"><div class="card-title">Payment Attempts</div><div class="timeline">`;
      for (let i = 0; i < attempts.length; i++) {
        const a = attempts[i];
        const ok = a.status === "SUCCESS" || a.status === "RECOVERED";
        const cls = ok ? "success" : "failed";
        const dot = ok ? "✓" : "✕";
        let text = "";
        if (a.retried_same) text = `Retried ${a.instrument_name}`;
        else if (a.attempt_number === 1) text = `Tried ${a.instrument_name}`;
        else text = `Switched to ${a.instrument_name}`;
        if (!ok && a.error_message) text += ` — ${a.error_message}`;
        if (ok) text += " — Success";

        timelineHTML += `
          <div class="timeline-step ${cls}" style="animation-delay: ${i * 200}ms">
            <div class="timeline-dot">${dot}</div>
            <div class="timeline-text">${text}</div>
          </div>`;
      }
      timelineHTML += `</div></div>`;
    }

    // Savings row
    let savingsHTML = "";
    if (savings > 0 && (isSuccess || isRecovered)) {
      savingsHTML = `
        <div class="savings-row">
          <span class="label">You saved</span>
          <span class="amount savings-amount-animated" data-target="${savings}">₹0</span>
        </div>`;
    }

    // Root cause (for failed)
    let failHTML = "";
    if (isFailed && r.root_cause) {
      const rc = r.root_cause;
      failHTML = `
        <div class="card rcpt-animate">
          <div class="card-title">Failure Details</div>
          <p style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6">${rc.summary || "All instruments failed."}</p>
          <p style="font-size:12px;color:rgba(255,255,255,0.3);margin-top:8px">${rc.instruments_tried || 0} instruments tried across ${rc.total_attempts || 0} attempts</p>
        </div>`;
    }

    // Reasoning section from attempts
    let reasoningHTML = "";
    if (attempts.length > 0) {
      let reasoningSteps = "";
      for (const a of attempts) {
        const statusLabel = a.status === "SUCCESS" ? "Success" : a.status === "RECOVERED" ? "Recovered" : "Failed";
        const errorInfo = a.error_code ? ` → Error: ${a.error_code}` : "";
        reasoningSteps += `
          <div class="reasoning-step">
            <div class="reasoning-label">Attempt ${a.attempt_number} · ${statusLabel}</div>
            ${a.instrument_name}${errorInfo}${a.error_message ? ` — ${a.error_message}` : ""}
            ${a.retried_same ? " (retried same instrument)" : ""}
          </div>`;
      }
      reasoningHTML = `
        <div class="reasoning-card rcpt-animate">
          <div class="reasoning-toggle" id="reasoning-toggle">
            <div class="card-title">🤖 Agent Reasoning</div>
            <span class="reasoning-chevron" id="reasoning-chevron">▼</span>
          </div>
          <div class="reasoning-content" id="reasoning-content">
            ${reasoningSteps}
          </div>
        </div>`;
    }

    // Animated checkmark SVG
    const checkSVG = `<svg class="animated-check" width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="24"/>
      <path class="check-path" d="M14 24 L21 31 L34 18"/>
    </svg>`;

    const statusIcons = { success: checkSVG, recovered: checkSVG, failed: "!" };
    const statusTitles = {
      success: "Payment Successful",
      recovered: "Payment Recovered",
      failed: "Payment Failed",
    };
    const statusSubs = {
      success: "Your payment was processed successfully",
      recovered: "PaySense automatically recovered your payment",
      failed: "We couldn't complete your payment",
    };

    // Pine Labs branding badges
    const pinelabsBadge = `<span class="pinelabs-badge">🏦 Powered by <strong>Pine Labs</strong></span>`;
    const aiRecoveryBadge = isRecovered ? `<span class="ai-recovery-badge">🤖 AI-Powered Recovery</span>` : "";

    document.getElementById("empty").style.display = "none";
    document.getElementById("receipt").innerHTML = `
      <!-- Header -->
      <div class="receipt-header rcpt-animate" style="animation-delay: 0ms">
        <div class="receipt-logo">⚡ Pay<span>Sense</span></div>
        <div class="receipt-subtitle">Payment Receipt</div>
      </div>

      <!-- Status -->
      <div class="status-badge ${statusClass} rcpt-animate" style="animation-delay: 200ms">
        <div class="status-icon">${statusClass === "failed" ? "!" : statusIcons[statusClass]}</div>
        <div>
          <div class="status-title">${statusTitles[statusClass]}</div>
          <div class="status-sub">${statusSubs[statusClass]}</div>
        </div>
      </div>

      <!-- Product -->
      <div class="card rcpt-animate" style="animation-delay: 400ms">
        <div class="card-title">Product</div>
        <div class="product">
          <div class="product-emoji">${product.image_emoji || "🛒"}</div>
          <div>
            <div class="product-name">${productName}</div>
            <div class="product-price">
              ₹${effectivePrice.toLocaleString("en-IN")}
              ${savings > 0 ? `<span class="product-mrp">₹${price.toLocaleString("en-IN")}</span>` : ""}
            </div>
          </div>
        </div>
      </div>

      <!-- Payment Details -->
      <div class="card rcpt-animate" style="animation-delay: 600ms">
        <div class="card-title">Payment Details</div>
        <div class="detail-row">
          <span class="detail-label">Pine Labs Order ID</span>
          <span class="detail-value mono">${orderId}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Date</span>
          <span class="detail-value">${timestamp}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Amount</span>
          <span class="detail-value${savings > 0 ? " green" : ""}">₹${effectivePrice.toLocaleString("en-IN")}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Paid via</span>
          <span class="detail-value">${finalInstrument}</span>
        </div>
        ${isRecovered ? `
        <div class="detail-row">
          <span class="detail-label">Recovery</span>
          <span class="detail-value amber">Auto-recovered by PaySense</span>
        </div>` : ""}
        <div class="detail-row">
          <span class="detail-label">Processing time</span>
          <span class="detail-value">${totalTime}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value ${statusClass === "failed" ? "" : "green"}">${finalStatus}</span>
        </div>
        ${savingsHTML}
      </div>

      <!-- Timeline (if recovery or failure) -->
      ${timelineHTML}

      <!-- Failure details -->
      ${failHTML}

      <!-- Agent Reasoning -->
      ${reasoningHTML}

      <!-- Footer -->
      <div class="receipt-footer rcpt-animate" style="animation-delay: 1000ms">
        <div style="margin-bottom: 12px">
          ${pinelabsBadge}
          ${aiRecoveryBadge}
        </div>
        <div class="footer-text">
          Powered by <a href="#">PaySense</a> — Autonomous Payment Intelligence
        </div>
        <div class="footer-powered">
          Pine Labs AI Hackathon 2026
        </div>
        <button class="close-btn" id="close-receipt">Close Receipt</button>
      </div>
    `;

    // Wire up close button
    document.getElementById("close-receipt").addEventListener("click", () => {
      window.close();
    });

    // Wire up reasoning toggle
    const toggle = document.getElementById("reasoning-toggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        const content = document.getElementById("reasoning-content");
        const chevron = document.getElementById("reasoning-chevron");
        content.classList.toggle("open");
        chevron.classList.toggle("open");
      });
    }

    // Animate savings count-up
    const savingsEl = document.querySelector(".savings-amount-animated");
    if (savingsEl) {
      const target = parseInt(savingsEl.dataset.target, 10);
      animateCountUp(savingsEl, target, "₹");
    }
  });

  function animateCountUp(el, target, prefix = "") {
    const duration = 800;
    const start = performance.now();
    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      el.textContent = `${prefix}${current.toLocaleString("en-IN")}`;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
})();
