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
      timelineHTML = `<div class="card"><div class="card-title">Payment Attempts</div><div class="timeline">`;
      for (const a of attempts) {
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
          <div class="timeline-step ${cls}">
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
          <span class="amount">₹${savings.toLocaleString("en-IN")}</span>
        </div>`;
    }

    // Root cause (for failed)
    let failHTML = "";
    if (isFailed && r.root_cause) {
      const rc = r.root_cause;
      failHTML = `
        <div class="card">
          <div class="card-title">Failure Details</div>
          <p style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6">${rc.summary || "All instruments failed."}</p>
          <p style="font-size:12px;color:rgba(255,255,255,0.3);margin-top:8px">${rc.instruments_tried || 0} instruments tried across ${rc.total_attempts || 0} attempts</p>
        </div>`;
    }

    const statusIcons = { success: "✓", recovered: "✓", failed: "!" };
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

    document.getElementById("empty").style.display = "none";
    document.getElementById("receipt").innerHTML = `
      <!-- Header -->
      <div class="receipt-header">
        <div class="receipt-logo">⚡ Pay<span>Sense</span></div>
        <div class="receipt-subtitle">Payment Receipt</div>
      </div>

      <!-- Status -->
      <div class="status-badge ${statusClass}">
        <div class="status-icon">${statusIcons[statusClass]}</div>
        <div>
          <div class="status-title">${statusTitles[statusClass]}</div>
          <div class="status-sub">${statusSubs[statusClass]}</div>
        </div>
      </div>

      <!-- Product -->
      <div class="card">
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
      <div class="card">
        <div class="card-title">Payment Details</div>
        <div class="detail-row">
          <span class="detail-label">Order ID</span>
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

      <!-- Footer -->
      <div class="receipt-footer">
        <div class="footer-text">
          Powered by <a href="#">PaySense</a> — Autonomous Payment Intelligence
        </div>
        <div class="footer-powered">
          Pine Labs AI Hackathon 2026
        </div>
        <button class="close-btn" id="close-receipt">Close Receipt</button>
      </div>
    `;

    document.getElementById("close-receipt").addEventListener("click", () => {
      window.close();
    });
  });
})();
