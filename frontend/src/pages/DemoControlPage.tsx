import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Wifi,
  CreditCard,
  Building2,
  Smartphone,
  ShieldOff,
  Trash2,
  Plus,
  X,
  ChevronDown,
} from "lucide-react";
import {
  armFailure,
  removeRule,
  clearFailure,
  getDemoStatus,
  clearTransactions,
  getInstruments,
} from "../api";

const FAILURE_TYPES = [
  {
    code: "INVALID_USER_ACCOUNT",
    label: "UPI Handle Inactive",
    description: "Inactive or unregistered UPI handle",
    icon: Smartphone,
    color: "purple",
  },
  {
    code: "AMOUNT_LIMIT_EXCEEDED",
    label: "Card Limit Exceeded",
    description: "Transaction exceeds card spending limit",
    icon: CreditCard,
    color: "amber",
  },
  {
    code: "ISSUER_NOT_SUPPORTED",
    label: "Bank Downtime",
    description: "Issuer bank temporarily unavailable",
    icon: Building2,
    color: "red",
  },
  {
    code: "TIMED_OUT",
    label: "Network Timeout",
    description: "Payment request timed out",
    icon: Wifi,
    color: "blue",
  },
  {
    code: "INSUFFICIENT_FUNDS",
    label: "Insufficient Funds",
    description: "Not enough balance in account",
    icon: CreditCard,
    color: "orange",
  },
  {
    code: "PAYMENT_DECLINED",
    label: "Payment Declined",
    description: "Declined by issuer bank",
    icon: AlertTriangle,
    color: "rose",
  },
];

const INSTRUMENT_TYPE_OPTIONS = [
  { value: "", label: "Any instrument" },
  { value: "UPI", label: "UPI only" },
  { value: "Credit Card", label: "Credit Cards only" },
  { value: "Debit Card", label: "Debit Cards only" },
];

interface QueueRule {
  error_code: string;
  remaining: number;
  original_count: number;
  instrument_type: string | null;
  instrument_id: string | null;
}

interface Instrument {
  id: string;
  name: string;
  type: string;
}

