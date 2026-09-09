import React from "react";
import { DownloadProgress } from "../types/launcher";
import { Download, AlertCircle, CheckCircle2 } from "lucide-react";

interface ProgressBarProps {
  progress: DownloadProgress | null;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  if (!progress) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const isCompleted = progress.percentage >= 100;
  const isRetrying = (progress.retry_count || 0) > 0;

  return (
    <div className="w-full bg-[#111622] border border-blue-900/40 rounded-2xl p-4 shadow-xl transition-all duration-300">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <Download className="w-4 h-4 text-cyan-400 animate-bounce" />
          )}
          <span className="text-xs font-semibold text-slate-200">
            {progress.status || "Downloading..."}
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800/60 text-cyan-300">
            {progress.version}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          {isRetrying && (
            <span className="flex items-center gap-1 text-amber-400 font-semibold animate-pulse">
              <AlertCircle className="w-3.5 h-3.5" />
              Retry #{progress.retry_count}
            </span>
          )}
          <span className="text-slate-400">
            {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}
          </span>
          <span className="font-bold text-cyan-400 min-w-[45px] text-right">
            {progress.percentage.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Track */}
      <div className="w-full h-2.5 bg-slate-900/90 rounded-full overflow-hidden p-0.5 border border-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-200 ${
            isCompleted
              ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_#10b981]"
              : isRetrying
              ? "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_10px_#f59e0b]"
              : "bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-400 shadow-[0_0_12px_#00d2ff]"
          }`}
          style={{ width: `${Math.min(100, Math.max(0, progress.percentage))}%` }}
        />
      </div>
    </div>
  );
};
