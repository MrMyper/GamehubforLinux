use crate::config::{
    get_cache_dir, get_data_dir, get_profile_prefix_dir, load_config, LauncherProfile,
};
use futures_util::StreamExt;
use serde::Serialize;
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::time::Duration;
use tauri::Emitter;
use tokio::io::AsyncBufReadExt;

// Platform default installer URLs
const BNET_INSTALLER_URL: &str =
    "https://www.battle.net/download/getInstallerForGame?os=win&gameProgram=BATTLENET_APP&version=Live";
const UBISOFT_INSTALLER_URL: &str =
    "https://static3.cdn.ubi.com/orbit/launcher_installer/UbisoftConnectInstaller.exe";
const EA_INSTALLER_URL: &str =
    "https://origin-a.akamaihd.net/EA-Desktop-Client-Download/installer-releases/EAappInstaller.exe";
const WARGAMING_INSTALLER_URL: &str =
    "https://wgus-wotru.wargaming.net/wgc/WGC_EU_install.exe";

#[derive(Debug, Serialize, Clone)]
pub struct LauncherLogEvent {
    pub text: String,
    pub level: String, // "stdout", "stderr", "system", "error"
}

#[derive(Debug, Serialize, Clone)]
pub struct InstallerProgress {
    pub version: String,
    pub downloaded: u64,
    pub total: u64,
    pub percentage: f64,
    pub status: String,
    pub retry_count: u32,
}

/// Detects executable for Battle.net
pub fn find_battlenet_exe(prefix: &std::path::Path) -> Option<PathBuf> {
    let candidates = [
        prefix.join("drive_c/Program Files (x86)/Battle.net/Battle.net.exe"),
        prefix.join("pfx/drive_c/Program Files (x86)/Battle.net/Battle.net.exe"),
        prefix.join("drive_c/Program Files/Battle.net/Battle.net.exe"),
        prefix.join("pfx/drive_c/Program Files/Battle.net/Battle.net.exe"),
        prefix.join("drive_c/Program Files (x86)/Battle.net/Battle.net Launcher.exe"),
        prefix.join("pfx/drive_c/Program Files (x86)/Battle.net/Battle.net Launcher.exe"),
    ];
    for c in &candidates {
        if c.exists() {
            return Some(c.clone());
        }
    }
    None
}

/// Detects executable for Ubisoft Connect
pub fn find_ubisoft_exe(prefix: &std::path::Path) -> Option<PathBuf> {
    let candidates = [
        prefix.join("drive_c/Program Files (x86)/Ubisoft/Ubisoft Game Launcher/UbisoftConnect.exe"),
        prefix.join("pfx/drive_c/Program Files (x86)/Ubisoft/Ubisoft Game Launcher/UbisoftConnect.exe"),
        prefix.join("drive_c/Program Files (x86)/Ubisoft/Ubisoft Game Launcher/Uplay.exe"),
        prefix.join("pfx/drive_c/Program Files (x86)/Ubisoft/Ubisoft Game Launcher/Uplay.exe"),
    ];
    for c in &candidates {
        if c.exists() {
            return Some(c.clone());
        }
    }
    None
}

/// Detects executable for EA App
pub fn find_ea_exe(prefix: &std::path::Path) -> Option<PathBuf> {
    let candidates = [
        prefix.join("drive_c/Program Files/Electronic Arts/EA Desktop/EA Desktop/EALauncher.exe"),
        prefix.join("pfx/drive_c/Program Files/Electronic Arts/EA Desktop/EA Desktop/EALauncher.exe"),
        prefix.join("drive_c/Program Files/Electronic Arts/EA Desktop/EA Desktop/EADesktop.exe"),
        prefix.join("pfx/drive_c/Program Files/Electronic Arts/EA Desktop/EA Desktop/EADesktop.exe"),
    ];
    for c in &candidates {
        if c.exists() {
            return Some(c.clone());
        }
    }
    None
}

