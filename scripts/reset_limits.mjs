import { resetAllPromoLimits } from '../promoCodeManager.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Error: dev:reset-limits cannot be run in production environment.');
  process.exit(1);
}

try {
  resetAllPromoLimits();
  console.log('✓ Successfully reset all promo failure rate limits and lockout tracking.');
} catch (err) {
  console.error('Failed to reset limits:', err.message);
  process.exit(1);
}

