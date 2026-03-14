import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Trash2,
} from "lucide-react";
import { getTransactions, clearTransactions } from "../api";

const TRACE_CONFIG: Record<
  string,
  { icon: typeof Sparkles; color: string; bg: string; label: string }
> = {
  RECOMMENDATION: {
    icon: Sparkles,
    color: "text-blue-400",
    bg: "bg-blue-500/20",
    label: "Instrument Recommendation",
  },
  DIAGNOSIS: {
    icon: AlertCircle,
    color: "text-red-400",
    bg: "bg-red-500/20",
    label: "Failure Diagnosed",
  },
  RECOVERY: {
    icon: RefreshCw,
    color: "text-amber-400",
    bg: "bg-amber-500/20",
    label: "Payment Recovered",
  },
};

export default function TracePage() {
  const [traces, setTraces] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await getTransactions();
      setTraces(data.traces || []);
      setTransactions(data.transactions || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleClear = async () => {
    await clearTransactions();
    setTraces([]);
    setTransactions([]);
  };

  // Group traces by transaction
  const tracesByTxn = traces.reduce((acc: Record<string, any[]>, t) => {
    (acc[t.transaction_id] = acc[t.transaction_id] || []).push(t);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Reasoning Trace</h1>
          <p className="text-white/50 text-sm mt-1">
            Every decision PaySense makes, explained in real time
          </p>
        </div>
        <button
          onClick={handleClear}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Clear All
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/40">Loading traces...</div>
      ) : traces.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40">No traces yet. Make a payment to see agent reasoning.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-white/10" />

          <AnimatePresence>
            {traces.map((trace, idx) => {
              const config =
                TRACE_CONFIG[trace.trace_type] || TRACE_CONFIG.RECOMMENDATION;
              const Icon = config.icon;
              const isExpanded = expanded.has(trace.id);
              const tx = transactions.find((t) => t.id === trace.transaction_id);

              return (
                <motion.div
                  key={trace.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="relative pl-14 pb-6"
                >
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-4 w-5 h-5 rounded-full ${config.bg} flex items-center justify-center`}
                  >
                    <Icon className={`w-3 h-3 ${config.color}`} />
                  </div>

                  <button
                    onClick={() => toggle(trace.id)}
                    className="w-full glass p-4 text-left hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-semibold uppercase tracking-wider ${config.color}`}
                        >
                          {config.label}
                        </span>
                        {tx && (
                          <span className="text-xs text-white/30">
                            Order: {tx.order_id?.slice(0, 12)}...
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/30">
                          {trace.created_at
                            ? new Date(trace.created_at).toLocaleTimeString()
                            : ""}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-white/30" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-white/30" />
                        )}
                      </div>
                    </div>

                    {trace.instrument_selected && (
                      <p className="text-sm text-white/60 mt-1">
                        Instrument: {trace.instrument_selected}
                      </p>
                    )}

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                              {trace.reasoning}
                            </p>
                            {tx?.failure_code && trace.trace_type === "DIAGNOSIS" && (
                              <div className="mt-2 inline-flex items-center gap-1 bg-red-500/10 text-red-400 px-2 py-1 rounded text-xs">
                                Error: {tx.failure_code}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