/// Detects executable for Wargaming Game Center
pub fn find_wargaming_exe(prefix: &std::path::Path) -> Option<PathBuf> {
    let candidates = [
        prefix.join("drive_c/ProgramData/Wargaming.net/GameCenter/wgc.exe"),
        prefix.join("pfx/drive_c/ProgramData/Wargaming.net/GameCenter/wgc.exe"),
        prefix.join("drive_c/Program Files (x86)/Wargaming.net/GameCenter/wgc.exe"),
        prefix.join("pfx/drive_c/Program Files (x86)/Wargaming.net/GameCenter/wgc.exe"),
        prefix.join("drive_c/Games/World_of_Tanks_RU/wgc.exe"),
        prefix.join("drive_c/Games/World_of_Tanks_EU/wgc.exe"),
    ];
    for c in &candidates {
        if c.exists() {
            return Some(c.clone());
        }
    }
    None
}

/// Locates executable based on profile custom_exe_path or standard paths
pub fn find_launcher_exe(profile: &LauncherProfile) -> Option<PathBuf> {
    // 1. Check custom_exe_path override first
    if let Some(ref custom_path) = profile.custom_exe_path {
        let trimmed = custom_path.trim();
        if !trimmed.is_empty() {
            let p = PathBuf::from(trimmed);
            if p.exists() {
                return Some(p);
            }
        }
    }

    // 2. Default platform detection
    let prefix = get_profile_prefix_dir(&profile.id);
    match profile.id.as_str() {
        "battlenet" => find_battlenet_exe(&prefix),
        "ubisoft" => find_ubisoft_exe(&prefix),
        "ea" => find_ea_exe(&prefix),
        "wargaming" => find_wargaming_exe(&prefix),
        _ => None,
    }
}

#[tauri::command]
pub fn check_launcher_installed(profile_id: String) -> Result<bool, String> {
    let config = load_config()?;
    let profile = config
        .profiles
        .into_iter()
        .find(|p| p.id == profile_id)
        .ok_or_else(|| format!("Profile '{}' not found", profile_id))?;

    Ok(find_launcher_exe(&profile).is_some())
}

// Backward compatibility command
#[tauri::command]
pub fn check_battlenet_installed() -> Result<bool, String> {
    check_launcher_installed("battlenet".to_string())
}

/// Locates the Proton executable binary or script inside a given version directory or system paths
pub fn resolve_proton_binary(proton_tag: &str) -> Result<PathBuf, String> {
    // 1. Check if proton_tag is an existing file or directory directly
    let direct = PathBuf::from(proton_tag);
    if direct.is_file() {
        return Ok(direct);
    }
    if direct.is_dir() {
        if let Some(bin) = check_proton_candidates(&direct) {
            return Ok(bin);
        }
    }

    // 2. Search all known search directories (app proton dir, Steam compat tools, steamapps common, Flatpak)
    for search_dir in crate::proton::get_proton_search_dirs() {
        let base = search_dir.join(proton_tag);
        if base.exists() {
            if let Some(bin) = check_proton_candidates(&base) {
                return Ok(bin);
            }
        }
    }

    Err(format!(
        "Proton version '{}' is not installed or valid executable not found",
        proton_tag
    ))
}

fn check_proton_candidates(base: &std::path::Path) -> Option<PathBuf> {
    let candidates = [
        base.join("proton"),
        base.join("dist/bin/wine"),
        base.join("files/bin/wine"),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return Some(candidate.clone());
        }
    }

    // Fallback: search 1-level deep in subdirectories
    if let Ok(entries) = fs::read_dir(base) {
        for entry in entries.flatten() {
            let p = entry.path().join("proton");
            if p.exists() {
                return Some(p);
            }
        }
    }

    None
}

