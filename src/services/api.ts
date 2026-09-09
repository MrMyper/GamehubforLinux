import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  LauncherConfig,
  LauncherProfile,
  ProtonRelease,
  DownloadProgress,
  LauncherPaths,
  ResolvedExeInfo,
  LauncherStatusEvent,
} from "../types/launcher";

const isTauriEnv = (): boolean => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

// Mock data for browser testing
const MOCK_RELEASES: ProtonRelease[] = [
  {
    tag_name: "GE-Proton11-6",
    name: "GE-Proton11-6 (Latest)",
    tarball_url: "https://github.com/GloriousEggroll/proton-ge-custom/releases/download/GE-Proton11-6/GE-Proton11-6-x86_64.tar.gz",
    size: 533700000,
    published_at: "2026-08-28T21:37:07Z",
    is_installed: true,
  },
  {
    tag_name: "GE-Proton10-34",
    name: "GE-Proton10-34",
    tarball_url: "https://github.com/GloriousEggroll/proton-ge-custom/releases/download/GE-Proton10-34/GE-Proton10-34.tar.gz",
    size: 472500000,
    published_at: "2026-03-01T12:00:00Z",
    is_installed: false,
  },
  {
    tag_name: "GE-Proton9-26",
    name: "GE-Proton9-26 (Stable)",
    tarball_url: "https://github.com/GloriousEggroll/proton-ge-custom/releases/download/GE-Proton9-26/GE-Proton9-26.tar.gz",
    size: 468900000,
    published_at: "2026-01-20T14:30:00Z",
    is_installed: false,
  },
];

let mockConfig: LauncherConfig = {
  active_profile_id: "battlenet",
  profiles: [
    {
      id: "battlenet",
      name: "Battle.net",
      selected_proton: "GE-Proton11-6",
      env_args: "DXVK_HUD=fps WINEFSYNC=1",
      custom_exe_path: null,
      custom_launch_args: "",
    },
    {
      id: "ubisoft",
      name: "Ubisoft Connect",
      selected_proton: "GE-Proton11-6",
      env_args: "DXVK_HUD=fps WINEFSYNC=1",
      custom_exe_path: null,
      custom_launch_args: "",
    },
    {
      id: "ea",
      name: "EA App",
      selected_proton: "GE-Proton11-6",
      env_args: "DXVK_HUD=fps WINEFSYNC=1",
      custom_exe_path: null,
      custom_launch_args: "",
    },
    {
      id: "wargaming",
      name: "Wargaming.net",
      selected_proton: "GE-Proton11-6",
      env_args: "DXVK_HUD=fps WINEFSYNC=1",
      custom_exe_path: null,
      custom_launch_args: "",
    },
    {
      id: "custom",
      name: "Custom App",
      selected_proton: "GE-Proton11-6",
      env_args: "",
      custom_exe_path: null,
      custom_launch_args: "",
    },
  ],
};

const mockInstalledStatus: Record<string, boolean> = {
  battlenet: true,
  ubisoft: false,
  ea: false,
  wargaming: false,
  custom: false,
};

