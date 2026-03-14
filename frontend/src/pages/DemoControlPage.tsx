import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Wifi,
  CreditCard,
  Building2,
  Smartphone,
  ShieldOff,
  Trash2,
} from "lucide-react";
import {
  armFailure,
  clearFailure,
  getDemoStatus,
  clearTransactions,
} from "../api";

const FAILURE_TYPES = [
  {
    code: "INVALID_USER_ACCOUNT",
    label: "UPI Handle Inactive",
    description: "Simulates an inactive or unregistered UPI handle",
    icon: Smartphone,
    color: "border-purple-500/50 hover:bg-purple-500/10",
    activeColor: "border-purple-400 bg-purple-500/20",
    badge: "text-purple-400",
  },
  {
    code: "AMOUNT_LIMIT_EXCEEDED",
    label: "Card Limit Exceeded",
    description: "Simulates transaction exceeding card spending limit",
    icon: CreditCard,
    color: "border-amber-500/50 hover:bg-amber-500/10",
    activeColor: "border-amber-400 bg-amber-500/20",
    badge: "text-amber-400",
  },
  {
    code: "ISSUER_NOT_SUPPORTED",
    label: "Bank Downtime",
    description: "Simulates issuer bank being temporarily unavailable",
    icon: Building2,
    color: "border-red-500/50 hover:bg-red-500/10",
    activeColor: "border-red-400 bg-red-500/20",
    badge: "text-red-400",
  },
  {
    code: "TIMED_OUT",
    label: "Network Timeout",
    description: "Simulates a payment request timing out",
    icon: Wifi,
    color: "border-blue-500/50 hover:bg-blue-500/10",
    activeColor: "border-blue-400 bg-blue-500/20",
    badge: "text-blue-400",
  },
];

export default function DemoControlPage() {
  const [armed, setArmed] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    getDemoStatus().then((d) => setArmed(d.armed_failure));
    const interval = setInterval(() => {
      getDemoStatus().then((d) => setArmed(d.armed_failure));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleArm = async (code: string) => {
    setLoading(code);
    await armFailure(code);
    setArmed(code);
    setLoading(null);
  };

  const handleClear = async () => {
    setLoading("clear");
    await clearFailure();
    setArmed(null);
    setLoading(null);
  };

  const handleReset = async () => {
    await clearFailure();
    await clearTransactions();
    setArmed(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Demo Control Panel</h1>
          <p className="text-white/50 text-sm mt-1">
            Arm failure types to simulate during the next payment
          </p>
        </div>
      </div>

      {/* Current status */}
      <motion.div
        layout
        className={`glass p-6 mb-8 border-2 transition-colors ${
          armed
            ? "border-red-500/40 bg-red-500/5"
            : "border-emerald-500/40 bg-emerald-500/5"
        }`}
      >
        <div className="flex items-center gap-3">
          {armed ? (
            <>
              <div className="relative">
                <AlertTriangle className="w-8 h-8 text-red-400" />
                <motion.div
                  className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
              </div>
              <div>
                <p className="font-semibold text-red-400">Failure Armed</p>
                <p className="text-sm text-white/60">
                  Next payment will fail with:{" "}
                  <code className="bg-white/10 px-2 py-0.5 rounded text-red-300">
                    {armed}
                  </code>
                </p>
              </div>
            </>
          ) : (
            <>
              <ShieldOff className="w-8 h-8 text-emerald-400" />
              <div>
                <p className="font-semibold text-emerald-400">No Failure Armed</p>
                <p className="text-sm text-white/60">
                  Next payment will succeed normally
                </p>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Failure type buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {FAILURE_TYPES.map((ft, idx) => {
          const Icon = ft.icon;
          const isActive = armed === ft.code;

          return (
            <motion.button
              key={ft.code}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => handleArm(ft.code)}
              disabled={loading !== null}
              className={`glass p-5 text-left border-2 transition-all ${
                isActive ? ft.activeColor : ft.color
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <Icon className={`w-5 h-5 ${ft.badge}`} />
                <span className={`font-semibold ${ft.badge}`}>{ft.label}</span>
                {isActive && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full ml-auto"
                  >
                    ARMED
                  </motion.span>
                )}
              </div>
              <p className="text-sm text-white/50">{ft.description}</p>
              <p className="text-xs text-white/30 mt-2 font-mono">{ft.code}</p>
            </motion.button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleClear}
          disabled={!armed || loading !== null}
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