/// Downloads platform installer into cache if not already present
pub async fn ensure_platform_installer(
    app: &tauri::AppHandle,
    profile_id: &str,
    url: &str,
    filename: &str,
) -> Result<PathBuf, String> {
    let cache_dir = get_cache_dir();
    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create cache directory: {}", e))?;

    let installer_path = cache_dir.join(filename);
    if installer_path.exists() {
        if let Ok(meta) = fs::metadata(&installer_path) {
            if meta.len() > 1_000_000 {
                return Ok(installer_path);
            }
        }
    }

    let _ = app.emit(
        "launcher-log",
        LauncherLogEvent {
            text: format!("[System] Downloading installer for {} ({url})...", profile_id),
            level: "system".to_string(),
        },
    );

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to request installer: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to download installer, HTTP status: {}",
            response.status()
        ));
    }

    let total = response.content_length().unwrap_or(0);
    let part_path = installer_path.with_extension("exe.part");
    let mut file = File::create(&part_path)
        .map_err(|e| format!("Failed to create installer file: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    let mut last_emit = std::time::Instant::now();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Error downloading chunk: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Error writing chunk: {}", e))?;
        downloaded += chunk.len() as u64;

        if last_emit.elapsed() >= Duration::from_millis(200) || downloaded == total {
            let percentage = if total > 0 {
                (downloaded as f64 / total as f64) * 100.0
            } else {
                0.0
            };
            let _ = app.emit(
                "proton-download-progress",
                InstallerProgress {
                    version: filename.to_string(),
                    downloaded,
                    total,
                    percentage,
                    status: format!("Downloading {} Installer...", profile_id),
                    retry_count: 0,
                },
            );
            last_emit = std::time::Instant::now();
        }
    }

    fs::rename(&part_path, &installer_path)
        .map_err(|e| format!("Failed to finalize installer: {}", e))?;

    let _ = app.emit(
        "launcher-log",
        LauncherLogEvent {
            text: format!("[System] {} download complete.", filename),
            level: "system".to_string(),
        },
    );

    Ok(installer_path)
}

