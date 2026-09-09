export interface LauncherProfile {
  id: string;
  name: string;
  selected_proton: string | null;
  env_args: string;
  custom_exe_path: string | null;
  custom_launch_args: string;
}

export interface LauncherConfig {
  active_profile_id: string;
  profiles: LauncherProfile[];
}

export interface ProtonRelease {
  tag_name: string;
  name: string;
  tarball_url: string | null;
  size: number | null;
  published_at: string;
  category?: string;
  is_installed?: boolean;
}

export interface ResolvedExeInfo {
  path: string | null;
  exists: boolean;
  is_custom: boolean;
}

export interface LauncherStatusEvent {
  profile_id: string;
  status: LauncherStatus;
}

export interface DownloadProgress {
  version: string;
  downloaded: number;
  total: number;
  percentage: number;
  status: string;
  retry_count?: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  text: string;
  level: 'stdout' | 'stderr' | 'system' | 'error';
}

export type LauncherStatus =
  | 'idle'
  | 'checking'
  | 'downloading_proton'
  | 'installing_bnet'
  | 'launching'
  | 'running'
  | 'stopping';

export interface LauncherPaths {
  config_path: string;
  data_path: string;
  prefix_path: string;
  proton_dir: string;
  desktop_file: string;
  is_installed: boolean;
}

