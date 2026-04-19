// Shared TypeScript types for entities — keep in sync with DB schema in §5.2
import type { UserRole, SettingStatus, ImageStatus } from './schemas.js';

export interface User {
  id: string; // CHAR(16)
  email: string;
  display_name: string;
  password_hash: string | null;
  google_id: string | null;
  role: UserRole;
  email_verified: boolean;
  cloudify_user_id: string | null;
  timezone: string | null;
  bio: string | null;
  avatar_url: string | null;
  submission_count: number;
  reputation: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export type PublicUser = Pick<
  User,
  | 'id'
  | 'display_name'
  | 'bio'
  | 'avatar_url'
  | 'submission_count'
  | 'reputation'
  | 'created_at'
>;

export interface LaserSetting {
  id: number;
  uuid: string;
  title: string;
  description: string | null;
  device_id: number;
  laser_type_id: number;
  material_id: number;
  operation_type_id: number;
  power: number | null;
  speed: number | null;
  frequency: number | null;
  lpi: number | null;
  pulse_width: number | null;
  passes: number | null;
  cross_hatch: boolean | null;
  focus_offset: number | null;
  scan_mode: string | null;
  extra_params: unknown;
  result_description: string | null;
  result_image_url: string | null;
  source_xcs: string | null;
  quality_rating: number | null;
  submitted_by: string;
  status: SettingStatus;
  moderated_by: string | null;
  moderated_at: string | null;
  rejection_reason: string | null;
  vote_score: number;
  view_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
}

export interface SettingImage {
  id: number;
  uuid: string;
  setting_id: number;
  uploaded_by: string;
  original_filename: string;
  stored_path: string;
  thumbnail_path: string;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  status: ImageStatus;
  moderated_by: string | null;
  moderated_at: string | null;
  rejected_reason: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface ApiSuccess<T> {
  data: T;
  meta?: { page: number; pageSize: number; total: number };
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}