#[tauri::command]
pub async fn run_launcher(app: tauri::AppHandle, profile_id: String) -> Result<(), String> {
    let config = load_config()?;
    let profile = config
        .profiles
        .into_iter()
        .find(|p| p.id == profile_id)
        .ok_or_else(|| format!("Profile '{}' not found", profile_id))?;

    let proton_tag = profile
        .selected_proton
        .clone()
        .ok_or_else(|| format!("Please select a Proton runner for '{}'", profile.name))?;

    let proton_bin = resolve_proton_binary(&proton_tag)?;
    let prefix_dir = get_profile_prefix_dir(&profile.id);
    fs::create_dir_all(&prefix_dir)
        .map_err(|e| format!("Failed to create prefix directory {:?}: {}", prefix_dir, e))?;

    let client_install_dir = get_data_dir();
    let _ = fs::create_dir_all(&client_install_dir);

    // Resolve target executable or download installer
    let maybe_exe = find_launcher_exe(&profile);
    let (target_exe, is_setup) = match maybe_exe {
        Some(exe) => (exe, false),
        None => match profile.id.as_str() {
            "battlenet" => {
                let inst = ensure_platform_installer(
                    &app,
                    &profile.name,
                    BNET_INSTALLER_URL,
                    "Battle.net-Setup.exe",
                )
                .await?;
                (inst, true)
            }
            "ubisoft" => {
                let inst = ensure_platform_installer(
                    &app,
                    &profile.name,
                    UBISOFT_INSTALLER_URL,
                    "UbisoftConnectInstaller.exe",
                )
                .await?;
                (inst, true)
            }
            "ea" => {
                let inst = ensure_platform_installer(
                    &app,
                    &profile.name,
                    EA_INSTALLER_URL,
                    "EAappInstaller.exe",
                )
                .await?;
                (inst, true)
            }
            "wargaming" => {
                let inst = ensure_platform_installer(
                    &app,
                    &profile.name,
                    WARGAMING_INSTALLER_URL,
                    "wgc_setup.exe",
                )
                .await?;
                (inst, true)
            }
            "custom" => {
                return Err(
                    "No executable path provided. Please set 'Manual Executable Path' in Advanced Settings."
                        .to_string(),
                );
            }
            _ => {
                return Err(format!(
                    "No executable found and no automatic installer configured for '{}'",
                    profile.name
                ));
            }
        },
    };

    let _ = app.emit(
        "launcher-log",
        LauncherLogEvent {
            text: format!(
                "[System] Spawning {} via Proton {:?}: {:?}",
                if is_setup { "Installer" } else { &profile.name },
                proton_bin,
                target_exe
            ),
            level: "system".to_string(),
        },
    );

    let is_proton_script = proton_bin
        .file_name()
        .map(|n| n == "proton")
        .unwrap_or(false);

    let mut cmd = tokio::process::Command::new(&proton_bin);

    if is_proton_script {
        cmd.arg("run");
    }

    cmd.arg(&target_exe);

    // Append custom runtime arguments if specified
    if !profile.custom_launch_args.trim().is_empty() {
        for arg in profile.custom_launch_args.split_whitespace() {
            cmd.arg(arg);
        }
    }

    // Set standard Steam Proton environment
    cmd.env(
        "STEAM_COMPAT_CLIENT_INSTALL_PATH",
        client_install_dir.to_string_lossy().to_string(),
    );
    cmd.env(
        "STEAM_COMPAT_DATA_PATH",
        prefix_dir.to_string_lossy().to_string(),
    );
    cmd.env("WINEPREFIX", prefix_dir.to_string_lossy().to_string());

    // Parse user env args (supporting quotes, Steam %command% placeholder, etc.)
    let parsed_envs = parse_env_string(&profile.env_args);
    for (k, v) in &parsed_envs {
        cmd.env(k, v);
        let _ = app.emit(
            "launcher-log",
            LauncherLogEvent {
                text: format!("[Env] {}={}", k, v),
                level: "system".to_string(),
            },
        );
    }

    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn process {:?}: {}", proton_bin, e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let app_stdout = app.clone();
    if let Some(stdout) = stdout {
        tokio::spawn(async move {
            let mut reader = tokio::io::BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_stdout.emit(
                    "launcher-log",
                    LauncherLogEvent {
                        text: line,
                        level: "stdout".to_string(),
                    },
                );
            }
        });
    }

    let app_stderr = app.clone();
    if let Some(stderr) = stderr {
        tokio::spawn(async move {
            let mut reader = tokio::io::BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_stderr.emit(
                    "launcher-log",
                    LauncherLogEvent {
                        text: line,
                        level: "stderr".to_string(),
                    },
                );
            }
        });
    }

    let app_exit = app.clone();
    let pid_exit = profile.id.clone();
    let name_exit = profile.name.clone();
    tokio::spawn(async move {
        match child.wait().await {
            Ok(status) => {
                let _ = app_exit.emit(
                    "launcher-log",
                    LauncherLogEvent {
                        text: format!("[System] {} finished with status: {}", name_exit, status),
                        level: "system".to_string(),
                    },
                );
            }
            Err(e) => {
                let _ = app_exit.emit(
                    "launcher-log",
                    LauncherLogEvent {
                        text: format!("[System Error] Process wait error for {}: {}", name_exit, e),
                        level: "error".to_string(),
                    },
                );
            }
        }

        // Emit status update to idle so frontend immediately reacts to user closing launcher
        let _ = app_exit.emit(
            "launcher-status-changed",
            serde_json::json!({
                "profile_id": pid_exit,
                "status": "idle"
            }),
        );
        let _ = app_exit.emit("launcher-stopped", pid_exit);
    });

    Ok(())
}

// Backward compatibility command
#[tauri::command]
pub async fn run_battlenet(
    app: tauri::AppHandle,
    _proton_tag: String,
    _env_args: String,
) -> Result<(), String> {
    run_launcher(app, "battlenet".to_string()).await
}

#[derive(Debug, Serialize, Clone)]
pub struct ResolvedExeInfo {
    pub path: Option<String>,
    pub exists: bool,
    pub is_custom: bool,
}

