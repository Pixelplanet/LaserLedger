import { z } from 'zod';

// ─── Enums ──────────────────────────────────────────────────────────────────
export const UserRole = z.enum(['user', 'moderator', 'admin']);
export type UserRole = z.infer<typeof UserRole>;

export const SettingStatus = z.enum(['draft', 'pending', 'approved', 'rejected', 'archived']);
export type SettingStatus = z.infer<typeof SettingStatus>;

export const ImageStatus = z.enum(['pending', 'approved', 'rejected', 'archived']);
export type ImageStatus = z.infer<typeof ImageStatus>;

export const ReportTargetType = z.enum(['setting', 'comment', 'image']);
export type ReportTargetType = z.infer<typeof ReportTargetType>;

export const ReportReason = z.enum([
  'spam',
  'inappropriate',
  'illegal',
  'duplicate',
  'misleading',
  'other',
]);
export type ReportReason = z.infer<typeof ReportReason>;

export const ReportStatus = z.enum(['pending', 'reviewed', 'dismissed', 'resolved', 'actioned']);
export type ReportStatus = z.infer<typeof ReportStatus>;

export const ModerationAction = z.enum(['approve', 'reject', 'archive', 'edit', 'revert']);
export type ModerationAction = z.infer<typeof ModerationAction>;

// ─── Auth ───────────────────────────────────────────────────────────────────
export const RegisterInput = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
  display_name: z.string().min(1).max(100).trim(),
  password: z.string().min(8).max(255),
  timezone: z.string().max(64).optional(),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LoginInput = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
  password: z.string().min(1).max(255),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const GoogleLoginInput = z.object({ id_token: z.string().min(10) });
export type GoogleLoginInput = z.infer<typeof GoogleLoginInput>;

export const ProfileUpdateInput = z.object({
  display_name: z.string().min(1).max(100).trim().optional(),
  bio: z.string().max(2000).optional().nullable(),
  timezone: z.string().max(64).optional().nullable(),
  avatar_url: z.string().url().max(512).optional().nullable(),
});
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateInput>;

export const PasswordResetRequestInput = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
});

export const PasswordResetInput = z.object({
  token: z.string().min(10).max(128),
  new_password: z.string().min(8).max(255),
});
export type PasswordResetInput = z.infer<typeof PasswordResetInput>;

// ─── Submissions ────────────────────────────────────────────────────────────
export const ScanMode = z.enum(['lineMode', 'crossMode', 'zMode']).optional();

export const SettingInput = z.object({
  title: z.string().min(3).max(200).trim(),
  description: z.string().max(10_000).optional().nullable(),
  device_id: z.number().int().positive(),
  laser_type_id: z.number().int().positive(),
  material_id: z.number().int().positive(),
  operation_type_id: z.number().int().positive(),
  power: z.number().min(0).max(100).nullable().optional(),
  speed: z.number().min(0).max(100_000).nullable().optional(),
  frequency: z.number().min(0).max(10_000).nullable().optional(),
  lpi: z.number().int().min(0).max(20_000).nullable().optional(),
  pulse_width: z.number().int().min(0).max(1_000_000).nullable().optional(),
  passes: z.number().int().min(1).max(50).nullable().optional(),
  cross_hatch: z.boolean().nullable().optional(),
  focus_offset: z.number().min(-50).max(50).nullable().optional(),
  scan_mode: ScanMode.nullable(),
  extra_params: z.record(z.unknown()).nullable().optional(),
  result_description: z.string().max(5000).nullable().optional(),
  quality_rating: z.number().int().min(1).max(5).nullable().optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  source_xcs: z.string().max(5_000_000).nullable().optional(),
});
export type SettingInput = z.infer<typeof SettingInput>;

