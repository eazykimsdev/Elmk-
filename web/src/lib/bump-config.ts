/**
 * Single Source of Truth for Bump Configuration (Round 5 Section 3)
 */
export const BUMP_COOLDOWN_HOURS = 2;
export const BUMP_COST_CREDITS = 0; // Default Free

export function formatBumpCooldown(hours = BUMP_COOLDOWN_HOURS): string {
  if (hours === 1) return '1 hour';
  return `${hours} hours`;
}

export function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return 'ready';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

