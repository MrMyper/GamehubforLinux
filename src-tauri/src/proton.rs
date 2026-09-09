use crate::config::{get_cache_dir, get_proton_dir};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::Emitter;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProtonRelease {
    pub tag_name: String,
    pub name: String,
    pub tarball_url: Option<String>,
    pub size: Option<u64>,
    pub published_at: String,
    pub category: Option<String>,
    pub is_installed: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadProgress {
    pub version: String,
    pub downloaded: u64,
    pub total: u64,
    pub percentage: f64,
    pub status: String,
    pub retry_count: u32,
}

#[derive(Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    name: Option<String>,
    published_at: Option<String>,
    assets: Vec<GitHubAsset>,
}

/// Returns all standard directories where Proton versions may reside
pub fn get_proton_search_dirs() -> Vec<PathBuf> {
    let mut dirs_to_check = Vec::new();

    // 1. App's own proton directory (~/.local/share/bnet-linux-launcher/proton)
    dirs_to_check.push(get_proton_dir());

    // 2. Steam standard compatibilitytools.d & steamapps/common
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

    let steam_roots = [
        home.join(".local/share/Steam"),
        home.join(".steam/steam"),
        home.join(".steam/root"),
        home.join(".var/app/com.valvesoftware.Steam/data/Steam"),
    ];

    for root in &steam_roots {
        let compat = root.join("compatibilitytools.d");
        if compat.exists() {
            dirs_to_check.push(compat);
        }
        let common = root.join("steamapps/common");
        if common.exists() {
            dirs_to_check.push(common);
        }
    }

    dirs_to_check
}

/// Checks if a directory contains a valid Proton executable runner
pub fn is_valid_proton_dir(path: &Path) -> bool {
    if !path.is_dir() {
        return false;
    }
    // Ignore runtime/voice/configs support directories
    let dir_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_lowercase();
    if dir_name.contains("runtime")
        || dir_name.contains("voice")
        || dir_name.contains("configs")
        || dir_name.contains("shared")
    {
        return false;
    }

    let candidates = [
        path.join("proton"),
        path.join("dist/bin/wine"),
        path.join("files/bin/wine"),
    ];

    candidates.iter().any(|c| c.exists())
}

#[tauri::command]
pub fn get_installed_protons() -> Result<Vec<String>, String> {
    let mut installed = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for search_dir in get_proton_search_dirs() {
        if !search_dir.exists() {
            continue;
        }

        if let Ok(entries) = fs::read_dir(&search_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if is_valid_proton_dir(&path) {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        // Only add valid Proton runners
                        if (name.contains("Proton") || name.starts_with("GE-") || name.starts_with("wine-"))
                            && seen.insert(name.to_string())
                        {
                            installed.push(name.to_string());
                        }
                    }
                }
            }
        }
    }

    // Sort with natural version ordering: newest first
    installed.sort_by(|a, b| b.cmp(a));
    Ok(installed)
}