#[tauri::command]
pub fn get_resolved_launcher_exe(profile_id: String) -> Result<ResolvedExeInfo, String> {
    let config = load_config()?;
    let profile = config
        .profiles
        .into_iter()
        .find(|p| p.id == profile_id)
        .ok_or_else(|| format!("Profile '{}' not found", profile_id))?;

    let is_custom = profile
        .custom_exe_path
        .as_ref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);

    if let Some(exe) = find_launcher_exe(&profile) {
        let exists = exe.exists();
        Ok(ResolvedExeInfo {
            path: Some(exe.to_string_lossy().to_string()),
            exists,
            is_custom,
        })
    } else if let Some(ref custom) = profile.custom_exe_path {
        let p = PathBuf::from(custom.trim());
        let exists = p.exists();
        Ok(ResolvedExeInfo {
            path: Some(custom.clone()),
            exists,
            is_custom: true,
        })
    } else {
        Ok(ResolvedExeInfo {
            path: None,
            exists: false,
            is_custom: false,
        })
    }
}

#[tauri::command]
pub async fn browse_executable_file() -> Result<Option<String>, String> {
    // Try native zenity file picker first
    let output = tokio::process::Command::new("zenity")
        .arg("--file-selection")
        .arg("--title=Select Executable File")
        .arg("--file-filter=Executable Files (*.exe *.bat *.cmd) | *.exe *.bat *.cmd")
        .arg("--file-filter=All Files | *")
        .output()
        .await;

    if let Ok(out) = output {
        if out.status.success() {
            let path_str = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !path_str.is_empty() {
                return Ok(Some(path_str));
            }
        }
    }

    // Fallback: try kdialog
    let koutput = tokio::process::Command::new("kdialog")
        .arg("--getopenfilename")
        .arg(".")
        .arg("*.exe *.bat *.cmd|Executable Files\n*|All Files")
        .output()
        .await;

    if let Ok(out) = koutput {
        if out.status.success() {
            let path_str = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !path_str.is_empty() {
                return Ok(Some(path_str));
            }
        }
    }

    Ok(None)
}

#[tauri::command]
pub async fn uninstall_launcher(
    app: tauri::AppHandle,
    profile_id: String,
) -> Result<String, String> {
    // 1. Terminate all wineserver and lingering processes
    let _ = kill_wineserver(app.clone(), Some(profile_id.clone())).await;

    // 2. Remove isolated prefix folder
    let prefix_dir = get_profile_prefix_dir(&profile_id);
    if prefix_dir.exists() {
        fs::remove_dir_all(&prefix_dir)
            .map_err(|e| format!("Failed to remove prefix directory {:?}: {}", prefix_dir, e))?;
    }

    let msg = format!("Launcher prefix for '{}' uninstalled successfully.", profile_id);
    let _ = app.emit(
        "launcher-log",
        LauncherLogEvent {
            text: format!("[System] {}", msg),
            level: "system".to_string(),
        },
    );
    let _ = app.emit(
        "launcher-status-changed",
        serde_json::json!({
            "profile_id": profile_id,
            "status": "idle"
        }),
    );
    let _ = app.emit("launcher-stopped", profile_id);

    Ok(msg)
}

#[tauri::command]
pub async fn reinstall_launcher(
    app: tauri::AppHandle,
    profile_id: String,
) -> Result<String, String> {
    // 1. Terminate all wineserver and lingering processes
    let _ = kill_wineserver(app.clone(), Some(profile_id.clone())).await;

    // 2. Remove existing prefix folder
    let prefix_dir = get_profile_prefix_dir(&profile_id);
    if prefix_dir.exists() {
        fs::remove_dir_all(&prefix_dir)
            .map_err(|e| format!("Failed to remove prefix directory {:?}: {}", prefix_dir, e))?;
    }

    // 3. Re-create empty prefix directory
    fs::create_dir_all(&prefix_dir)
        .map_err(|e| format!("Failed to re-create prefix directory {:?}: {}", prefix_dir, e))?;

    let msg = format!("Prefix for '{}' has been reset. Ready for clean setup.", profile_id);
    let _ = app.emit(
        "launcher-log",
        LauncherLogEvent {
            text: format!("[System] {}", msg),
            level: "system".to_string(),
        },
    );
    let _ = app.emit(
        "launcher-status-changed",
        serde_json::json!({
            "profile_id": profile_id,
            "status": "idle"
        }),
    );
    let _ = app.emit("launcher-stopped", profile_id);

    Ok(msg)
}

