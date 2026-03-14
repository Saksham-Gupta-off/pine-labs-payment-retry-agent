import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  RefreshCw,
  DollarSign,
  Activity,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getDashboard } from "../api";

function AnimatedNumber({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const start = Date.now();
    const from = display;

    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [value]);

  return (
    <span>
      {prefix}
      {display.toLocaleString()}
    </span>
  );
}

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  SUCCESS: { color: "text-emerald-400 bg-emerald-500/10", label: "Success" },
  RECOVERED: { color: "text-amber-400 bg-amber-500/10", label: "Recovered" },
  FAILED: { color: "text-red-400 bg-red-500/10", label: "Failed" },
  PENDING: { color: "text-blue-400 bg-blue-500/10", label: "Pending" },
};

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const d = await getDashboard();
      setData(d);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading)
    return <div className="text-center py-12 text-white/40">Loading dashboard...</div>;

  if (!data)
    return <div className="text-center py-12 text-white/40">Failed to load dashboard</div>;

  // Payment method breakdown for chart
  const methodCounts: Record<string, number> = {};
  for (const tx of data.transactions || []) {
    const name = tx.instrument_name || tx.instrument_id;
    methodCounts[name] = (methodCounts[name] || 0) + 1;
  }
  const chartData = Object.entries(methodCounts).map(([name, count]) => ({
    name: name.length > 15 ? name.slice(0, 15) + "…" : name,
    count,
  }));

  const CHART_COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444"];

  const stats = [
    {
      icon: Activity,
      label: "Total Transactions",
      value: data.total_transactions,
      color: "text-blue-400",
    },
    {
      icon: RefreshCw,
      label: "Successful Recoveries",
      value: data.successful_recoveries,
      color: "text-amber-400",
    },
    {
      icon: DollarSign,
      label: "Money Saved",
      value: data.money_saved,
      prefix: "₹",
      color: "text-emerald-400",
    },
    {
      icon: TrendingUp,
      label: "Success Rate (After)",
      value: data.success_rate_after,
      suffix: "%",
      color: "text-emerald-400",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="glass p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-xs text-white/40 uppercase tracking-wider">
                  {stat.label}
                </span>
              </div>
              <div className={`text-2xl font-bold ${stat.color}`}>
                <AnimatedNumber
                  value={stat.value}
                  prefix={stat.prefix || ""}
                />
                {stat.suffix || ""}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Success rate comparison */}
      <div className="glass p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Success Rate Comparison</h2>
        <div className="flex items-center gap-8">
          <div className="flex-1">
            <p className="text-sm text-white/40 mb-1">Without PaySense</p>
            <div className="h-4 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${data.success_rate_before}%` }}
                transition={{ duration: 1, delay: 0.3 }}
                className="h-full bg-red-500/60 rounded-full"
              />
            </div>
            <p className="text-sm font-medium text-red-400 mt-1">
              {data.success_rate_before}%
            </p>
          </div>
          <ArrowUpRight className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-white/40 mb-1">With PaySense</p>
            <div className="h-4 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${data.success_rate_after}%` }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-full bg-emerald-500 rounded-full"
              />
            </div>
            <p className="text-sm font-medium text-emerald-400 mt-1">
              {data.success_rate_after}%
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment method chart */}
        {chartData.length > 0 && (
          <div className="glass p-6">
            <h2 className="text-lg font-semibold mb-4">Payment Methods Used</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#1e293b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Transaction history */}
        <div className="glass p-6">
          <h2 className="text-lg font-semibold mb-4">Transaction History</h2>
          {(data.transactions || []).length === 0 ? (
            <p className="text-white/40 text-sm">No transactions yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(data.transactions || []).map((tx: any) => {
                const badge = STATUS_BADGE[tx.status] || STATUS_BADGE.PENDING;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {tx.status === "SUCCESS" || tx.status === "RECOVERED" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {tx.instrument_name || tx.instrument_id}
                        </p>
                        <p className="text-xs text-white/30">
                          {tx.order_id?.slice(0, 16)}...
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        ₹{(tx.amount || 0).toLocaleString()}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
