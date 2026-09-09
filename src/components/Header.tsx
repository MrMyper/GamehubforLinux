import React from "react";
import { Shield, Sparkles, AppWindow, CheckCircle2, RefreshCw } from "lucide-react";
import { LauncherStatus, LauncherPaths } from "../types/launcher";

interface HeaderProps {
  status: LauncherStatus;
  paths: LauncherPaths | null;
  onRefreshReleases: () => void;
  onCreateShortcut: () => void;
  shortcutCreated: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  paths,
  onRefreshReleases,
  onCreateShortcut,
  shortcutCreated,
}) => {
  const getStatusBadge = () => {
    switch (status) {
      case "idle":
        return {
          text: "READY",
          bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
          dot: "bg-emerald-400 shadow-[0_0_8px_#34d399]",
        };
      case "running":
        return {
          text: "RUNNING",
          bg: "bg-cyan-500/15 border-cyan-500/40 text-cyan-300 animate-pulse",
          dot: "bg-cyan-400 shadow-[0_0_12px_#22d3ee]",
        };
      case "downloading_proton":
        return {
          text: "DOWNLOADING PROTON",
          bg: "bg-blue-500/15 border-blue-500/40 text-blue-300",
          dot: "bg-blue-400 shadow-[0_0_10px_#60a5fa] animate-ping",
        };
      case "installing_bnet":
        return {
          text: "INSTALLING BNET",
          bg: "bg-purple-500/15 border-purple-500/40 text-purple-300",
          dot: "bg-purple-400 shadow-[0_0_10px_#c084fc]",
        };
      case "launching":
        return {
          text: "LAUNCHING",
          bg: "bg-amber-500/15 border-amber-500/40 text-amber-300",
          dot: "bg-amber-400 shadow-[0_0_10px_#f59e0b]",
        };
      case "stopping":
        return {
          text: "STOPPING",
          bg: "bg-rose-500/15 border-rose-500/40 text-rose-300",
          dot: "bg-rose-400 shadow-[0_0_10px_#f43f5e]",
        };
      default:
        return {
          text: "IDLE",
          bg: "bg-slate-500/15 border-slate-500/30 text-slate-400",
          dot: "bg-slate-400",
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <header className="w-full bg-[#0D121D]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-4 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3.5">
        {/* Battle.net custom stylized icon badge */}
        <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 p-[1px] shadow-[0_0_15px_rgba(0,116,224,0.4)]">
          <div className="w-full h-full bg-[#0B0F19] rounded-[11px] flex items-center justify-center">
            <Shield className="w-6 h-6 text-cyan-400" />
          </div>
          <Sparkles className="w-3.5 h-3.5 text-cyan-300 absolute -top-1 -right-1 animate-pulse" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 uppercase">
              Multi-Launcher
            </h1>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-medium tracking-wide bg-blue-950/60 text-cyan-400 border border-cyan-500/30">
              Linux Gaming
            </span>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
            <span title={paths?.prefix_path || "~/.local/share/bnet-linux-launcher/prefixes"}>
              Isolated Prefixes
            </span>
            <span className="text-slate-600">•</span>
            <span>Proton-GE Runner</span>
            <span className="text-slate-600">•</span>
            <span>XDG Compliant</span>
          </p>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Desktop shortcut button */}
        <button
          onClick={onCreateShortcut}
          title="Add or update .desktop shortcut in ~/.local/share/applications"
          className="group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 text-slate-300 transition-all cursor-pointer shadow-sm active:scale-95"
        >
          {shortcutCreated ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AppWindow className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
          )}
          <span>{shortcutCreated ? "Shortcut Active" : "Desktop Shortcut"}</span>
        </button>

        {/* Refresh releases */}
        <button
          onClick={onRefreshReleases}
          title="Refresh Proton releases"
          className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Dynamic Status Indicator */}
        <div
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono font-semibold tracking-wider ${badge.bg} transition-all duration-300`}
        >
          <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
          {badge.text}
        </div>
      </div>
    </header>
  );
};
