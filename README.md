# Gamehub for Linux

<div align="center">

![Platform](https://img.shields.io/badge/Platform-Linux-orange?logo=linux&logoColor=white)
![Framework](https://img.shields.io/badge/Tauri-v2-24C8D8?logo=tauri&logoColor=white)
![Frontend](https://img.shields.io/badge/React_19-Vite-61DAFB?logo=react&logoColor=white)
![Backend](https://img.shields.io/badge/Rust-2021-DEA584?logo=rust&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)

**A high-performance, lightweight gaming launcher and runner manager for Linux.**  
Run Battle.net, Ubisoft Connect, EA App, Wargaming, and your own custom Windows games seamlessly using Proton & Wine.

</div>

---

## 🚀 Key Features

- **Multi-Platform Out-of-the-Box Support**:
  - **Battle.net** (World of Warcraft, Diablo IV, Overwatch 2, Hearthstone)
  - **Ubisoft Connect** (Rainbow Six, Assassin's Creed, Far Cry)
  - **EA App** (Apex Legends, Battlefield, FIFA/EA FC, Need for Speed)
  - **Wargaming.net Game Center** (World of Tanks, World of Warships)
  - **Unlimited Custom Windows Games / Apps**: Add, configure, rename, and manage any `.exe` executable with its own isolated environment.

- **Advanced Proton & Runner Management**:
  - **Auto-Discovery of Official Valve Proton**: Automatically detects local and Steam-installed Proton versions (`Proton 8.0`, `Proton 9.0`, `Proton 10.0`, `Proton 11.0`, `Proton Experimental`, `Proton Hotfix`).
  - **Integrated GE-Proton Downloader**: Fetches and downloads any GloriousEggroll release from `GE-Proton 8` to the latest `GE-Proton 11` with live progress bars and automatic extraction.
  - **Grouped Selection**: Fast and organized runner selector categorized by release series.

- **Clean Isolated Environments (XDG Compliant)**:
  - Each platform and custom application runs inside its own isolated `WINEPREFIX` (`~/.local/share/bnet-linux-launcher/prefixes/<id>/`).
  - Never pollutes other prefixes or your system wine settings.
  - One-click **Prefix Folder Explorer** to access virtual `drive_c`.

- **Process Lifecycle Detection**:
  - Real-time status monitoring detects when a game or launcher is closed by the user, immediately resetting the UI to ready.
  - Integrated `wineserver -k` process termination to clean up stuck wine threads.

- **Gaming Performance Presets**:
  - Nvidia Dedicated GPU offload (`__NV_PRIME_RENDER_OFFLOAD=1`)
  - MangoHud 60 FPS overlay & frame limiter
  - DXVK Vulkan HUD
  - Valve Fsync (`WINEFSYNC=1`)
  - AMD FSR Upscaling (`WINE_FULLSCREEN_FSR=1`)
  - Feral GameMode integration (`gamemoderun`)

- **Native Linux Experience**:
  - Native file browser dialog (`zenity` / `kdialog`) for selecting `.exe` binaries.
  - Native `.desktop` shortcut integration in `~/.local/share/applications/`.
  - Live console with real-time `stdout`, `stderr`, and system diagnostics.
  - Safe **Reinstall** and **Uninstall** management with confirmation safety dialogs.

---

## 📦 System Requirements

- **OS**: Any 64-bit Linux distribution (Ubuntu, Debian, Fedora, Arch Linux, Manjaro, openSUSE, Pop!_OS, SteamOS, etc.)
- **GPU**: Vulkan 1.2+ capable GPU (NVIDIA, AMD, or Intel)
- **Dependencies**:
  - `wine` and `wineserver` (or Steam with Proton installed)
  - `zenity` (optional, for native file chooser dialogs)

---

## 🛠️ Installation & Building from Source

### 1. Install Prerequisites

#### Ubuntu / Debian / Pop!_OS / Linux Mint:
```bash
sudo apt update
sudo apt install -y build-essential curl wget libssl-dev libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev zenity
```

#### Fedora / RHEL:
```bash
sudo dnf install -y gcc gcc-c++ make curl wget openssl-devel gtk3-devel webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel zenity
```

#### Arch Linux / Manjaro:
```bash
sudo pacman -S --needed base-devel curl wget openssl gtk3 webkit2gtk-4.1 libappindicator-gtk3 librsvg zenity
```

### 2. Install Node.js & Rust (if not already installed)

- **Node.js** (v18 or newer):
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
  ```
- **Rust toolchain**:
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  source $HOME/.cargo/env
  ```

### 3. Clone and Setup

```bash
git clone https://github.com/MrMyper/GamehubforLinux.git
cd GamehubforLinux

# Install frontend dependencies
npm install
```

---

## 🎮 Running the Launcher

### Quick Launch (Automated Release Build):
```bash
./launch.sh
```

### Development Mode (with Live Reload):
```bash
npm run tauri dev
```

### Build Production Binary:
```bash
npm run build
cargo build --release --manifest-path src-tauri/Cargo.toml
```
The compiled binary will be located at `src-tauri/target/release/bnet-linux-launcher`.

---

## 📂 File Structure

```
├── launch.sh              # Startup script with auto-build support
├── package.json           # Frontend dependencies and Vite configuration
├── src/                   # React 19 + Tailwind CSS user interface
│   ├── components/        # Header, LauncherSelector, ControlDeck, Terminal
│   ├── services/api.ts    # Tauri IPC interface and listeners
│   └── types/             # TypeScript data contracts
└── src-tauri/             # Rust Tauri backend
    ├── Cargo.toml         # Rust dependencies
    └── src/
        ├── config.rs      # Multi-profile XDG configuration management
        ├── launcher.rs    # Process spawning, installer runner & wineserver
        ├── proton.rs      # Valve Proton discovery & GE-Proton release fetching
        └── shortcut.rs    # Freedesktop .desktop launcher generator
```

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