#[tauri::command]
pub async fn fetch_proton_releases() -> Result<Vec<ProtonRelease>, String> {
    let mut result = Vec::new();
    let mut seen_tags = std::collections::HashSet::new();

    // 1. Add all installed local & system/Steam Proton versions first
    let installed_protons = get_installed_protons().unwrap_or_default();
    for proton_name in &installed_protons {
        let is_valve = proton_name.starts_with("Proton ") || proton_name == "Proton - Experimental" || proton_name == "Proton Hotfix";
        let category = if is_valve {
            "valve".to_string()
        } else if proton_name.contains("11-") || proton_name.contains("11.") {
            "ge-11".to_string()
        } else if proton_name.contains("10-") || proton_name.contains("10.") {
            "ge-10".to_string()
        } else if proton_name.contains("9-") || proton_name.contains("9.") {
            "ge-9".to_string()
        } else if proton_name.contains("8-") || proton_name.contains("8.") {
            "ge-8".to_string()
        } else {
            "installed".to_string()
        };

        seen_tags.insert(proton_name.clone());
        result.push(ProtonRelease {
            tag_name: proton_name.clone(),
            name: if is_valve {
                format!("Valve {} (Installed)", proton_name)
            } else {
                format!("{} (Installed)", proton_name)
            },
            tarball_url: None,
            size: None,
            published_at: String::new(),
            category: Some(category),
            is_installed: Some(true),
        });
    }

    // 2. Fetch GloriousEggroll/proton-ge-custom releases from GitHub (pages 1 and 2 to reach GE-Proton8)
    let client = reqwest::Client::builder()
        .user_agent("bnet-linux-launcher/0.1.0 (https://github.com)")
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let target_arch = std::env::consts::ARCH;

    for page in 1..=2 {
        let url = format!(
            "https://api.github.com/repos/GloriousEggroll/proton-ge-custom/releases?per_page=100&page={}",
            page
        );
        let resp = match client.get(&url).send().await {
            Ok(r) if r.status().is_success() => r,
            _ => break, // If rate-limited or error, proceed with what we have
        };

        let releases: Vec<GitHubRelease> = match resp.json().await {
            Ok(rels) => rels,
            Err(_) => break,
        };

        if releases.is_empty() {
            break;
        }

        for rel in releases {
            let tag = &rel.tag_name;
            // Filter releases to focus on GE-Proton 8, 9, 10, 11
            let category = if tag.contains("GE-Proton11") {
                Some("ge-11".to_string())
            } else if tag.contains("GE-Proton10") {
                Some("ge-10".to_string())
            } else if tag.contains("GE-Proton9") {
                Some("ge-9".to_string())
            } else if tag.contains("GE-Proton8") {
                Some("ge-8".to_string())
            } else {
                continue; // Skip pre-8 versions to keep list high quality
            };

            let is_inst = seen_tags.contains(tag);

            if !seen_tags.insert(tag.clone()) && is_inst {
                continue;
            }

            let tar_assets: Vec<&GitHubAsset> = rel
                .assets
                .iter()
                .filter(|a| a.name.ends_with(".tar.gz"))
                .collect();

            let chosen_asset = tar_assets
                .iter()
                .find(|a| {
                    a.name.contains(target_arch)
                        || (target_arch == "x86_64" && a.name.contains("x86-64"))
                })
                .or_else(|| tar_assets.first())
                .copied();

            result.push(ProtonRelease {
                tag_name: rel.tag_name.clone(),
                name: rel.name.unwrap_or_else(|| rel.tag_name.clone()),
                tarball_url: chosen_asset.map(|a| a.browser_download_url.clone()),
                size: chosen_asset.map(|a| a.size),
                published_at: rel.published_at.unwrap_or_default(),
                category,
                is_installed: Some(is_inst),
            });
        }
    }

    Ok(result)
}

async fn download_with_retry(
    app: &tauri::AppHandle,
    version_tag: &str,
    download_url: &str,
    cache_file: &Path,
) -> Result<(), String> {
    let max_retries = 3;
    let mut attempt = 0;
    let client = reqwest::Client::builder()
        .user_agent("bnet-linux-launcher/0.1.0")
        .connect_timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    while attempt < max_retries {
        attempt += 1;

        let retry_notice = if attempt > 1 {
            format!("(Attempt {}/{})", attempt, max_retries)
        } else {
            String::new()
        };

        let emit_progress = |downloaded: u64, total: u64, status: &str| {
            let percentage = if total > 0 {
                (downloaded as f64 / total as f64) * 100.0
            } else {
                0.0
            };
            let _ = app.emit(
                "proton-download-progress",
                DownloadProgress {
                    version: version_tag.to_string(),
                    downloaded,
                    total,
                    percentage,
                    status: status.to_string(),
                    retry_count: attempt - 1,
                },
            );
        };

        emit_progress(
            0,
            0,
            &format!("Connecting to download server... {}", retry_notice),
        );

        match client.get(download_url).send().await {
            Ok(response) if response.status().is_success() => {
                let total = response.content_length().unwrap_or(0);
                emit_progress(
                    0,
                    total,
                    &format!("Downloading archive... {}", retry_notice),
                );

                let part_file = cache_file.with_extension("tar.gz.part");
                let mut file = match File::create(&part_file) {
                    Ok(f) => f,
                    Err(e) => {
                        return Err(format!("Failed to create temporary download file: {}", e))
                    }
                };

                let mut downloaded: u64 = 0;
                let mut stream = response.bytes_stream();
                let mut last_emit = std::time::Instant::now();
                let mut success = true;

                while let Some(chunk_result) = stream.next().await {
                    match chunk_result {
                        Ok(chunk) => {
                            if let Err(e) = file.write_all(&chunk) {
                                eprintln!("Error writing chunk: {}", e);
                                success = false;
                                break;
                            }
                            downloaded += chunk.len() as u64;

                            if last_emit.elapsed() >= Duration::from_millis(150)
                                || downloaded == total
                            {
                                emit_progress(
                                    downloaded,
                                    total,
                                    "Downloading Proton-GE archive...",
                                );
                                last_emit = std::time::Instant::now();
                            }
                        }
                        Err(e) => {
                            eprintln!("Network stream error on attempt {}: {}", attempt, e);
                            success = false;
                            break;
                        }
                    }
                }

                if success && (total == 0 || downloaded >= total) {
                    if let Err(e) = fs::rename(&part_file, cache_file) {
                        return Err(format!("Failed to finalize downloaded archive: {}", e));
                    }
                    return Ok(());
                } else {
                    let _ = fs::remove_file(&part_file);
                    if attempt < max_retries {
                        let delay = Duration::from_secs(1 << (attempt - 1));
                        emit_progress(
                            downloaded,
                            total,
                            &format!(
                                "Download interrupted. Retrying in {}s...",
                                delay.as_secs()
                            ),
                        );
                        tokio::time::sleep(delay).await;
                    }
                }
            }
            Ok(resp) => {
                let status_code = resp.status();
                eprintln!("HTTP error {} on attempt {}", status_code, attempt);
                if attempt < max_retries {
                    let delay = Duration::from_secs(1 << (attempt - 1));
                    tokio::time::sleep(delay).await;
                }
            }
            Err(e) => {
                eprintln!("Connection failed on attempt {}: {}", attempt, e);
                if attempt < max_retries {
                    let delay = Duration::from_secs(1 << (attempt - 1));
                    tokio::time::sleep(delay).await;
                }
            }
        }
    }

    // Cleanup any lingering artifacts
    let part_file = cache_file.with_extension("tar.gz.part");
    let _ = fs::remove_file(&part_file);

    Err(format!(
        "Failed to download {} after {} attempts.",
        version_tag, max_retries
    ))
}

