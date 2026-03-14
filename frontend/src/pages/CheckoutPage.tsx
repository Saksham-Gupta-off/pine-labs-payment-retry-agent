import { useEffect, useState } from "react";
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
  ChevronLeft,
  Search,
} from "lucide-react";
import { getProducts, recommendPayment, executePayment, searchProducts } from "../api";

type FlowState =
  | "catalog"
  | "thinking"
  | "recommendation"
  | "processing"
  | "recovering"
  | "success";

interface Product {
  id: string;
  name: string;
  price: number;
  mrp: number;
  category: string;
  image_emoji: string;
  description: string;
  card_offers: Record<string, { type: string; amount: number; desc: string }>;
}

interface Instrument {
  id: string;
  type: string;
  name: string;
  handle?: string;
  last4?: string;
  success_rate: number;
  recent_failures: number;
  icon: string;
  product_offer?: { type: string; amount: number; desc: string };
}

const ICON_COLORS: Record<string, string> = {
  phonepe: "bg-purple-600",
  icici: "bg-orange-600",
  axis: "bg-pink-600",
  hdfc: "bg-blue-600",
  sbi: "bg-blue-800",
};

export default function CheckoutPage() {
  const [state, setState] = useState<FlowState>("catalog");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [execResult, setExecResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    getProducts().then((d) => setProducts(d.products || []));
  }, []);

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const data = await searchProducts(q);
      setSearchResults(data.products || []);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
  };

  const handleSelectProduct = async (product: Product) => {
    setSelectedProduct(product);
    setState("thinking");
    setError(null);
    try {
      const data = await recommendPayment(product.id);
      setRecommendation(data.recommendation);
      setInstruments(data.instruments || []);
      setState("recommendation");
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || "Failed to get recommendation");
      setState("catalog");
    }
  };

  const handleExecute = async (instrumentId: string) => {
    if (!selectedProduct) return;
    setState("processing");
    try {
      const data = await executePayment(instrumentId, selectedProduct.id);
      setExecResult(data);

      if (data.initial_attempt?.status === "FAILED" && data.recovery) {
        setState("recovering");
        setTimeout(() => setState("success"), 3000);
      } else {
        setTimeout(() => setState("success"), 1500);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || "Payment failed");
      setState("catalog");
    }
  };

  const reset = () => {
    setState("catalog");
    setSelectedProduct(null);
    setRecommendation(null);
    setInstruments([]);
    setExecResult(null);
    setError(null);
  };

  return (
    <div className="flex justify-center items-start pt-4">
      <AnimatePresence mode="wait">
        {/* ── Product Catalog ── */}
        {state === "catalog" && (
          <motion.div
            key="catalog"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-2xl"
          >
            <h2 className="text-xl font-bold mb-4">Choose a product</h2>
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

            {/* Search bar */}
            <form
              onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
              className="mb-5 flex gap-2"
            >
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
              {searchResults !== null && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="text-white/40 hover:text-white/70 text-sm px-3 transition-colors"
                >
                  Clear
                </button>
              )}
            </form>

            {/* Search results */}
            {searching && (
              <div className="flex items-center justify-center py-8 gap-2 text-white/40">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Searching...</span>
              </div>
            )}

            {!searching && searchResults !== null && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-white/50 mb-3">
                  Search results ({searchResults.length})
                </h3>
                {searchResults.length === 0 ? (
                  <p className="text-white/30 text-sm py-4 text-center">No products found for &quot;{searchQuery}&quot;</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {searchResults.map((p, idx) => {
                      const discount = Math.round(((p.mrp - p.price) / p.mrp) * 100);
                      return (
                        <motion.button
                          key={p.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          onClick={() => handleSelectProduct(p)}
                          className="glass p-5 text-left hover:bg-white/10 transition-all group"
                        >
                          <div className="flex items-start gap-4">
                            <div className="text-4xl flex-shrink-0">{p.image_emoji}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm leading-tight truncate">{p.name}</p>
                              <p className="text-xs text-white/40 mt-0.5">{p.category}</p>
                              <div className="flex items-baseline gap-2 mt-2">
                                <span className="text-lg font-bold text-emerald-400">
                                  ₹{p.price.toLocaleString()}
                                </span>
                                {p.mrp > p.price && (
                                  <>
                                    <span className="text-xs text-white/30 line-through">
                                      ₹{p.mrp.toLocaleString()}
                                    </span>
                                    <span className="text-xs text-emerald-400">{discount}% off</span>
                                  </>
                                )}
                              </div>
                              {Object.keys(p.card_offers).length > 0 && (
                                <p className="text-xs text-amber-400 mt-1">
                                  {Object.keys(p.card_offers).length} card offer
                                  {Object.keys(p.card_offers).length > 1 ? "s" : ""} available
                                </p>
                              )}
                            </div>
                            <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/50 mt-1 flex-shrink-0" />
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Catalog products */}
            {searchResults === null && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {products.map((p, idx) => {
                  const discount = Math.round(((p.mrp - p.price) / p.mrp) * 100);
                  return (
                    <motion.button
                      key={p.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => handleSelectProduct(p)}
                      className="glass p-5 text-left hover:bg-white/10 transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-4xl flex-shrink-0">{p.image_emoji}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm leading-tight truncate">{p.name}</p>
                          <p className="text-xs text-white/40 mt-0.5">{p.category}</p>
                          <div className="flex items-baseline gap-2 mt-2">
                            <span className="text-lg font-bold text-emerald-400">
                              ₹{p.price.toLocaleString()}
                            </span>
                            {p.mrp > p.price && (
                              <>
                                <span className="text-xs text-white/30 line-through">
                                  ₹{p.mrp.toLocaleString()}
                                </span>
                                <span className="text-xs text-emerald-400">{discount}% off</span>
                              </>
                            )}
                          </div>
                          {Object.keys(p.card_offers).length > 0 && (
                            <p className="text-xs text-amber-400 mt-1">
                              {Object.keys(p.card_offers).length} card offer
                              {Object.keys(p.card_offers).length > 1 ? "s" : ""} available
                            </p>
                          )}
                        </div>
                        <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/50 mt-1 flex-shrink-0" />
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}

            {searchResults !== null && (
              <>
                <h3 className="text-sm font-medium text-white/50 mb-3">Popular Products</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {products.map((p, idx) => {
                    const discount = Math.round(((p.mrp - p.price) / p.mrp) * 100);
                    return (
                      <motion.button
                        key={p.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => handleSelectProduct(p)}
                        className="glass p-5 text-left hover:bg-white/10 transition-all group"
                      >
                        <div className="flex items-start gap-4">
                          <div className="text-4xl flex-shrink-0">{p.image_emoji}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm leading-tight truncate">{p.name}</p>
                            <p className="text-xs text-white/40 mt-0.5">{p.category}</p>
                            <div className="flex items-baseline gap-2 mt-2">
                              <span className="text-lg font-bold text-emerald-400">
                                ₹{p.price.toLocaleString()}
                              </span>
                              {p.mrp > p.price && (
                                <>
                                  <span className="text-xs text-white/30 line-through">
                                    ₹{p.mrp.toLocaleString()}
                                  </span>
                                  <span className="text-xs text-emerald-400">{discount}% off</span>
                                </>
                              )}
                            </div>
                            {Object.keys(p.card_offers).length > 0 && (
                              <p className="text-xs text-amber-400 mt-1">
                                {Object.keys(p.card_offers).length} card offer
                                {Object.keys(p.card_offers).length > 1 ? "s" : ""} available
                              </p>
                            )}
                          </div>
                          <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/50 mt-1 flex-shrink-0" />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ── Agent Thinking ── */}
        {state === "thinking" && selectedProduct && (
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
              {selectedProduct.name} · ₹{selectedProduct.price.toLocaleString()}
            </p>
            <div className="flex justify-center gap-1 mt-6">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-emerald-400 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Recommendation ── */}
        {state === "recommendation" && recommendation && selectedProduct && (
          <motion.div
            key="recommendation"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md space-y-4"
          >
            {/* Product summary */}
            <div className="glass p-4 flex items-center gap-3">
              <span className="text-2xl">{selectedProduct.image_emoji}</span>
              <div className="flex-1">
                <p className="font-medium text-sm">{selectedProduct.name}</p>
                <p className="text-lg font-bold text-emerald-400">
                  ₹{selectedProduct.price.toLocaleString()}
                </p>
              </div>
              <button onClick={reset} className="text-xs text-white/40 hover:text-white/60">
                <ChevronLeft className="w-4 h-4 inline" /> Change
              </button>
            </div>

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
                    {recommendation.reasoning}
                  </p>
                  {(recommendation.savings_amount ?? 0) > 0 && (
                    <div className="mt-3 inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-medium">
                      You save ₹{recommendation.savings_amount.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Instrument cards */}
            <div className="space-y-2">
              {(recommendation.ranked_instruments || []).map((ranked: any, idx: number) => {
                const inst = instruments.find((i: Instrument) => i.id === ranked.id);
                if (!inst) return null;
                const isRecommended = ranked.id === recommendation.recommended_id;
                const offer = inst.product_offer;
                return (
                  <motion.button
                    key={ranked.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    onClick={() => handleExecute(ranked.id)}
                    className={`w-full glass p-4 flex items-center gap-4 text-left transition-all hover:bg-white/10 ${
                      isRecommended ? "ring-2 ring-emerald-400/50 bg-emerald-500/5" : ""
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs ${
                        ICON_COLORS[inst.icon] || "bg-gray-600"
                      }`}
                    >
                      {inst.icon.slice(0, 4).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{inst.name}</span>
                        {isRecommended && (
                          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full flex-shrink-0">
                            Best
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/40 mt-0.5">
                        {inst.type}
                        {inst.last4 ? ` •••• ${inst.last4}` : ""}
                        {inst.handle ? ` · ${inst.handle}` : ""} ·{" "}
                        {(inst.success_rate * 100).toFixed(0)}% success
                      </p>
                      {offer && (
                        <p className="text-xs text-amber-400 mt-0.5">
                          {offer.desc}
                        </p>
                      )}
                    </div>
                    {offer && (
                      <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded flex-shrink-0">
                        -₹{offer.amount.toLocaleString()}
                      </span>
                    )}
                    <ArrowRight className="w-4 h-4 text-white/30 flex-shrink-0" />
                  </motion.button>
                );
              })}
            </div>

            {/* Approve recommended */}
            <button
              onClick={() => handleExecute(recommendation.recommended_id)}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <CreditCard className="w-5 h-5" />
              Pay with {recommendation.recommended_name || "recommended instrument"}
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
            <h3 className="text-xl font-semibold mt-6">Processing payment...</h3>
            <p className="text-white/50 mt-2 text-sm">Connecting to Pine Labs payment gateway</p>
          </motion.div>
        )}

        {/* ── Recovering ── */}
        {state === "recovering" && execResult && (
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
                {execResult.recovery?.diagnosis ||
                  "The initial payment didn't go through. PaySense is switching to a better option."}
              </p>
              <div className="mt-4 glass p-4 text-left">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2">
                  Agent Reasoning
                </p>
                <p className="text-sm text-white/70">
                  {execResult.recovery?.reasoning || "Analyzing failure and selecting optimal fallback..."}
                </p>
              </div>
              <div className="flex justify-center gap-1 mt-6">
                {[0, 1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 bg-amber-400 rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Success ── */}
        {state === "success" && execResult && selectedProduct && (
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
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              >
                <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
              </motion.div>
              <h3 className="text-2xl font-bold mt-4">Payment Successful!</h3>
              <p className="text-white/50 mt-1 text-sm">Order ID: {execResult.order_id}</p>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Product</span>
                <span className="font-medium">{selectedProduct.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Amount</span>
                <span className="font-medium">
                  {execResult.savings > 0 ? (
                    <>
                      <span className="line-through text-white/30 mr-2">
                        ₹{selectedProduct.price.toLocaleString()}
                      </span>
                      <span className="text-emerald-400">
                        ₹{(selectedProduct.price - execResult.savings).toLocaleString()}
                      </span>
                    </>
                  ) : (
                    <>₹{selectedProduct.price.toLocaleString()}</>
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Paid with</span>
                <span className="font-medium">
                  {execResult.recovery
                    ? execResult.recovery.instrument_name
                    : execResult.initial_attempt?.instrument_name}
                </span>
              </div>
              {execResult.recovery && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Recovery</span>
                  <span className="font-medium text-amber-400">
                    Auto-recovered from {execResult.initial_attempt?.instrument_name}
                  </span>
                </div>
              )}
              {execResult.savings > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">You saved</span>
                  <span className="font-medium text-emerald-400">
                    ₹{execResult.savings.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Time</span>
                <span className="font-medium">{(execResult.total_time_ms / 1000).toFixed(1)}s</span>
              </div>
            </div>

            {execResult.recovery && (
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
                    <p className="text-xs text-white/50 mt-1">{execResult.recovery.diagnosis}</p>
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