#[tauri::command]
pub async fn kill_wineserver(
    app: tauri::AppHandle,
    profile_id: Option<String>,
) -> Result<String, String> {
    let pid = profile_id.unwrap_or_else(|| "battlenet".to_string());
    let prefix = get_profile_prefix_dir(&pid);
    let prefix_pfx = prefix.join("pfx");
    let target_pfx = if prefix_pfx.exists() {
        prefix_pfx
    } else {
        prefix.clone()
    };

    let _ = app.emit(
        "launcher-log",
        LauncherLogEvent {
            text: format!(
                "[System] Stopping wineserver for '{}' at {:?}...",
                pid, target_pfx
            ),
            level: "system".to_string(),
        },
    );

    // 1. Run wineserver -k
    let _ = tokio::process::Command::new("wineserver")
        .arg("-k")
        .env("WINEPREFIX", &target_pfx)
        .output()
        .await;

    // 2. Force-terminate lingering platform processes via pkill
    let targets = [
        // Battle.net
        "Battle.net.exe",
        "Agent.exe",
        "Battle.net Helper.exe",
        "Battle.net Launcher.exe",
        // Ubisoft
        "UbisoftConnect.exe",
        "upc.exe",
        "Uplay.exe",
        "UbisoftGameLauncher.exe",
        // EA
        "EALauncher.exe",
        "EADesktop.exe",
        "EABackgroundService.exe",
        "Link2EA.exe",
        // Wargaming
        "wgc.exe",
        "wgc_renderer.exe",
        // Wine
        "wineserver",
        "wine64-preloader",
        "wine-preloader",
    ];

    for target in &targets {
        let _ = tokio::process::Command::new("pkill")
            .arg("-9")
            .arg("-f")
            .arg(target)
            .output()
            .await;
    }

    let msg = format!(
        "wineserver -k executed for '{}'. Lingering processes stopped.",
        pid
    );
    let _ = app.emit(
        "launcher-log",
        LauncherLogEvent {
            text: format!("[System] {}", msg),
            level: "system".to_string(),
        },
    );
    let _ = app.emit(
        "launcher-status-changed",
        serde_json::json!({
            "profile_id": pid,
            "status": "idle"
        }),
    );
    let _ = app.emit("launcher-stopped", pid);

    Ok(msg)
}

/// Tokenizes an environment argument string respecting quotes and ignoring %command%
pub fn parse_env_string(input: &str) -> Vec<(String, String)> {
    let mut result = Vec::new();
    let mut chars = input.chars().peekable();
    let mut current_token = String::new();
    let mut in_quote: Option<char> = None;

    while let Some(c) = chars.next() {
        match c {
            '"' | '\'' => {
                if in_quote == Some(c) {
                    in_quote = None; // closing quote
                } else if in_quote.is_none() {
                    in_quote = Some(c); // opening quote
                } else {
                    current_token.push(c);
                }
            }
            ' ' | '\t' | '\n' if in_quote.is_none() => {
                if !current_token.is_empty() {
                    process_token(&current_token, &mut result);
                    current_token.clear();
                }
            }
            _ => {
                current_token.push(c);
            }
        }
    }

    if !current_token.is_empty() {
        process_token(&current_token, &mut result);
    }

    result
}

fn process_token(token: &str, out: &mut Vec<(String, String)>) {
    let trimmed = token.trim();
    if trimmed == "%command%" || trimmed.is_empty() {
        return;
    }
    if let Some((k, v)) = trimmed.split_once('=') {
        let key = k.trim().to_string();
        let mut val = v.trim().to_string();
        // Strip surrounding quotes if present
        if (val.starts_with('"') && val.ends_with('"'))
            || (val.starts_with('\'') && val.ends_with('\''))
        {
            if val.len() >= 2 {
                val = val[1..val.len() - 1].to_string();
            }
        }
        out.push((key, val));
    }
}
