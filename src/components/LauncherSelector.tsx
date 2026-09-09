import React from "react";
import { LauncherProfile } from "../types/launcher";
import {
  Shield,
  Gamepad2,
  Flame,
  Wrench,
  Sparkles,
  Plus,
  Trash2,
} from "lucide-react";

interface LauncherSelectorProps {
  profiles: LauncherProfile[];
  activeProfileId: string;
  onSelectProfile: (id: string) => void;
  installedStatus: Record<string, boolean>;
  onAddCustomProfile?: () => void;
  onDeleteProfile?: (id: string, name: string) => void;
}

const BUILT_IN_PROFILES = new Set(["battlenet", "ubisoft", "ea", "wargaming"]);

export const LauncherSelector: React.FC<LauncherSelectorProps> = ({
  profiles,
  activeProfileId,
  onSelectProfile,
  installedStatus,
  onAddCustomProfile,
  onDeleteProfile,
}) => {
  const getIcon = (id: string) => {
    switch (id) {
      case "battlenet":
        return <Shield className="w-4 h-4 text-cyan-400 shrink-0" />;
      case "ubisoft":
        return <Gamepad2 className="w-4 h-4 text-blue-400 shrink-0" />;
      case "ea":
        return <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />;
      case "wargaming":
        return <Flame className="w-4 h-4 text-amber-400 shrink-0" />;
      default:
        return <Wrench className="w-4 h-4 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div className="w-full bg-[#0B0E16] border border-slate-800/80 rounded-2xl p-2 flex items-center gap-2 overflow-x-auto shadow-inner custom-scrollbar">
      {profiles.map((profile) => {
        const isActive = profile.id === activeProfileId;
        const isInstalled = installedStatus[profile.id] ?? false;
        const isCustom = !BUILT_IN_PROFILES.has(profile.id);

        return (
          <div
            key={profile.id}
            onClick={() => onSelectProfile(profile.id)}
            className={`group relative flex-1 min-w-[150px] max-w-[220px] py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer border select-none ${
              isActive
                ? "bg-gradient-to-r from-blue-950/80 to-slate-900 border-cyan-500/60 text-white shadow-[0_0_15px_rgba(0,180,255,0.25)] ring-1 ring-cyan-500/30"
                : "bg-slate-900/40 hover:bg-slate-900/80 border-slate-800/60 text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              {getIcon(profile.id)}
              <span className="truncate" title={profile.name}>{profile.name}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  isInstalled
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-slate-800 text-slate-400 border border-slate-700/40"
                }`}
              >
                {isInstalled ? "Ready" : "Setup"}
              </span>

              {isCustom && onDeleteProfile && (
                <button
                  type="button"
                  title={`Delete profile '${profile.name}'`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteProfile(profile.id, profile.name);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 p-1 rounded transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Add Custom App Button */}
      {onAddCustomProfile && (
        <button
          type="button"
          onClick={onAddCustomProfile}
          title="Add a custom game or launcher application"
          className="shrink-0 py-2.5 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-dashed border-cyan-600/40 hover:border-cyan-400/80 text-cyan-400 hover:text-cyan-300 bg-cyan-950/20 hover:bg-cyan-950/40"
        >
          <Plus className="w-4 h-4" />
          <span>Add App</span>
        </button>
      )}
    </div>
  );
};

