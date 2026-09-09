use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const APP_DIR_NAME: &str = "bnet-linux-launcher";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LauncherProfile {
    pub id: String,
    pub name: String,
    pub selected_proton: Option<String>,
    pub env_args: String,
    pub custom_exe_path: Option<String>,
    pub custom_launch_args: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LauncherConfig {
    pub active_profile_id: String,
    pub profiles: Vec<LauncherProfile>,
}

impl Default for LauncherConfig {
    fn default() -> Self {
        Self {
            active_profile_id: "battlenet".to_string(),
            profiles: vec![
                LauncherProfile {
                    id: "battlenet".to_string(),
                    name: "Battle.net".to_string(),
                    selected_proton: None,
                    env_args: "DXVK_HUD=fps WINEFSYNC=1".to_string(),
                    custom_exe_path: None,
                    custom_launch_args: "".to_string(),
                },
                LauncherProfile {
                    id: "ubisoft".to_string(),
                    name: "Ubisoft Connect".to_string(),
                    selected_proton: None,
                    env_args: "DXVK_HUD=fps WINEFSYNC=1".to_string(),
                    custom_exe_path: None,
                    custom_launch_args: "".to_string(),
                },
                LauncherProfile {
                    id: "ea".to_string(),
                    name: "EA App".to_string(),
                    selected_proton: None,
                    env_args: "DXVK_HUD=fps WINEFSYNC=1".to_string(),
                    custom_exe_path: None,
                    custom_launch_args: "".to_string(),
                },
                LauncherProfile {
                    id: "wargaming".to_string(),
                    name: "Wargaming.net".to_string(),
                    selected_proton: None,
                    env_args: "DXVK_HUD=fps WINEFSYNC=1".to_string(),
                    custom_exe_path: None,
                    custom_launch_args: "".to_string(),
                },
                LauncherProfile {
                    id: "custom".to_string(),
                    name: "Custom App".to_string(),
                    selected_proton: None,
                    env_args: "".to_string(),
                    custom_exe_path: None,
                    custom_launch_args: "".to_string(),
                },
            ],
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LauncherPaths {
    pub config_path: String,
    pub data_path: String,
    pub prefix_path: String,
    pub proton_dir: String,
    pub desktop_file: String,
    pub is_installed: bool,
}

// Legacy single-profile config struct for automatic migration
#[derive(Deserialize)]
struct LegacyConfig {
    selected_proton: Option<String>,
    env_args: Option<String>,
}

/// Resolves XDG config path: ~/.config/bnet-linux-launcher/config.json
pub fn get_config_path() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        home.join(".config")
    });
    base.join(APP_DIR_NAME).join("config.json")
}

/// Resolves XDG data local directory: ~/.local/share/bnet-linux-launcher/
pub fn get_data_dir() -> PathBuf {
    let base = dirs::data_local_dir().unwrap_or_else(|| {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        home.join(".local").join("share")
    });
    base.join(APP_DIR_NAME)
}

pub fn get_proton_dir() -> PathBuf {
    get_data_dir().join("proton")
}

pub fn get_cache_dir() -> PathBuf {
    get_data_dir().join("cache")
}

pub fn get_icons_dir() -> PathBuf {
    get_data_dir().join("icons")
}

pub fn get_prefixes_base_dir() -> PathBuf {
    get_data_dir().join("prefixes")
}

/// Returns the isolated prefix directory for a specific profile
pub fn get_profile_prefix_dir(profile_id: &str) -> PathBuf {
    let new_path = get_prefixes_base_dir().join(profile_id);
    if profile_id == "battlenet" {
        let legacy_path = get_data_dir().join("prefix");
        if !new_path.exists() && legacy_path.exists() {
            return legacy_path;
        }
    }
    new_path
}

pub fn get_desktop_file_path() -> PathBuf {
    let apps_dir = dirs::data_local_dir()
        .unwrap_or_else(|| {
            let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
            home.join(".local").join("share")
        })
        .join("applications");
    apps_dir.join("bnet-launcher.desktop")
}

/// Ensures all XDG standard directories exist
pub fn ensure_directories() -> Result<LauncherPaths, String> {
    let config_file = get_config_path();
    if let Some(parent) = config_file.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory {:?}: {}", parent, e))?;
    }

    let data_dir = get_data_dir();
    let proton_dir = get_proton_dir();
    let cache_dir = get_cache_dir();
    let icons_dir = get_icons_dir();
    let prefixes_base = get_prefixes_base_dir();

    for dir in &[&data_dir, &proton_dir, &cache_dir, &icons_dir, &prefixes_base] {
        fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create data directory {:?}: {}", dir, e))?;
    }

    // Ensure prefixes for all default profiles exist
    let default_ids = ["battlenet", "ubisoft", "ea", "wargaming", "custom"];
    for id in &default_ids {
        let p = get_profile_prefix_dir(id);
        let _ = fs::create_dir_all(&p);
    }

    let apps_dir = dirs::data_local_dir()
        .map(|p| p.join("applications"))
        .unwrap_or_else(|| get_data_dir().join("applications"));
    let _ = fs::create_dir_all(&apps_dir);

    Ok(LauncherPaths {
        config_path: config_file.to_string_lossy().to_string(),
        data_path: data_dir.to_string_lossy().to_string(),
        prefix_path: get_profile_prefix_dir("battlenet").to_string_lossy().to_string(),
        proton_dir: proton_dir.to_string_lossy().to_string(),
        desktop_file: get_desktop_file_path().to_string_lossy().to_string(),
        is_installed: false,
    })
}

