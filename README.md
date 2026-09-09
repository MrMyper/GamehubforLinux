# Gamehub for Linux

Launcher and runner manager for running Windows game clients and standalone applications on Linux using Wine and Proton.

Supported launchers:
- Battle.net
- Ubisoft Connect
- EA App
- Wargaming.net Game Center
- Custom Windows executables (.exe)

## Features

- **Isolated wine prefixes**: Each launcher or custom application runs in its own prefix under `~/.local/share/bnet-linux-launcher/prefixes/<id>/`.
- **Proton runner management**:
  - Automatic detection of official Valve Proton versions installed via Steam (Proton 8, 9, 10, 11, Experimental, Hotfix).
  - Built-in downloader for GE-Proton releases (GE-Proton 8 through latest versions) with automatic archive extraction.
  - Selection of runner per application.
- **Custom application support**: Add, rename, configure, and remove custom Windows games or software.
- **Process tracking**: Monitors running processes and updates status when the game or launcher exits.
- **Process termination**: Clean shutdown of background Wine processes (`wineserver -k`).
- **Performance tweaks**:
  - Nvidia Prime render offload (`__NV_PRIME_RENDER_OFFLOAD=1`)
  - MangoHud overlay and frame limiter
  - DXVK HUD
  - Fsync (`WINEFSYNC=1`)
  - AMD FSR (`WINE_FULLSCREEN_FSR=1`)
  - GameMode (`gamemoderun`)
- **Desktop integration**:
  - Generation of `.desktop` files in `~/.local/share/applications/`.
  - Executable path browser via Zenity.
  - Embedded console for launcher output and logs.
  - Prefix directory browser.

## Requirements

- 64-bit Linux distribution
- Vulkan-capable GPU with drivers installed
- Wine and wineserver (or Steam with Proton installed)
- `zenity` (optional, used for the file selection dialog)

## Dependencies

### Ubuntu / Debian / Pop!_OS / Linux Mint
```bash
sudo apt update
sudo apt install -y build-essential curl wget libssl-dev libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev zenity
```

### Fedora / RHEL
```bash
sudo dnf install -y gcc gcc-c++ make curl wget openssl-devel gtk3-devel webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel zenity
```

### Arch Linux / Manjaro
```bash
sudo pacman -S --needed base-devel curl wget openssl gtk3 webkit2gtk-4.1 libappindicator-gtk3 librsvg zenity
```

### Node.js and Rust
- Node.js 18+
- Rust 1.75+ (via rustup)

```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

## Building

1. Clone the repository:
```bash
git clone https://github.com/MrMyper/GamehubforLinux.git
cd GamehubforLinux
```

2. Install frontend dependencies:
```bash
npm install
```

3. Run in development mode:
```bash
npm run tauri dev
```

4. Build release binary:
```bash
npm run build
cargo build --release --manifest-path src-tauri/Cargo.toml
```

The compiled binary will be located at:
`src-tauri/target/release/bnet-linux-launcher`

Alternatively, use the launch script:
```bash
./launch.sh
```

## Directory Structure

- `~/.config/bnet-linux-launcher/config.json` — application configuration and profiles.
- `~/.local/share/bnet-linux-launcher/prefixes/` — Wine prefixes for each launcher and game.
- `~/.local/share/bnet-linux-launcher/runners/` — downloaded GE-Proton runners.
- `~/.local/share/applications/` — generated desktop shortcuts.

## License

MIT License. See [LICENSE](LICENSE) for details.
