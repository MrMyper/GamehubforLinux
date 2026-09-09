import React, { useState, useEffect, useMemo } from "react";
import {
  Play,
  Download,
  Square,
  Cpu,
  Terminal,
  HardDrive,
  AlertTriangle,
  Loader2,
  Check,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Sliders,
  FileCode2,
  FolderSearch,
  RotateCcw,
  Trash2,
  X,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import { ProtonRelease, LauncherStatus, LauncherProfile, ResolvedExeInfo } from "../types/launcher";
import { launcherApi } from "../services/api";

interface ControlDeckProps {
  activeProfile: LauncherProfile;
  releases: ProtonRelease[];
  onUpdateProfile: (updated: Partial<LauncherProfile>) => void;
  isLauncherInstalled: boolean;
  status: LauncherStatus;
  onMainAction: () => void;
  onKillProcesses: () => void;
  onOpenFolder: () => void;
  onReinstallLauncher?: () => void;
  onUninstallLauncher?: () => void;
}

const PRESET_FLAGS = [
  {
    label: "Nvidia Dedicated GPU",
    value: "__NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia",
    check: "__NV_PRIME_RENDER_OFFLOAD=1",
  },
  {
    label: "Max Frames=1",
    value: "__GL_MaxFramesAllowed=1",
    check: "__GL_MaxFramesAllowed=1",
  },
  {
    label: "MangoHud 60 FPS",
    value: 'MANGOHUD=1 MANGOHUD_CONFIG="fps_limit=60,no_display=1"',
    check: "MANGOHUD=1",
  },
  { label: "DXVK HUD", value: "DXVK_HUD=fps", check: "DXVK_HUD=fps" },
  { label: "Fsync", value: "WINEFSYNC=1", check: "WINEFSYNC=1" },
  { label: "FSR Upscaling", value: "WINE_FULLSCREEN_FSR=1", check: "WINE_FULLSCREEN_FSR=1" },
  { label: "Gamemode", value: "gamemoderun", check: "gamemoderun" },
];

export const ControlDeck: React.FC<ControlDeckProps> = ({
  activeProfile,
  releases,
  onUpdateProfile,
  isLauncherInstalled,
  status,
  onMainAction,
  onKillProcesses,
  onOpenFolder,
  onReinstallLauncher,
  onUninstallLauncher,
}) => {
  const [showAdvanced, setShowAdvanced] = useState<boolean>(true);
  const [resolvedExe, setResolvedExe] = useState<ResolvedExeInfo | null>(null);
  const [isBrowsing, setIsBrowsing] = useState<boolean>(false);
  const [confirmAction, setConfirmAction] = useState<"reinstall" | "uninstall" | null>(null);

  // Load active executable info whenever profile or custom_exe_path changes
  useEffect(() => {
    let mounted = true;
    async function fetchResolved() {
      try {
        const info = await launcherApi.getResolvedLauncherExe(activeProfile.id);
        if (mounted) setResolvedExe(info);
      } catch {
        if (mounted) setResolvedExe(null);
      }
    }
    fetchResolved();
    return () => {
      mounted = false;
    };
  }, [activeProfile.id, activeProfile.custom_exe_path, isLauncherInstalled]);

  const selectedRelease = releases.find((r) => r.tag_name === activeProfile.selected_proton);
  const isSelectedProtonInstalled = selectedRelease?.is_installed ?? false;

  const handleTogglePreset = (preset: (typeof PRESET_FLAGS)[0]) => {
    const trimmed = activeProfile.env_args.trim();
    if (trimmed.includes(preset.check)) {
      let updated = trimmed;
      for (const part of preset.value.split(/\s+/)) {
        updated = updated.replace(part, "");
      }
      onUpdateProfile({ env_args: updated.replace(/\s+/g, " ").trim() });
    } else {
      const updated = trimmed ? `${trimmed} ${preset.value}` : preset.value;
      onUpdateProfile({ env_args: updated });
    }
  };

  const handleBrowseExe = async () => {
    try {
      setIsBrowsing(true);
      const chosen = await launcherApi.browseExecutableFile();
      if (chosen) {
        onUpdateProfile({ custom_exe_path: chosen });
      }
    } finally {
      setIsBrowsing(false);
    }
  };

  // Group Proton releases into clean series: Valve, GE-11, GE-10, GE-9, GE-8, Other
  const protonGroups = useMemo(() => {
    const valveGroup: ProtonRelease[] = [];
    const ge11Group: ProtonRelease[] = [];
    const ge10Group: ProtonRelease[] = [];
    const ge9Group: ProtonRelease[] = [];
    const ge8Group: ProtonRelease[] = [];
    const otherGroup: ProtonRelease[] = [];

    for (const rel of releases) {
      const tag = rel.tag_name;
      const cat = rel.category || "";

      if (cat === "valve" || tag.startsWith("Proton ") || tag.includes("Proton -") || tag.includes("Proton Hotfix")) {
        valveGroup.push(rel);
      } else if (cat === "ge-11" || tag.includes("11-") || tag.includes("11.")) {
        ge11Group.push(rel);
      } else if (cat === "ge-10" || tag.includes("10-") || tag.includes("10.")) {
        ge10Group.push(rel);
      } else if (cat === "ge-9" || tag.includes("9-") || tag.includes("9.")) {
        ge9Group.push(rel);
      } else if (cat === "ge-8" || tag.includes("8-") || tag.includes("8.")) {
        ge8Group.push(rel);
      } else {
        otherGroup.push(rel);
      }
    }

    return [
      { label: "Valve Proton (Steam / System)", items: valveGroup },
      { label: "GE-Proton 11 Series", items: ge11Group },
      { label: "GE-Proton 10 Series", items: ge10Group },
      { label: "GE-Proton 9 Series", items: ge9Group },
      { label: "GE-Proton 8 Series", items: ge8Group },
      { label: "Other Runners", items: otherGroup },
    ].filter((g) => g.items.length > 0);
  }, [releases]);

  const getMainButtonConfig = () => {
    if (status === "running") {
      return {
        label: `${activeProfile.name} Active`,
        icon: <Loader2 className="w-5 h-5 animate-spin" />,
        className: "bg-emerald-600/90 text-white cursor-default shadow-[0_0_20px_rgba(16,185,129,0.3)]",
        disabled: true,
      };
    }

    if (status === "downloading_proton") {
      return {
        label: "Downloading Proton...",
        icon: <Loader2 className="w-5 h-5 animate-spin" />,
        className: "bg-blue-600/80 text-white cursor-wait",
        disabled: true,
      };
    }

    if (status === "installing_bnet") {
      return {
        label: `Installing ${activeProfile.name}...`,
        icon: <Loader2 className="w-5 h-5 animate-spin" />,
        className: "bg-purple-600/80 text-white cursor-wait",
        disabled: true,
      };
    }

    if (status === "launching") {
      return {
        label: "Launching...",
        icon: <Loader2 className="w-5 h-5 animate-spin" />,
        className: "bg-cyan-600/80 text-white cursor-wait",
        disabled: true,
      };
    }

    if (!isSelectedProtonInstalled) {
      return {
        label: `Download ${activeProfile.selected_proton || "Proton"}`,
        icon: <Download className="w-5 h-5" />,
        className:
          "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-[0_0_25px_rgba(0,116,224,0.4)] active:scale-[0.98]",
        disabled: false,
      };
    }

    if (!isLauncherInstalled && !activeProfile.custom_exe_path) {
      return {
        label: `Install ${activeProfile.name}`,
        icon: <Download className="w-5 h-5" />,
        className:
          "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-[0_0_25px_rgba(99,102,241,0.4)] active:scale-[0.98]",
        disabled: false,
      };
    }

    return {
      label: `Launch ${activeProfile.name}`,
      icon: <Play className="w-5 h-5 fill-current" />,
      className:
        "bg-gradient-to-r from-[#0074E0] to-[#00D2FF] hover:from-[#0082FB] hover:to-[#22DCFF] text-white shadow-[0_0_30px_rgba(0,180,255,0.45)] hover:shadow-[0_0_35px_rgba(0,210,255,0.6)] active:scale-[0.98]",
      disabled: false,
    };
  };

  const btn = getMainButtonConfig();

  return (
    <div className="w-full bg-[#111622]/95 border border-slate-800/90 rounded-2xl p-6 shadow-2xl backdrop-blur-sm flex flex-col gap-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configuration Controls */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* Proton Selection with series grouping */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <label htmlFor="proton-select" className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>PROTON RUNNER VERSION (VALVE 8-11 & GE-PROTON 8-11)</span>
              </label>
              {isSelectedProtonInstalled ? (
                <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-mono">
                  <Check className="w-3.5 h-3.5" /> Ready / Installed locally
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400 text-[11px] font-mono">
                  <AlertTriangle className="w-3.5 h-3.5" /> Will download on launch
                </span>
              )}
            </div>

            <div className="relative">
              <select
                id="proton-select"
                value={activeProfile.selected_proton || ""}
                onChange={(e) => onUpdateProfile({ selected_proton: e.target.value })}
                className="w-full bg-[#090C12] border border-slate-700/80 hover:border-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 rounded-xl px-4 py-3 text-sm text-slate-100 appearance-none transition-all cursor-pointer outline-none font-medium"
              >
                {protonGroups.length === 0 ? (
                  <option value="">Loading releases...</option>
                ) : (
                  protonGroups.map((group) => (
                    <optgroup key={group.label} label={group.label} className="bg-[#0B0F18] text-cyan-400 font-semibold">
                      {group.items.map((rel) => (
                        <option
                          key={rel.tag_name}
                          value={rel.tag_name}
                          className="bg-[#090C12] text-slate-100 font-normal py-1"
                        >
                          {rel.name} {rel.is_installed ? "[Installed]" : "[Download]"}
                        </option>
                      ))}
                    </optgroup>
                  ))
                )}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Environment Variables & Presets */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <label htmlFor="env-args-input" className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>ENVIRONMENT VARIABLES (WINE/PROTON)</span>
              </label>
              <span className="text-[11px] font-mono text-slate-400">WINEPREFIX isolated per launcher</span>
            </div>

            <input
              id="env-args-input"
              type="text"
              value={activeProfile.env_args}
              onChange={(e) => onUpdateProfile({ env_args: e.target.value })}
              placeholder="e.g. __NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia DXVK_HUD=fps"
              className="w-full bg-[#090C12] border border-slate-700/80 hover:border-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 rounded-xl px-4 py-2.5 text-xs font-mono text-cyan-300 placeholder-slate-600 transition-all outline-none"
            />

            {/* Preset quick toggles */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-400 font-medium mr-1">Presets:</span>
              {PRESET_FLAGS.map((preset) => {
                const isActive = activeProfile.env_args.includes(preset.check);
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handleTogglePreset(preset)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-mono font-medium transition-all cursor-pointer border ${
                      isActive
                        ? "bg-cyan-950/80 border-cyan-500/60 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                        : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600"
                    }`}
                  >
                    {isActive ? (
                      <span className="flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>{preset.label}</span>
                      </span>
                    ) : (
                      `+ ${preset.label}`
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Hero Actions & Controls */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-4 bg-[#0A0D15] border border-slate-800/80 rounded-xl p-5">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-mono tracking-wider text-slate-400 font-semibold uppercase flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
              Platform Status ({activeProfile.name})
            </span>
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-900/70 border border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Executable:</span>
                <span
                  className={
                    resolvedExe?.exists
                      ? "text-emerald-400 font-mono font-medium truncate max-w-[140px]"
                      : "text-amber-400 font-mono font-medium"
                  }
                  title={resolvedExe?.path || undefined}
                >
                  {resolvedExe?.exists
                    ? resolvedExe.is_custom
                      ? "Custom (.exe ready)"
                      : "Installed (.exe ready)"
                    : isLauncherInstalled
                    ? "Installed"
                    : "Not Installed"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Runner:</span>
                <span className="text-slate-200 font-mono font-medium truncate max-w-[140px]">
                  {activeProfile.selected_proton || "None"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {/* Primary Hero Action Button */}
            <button
              id="hero-launch-btn"
              onClick={onMainAction}
              disabled={btn.disabled}
              className={`w-full py-3.5 px-5 rounded-xl font-bold tracking-wider uppercase text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer ${btn.className}`}
            >
              {btn.icon}
              <span>{btn.label}</span>
            </button>

            {/* Quick Management Row: Open Folder & Kill Processes */}
            <div className="grid grid-cols-2 gap-2">
              <button
                id="open-folder-btn"
                type="button"
                onClick={onOpenFolder}
                title={`Opens prefix directory in your system file manager`}
                className="py-2.5 px-3 rounded-xl font-medium text-xs text-slate-300 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                <span>Prefix Folder</span>
              </button>

              <button
                id="kill-processes-btn"
                type="button"
                onClick={onKillProcesses}
                title="Executes wineserver -k for this prefix and terminates lingering processes"
                className="py-2.5 px-3 rounded-xl font-semibold text-xs text-rose-300 bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/40 hover:border-rose-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Square className="w-3 h-3 fill-current text-rose-400" />
                <span>Kill Processes</span>
              </button>
            </div>

            {/* Reinstall & Uninstall Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
              <button
                type="button"
                onClick={() => setConfirmAction("reinstall")}
                title={`Cleanly reset prefix for ${activeProfile.name} to run setup again`}
                className="py-1.5 px-2.5 rounded-lg text-[11px] font-medium text-amber-300/90 bg-amber-950/20 hover:bg-amber-950/40 border border-amber-800/40 hover:border-amber-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-amber-400" />
                <span>Reinstall</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmAction("uninstall")}
                title={`Uninstall and remove Wine prefix folder for ${activeProfile.name}`}
                className="py-1.5 px-2.5 rounded-lg text-[11px] font-medium text-rose-400/90 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-800/40 hover:border-rose-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3 h-3 text-rose-400" />
                <span>Uninstall</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced / Executable Customization Accordion */}
      <div className="border-t border-slate-800/80 pt-3">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors py-1 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Executable Configuration & Custom Target</span>
          </div>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-3 pt-3 mt-1 pb-1">
            {/* Active Executable Visual Status Card */}
            <div className="bg-[#090C12] border border-slate-800 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <FileCode2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>RESOLVED EXECUTABLE:</span>
                </span>
                <div className="text-xs font-mono text-cyan-300 break-all bg-[#0e131d] px-3 py-1.5 rounded-lg border border-slate-800/80">
                  {resolvedExe?.path || (
                    <span className="text-slate-500 italic">
                      No executable detected or set yet. Automatic setup or manual path required.
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {resolvedExe?.exists ? (
                  <span className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready on Disk
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <XCircle className="w-3.5 h-3.5" /> File Not Found
                  </span>
                )}

                {activeProfile.custom_exe_path && (
                  <button
                    type="button"
                    onClick={() => onUpdateProfile({ custom_exe_path: null })}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                  >
                    Reset to Default
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Custom Executable Override Input with Native File Picker */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="custom-exe-input" className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Manual Executable Path (Override or Custom Game)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="custom-exe-input"
                    type="text"
                    value={activeProfile.custom_exe_path || ""}
                    onChange={(e) =>
                      onUpdateProfile({ custom_exe_path: e.target.value.trim() ? e.target.value : null })
                    }
                    placeholder="e.g. /home/user/Games/game.exe or C:\Games\game.exe"
                    className="flex-1 bg-[#090C12] border border-slate-700/80 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseExe}
                    disabled={isBrowsing}
                    title="Browse system for .exe binary via native file chooser"
                    className="py-2 px-3.5 rounded-xl text-xs font-semibold bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-700/60 text-cyan-300 hover:text-cyan-200 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {isBrowsing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FolderSearch className="w-3.5 h-3.5" />
                    )}
                    <span>Browse...</span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  Browse or paste an absolute Linux path to directly run any Windows game or executable with Proton.
                </span>
              </div>

              {/* Custom Launch Arguments */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="custom-args-input" className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Custom Runtime Arguments (Passed to Executable)</span>
                </label>
                <input
                  id="custom-args-input"
                  type="text"
                  value={activeProfile.custom_launch_args}
                  onChange={(e) => onUpdateProfile({ custom_launch_args: e.target.value })}
                  placeholder="e.g. -novid -fullscreen --rendering-driver vulkan"
                  className="w-full bg-[#090C12] border border-slate-700/80 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 outline-none"
                />
                <span className="text-[10px] text-slate-500 font-mono">
                  Additional arguments appended to the binary call after the executable.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Reinstall or Uninstall */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101420] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
                <AlertTriangle className="w-5 h-5" />
                <span>
                  {confirmAction === "uninstall"
                    ? `Uninstall ${activeProfile.name}?`
                    : `Reinstall ${activeProfile.name}?`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {confirmAction === "uninstall" ? (
                <>
                  Are you sure you want to uninstall{" "}
                  <strong className="text-white">{activeProfile.name}</strong>? This will terminate all
                  running processes and delete its isolated prefix folder (
                  <code className="text-cyan-300 font-mono text-[11px]">
                    ~/.local/share/bnet-linux-launcher/prefixes/{activeProfile.id}
                  </code>
                  ).
                </>
              ) : (
                <>
                  Are you sure you want to reinstall{" "}
                  <strong className="text-white">{activeProfile.name}</strong>? This will stop all processes,
                  wipe the prefix folder, and prepare for a clean first-run installer setup.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const act = confirmAction;
                  setConfirmAction(null);
                  if (act === "uninstall") {
                    onUninstallLauncher?.();
                  } else {
                    onReinstallLauncher?.();
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950/50 transition-all cursor-pointer"
              >
                {confirmAction === "uninstall" ? "Yes, Uninstall" : "Yes, Reinstall"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
