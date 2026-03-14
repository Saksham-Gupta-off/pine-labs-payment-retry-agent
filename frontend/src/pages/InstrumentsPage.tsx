import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  CreditCard,
  Smartphone,
  Loader2,
  Wallet,
} from "lucide-react";
import { getInstruments, addInstrument, deleteInstrument } from "../api";

interface Instrument {
  id: string;
  type: string;
  name: string;
  handle?: string;
  last4?: string;
  icon: string;
  success_rate: number;
  recent_failures: number;
}

const ICON_COLORS: Record<string, string> = {
  phonepe: "bg-purple-600",
  icici: "bg-orange-600",
  axis: "bg-pink-600",
  hdfc: "bg-blue-600",
  sbi: "bg-blue-800",
  gpay: "bg-green-600",
};

const TYPE_OPTIONS = [
  { value: "UPI", label: "UPI" },
  { value: "Credit Card", label: "Credit Card" },
  { value: "Debit Card", label: "Debit Card" },
];

export default function InstrumentsPage() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Form state
  const [formType, setFormType] = useState("UPI");
  const [formName, setFormName] = useState("");
  const [formHandle, setFormHandle] = useState("");
  const [formLast4, setFormLast4] = useState("");
  const [formIcon, setFormIcon] = useState("");

  const load = async () => {
    try {
      const data = await getInstruments();
      setInstruments(data.instruments || data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteInstrument(id);
      setInstruments((prev) => prev.filter((i) => i.id !== id));
    } catch {}
    setDeleting(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formIcon.trim()) return;

    setAdding(true);
    try {
      const payload: any = {
        type: formType,
        name: formName.trim(),
        icon: formIcon.trim().toLowerCase(),
      };
      if (formType === "UPI") {
        payload.handle = formHandle.trim();
      } else {
        payload.last4 = formLast4.trim();
      }
      const result = await addInstrument(payload);
      if (result.instrument) {
        setInstruments((prev) => [...prev, result.instrument]);
      } else {
        await load();
      }
      setFormName("");
      setFormHandle("");
      setFormLast4("");
      setFormIcon("");
      setFormType("UPI");
    } catch {}
    setAdding(false);
  };

  const isCard = formType === "Credit Card" || formType === "Debit Card";

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Payment Instruments</h1>
      <p className="text-white/50 text-sm mb-6">
        Manage your saved payment methods
      </p>

      {loading ? (
        <div className="text-center py-12 text-white/40">Loading instruments...</div>
      ) : (
        <>
          {/* Instrument list */}
          <div className="space-y-3 mb-8">
            <AnimatePresence>
              {instruments.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8"
                >
                  <Wallet className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40 text-sm">No instruments added yet</p>
                </motion.div>
              )}
              {instruments.map((inst, idx) => (
                <motion.div
                  key={inst.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass p-4 flex items-center gap-4"
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${
                      ICON_COLORS[inst.icon] || "bg-gray-600"
                    }`}
                  >
                    {inst.icon.slice(0, 4).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{inst.name}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {inst.type}
                      {inst.last4 ? ` \u2022\u2022\u2022\u2022 ${inst.last4}` : ""}
                      {inst.handle ? ` \u00b7 ${inst.handle}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(inst.id)}
                    disabled={deleting === inst.id}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0 disabled:opacity-30"
                  >
                    {deleting === inst.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Add instrument form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass p-6"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              Add Instrument
            </h3>
            <form onSubmit={handleAdd} className="space-y-4">
              {/* Type */}
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">
                  Type
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-gray-900">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">
                  Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. ICICI Amazon Pay Card"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                />
              </div>

              {/* Conditional: UPI handle or last 4 */}
              {formType === "UPI" ? (
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">
                    UPI Handle
                  </label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="text"
                      value={formHandle}
                      onChange={(e) => setFormHandle(e.target.value)}
                      placeholder="name@okaxis"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">
                    Last 4 Digits
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="text"
                      value={formLast4}
                      onChange={(e) => setFormLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="1234"
                      maxLength={4}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Icon */}
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">
                  Bank Icon Code
                </label>
                <input
                  type="text"
                  value={formIcon}
                  onChange={(e) => setFormIcon(e.target.value)}
                  placeholder="icici, hdfc, axis, sbi, phonepe, gpay"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                />
                {formIcon && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-white/40">Preview:</span>
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs ${
                        ICON_COLORS[formIcon.trim().toLowerCase()] || "bg-gray-600"
                      }`}
                    >
                      {formIcon.trim().slice(0, 4).toUpperCase()}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={adding || !formName.trim() || !formIcon.trim()}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                {adding ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                Add Instrument
              </button>
            </form>
          </motion.div>
        </>
      )}
    </div>
  );
}