fn extract_archive(
    app: &tauri::AppHandle,
    version_tag: &str,
    tarball_path: &Path,
) -> Result<(), String> {
    let proton_dir = get_proton_dir();
    fs::create_dir_all(&proton_dir)
        .map_err(|e| format!("Failed to create proton directory: {}", e))?;

    let _ = app.emit(
        "proton-download-progress",
        DownloadProgress {
            version: version_tag.to_string(),
            downloaded: 0,
            total: 0,
            percentage: 99.0,
            status: "Decompressing and extracting archive...".to_string(),
            retry_count: 0,
        },
    );

    let target_version_dir = proton_dir.join(version_tag);

    let tar_gz = File::open(tarball_path)
        .map_err(|e| format!("Failed to open downloaded archive: {}", e))?;
    let tar = flate2::read::GzDecoder::new(tar_gz);
    let mut archive = tar::Archive::new(tar);

    let temp_extract_dir = get_cache_dir().join(format!("extract_{}", version_tag));
    if temp_extract_dir.exists() {
        let _ = fs::remove_dir_all(&temp_extract_dir);
    }
    fs::create_dir_all(&temp_extract_dir)
        .map_err(|e| format!("Failed to create temporary extraction folder: {}", e))?;

    if let Err(e) = archive.unpack(&temp_extract_dir) {
        let _ = fs::remove_dir_all(&temp_extract_dir);
        let _ = fs::remove_file(tarball_path);
        return Err(format!("Extraction error: {}", e));
    }

    if target_version_dir.exists() {
        let _ = fs::remove_dir_all(&target_version_dir);
    }

    let mut inner_items = Vec::new();
    if let Ok(entries) = fs::read_dir(&temp_extract_dir) {
        for entry in entries.flatten() {
            inner_items.push(entry.path());
        }
    }

    if inner_items.len() == 1 && inner_items[0].is_dir() {
        fs::rename(&inner_items[0], &target_version_dir)
            .map_err(|e| format!("Failed to move extracted proton folder: {}", e))?;
    } else {
        fs::rename(&temp_extract_dir, &target_version_dir)
            .map_err(|e| format!("Failed to place extracted proton folder: {}", e))?;
    }

    let _ = fs::remove_dir_all(&temp_extract_dir);
    let _ = fs::remove_file(tarball_path);

    let _ = app.emit(
        "proton-download-progress",
        DownloadProgress {
            version: version_tag.to_string(),
            downloaded: 100,
            total: 100,
            percentage: 100.0,
            status: "Extraction complete!".to_string(),
            retry_count: 0,
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn download_and_extract_proton(
    app: tauri::AppHandle,
    version_tag: String,
    download_url: Option<String>,
) -> Result<(), String> {
    let url = match download_url {
        Some(u) if !u.is_empty() => u,
        _ => {
            let releases = fetch_proton_releases().await?;
            let release = releases
                .into_iter()
                .find(|r| r.tag_name == version_tag)
                .ok_or_else(|| format!("Release {} not found on GitHub", version_tag))?;
            release
                .tarball_url
                .ok_or_else(|| format!("No .tar.gz asset found for {}", version_tag))?
        }
    };

    let cache_dir = get_cache_dir();
    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create cache directory: {}", e))?;

    let cache_file = cache_dir.join(format!("{}.tar.gz", version_tag));

    download_with_retry(&app, &version_tag, &url, &cache_file).await?;
    extract_archive(&app, &version_tag, &cache_file)?;

    Ok(())
}