#[tauri::command]
pub fn get_launcher_paths() -> Result<LauncherPaths, String> {
    ensure_directories()
}

#[tauri::command]
pub fn load_config() -> Result<LauncherConfig, String> {
    let path = get_config_path();
    if !path.exists() {
        let default_config = LauncherConfig::default();
        let _ = save_full_config(&default_config);
        return Ok(default_config);
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Could not read config at {:?}: {}", path, e))?;

    // Try modern multi-profile config
    if let Ok(config) = serde_json::from_str::<LauncherConfig>(&content) {
        return Ok(config);
    }

    // Try migrating legacy single-profile config
    if let Ok(legacy) = serde_json::from_str::<LegacyConfig>(&content) {
        let mut default_config = LauncherConfig::default();
        if let Some(bnet) = default_config.profiles.iter_mut().find(|p| p.id == "battlenet") {
            if legacy.selected_proton.is_some() {
                bnet.selected_proton = legacy.selected_proton;
            }
            if let Some(env) = legacy.env_args {
                bnet.env_args = env;
            }
        }
        let _ = save_full_config(&default_config);
        return Ok(default_config);
    }

    // Fallback on corrupted config
    let default_config = LauncherConfig::default();
    let _ = save_full_config(&default_config);
    Ok(default_config)
}

fn save_full_config(config: &LauncherConfig) -> Result<(), String> {
    let path = get_config_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&path, json).map_err(|e| format!("Failed to write config to {:?}: {}", path, e))?;

    Ok(())
}

#[tauri::command]
pub fn save_config(config: LauncherConfig) -> Result<(), String> {
    save_full_config(&config)
}

#[tauri::command]
pub fn save_profile(profile: LauncherProfile) -> Result<(), String> {
    let mut config = load_config()?;
    if let Some(existing) = config.profiles.iter_mut().find(|p| p.id == profile.id) {
        *existing = profile;
    } else {
        config.profiles.push(profile);
    }
    save_full_config(&config)
}

#[tauri::command]
pub fn set_active_profile(profile_id: String) -> Result<(), String> {
    let mut config = load_config()?;
    if config.profiles.iter().any(|p| p.id == profile_id) {
        config.active_profile_id = profile_id;
        save_full_config(&config)?;
    }
    Ok(())
}

#[tauri::command]
pub fn add_custom_profile(
    name: String,
    exe_path: Option<String>,
    proton: Option<String>,
) -> Result<LauncherProfile, String> {
    let mut config = load_config()?;
    let unique_id = format!(
        "custom_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    let prefix_dir = get_profile_prefix_dir(&unique_id);
    let _ = fs::create_dir_all(&prefix_dir);

    let clean_exe = exe_path.and_then(|p| {
        let t = p.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    });

    let new_profile = LauncherProfile {
        id: unique_id.clone(),
        name: if name.trim().is_empty() {
            "Custom App".to_string()
        } else {
            name.trim().to_string()
        },
        selected_proton: proton,
        env_args: "DXVK_HUD=fps WINEFSYNC=1".to_string(),
        custom_exe_path: clean_exe,
        custom_launch_args: "".to_string(),
    };

    config.profiles.push(new_profile.clone());
    config.active_profile_id = unique_id;
    save_full_config(&config)?;

    Ok(new_profile)
}

#[tauri::command]
pub fn delete_profile(profile_id: String, delete_prefix: bool) -> Result<(), String> {
    let mut config = load_config()?;

    // Do not allow deleting built-in default profiles
    let default_ids = ["battlenet", "ubisoft", "ea", "wargaming"];
    if default_ids.contains(&profile_id.as_str()) {
        return Err(format!("Cannot delete built-in profile '{}'", profile_id));
    }

    let initial_len = config.profiles.len();
    config.profiles.retain(|p| p.id != profile_id);

    if config.profiles.len() == initial_len {
        return Err(format!("Profile '{}' not found", profile_id));
    }

    if config.active_profile_id == profile_id {
        config.active_profile_id = config
            .profiles
            .first()
            .map(|p| p.id.clone())
            .unwrap_or_else(|| "battlenet".to_string());
    }

    save_full_config(&config)?;

    if delete_prefix {
        let prefix_dir = get_profile_prefix_dir(&profile_id);
        if prefix_dir.exists() {
            let _ = fs::remove_dir_all(&prefix_dir);
        }
    }

    Ok(())
}

#[tauri::command]
pub fn rename_profile(profile_id: String, new_name: String) -> Result<(), String> {
    let mut config = load_config()?;
    if let Some(prof) = config.profiles.iter_mut().find(|p| p.id == profile_id) {
        prof.name = new_name;
        save_full_config(&config)?;
        Ok(())
    } else {
        Err(format!("Profile '{}' not found", profile_id))
    }
}

#[tauri::command]
pub async fn open_launcher_folder(profile_id: String) -> Result<String, String> {
    let dir = get_profile_prefix_dir(&profile_id);
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create folder {:?}: {}", dir, e))?;

    // Try xdg-open first, fallback to gio open
    let xdg = tokio::process::Command::new("xdg-open")
        .arg(&dir)
        .spawn();

    match xdg {
        Ok(_) => Ok(format!("Opened directory in file manager: {}", dir.display())),
        Err(e) => {
            let gio = tokio::process::Command::new("gio")
                .arg("open")
                .arg(&dir)
                .spawn();
            match gio {
                Ok(_) => Ok(format!("Opened directory via gio: {}", dir.display())),
                Err(_) => Err(format!("Could not open file manager for {:?}: {}", dir, e)),
            }
        }
    }
}