export default function DemoControlPage() {
  const [queue, setQueue] = useState<QueueRule[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add-rule form state
  const [selectedError, setSelectedError] = useState(FAILURE_TYPES[0].code);
  const [count, setCount] = useState(1);
  const [filterMode, setFilterMode] = useState<"any" | "type" | "specific">("any");
  const [instrumentType, setInstrumentType] = useState("");
  const [instrumentId, setInstrumentId] = useState("");

  const refresh = async () => {
    const status = await getDemoStatus();
    setQueue(status.queue || []);
  };

  useEffect(() => {
    refresh();
    getInstruments().then((d) => setInstruments(d.instruments || []));
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAddRule = async () => {
    setLoading(true);
    await armFailure(
      selectedError,
      count,
      filterMode === "type" ? instrumentType : undefined,
      filterMode === "specific" ? instrumentId : undefined
    );
    await refresh();
    setLoading(false);
    setShowAddForm(false);
    // Reset form
    setCount(1);
    setFilterMode("any");
    setInstrumentType("");
    setInstrumentId("");
  };

  const handleQuickArm = async (code: string) => {
    setLoading(true);
    await armFailure(code, 1);
    await refresh();
    setLoading(false);
  };

  const handleRemoveRule = async (index: number) => {
    await removeRule(index);
    await refresh();
  };

  const handleClear = async () => {
    await clearFailure();
    await refresh();
  };

  const handleReset = async () => {
    await clearFailure();
    await clearTransactions();
    await refresh();
  };

  const getFailureInfo = (code: string) =>
    FAILURE_TYPES.find((f) => f.code === code) || FAILURE_TYPES[0];

  const colorClasses: Record<string, { border: string; bg: string; text: string; dot: string }> = {
    purple: { border: "border-purple-500/40", bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-500" },
    amber: { border: "border-amber-500/40", bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-500" },
    red: { border: "border-red-500/40", bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-500" },
    blue: { border: "border-blue-500/40", bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-500" },
    orange: { border: "border-orange-500/40", bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-500" },
    rose: { border: "border-rose-500/40", bg: "bg-rose-500/10", text: "text-rose-400", dot: "bg-rose-500" },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Demo Control Panel</h1>
          <p className="text-white/50 text-sm mt-1">
            Queue multiple failure scenarios for payment simulation
          </p>
        </div>
      </div>

      {/* ── Current Queue ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide">
            Failure Queue ({queue.length} rule{queue.length !== 1 ? "s" : ""})
          </h2>
          {queue.length > 0 && (
            <button
              onClick={handleClear}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Clear All
            </button>
          )}
        </div>

        {queue.length === 0 ? (
          <motion.div
            layout
            className="glass p-6 border-2 border-emerald-500/40 bg-emerald-500/5 text-center"
          >
            <ShieldOff className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="font-semibold text-emerald-400">No Failures Queued</p>
            <p className="text-sm text-white/50 mt-1">
              Payments will proceed normally through Pine Labs
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {queue.map((rule, idx) => {
                const info = getFailureInfo(rule.error_code);
                const Icon = info.icon;
                const c = colorClasses[info.color] || colorClasses.red;
                const instName = rule.instrument_id
                  ? instruments.find((i) => i.id === rule.instrument_id)?.name || rule.instrument_id
                  : null;

                return (
                  <motion.div
                    key={`${idx}-${rule.error_code}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={`glass p-4 border-l-4 ${c.border} flex items-center gap-3`}
                  >
                    <Icon className={`w-5 h-5 ${c.text} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-sm ${c.text}`}>
                          {info.label}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
                          {rule.remaining}x left
                        </span>
                        {rule.remaining !== rule.original_count && (
                          <span className="text-xs text-white/30">
                            (of {rule.original_count})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/40 mt-0.5 flex items-center gap-2">
                        <code>{rule.error_code}</code>
                        {rule.instrument_type && (
                          <span className="bg-white/10 px-1.5 py-0.5 rounded">
                            {rule.instrument_type}
                          </span>
                        )}
                        {instName && (
                          <span className="bg-white/10 px-1.5 py-0.5 rounded truncate">
                            {instName}
                          </span>
                        )}
                        {!rule.instrument_type && !rule.instrument_id && (
                          <span className="text-white/30">any instrument</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveRule(idx)}
                      className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Add Rule Form ── */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="glass p-5 border-2 border-white/10 space-y-4">
              <h3 className="font-semibold text-sm">Add Failure Rule</h3>

              {/* Error Type */}
              <div>
                <label className="text-xs text-white/50 block mb-1.5">Error Type</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {FAILURE_TYPES.map((ft) => {
                    const Icon = ft.icon;
                    const c = colorClasses[ft.color] || colorClasses.red;
                    const selected = selectedError === ft.code;
                    return (
                      <button
                        key={ft.code}
                        onClick={() => setSelectedError(ft.code)}
                        className={`p-3 rounded-lg border text-left transition-all text-sm ${
                          selected
                            ? `${c.border} ${c.bg} ${c.text}`
                            : "border-white/10 text-white/50 hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="w-4 h-4" />
                          <span className="font-medium">{ft.label}</span>
                        </div>
                        <p className="text-xs opacity-60">{ft.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Count */}
              <div>
                <label className="text-xs text-white/50 block mb-1.5">
                  Number of times to fire
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 5, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCount(n)}
                      className={`w-10 h-10 rounded-lg border text-sm font-semibold transition-all ${
                        count === n
                          ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                          : "border-white/10 text-white/50 hover:border-white/20"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={count}
                    onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 h-10 rounded-lg border border-white/10 bg-white/5 text-center text-sm text-white px-2"
                  />
                </div>
              </div>

              {/* Instrument Filter */}
              <div>
                <label className="text-xs text-white/50 block mb-1.5">
                  Apply to which instruments?
                </label>
                <div className="flex gap-2 mb-2">
                  {(
                    [
                      ["any", "Any"],
                      ["type", "By Type"],
                      ["specific", "Specific"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setFilterMode(mode)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        filterMode === mode
                          ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                          : "border-white/10 text-white/50 hover:border-white/20"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {filterMode === "type" && (
                  <div className="flex gap-2">
                    {INSTRUMENT_TYPE_OPTIONS.filter((o) => o.value).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setInstrumentType(opt.value)}
                        className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
                          instrumentType === opt.value
                            ? "border-blue-500 bg-blue-500/20 text-blue-400"
                            : "border-white/10 text-white/50 hover:border-white/20"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {filterMode === "specific" && (
                  <div className="grid grid-cols-2 gap-2">
                    {instruments.map((inst) => (
                      <button
                        key={inst.id}
                        onClick={() => setInstrumentId(inst.id)}
                        className={`p-2 rounded-lg border text-xs text-left transition-all ${
                          instrumentId === inst.id
                            ? "border-blue-500 bg-blue-500/20 text-blue-400"
                            : "border-white/10 text-white/50 hover:border-white/20"
                        }`}
                      >
                        <div className="font-medium">{inst.name}</div>
                        <div className="opacity-50">{inst.type}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleAddRule}
                  disabled={loading || (filterMode === "type" && !instrumentType) || (filterMode === "specific" && !instrumentId)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 text-white py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Rule
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white/80 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full glass py-3 mb-6 font-medium flex items-center justify-center gap-2 text-emerald-400 hover:bg-emerald-500/10 transition-colors border-2 border-dashed border-emerald-500/30"
        >
          <Plus className="w-4 h-4" />
          Add Failure Rule
        </button>
      )}

      {/* ── Quick Arm (one-click shortcuts) ── */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">
          Quick Arm (1-shot, any instrument)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {FAILURE_TYPES.map((ft) => {
            const Icon = ft.icon;
            const c = colorClasses[ft.color] || colorClasses.red;
            return (
              <button
                key={ft.code}
                onClick={() => handleQuickArm(ft.code)}
                disabled={loading}
                className={`glass p-3 text-left border transition-all hover:${c.bg} ${c.border}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${c.text}`} />
                  <span className={`font-medium text-sm ${c.text}`}>{ft.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-4">
        <button
          onClick={handleClear}
          disabled={queue.length === 0}
          className="flex-1 glass py-3 px-6 font-medium flex items-center justify-center gap-2 hover:bg-white/10 transition-colors disabled:opacity-30"
        >
          <ShieldOff className="w-4 h-4" />
          Disarm All
        </button>
        <button
          onClick={handleReset}
          className="flex-1 glass py-3 px-6 font-medium flex items-center justify-center gap-2 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Reset Everything
        </button>
      </div>
    </div>
  );
}
