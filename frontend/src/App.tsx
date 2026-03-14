import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { Zap, Activity, BarChart3, Settings, Wallet } from "lucide-react";
import CheckoutPage from "./pages/CheckoutPage";
import TracePage from "./pages/TracePage";
import DashboardPage from "./pages/DashboardPage";
import DemoControlPage from "./pages/DemoControlPage";
import InstrumentsPage from "./pages/InstrumentsPage";

const tabs = [
  { to: "/", icon: Zap, label: "Checkout" },
  { to: "/instruments", icon: Wallet, label: "Instruments" },
  { to: "/trace", icon: Activity, label: "Reasoning Trace" },
  { to: "/dashboard", icon: BarChart3, label: "Dashboard" },
  { to: "/demo", icon: Settings, label: "Demo Control" },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-emerald-400" />
            <span className="text-xl font-bold tracking-tight">
              Pay<span className="text-emerald-400">Sense</span>
            </span>
            <span className="text-xs text-white/40 ml-2">
              Autonomous Payment Intelligence
            </span>
          </div>
          <nav className="flex gap-1">
            {tabs.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-white/10 text-emerald-400"
                      : "text-white/50 hover:text-white/80 hover:bg-white/5"
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<CheckoutPage />} />
            <Route path="/instruments" element={<InstrumentsPage />} />
            <Route path="/trace" element={<TracePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/demo" element={<DemoControlPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
