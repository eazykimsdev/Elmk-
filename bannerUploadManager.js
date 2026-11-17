import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import { hasActiveBoost } from './serverShopManager.js';
import { getPromotedServers } from './directoryManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Maximum banner size setting (default: 5MB)
export const MAX_BANNER_SIZE_BYTES = parseInt(process.env.MAX_BANNER_SIZE_BYTES || '5242880', 10);

const UPLOAD_DIRS = [
  path.join(__dirname, 'public', 'uploads', 'banners'),
  path.join(__dirname, 'dist', 'uploads', 'banners')
];

// Ensure upload directories exist
for (const dir of UPLOAD_DIRS) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
}

/**
 * Detect image format from real magic bytes
 */
export function detectImageFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) return null;

  // Check SVG / XML text
  const headStr = buffer.slice(0, 512).toString('utf8').toLowerCase();
  if (
    headStr.includes('<svg') ||
    headStr.includes('<?xml') ||
    headStr.includes('xmlns="http://www.w3.org/2000/svg"')
  ) {
    return 'svg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return 'png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpg';
  }

  // WebP: RIFF .... WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.length >= 12 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return 'gif';
  }

  return null;
}

/**
 * Verify whether a server has active Premium status
 */
export function isServerPremium(serverId) {
  if (!serverId) return false;
  const sid = String(serverId);
  // Check active boost
  if (hasActiveBoost(sid, 'premium')) return true;

  // Check directory record
  const servers = getPromotedServers(true);
  const server = servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
  return Boolean(server && (server.premium || server.isPremium || server.tier === 'premium'));
}

/**
 * Validate and safely store banner image
 */
export async function processAndSaveBanner({
  serverId,
  buffer,
  originalFilename = 'banner.png'
}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error('No image file received or file is empty.');
    err.code = 'EMPTY_FILE';
    throw err;
  }

  // 1. Size limit check
  if (buffer.length > MAX_BANNER_SIZE_BYTES) {
    const maxMb = Math.round(MAX_BANNER_SIZE_BYTES / (1024 * 1024));
    const err = new Error(`File is too large (${(buffer.length / (1024 * 1024)).toFixed(1)}MB). Maximum allowed banner size is ${maxMb}MB.`);
    err.code = 'FILE_TOO_LARGE';
    throw err;
  }

  // 2. Real content type detection
  const format = detectImageFormat(buffer);

  // 3. Strict SVG rejection
  if (format === 'svg') {
    const err = new Error('SVG files are strictly not allowed for security reasons. Please upload a PNG, JPG, or WebP image.');
    err.code = 'SVG_REJECTED';
    throw err;
  }

  // 4. Allowed formats: PNG, JPG, WebP (and GIF for Premium)
  if (!format || !['png', 'jpg', 'webp', 'gif'].includes(format)) {
    const err = new Error('Invalid image content. Only real PNG, JPG, and WebP images are allowed.');
    err.code = 'INVALID_FORMAT';
    throw err;
  }

  // 5. GIF Premium-only gate
  if (format === 'gif') {
    const hasPremium = isServerPremium(serverId);
    if (!hasPremium) {
      const err = new Error('Animated GIF banners are exclusive to Premium servers. Upgrade in Boosts to use animated banners.');
      err.code = 'PREMIUM_REQUIRED_FOR_GIF';
      throw err;
    }
  }

  // 6. Sanitize image buffer: strip dangerous trailing payloads
  let sanitizedBuffer = buffer;
  if (format === 'png') {
    // Look for IEND chunk (49 45 4E 44) + 4-byte CRC
    const iendIdx = buffer.indexOf(Buffer.from([0x49, 0x45, 0x4E, 0x44]));
    if (iendIdx !== -1 && iendIdx + 8 <= buffer.length) {
      sanitizedBuffer = buffer.slice(0, iendIdx + 8);
    }
  } else if (format === 'jpg') {
    // Look for EOI marker (FF D9)
    for (let i = buffer.length - 2; i >= 2; i--) {
      if (buffer[i] === 0xFF && buffer[i + 1] === 0xD9) {
        sanitizedBuffer = buffer.slice(0, i + 2);
        break;
      }
    }
  }

  // 7. Generate random, unguessable filename
  const randomName = `${randomBytes(16).toString('hex')}.${format}`;

  // 8. Save to disk in public and dist upload directories
  for (const dir of UPLOAD_DIRS) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, randomName), sanitizedBuffer);
    } catch (err) {
      console.warn(`[BANNER UPLOAD] Could not write to ${dir}:`, err.message);
    }
  }

  const bannerUrl = `/uploads/banners/${randomName}`;

  return {
    success: true,
    bannerUrl,
    filename: randomName,
    format,
    size: sanitizedBuffer.length
  };
}