export const launcherApi = {
  isTauri: isTauriEnv,

  async getLauncherPaths(): Promise<LauncherPaths> {
    if (isTauriEnv()) {
      return await invoke<LauncherPaths>("get_launcher_paths");
    }
    return {
      config_path: "~/.config/bnet-linux-launcher/config.json",
      data_path: "~/.local/share/bnet-linux-launcher",
      prefix_path: "~/.local/share/bnet-linux-launcher/prefixes/battlenet",
      proton_dir: "~/.local/share/bnet-linux-launcher/proton",
      desktop_file: "~/.local/share/applications/bnet-launcher.desktop",
      is_installed: mockInstalledStatus.battlenet,
    };
  },

  async loadConfig(): Promise<LauncherConfig> {
    if (isTauriEnv()) {
      return await invoke<LauncherConfig>("load_config");
    }
    const saved = localStorage.getItem("multi_launcher_config");
    if (saved) {
      try {
        mockConfig = JSON.parse(saved);
      } catch {
        // use default
      }
    }
    return mockConfig;
  },

  async saveConfig(config: LauncherConfig): Promise<void> {
    if (isTauriEnv()) {
      await invoke("save_config", { config });
      return;
    }
    mockConfig = config;
    localStorage.setItem("multi_launcher_config", JSON.stringify(config));
  },

  async saveProfile(profile: LauncherProfile): Promise<void> {
    if (isTauriEnv()) {
      await invoke("save_profile", { profile });
      return;
    }
    const idx = mockConfig.profiles.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      mockConfig.profiles[idx] = profile;
    } else {
      mockConfig.profiles.push(profile);
    }
    localStorage.setItem("multi_launcher_config", JSON.stringify(mockConfig));
  },

  async setActiveProfile(profileId: string): Promise<void> {
    if (isTauriEnv()) {
      await invoke("set_active_profile", { profileId });
      return;
    }
    mockConfig.active_profile_id = profileId;
    localStorage.setItem("multi_launcher_config", JSON.stringify(mockConfig));
  },

  async openLauncherFolder(profileId: string): Promise<string> {
    if (isTauriEnv()) {
      return await invoke<string>("open_launcher_folder", { profileId });
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    return `Opened ~/.local/share/bnet-linux-launcher/prefixes/${profileId}`;
  },

  async fetchProtonReleases(): Promise<ProtonRelease[]> {
    if (isTauriEnv()) {
      return await invoke<ProtonRelease[]>("fetch_proton_releases");
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    return MOCK_RELEASES;
  },

  async getInstalledProtons(): Promise<string[]> {
    if (isTauriEnv()) {
      return await invoke<string[]>("get_installed_protons");
    }
    return MOCK_RELEASES.filter((r) => r.is_installed).map((r) => r.tag_name);
  },

  async checkLauncherInstalled(profileId: string): Promise<boolean> {
    if (isTauriEnv()) {
      return await invoke<boolean>("check_launcher_installed", { profileId });
    }
    return mockInstalledStatus[profileId] ?? false;
  },

  async checkBattlenetInstalled(): Promise<boolean> {
    return this.checkLauncherInstalled("battlenet");
  },

  async createDesktopShortcut(): Promise<string> {
    if (isTauriEnv()) {
      return await invoke<string>("create_desktop_shortcut");
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    return "~/.local/share/applications/bnet-launcher.desktop created";
  },

  async downloadAndExtractProton(
    versionTag: string,
    downloadUrl: string,
    onProgress?: (p: DownloadProgress) => void
  ): Promise<void> {
    if (isTauriEnv()) {
      await invoke("download_and_extract_proton", {
        versionTag,
        downloadUrl,
      });
      return;
    }

    // Mock progress simulation in browser
    for (let percent = 0; percent <= 100; percent += 10) {
      await new Promise((res) => setTimeout(res, 150));
      const total = 533700000;
      const downloaded = Math.round((total * percent) / 100);
      onProgress?.({
        version: versionTag,
        downloaded,
        total,
        percentage: percent,
        status: percent < 100 ? "Downloading Proton-GE archive..." : "Extracting Proton-GE...",
        retry_count: 0,
      });
    }

    const rel = MOCK_RELEASES.find((r) => r.tag_name === versionTag);
    if (rel) rel.is_installed = true;
  },

  async runLauncher(
    profileId: string,
    onLog?: (msg: { text: string; level: 'stdout' | 'stderr' | 'system' }) => void
  ): Promise<void> {
    if (isTauriEnv()) {
      await invoke("run_launcher", { profileId });
      return;
    }

    const profile = mockConfig.profiles.find((p) => p.id === profileId);
    const name = profile?.name || profileId;
    const isInstalled = mockInstalledStatus[profileId] ?? false;

    if (!isInstalled && !profile?.custom_exe_path) {
      onLog?.({ text: `[System] ${name} not found in prefix. Downloading installer...`, level: "system" });
      await new Promise((res) => setTimeout(res, 500));
      onLog?.({ text: `[System] Launching ${name} setup via ${profile?.selected_proton || "Proton"}...`, level: "system" });
      await new Promise((res) => setTimeout(res, 1000));
      onLog?.({ text: `wine: creating WINEPREFIX at ~/.local/share/bnet-linux-launcher/prefixes/${profileId}`, level: "stdout" });
      mockInstalledStatus[profileId] = true;
    } else {
      onLog?.({ text: `[System] Launching ${name} with runner ${profile?.selected_proton}`, level: "system" });
      if (profile?.env_args) {
        onLog?.({ text: `[System] Applied launch environment: ${profile.env_args}`, level: "system" });
      }
      await new Promise((res) => setTimeout(res, 400));
      onLog?.({ text: `wine: starting ${name} executable...`, level: "stdout" });
      onLog?.({ text: "info: DXVK initialized (Vulkan 1.3)", level: "stdout" });
      onLog?.({ text: `${name} active`, level: "stdout" });
    }
  },

  async runBattlenet(
    _protonTag: string,
    _envArgs: string,
    onLog?: (msg: { text: string; level: 'stdout' | 'stderr' | 'system' }) => void
  ): Promise<void> {
    return this.runLauncher("battlenet", onLog);
  },

  async getResolvedLauncherExe(profileId: string): Promise<ResolvedExeInfo> {
    if (isTauriEnv()) {
      return await invoke<ResolvedExeInfo>("get_resolved_launcher_exe", { profileId });
    }
    const prof = mockConfig.profiles.find((p) => p.id === profileId);
    return {
      path: prof?.custom_exe_path || (mockInstalledStatus[profileId] ? `/home/user/.local/share/bnet-linux-launcher/prefixes/${profileId}/drive_c/game.exe` : null),
      exists: mockInstalledStatus[profileId] || Boolean(prof?.custom_exe_path),
      is_custom: Boolean(prof?.custom_exe_path),
    };
  },

  async browseExecutableFile(): Promise<string | null> {
    if (isTauriEnv()) {
      return await invoke<string | null>("browse_executable_file");
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    return "/home/user/Games/CustomGame/game.exe";
  },

  async addCustomProfile(name: string, exePath?: string, proton?: string): Promise<LauncherProfile> {
    if (isTauriEnv()) {
      return await invoke<LauncherProfile>("add_custom_profile", { name, exePath, proton });
    }
    const newId = `custom_${Date.now()}`;
    const newProf: LauncherProfile = {
      id: newId,
      name: name.trim() || "Custom App",
      selected_proton: proton || "GE-Proton11-6",
      env_args: "DXVK_HUD=fps WINEFSYNC=1",
      custom_exe_path: exePath || null,
      custom_launch_args: "",
    };
    mockConfig.profiles.push(newProf);
    mockConfig.active_profile_id = newId;
    localStorage.setItem("multi_launcher_config", JSON.stringify(mockConfig));
    return newProf;
  },

  async deleteProfile(profileId: string, deletePrefix: boolean = true): Promise<void> {
    if (isTauriEnv()) {
      await invoke("delete_profile", { profileId, deletePrefix });
      return;
    }
    mockConfig.profiles = mockConfig.profiles.filter((p) => p.id !== profileId);
    if (mockConfig.active_profile_id === profileId) {
      mockConfig.active_profile_id = mockConfig.profiles[0]?.id || "battlenet";
    }
    localStorage.setItem("multi_launcher_config", JSON.stringify(mockConfig));
  },

  async renameProfile(profileId: string, newName: string): Promise<void> {
    if (isTauriEnv()) {
      await invoke("rename_profile", { profileId, newName });
      return;
    }
    const prof = mockConfig.profiles.find((p) => p.id === profileId);
    if (prof) {
      prof.name = newName;
      localStorage.setItem("multi_launcher_config", JSON.stringify(mockConfig));
    }
  },

  async uninstallLauncher(profileId: string): Promise<string> {
    if (isTauriEnv()) {
      return await invoke<string>("uninstall_launcher", { profileId });
    }
    mockInstalledStatus[profileId] = false;
    await new Promise((resolve) => setTimeout(resolve, 300));
    return `Launcher prefix for '${profileId}' uninstalled successfully.`;
  },

  async reinstallLauncher(profileId: string): Promise<string> {
    if (isTauriEnv()) {
      return await invoke<string>("reinstall_launcher", { profileId });
    }
    mockInstalledStatus[profileId] = false;
    await new Promise((resolve) => setTimeout(resolve, 300));
    return `Prefix for '${profileId}' has been reset. Ready for clean setup.`;
  },

  async killWineserver(profileId?: string): Promise<string> {
    if (isTauriEnv()) {
      return await invoke<string>("kill_wineserver", { profileId });
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    return `wineserver -k executed for '${profileId || "all"}'. Lingering processes terminated.`;
  },

  // Event Listeners
  onProtonProgress(callback: (progress: DownloadProgress) => void): Promise<UnlistenFn> {
    if (isTauriEnv()) {
      return listen<DownloadProgress>("proton-download-progress", (event) => {
        callback(event.payload);
      });
    }
    return Promise.resolve(() => {});
  },

  onLauncherLog(callback: (log: { text: string; level: 'stdout' | 'stderr' | 'system' }) => void): Promise<UnlistenFn> {
    if (isTauriEnv()) {
      return listen<{ text: string; level: 'stdout' | 'stderr' | 'system' }>("launcher-log", (event) => {
        callback(event.payload);
      });
    }
    return Promise.resolve(() => {});
  },

  onLauncherStatusChanged(callback: (event: LauncherStatusEvent) => void): Promise<UnlistenFn> {
    if (isTauriEnv()) {
      return listen<LauncherStatusEvent>("launcher-status-changed", (event) => {
        callback(event.payload);
      });
    }
    return Promise.resolve(() => {});
  },

  onLauncherStopped(callback: (profileId: string) => void): Promise<UnlistenFn> {
    if (isTauriEnv()) {
      return listen<string>("launcher-stopped", (event) => {
        callback(event.payload);
      });
    }
    return Promise.resolve(() => {});
  },
};
