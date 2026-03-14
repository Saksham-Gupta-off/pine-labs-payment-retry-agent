import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  Sparkles,
  CreditCard,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Headphones,
} from "lucide-react";
import { executePayment, getProduct, getUser } from "../api";

type FlowState =
  | "product"
  | "thinking"
  | "recommendation"
  | "processing"
  | "recovering"
  | "success";

interface Instrument {
  id: string;
  type: string;
  name: string;
  handle?: string;
  last4?: string;
  success_rate: number;
  recent_failures: number;
  icon: string;
  offer?: { type: string; amount: number; desc: string };
}

const ICON_COLORS: Record<string, string> = {
  phonepe: "bg-purple-600",
  axis: "bg-pink-600",
  hdfc: "bg-blue-600",
};

export default function CheckoutPage() {
  const [state, setState] = useState<FlowState>("product");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const product = {
    name: "boAt Airdopes 141",
    price: 5799,
    description:
      "Wireless earbuds with 42H playtime, ENx\u2122 noise cancellation, and BEAST\u2122 mode for gaming.",
  };

  const handlePay = async () => {
    setState("thinking");
    setError(null);

    try {
      // Small delay to show thinking animation
      await new Promise((r) => setTimeout(r, 1500));

      const data = await executePayment();
      setResult(data);

      // Show recommendation
      setState("recommendation");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
      setState("product");
    }
  };

  const handleApprove = async (instrumentId?: string) => {
    setState("processing");

    // Simulate processing delay
    await new Promise((r) => setTimeout(r, 2000));

    if (result?.initial_attempt?.status === "FAILED") {
      setState("recovering");
      await new Promise((r) => setTimeout(r, 3000));
    }

    setState("success");
  };

  const handlePayWithInstrument = async (instrumentId: string) => {
    setState("thinking");
    setError(null);

    try {
      await new Promise((r) => setTimeout(r, 1500));
      const data = await executePayment(instrumentId);
      setResult(data);
      setState("processing");
      await new Promise((r) => setTimeout(r, 2000));

      if (data?.initial_attempt?.status === "FAILED") {
        setState("recovering");
        await new Promise((r) => setTimeout(r, 3000));
      }

      setState("success");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
      setState("product");
    }
  };

  const reset = () => {
    setState("product");
    setResult(null);
    setError(null);
  };

  return (
    <div className="flex justify-center items-start pt-8">
      <AnimatePresence mode="wait">
        {/* ── Product View ── */}
        {state === "product" && (
          <motion.div
            key="product"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass p-8 w-full max-w-md"
          >
            <div className="flex items-center justify-center mb-6">
              <div className="w-32 h-32 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center">
                <Headphones className="w-16 h-16 text-emerald-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center">{product.name}</h2>
            <p className="text-white/50 text-center mt-2 text-sm">
              {product.description}
            </p>
            <div className="text-3xl font-bold text-center mt-4 text-emerald-400">
              ₹{product.price.toLocaleString()}
            </div>
            {error && (
              <p className="text-red-400 text-sm text-center mt-2">{error}</p>
            )}
            <button
              onClick={handlePay}
              className="w-full mt-6 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <ShoppingBag className="w-5 h-5" />
              Pay Now
            </button>
          </motion.div>
        )}

        {/* ── Agent Thinking ── */}
        {state === "thinking" && (
          <motion.div
            key="thinking"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass p-12 w-full max-w-md text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="inline-block"
            >
              <Sparkles className="w-12 h-12 text-emerald-400" />
            </motion.div>
            <h3 className="text-xl font-semibold mt-6">
              PaySense is analyzing your payment options...
            </h3>
            <p className="text-white/50 mt-2 text-sm">
              Checking instrument health, offers, and success rates
            </p>
            <div className="flex justify-center gap-1 mt-6">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-emerald-400 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{
                    repeat: Infinity,
                    duration: 1,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Recommendation ── */}
        {state === "recommendation" && result && (
          <motion.div
            key="recommendation"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md space-y-4"
          >
            {/* Agent recommendation bubble */}
            <div className="glass p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-400 mb-1">
                    PaySense Recommendation
                  </p>
                  <p className="text-white/80 text-sm leading-relaxed">
                    {result.recommendation?.reasoning}
                  </p>
                  {(result.recommendation?.savings_amount ?? 0) > 0 && (
                    <div className="mt-3 inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-medium">
                      You save ₹{result.recommendation.savings_amount}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Instrument cards */}
            <div className="space-y-2">
              {result.recommendation?.ranked_instruments?.map(
                (ranked: any, idx: number) => {
                  const inst = findInstrument(ranked.id);
                  if (!inst) return null;
                  const isRecommended =
                    ranked.id === result.recommendation.recommended_id;
                  return (
                    <motion.button
                      key={ranked.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => handlePayWithInstrument(ranked.id)}
                      className={`w-full glass p-4 flex items-center gap-4 text-left transition-all hover:bg-white/10 ${
                        isRecommended
                          ? "ring-2 ring-emerald-400/50 bg-emerald-500/5"
                          : ""
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                          ICON_COLORS[inst.icon] || "bg-gray-600"
                        }`}
                      >
                        {inst.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{inst.name}</span>
                          {isRecommended && (
                            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/40 mt-0.5">
                          {inst.type}
                          {inst.last4 ? ` •••• ${inst.last4}` : ""}
                          {inst.handle ? ` · ${inst.handle}` : ""} ·{" "}
                          {(inst.success_rate * 100).toFixed(0)}% success rate
                        </p>
                      </div>
                      {inst.offer && (
                        <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                          ₹{inst.offer.amount} off
                        </span>
                      )}
                      <ArrowRight className="w-4 h-4 text-white/30" />
                    </motion.button>
                  );
                }
              )}
            </div>

            {/* Approve recommended */}
            <button
              onClick={() =>
                handlePayWithInstrument(result.recommendation.recommended_id)
              }
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <CreditCard className="w-5 h-5" />
              Pay with{" "}
              {result.recommendation?.recommended_name || "recommended instrument"}
            </button>
          </motion.div>
        )}

        {/* ── Processing ── */}
        {state === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass p-12 w-full max-w-md text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            >
              <Loader2 className="w-12 h-12 text-blue-400 mx-auto" />
            </motion.div>
            <h3 className="text-xl font-semibold mt-6">
              Processing payment...
            </h3>
            <p className="text-white/50 mt-2 text-sm">
              Connecting to Pine Labs payment gateway
            </p>
          </motion.div>
        )}

        {/* ── Recovering ── */}
        {state === "recovering" && result && (
          <motion.div
            key="recovering"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass p-8 w-full max-w-md border-amber-500/30"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="inline-block"
              >
                <RefreshCw className="w-12 h-12 text-amber-400" />
              </motion.div>
              <h3 className="text-xl font-semibold mt-6 text-amber-400">
                Recovering your payment...
              </h3>
              <p className="text-white/60 mt-3 text-sm">
                {result.recovery?.diagnosis ||
                  "The initial payment didn't go through. Don't worry — PaySense is switching to a better option."}
              </p>
              <div className="mt-4 glass p-4 text-left">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2">
                  Agent Reasoning
                </p>
                <p className="text-sm text-white/70">
                  {result.recovery?.reasoning ||
                    "Analyzing failure and selecting optimal fallback..."}
                </p>
              </div>
              <div className="flex justify-center gap-1 mt-6">
                {[0, 1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 bg-amber-400 rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      repeat: Infinity,
                      duration: 1,
                      delay: i * 0.15,
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Success ── */}
        {state === "success" && result && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="glass p-8 w-full max-w-md"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  delay: 0.2,
                }}
              >
                <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
              </motion.div>
              <h3 className="text-2xl font-bold mt-4">Payment Successful!</h3>
              <p className="text-white/50 mt-1">
                Order ID: {result.order_id}
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Amount</span>
                <span className="font-medium">
                  ₹{(5799).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Paid with</span>
                <span className="font-medium">
                  {result.recovery
                    ? result.recovery.instrument_name
                    : result.initial_attempt?.instrument_name}
                </span>
              </div>
              {result.recovery && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Recovery</span>
                  <span className="font-medium text-amber-400">
                    Auto-recovered from {result.initial_attempt?.instrument_name}
                  </span>
                </div>
              )}
              {(result.recommendation?.savings_amount ?? 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Savings</span>
                  <span className="font-medium text-emerald-400">
                    ₹{result.recommendation.savings_amount}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Time</span>
                <span className="font-medium">
                  {(result.total_time_ms / 1000).toFixed(1)}s
                </span>
              </div>
            </div>

            {result.recovery && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-400">
                      PaySense recovered this payment
                    </p>
                    <p className="text-xs text-white/50 mt-1">
                      {result.recovery.diagnosis}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            <button
              onClick={reset}
              className="w-full mt-6 bg-white/10 hover:bg-white/15 text-white font-medium py-3 px-6 rounded-xl transition-colors"
            >
              New Payment
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper to find instrument details from hardcoded data
function findInstrument(id: string): Instrument | null {
  const instruments: Instrument[] = [
    {
      id: "upi_1",
      type: "UPI",
      name: "PhonePe UPI",
      handle: "arjun@okaxis",
      success_rate: 0.72,
      recent_failures: 3,
      icon: "phonepe",
    },
    {
      id: "card_1",
      type: "Credit Card",
      name: "Axis Flipkart Card",
      last4: "4521",
      success_rate: 0.95,
      recent_failures: 0,
      icon: "axis",
      offer: {
        type: "cashback",
        amount: 280,
        desc: "\u20b9280 cashback on purchases above \u20b93000",
      },
    },
    {
      id: "card_2",
      type: "Debit Card",
      name: "HDFC Debit Card",
      last4: "8834",
      success_rate: 0.88,
      recent_failures: 1,
      icon: "hdfc",
    },
  ];
  return instruments.find((i) => i.id === id) || null;
}
