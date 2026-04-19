import { env } from '../config.js';

export interface ModerationResult {
  allowed: boolean;
  reason: string | null;
}

/**
 * Optional first-pass moderation hook.
 * If IMAGE_MODERATION_WEBHOOK_URL is not configured, uploads are allowed.
 */
export async function moderateImage(buffer: Buffer, mimeType: string): Promise<ModerationResult> {
  if (!env.IMAGE_MODERATION_WEBHOOK_URL) {
    return { allowed: true, reason: null };
  }

  try {
    const payload = {
      mime_type: mimeType,
      file_base64: buffer.toString('base64'),
    };
    const res = await fetch(env.IMAGE_MODERATION_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.IMAGE_MODERATION_WEBHOOK_TOKEN
          ? { authorization: `Bearer ${env.IMAGE_MODERATION_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // Fail-open: do not block uploads on transient moderation service errors.
      return { allowed: true, reason: null };
    }

    const data = (await res.json()) as { allowed?: boolean; reason?: string };
    return {
      allowed: data.allowed !== false,
      reason: typeof data.reason === 'string' ? data.reason : null,
    };
  } catch {
    // Fail-open to avoid hard dependency on third-party moderation service.
    return { allowed: true, reason: null };
  }
}
