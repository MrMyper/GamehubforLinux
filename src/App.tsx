import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Header } from "./components/Header";
import { LauncherSelector } from "./components/LauncherSelector";
import { ControlDeck } from "./components/ControlDeck";
import { ProgressBar } from "./components/ProgressBar";
import { TerminalConsole } from "./components/TerminalConsole";
import { launcherApi } from "./services/api";
import {
  LauncherStatus,
  ProtonRelease,
  DownloadProgress,
  LogEntry,
  LauncherPaths,
  LauncherConfig,
  LauncherProfile,
} from "./types/launcher";
import { X, FolderSearch, Loader2, Gamepad2 } from "lucide-react";

export function App() {
  const [status, setStatus] = useState<LauncherStatus>("idle");
  const [config, setConfig] = useState<LauncherConfig | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<string>("battlenet");
  const [installedStatus, setInstalledStatus] = useState<Record<string, boolean>>({});
  const [releases, setReleases] = useState<ProtonRelease[]>([]);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [paths, setPaths] = useState<LauncherPaths | null>(null);
  const [shortcutCreated, setShortcutCreated] = useState<boolean>(false);

  // Custom App Modal state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newAppName, setNewAppName] = useState<string>("");
  const [newAppExe, setNewAppExe] = useState<string>("");
  const [newAppProton, setNewAppProton] = useState<string>("");
  const [isBrowsingNewApp, setIsBrowsingNewApp] = useState<boolean>(false);

  const activeProfileIdRef = useRef<string>(activeProfileId);
  activeProfileIdRef.current = activeProfileId;

  const activeProfile = useMemo(() => {
    if (!config || !config.profiles.length) return null;
    return config.profiles.find((p) => p.id === activeProfileId) || config.profiles[0];
  }, [config, activeProfileId]);

  const addLog = useCallback(
    (text: string, level: LogEntry["level"] = "stdout") => {
      const now = new Date();
      const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
      setLogs((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp,
          text,
          level,
        },
      ]);
    },
    []
  );

  // Initialize data on mount
  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenLog: (() => void) | undefined;
    let unlistenStatus: (() => void) | undefined;
    let unlistenStopped: (() => void) | undefined;

    async function init() {
      addLog("[System] Initializing OmniGame Linux Multi-Launcher...", "system");

      try {
        // Load paths
        const resolvedPaths = await launcherApi.getLauncherPaths();
        setPaths(resolvedPaths);
        addLog(`[System] XDG Config: ${resolvedPaths.config_path}`, "system");
        addLog(`[System] XDG Data: ${resolvedPaths.data_path}`, "system");

        // Load config
        const loadedConfig = await launcherApi.loadConfig();
        setConfig(loadedConfig);
        setActiveProfileId(loadedConfig.active_profile_id);

        const currentProfile =
          loadedConfig.profiles.find((p) => p.id === loadedConfig.active_profile_id) ||
          loadedConfig.profiles[0];

        // Fetch installed and GitHub Proton releases
        await refreshReleases(currentProfile?.selected_proton);

        // Check installation status for all profiles
        const statusMap: Record<string, boolean> = {};
        for (const prof of loadedConfig.profiles) {
          try {
            statusMap[prof.id] = await launcherApi.checkLauncherInstalled(prof.id);
          } catch {
            statusMap[prof.id] = false;
          }
        }
        setInstalledStatus(statusMap);

        addLog(
          `[System] Active platform: ${currentProfile?.name}. Ready status: ${
            statusMap[currentProfile?.id || ""] ? "Installed" : "Setup Required"
          }`,
          "system"
        );

        // Setup event listeners
        unlistenProgress = await launcherApi.onProtonProgress((prog) => {
          setProgress(prog);
          if (prog.percentage >= 100) {
            setTimeout(() => setProgress(null), 1500);
          }
        });

        unlistenLog = await launcherApi.onLauncherLog((log) => {
          addLog(log.text, log.level);
        });

        // Monitor process lifecycle and status changes
        unlistenStatus = await launcherApi.onLauncherStatusChanged((evt) => {
          if (evt.profile_id === activeProfileIdRef.current || evt.status === "idle") {
            setStatus(evt.status);
            if (evt.status === "idle") {
              addLog(`[System] Process closed for '${evt.profile_id}'. Status: Ready`, "system");
            }
          }
        });

        unlistenStopped = await launcherApi.onLauncherStopped((stoppedId) => {
          if (stoppedId === activeProfileIdRef.current || !stoppedId) {
            setStatus("idle");
            addLog(`[System] Application closed by user. Ready for launch.`, "system");
          }
        });

        addLog("[System] Multi-Launcher ready.", "system");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        addLog(`[System Error] Initialization failure: ${msg}`, "error");
      }
    }

    init();

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenLog) unlistenLog();
      if (unlistenStatus) unlistenStatus();
      if (unlistenStopped) unlistenStopped();
    };
  }, [addLog]);

  const refreshReleases = async (preferredSelection?: string | null) => {
    try {
      addLog("[System] Querying GloriousEggroll/proton-ge-custom releases...", "system");
      const fetched = await launcherApi.fetchProtonReleases();
      const installedTags = await launcherApi.getInstalledProtons();

      const tagged = fetched.map((rel) => ({
        ...rel,
        is_installed: installedTags.includes(rel.tag_name),
      }));

      setReleases(tagged);

      const toSelect =
        preferredSelection ||
        tagged.find((r) => r.is_installed)?.tag_name ||
        tagged[0]?.tag_name ||
        null;

      if (toSelect && activeProfile && !activeProfile.selected_proton) {
        handleUpdateProfile({ selected_proton: toSelect });
      }

      addLog(`[System] Loaded ${tagged.length} Proton-GE releases. Runner: ${toSelect || "None"}`, "system");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`[System Error] Failed to fetch Proton releases: ${msg}`, "error");
    }
  };

  // Switch active profile
  const handleSelectProfile = async (id: string) => {
    if (id === activeProfileId) return;
    setActiveProfileId(id);

    try {
      await launcherApi.setActiveProfile(id);
      const isInstalled = await launcherApi.checkLauncherInstalled(id);
      setInstalledStatus((prev) => ({ ...prev, [id]: isInstalled }));

      const prof = config?.profiles.find((p) => p.id === id);
      addLog(
        `[Launcher] Switched active profile to ${prof?.name || id} (${
          isInstalled ? "Installed" : "Setup Required"
        })`,
        "system"
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`[System Error] Could not switch profile: ${msg}`, "error");
    }
  };

  // Save profile updates (Proton runner, env vars, custom exe, custom launch args)
  const handleUpdateProfile = async (updatedPartial: Partial<LauncherProfile>) => {
    if (!config || !activeProfile) return;

    const updatedProfile: LauncherProfile = {
      ...activeProfile,
      ...updatedPartial,
    };

    const newProfiles = config.profiles.map((p) =>
      p.id === updatedProfile.id ? updatedProfile : p
    );

    const newConfig: LauncherConfig = {
      ...config,
      profiles: newProfiles,
    };

    setConfig(newConfig);

    try {
      await launcherApi.saveProfile(updatedProfile);
      if (updatedPartial.selected_proton !== undefined) {
        addLog(
          `[Config] [${activeProfile.name}] Proton runner set to: ${updatedProfile.selected_proton || "None"}`,
          "system"
        );
      }
      if (updatedPartial.custom_exe_path !== undefined) {
        addLog(
          `[Config] [${activeProfile.name}] Custom executable path: ${
            updatedProfile.custom_exe_path || "Default automatic detection"
          }`,
          "system"
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`[Config Error] Could not save profile: ${msg}`, "error");
    }
  };

  // Open native prefix folder
  const handleOpenFolder = async () => {
    if (!activeProfile) return;
    try {
      addLog(`[System] Opening prefix directory for ${activeProfile.name}...`, "system");
      const res = await launcherApi.openLauncherFolder(activeProfile.id);
      addLog(`[System] ${res}`, "system");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`[System Error] Could not open prefix folder: ${msg}`, "error");
    }
  };

  const handleCreateShortcut = async () => {
    try {
      addLog("[System] Generating native .desktop shortcut in ~/.local/share/applications/...", "system");
      const msg = await launcherApi.createDesktopShortcut();
      setShortcutCreated(true);
      addLog(`[System] ${msg}`, "system");
      setTimeout(() => setShortcutCreated(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`[System Error] Could not create shortcut: ${msg}`, "error");
    }
  };

  const handleMainAction = async () => {
    if (!activeProfile) return;

    const runner = activeProfile.selected_proton;
    if (!runner) {
      addLog("[Error] Please select a Proton version first.", "error");
      return;
    }

    const release = releases.find((r) => r.tag_name === runner);

    // Step 1: Check if selected Proton runner is installed
    if (!release?.is_installed) {
      setStatus("downloading_proton");
      addLog(`[Download] Starting download of ${runner}...`, "system");

      try {
        await launcherApi.downloadAndExtractProton(
          runner,
          release?.tarball_url || "",
          (prog) => setProgress(prog)
        );

        addLog(`[Download] ${runner} downloaded and extracted successfully!`, "system");
        setReleases((prev) =>
          prev.map((r) => (r.tag_name === runner ? { ...r, is_installed: true } : r))
        );
        setStatus("idle");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        addLog(`[Download Error] ${msg}`, "error");
        setStatus("idle");
        setProgress(null);
      }
      return;
    }

    const isInstalled = installedStatus[activeProfile.id] ?? false;

    // Step 2: If launcher executable is missing and no custom executable is specified, run installer
    if (!isInstalled && !activeProfile.custom_exe_path) {
      setStatus("installing_bnet");
      addLog(`[Install] Starting ${activeProfile.name} first-run installation...`, "system");

      try {
        await launcherApi.runLauncher(activeProfile.id, (msg) => {
          addLog(msg.text, msg.level);
        });
        const exists = await launcherApi.checkLauncherInstalled(activeProfile.id);
        setInstalledStatus((prev) => ({ ...prev, [activeProfile.id]: exists }));
        setStatus("idle");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        addLog(`[Install Error] ${msg}`, "error");
        setStatus("idle");
      }
      return;
    }

    // Step 3: Launch the executable
    setStatus("launching");
    addLog(`[Launch] Executing ${activeProfile.name} via ${runner}...`, "system");

    try {
      await launcherApi.runLauncher(activeProfile.id, (msg) => {
        addLog(msg.text, msg.level);
      });
      setStatus("running");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`[Launch Error] ${msg}`, "error");
      setStatus("idle");
    }
  };

  const handleKillProcesses = async () => {
    if (!activeProfile) return;
    setStatus("stopping");
    addLog(`[System] Executing wineserver -k for [${activeProfile.name}] prefix...`, "system");

    try {
      const res = await launcherApi.killWineserver(activeProfile.id);
      addLog(`[System] ${res}`, "system");
      setStatus("idle");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`[Error] Kill wineserver failed: ${msg}`, "error");
      setStatus("idle");
    }
  };

  const handleReinstallLauncher = async () => {
    if (!activeProfile) return;
    try {
      addLog(`[System] Resetting prefix for ${activeProfile.name}...`, "system");
      const res = await launcherApi.reinstallLauncher(activeProfile.id);
      addLog(`[System] ${res}`, "system");
      setInstalledStatus((prev) => ({ ...prev, [activeProfile.id]: false }));
      setStatus("idle");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`[Error] Reinstall failed: ${msg}`, "error");
    }
  };

  const handleUninstallLauncher = async () => {
    if (!activeProfile) return;
    try {
      addLog(`[System] Uninstalling ${activeProfile.name} and deleting prefix...`, "system");
      const res = await launcherApi.uninstallLauncher(activeProfile.id);
      addLog(`[System] ${res}`, "system");
      setInstalledStatus((prev) => ({ ...prev, [activeProfile.id]: false }));
      setStatus("idle");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`[Error] Uninstall failed: ${msg}`, "error");
    }
  };

  const handleDeleteProfile = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete profile "${name}"? This will terminate processes and remove its prefix.`)) {
      return;
    }
    try {
      await launcherApi.deleteProfile(id, true);
      const loaded = await launcherApi.loadConfig();
      setConfig(loaded);
      setActiveProfileId(loaded.active_profile_id);
      addLog(`[Config] Deleted profile: ${name}`, "system");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`[Error] Failed to delete profile: ${msg}`, "error");
    }
  };

  const handleOpenAddModal = () => {
    setNewAppName("");
    setNewAppExe("");
    setNewAppProton(activeProfile?.selected_proton || releases[0]?.tag_name || "");
    setShowAddModal(true);
  };

  const handleBrowseNewAppExe = async () => {
    try {
      setIsBrowsingNewApp(true);
      const chosen = await launcherApi.browseExecutableFile();
      if (chosen) {
        setNewAppExe(chosen);
        if (!newAppName.trim()) {
          // Auto fill name from exe file name
          const fileName = chosen.split("/").pop()?.replace(/\.(exe|bat|cmd)$/i, "");
          if (fileName) setNewAppName(fileName);
        }
      }
    } finally {
      setIsBrowsingNewApp(false);
    }
  };

  const handleCreateCustomApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppName.trim()) return;

    try {
      addLog(`[Config] Creating custom application profile: ${newAppName.trim()}...`, "system");
      const created = await launcherApi.addCustomProfile(
        newAppName.trim(),
        newAppExe.trim() || undefined,
        newAppProton || undefined
      );

      const loaded = await launcherApi.loadConfig();
      setConfig(loaded);
      setActiveProfileId(created.id);

      const isInstalled = await launcherApi.checkLauncherInstalled(created.id);
      setInstalledStatus((prev) => ({ ...prev, [created.id]: isInstalled }));

      addLog(`[Config] Custom app '${created.name}' ready!`, "system");
      setShowAddModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`[Error] Could not create custom app: ${msg}`, "error");
    }
  };

  const currentPrefixPath = activeProfile
    ? activeProfile.id === "battlenet"
      ? paths?.prefix_path || "~/.local/share/bnet-linux-launcher/prefix"
      : `${paths?.data_path || "~/.local/share/bnet-linux-launcher"}/prefixes/${activeProfile.id}`
    : "~/.local/share/bnet-linux-launcher/prefixes";

  return (
    <div className="flex flex-col h-screen w-screen bg-[#080B11] text-slate-100 select-none overflow-hidden font-sans">
      {/* Top Header Bar */}
      <Header
        status={status}
        paths={paths}
        onRefreshReleases={() => refreshReleases(activeProfile?.selected_proton)}
        onCreateShortcut={handleCreateShortcut}
        shortcutCreated={shortcutCreated}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3.5">
        {/* Multi-Launcher Platform Switcher */}
        {config && (
          <LauncherSelector
            profiles={config.profiles}
            activeProfileId={activeProfileId}
            onSelectProfile={handleSelectProfile}
            installedStatus={installedStatus}
            onAddCustomProfile={handleOpenAddModal}
            onDeleteProfile={handleDeleteProfile}
          />
        )}

        {/* Control Deck */}
        {activeProfile && (
          <ControlDeck
            activeProfile={activeProfile}
            releases={releases}
            onUpdateProfile={handleUpdateProfile}
            isLauncherInstalled={installedStatus[activeProfile.id] ?? false}
            status={status}
            onMainAction={handleMainAction}
            onKillProcesses={handleKillProcesses}
            onOpenFolder={handleOpenFolder}
            onReinstallLauncher={handleReinstallLauncher}
            onUninstallLauncher={handleUninstallLauncher}
          />
        )}

        {/* Live Progress Bar (when downloading or extracting) */}
        {progress && <ProgressBar progress={progress} />}

        {/* Realtime Terminal Console */}
        <TerminalConsole logs={logs} onClearLogs={() => setLogs([])} />
      </main>

      {/* Add Custom App Modal Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateCustomApp}
            className="bg-[#111622] border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in duration-150"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5 text-cyan-400 font-bold text-base">
                <Gamepad2 className="w-5 h-5" />
                <span>Add Custom Application / Game</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {/* App Name */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-300">
                  Application Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newAppName}
                  onChange={(e) => setNewAppName(e.target.value)}
                  placeholder="e.g. Cyberpunk 2077, GOG Galaxy, Diablo II Resurrected"
                  className="w-full bg-[#090C12] border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 outline-none"
                />
              </div>

              {/* Executable Path with Browse */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-300">
                  Target Executable Path (.exe)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newAppExe}
                    onChange={(e) => setNewAppExe(e.target.value)}
                    placeholder="e.g. /home/user/Games/game.exe"
                    className="flex-1 bg-[#090C12] border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs font-mono text-cyan-300 placeholder-slate-600 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseNewAppExe}
                    disabled={isBrowsingNewApp}
                    className="py-2 px-3.5 rounded-xl text-xs font-semibold bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {isBrowsingNewApp ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FolderSearch className="w-3.5 h-3.5" />
                    )}
                    <span>Browse...</span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  You can browse your disk or paste an absolute path.
                </span>
              </div>

              {/* Proton Selection */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-300">
                  Proton Runner
                </label>
                <select
                  value={newAppProton}
                  onChange={(e) => setNewAppProton(e.target.value)}
                  className="w-full bg-[#090C12] border border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none cursor-pointer"
                >
                  {releases.map((rel) => (
                    <option key={rel.tag_name} value={rel.tag_name} className="bg-[#090C12] text-white">
                      {rel.name} {rel.is_installed ? "• [Installed]" : "• [Download]"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newAppName.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 shadow-lg shadow-cyan-950/50 transition-all cursor-pointer"
              >
                Create Application
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subtle XDG Path Footer */}
      <footer className="px-6 py-2 bg-[#0A0D15] border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <div className="flex items-center gap-2 truncate">
          <span className="text-slate-400 font-semibold">{activeProfile?.name || "Active"} Prefix:</span>
          <span className="text-slate-400 truncate">{currentPrefixPath}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span>Config: {paths?.config_path || "~/.config/bnet-linux-launcher/config.json"}</span>
        </div>
      </footer>
    </div>
  );
}

export default App;

