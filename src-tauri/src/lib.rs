pub mod config;
pub mod launcher;
pub mod proton;
pub mod shortcut;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            // Ensure XDG Base Directory structure exists on launch
            if let Err(e) = config::ensure_directories() {
                eprintln!("[Launcher Init Warning] Failed to create directories: {}", e);
            }

            // Automatically create or verify desktop shortcut
            if let Err(e) = shortcut::setup_desktop_shortcut() {
                eprintln!("[Launcher Init Warning] Failed to setup desktop shortcut: {}", e);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            config::get_launcher_paths,
            config::load_config,
            config::save_config,
            config::save_profile,
            config::set_active_profile,
            config::open_launcher_folder,
            config::add_custom_profile,
            config::delete_profile,
            config::rename_profile,
            shortcut::create_desktop_shortcut,
            proton::fetch_proton_releases,
            proton::get_installed_protons,
            proton::download_and_extract_proton,
            launcher::check_launcher_installed,
            launcher::check_battlenet_installed,
            launcher::get_resolved_launcher_exe,
            launcher::browse_executable_file,
            launcher::run_launcher,
            launcher::run_battlenet,
            launcher::kill_wineserver,
            launcher::uninstall_launcher,
            launcher::reinstall_launcher
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