// ─── Search ────────────────────────────────────────────────────────────────
export const SearchQuery = z.object({
  q: z.string().max(200).optional(),
  device: z.string().optional(), // comma-separated ids
  laser_type: z.string().optional(),
  material: z.string().optional(),
  material_category: z.string().optional(),
  operation: z.string().optional(),
  manufacturer: z.string().optional(),
  tags: z.string().optional(),
  power_min: z.coerce.number().optional(),
  power_max: z.coerce.number().optional(),
  speed_min: z.coerce.number().optional(),
  speed_max: z.coerce.number().optional(),
  frequency_min: z.coerce.number().optional(),
  frequency_max: z.coerce.number().optional(),
  lpi_min: z.coerce.number().optional(),
  lpi_max: z.coerce.number().optional(),
  min_rating: z.coerce.number().int().min(0).optional(),
  has_image: z.enum(['1', 'true']).optional(),
  sort: z.enum(['relevance', 'newest', 'top_rated', 'most_viewed', 'most_discussed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type SearchQuery = z.infer<typeof SearchQuery>;

// ─── CMS / Admin ───────────────────────────────────────────────────────────
const slug = z.string().min(1).max(150).regex(/^[a-z0-9-]+$/, 'invalid slug');

export const ManufacturerInput = z.object({
  name: z.string().min(1).max(100),
  slug: slug.optional(),
  website: z.string().url().max(512).optional().nullable(),
  logo_url: z.string().url().max(512).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});
export type ManufacturerInput = z.infer<typeof ManufacturerInput>;

export const DeviceFamilyInput = z.object({
  manufacturer_id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  slug: slug.optional(),
  description: z.string().max(5000).optional().nullable(),
  sort_order: z.number().int().optional(),
});
export type DeviceFamilyInput = z.infer<typeof DeviceFamilyInput>;

export const DeviceInput = z.object({
  family_id: z.number().int().positive(),
  name: z.string().min(1).max(150),
  slug: slug.optional(),
  ext_id: z.string().max(50).optional().nullable(),
  ext_name: z.string().max(100).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  image_url: z.string().url().max(512).optional().nullable(),
  product_url: z.string().url().max(512).optional().nullable(),
  workspace_width: z.number().optional().nullable(),
  workspace_height: z.number().optional().nullable(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});
export type DeviceInput = z.infer<typeof DeviceInput>;

export const LaserTypeInput = z.object({
  name: z.string().min(1).max(100),
  slug: slug.optional(),
  light_source: z.string().min(1).max(30),
  wavelength_nm: z.number().int().optional().nullable(),
  has_pulse_width: z.boolean().optional(),
  has_mopa_frequency: z.boolean().optional(),
  processing_type: z.string().max(50).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});
export type LaserTypeInput = z.infer<typeof LaserTypeInput>;

export const MaterialCategoryInput = z.object({
  name: z.string().min(1).max(100),
  slug: slug.optional(),
  icon: z.string().max(50).optional().nullable(),
  sort_order: z.number().int().optional(),
});
export type MaterialCategoryInput = z.infer<typeof MaterialCategoryInput>;

export const MaterialInput = z.object({
  category_id: z.number().int().positive(),
  name: z.string().min(1).max(150),
  slug: slug.optional(),
  xtool_material_id: z.number().int().optional().nullable(),
  thickness_mm: z.number().optional().nullable(),
  color: z.string().max(50).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  properties: z.record(z.unknown()).optional().nullable(),
  image_url: z.string().url().max(512).optional().nullable(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});
export type MaterialInput = z.infer<typeof MaterialInput>;

export const OperationTypeInput = z.object({
  name: z.string().min(1).max(100),
  slug: slug.optional(),
  description: z.string().max(5000).optional().nullable(),
  sort_order: z.number().int().optional(),
});
export type OperationTypeInput = z.infer<typeof OperationTypeInput>;

export const TagInput = z.object({
  name: z.string().min(1).max(50),
  slug: slug.optional(),
  description: z.string().max(500).optional().nullable(),
});
export type TagInput = z.infer<typeof TagInput>;

export const DeviceLaserTypesInput = z.object({
  laser_types: z
    .array(
      z.object({
        laser_type_id: z.number().int().positive(),
        is_default: z.boolean().optional(),
        power_watts: z.array(z.number()).optional().nullable(),
      }),
    )
    .min(0),
});
export type DeviceLaserTypesInput = z.infer<typeof DeviceLaserTypesInput>;

// ─── Comments / Reports / Bookmarks ────────────────────────────────────────
export const CommentInput = z.object({
  body: z.string().min(1).max(10_000),
  parent_id: z.number().int().positive().optional().nullable(),
});

export const ReportInput = z.object({
  target_type: ReportTargetType,
  target_id: z.number().int().positive(),
  reason: ReportReason,
  description: z.string().max(2000).optional().nullable(),
});
export type ReportInput = z.infer<typeof ReportInput>;

// ─── Moderation ────────────────────────────────────────────────────────────
export const RejectInput = z.object({
  reason: z.string().min(1).max(255),
  notes: z.string().max(2000).optional().nullable(),
});
export type RejectInput = z.infer<typeof RejectInput>;
