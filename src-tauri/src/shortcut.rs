use crate::config::{get_desktop_file_path, get_icons_dir};
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

// Embed the default icon so the desktop shortcut always has a valid image
const EMBEDDED_ICON: &[u8] = include_bytes!("../icons/icon.png");

pub fn setup_desktop_shortcut() -> Result<String, String> {
    let icons_dir = get_icons_dir();
    fs::create_dir_all(&icons_dir)
        .map_err(|e| format!("Failed to create icons directory: {}", e))?;

    let icon_path = icons_dir.join("bnet-launcher.png");
    if !icon_path.exists() {
        fs::write(&icon_path, EMBEDDED_ICON)
            .map_err(|e| format!("Failed to write launcher icon: {}", e))?;
    }

    let exe_path = std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "bnet-launcher".to_string());

    let desktop_file = get_desktop_file_path();
    if let Some(parent) = desktop_file.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create applications directory: {}", e))?;
    }

    let content = format!(
        "[Desktop Entry]\n\
         Name=Game Multi-Launcher\n\
         GenericName=Linux Game Multi-Launcher\n\
         Comment=Modular Linux Game Launcher with Proton-GE\n\
         Exec=\"{}\" %u\n\
         Icon={}\n\
         Terminal=false\n\
         Type=Application\n\
         Categories=Game;\n\
         StartupWMClass=bnet-linux-launcher\n\
         Keywords=Gaming;Game;Launcher;Battle.net;Blizzard;Ubisoft;EA;Wargaming;Proton;Wine;\n",
        exe_path,
        icon_path.to_string_lossy()
    );

    fs::write(&desktop_file, content)
        .map_err(|e| format!("Failed to write desktop shortcut at {:?}: {}", desktop_file, e))?;

    #[cfg(unix)]
    {
        if let Ok(metadata) = fs::metadata(&desktop_file) {
            let mut perms = metadata.permissions();
            perms.set_mode(0o755);
            let _ = fs::set_permissions(&desktop_file, perms);
        }
    }

    Ok(format!(
        "Desktop shortcut successfully created at {}",
        desktop_file.display()
    ))
}

#[tauri::command]
pub fn create_desktop_shortcut() -> Result<String, String> {
    setup_desktop_shortcut()
}
