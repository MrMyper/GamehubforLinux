import React, { useRef, useEffect, useState } from "react";
import { Terminal, Trash2, Copy, Check, ArrowDown } from "lucide-react";
import { LogEntry } from "../types/launcher";

interface TerminalConsoleProps {
  logs: LogEntry[];
  onClearLogs: () => void;
}

export const TerminalConsole: React.FC<TerminalConsoleProps> = ({ logs, onClearLogs }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleCopyLogs = async () => {
    const text = logs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.text}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLogColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "system":
        return "text-cyan-400 font-semibold";
      case "stderr":
        return "text-amber-400";
      case "error":
        return "text-rose-400 font-bold";
      case "stdout":
      default:
        return "text-slate-300";
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-[#070A0F] border border-slate-800/90 rounded-2xl overflow-hidden shadow-2xl">
      {/* Console Header Bar */}
      <div className="bg-[#0D121B] px-4 py-2.5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-300">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span>REALTIME PROCESS LOG</span>
          <span className="text-[11px] text-slate-500 font-normal">
            ({logs.length} entries)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Autoscroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? "Disable autoscroll" : "Enable autoscroll"}
            className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-mono transition-all cursor-pointer border ${
              autoScroll
                ? "bg-cyan-950/70 text-cyan-400 border-cyan-700/50"
                : "bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-slate-300"
            }`}
          >
            <ArrowDown className="w-3 h-3" />
            <span>Auto-scroll</span>
          </button>

          {/* Copy logs */}
          <button
            onClick={handleCopyLogs}
            title="Copy logs to clipboard"
            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-mono bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/50 transition-all cursor-pointer active:scale-95"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          {/* Clear logs */}
          <button
            onClick={onClearLogs}
            title="Clear terminal log"
            className="p-1 rounded-md bg-slate-800/60 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700/50 hover:border-rose-800/60 transition-all cursor-pointer active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        ref={containerRef}
        className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1 select-text bg-[#070A0F]"
        style={{ minHeight: "180px", maxHeight: "280px" }}
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 italic">No output yet. Launcher ready.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2.5 leading-relaxed font-mono">
              <span className="text-slate-600 select-none shrink-0 text-[11px] pt-0.5">
                {log.timestamp}
              </span>
              <span className={`break-all ${getLogColor(log.level)}`}>{log.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
