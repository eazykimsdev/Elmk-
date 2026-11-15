#!/usr/bin/env node
import 'dotenv/config';
import { sendComponentAlert } from '../monitorJob.js';

console.log('Sending test Discord Components V2 alert to ALERT_DISCORD_IDS...');
try {
  const result = await sendComponentAlert({
    component: 'Discord bot',
    status: 'Degraded',
    errorSummary: 'Heartbeat latency exceeded 2000ms threshold during manual alert check.',
    isTest: true
  });
  console.log('[ALERT TEST RESULT]', result);
  if (result.delivered) {
    console.log('SUCCESS: Test alert successfully dispatched to owner via Components V2.');
  } else {
    console.log('NOTICE: DM could not be delivered directly (closed DMs or recipient not reachable). Ensure ALERT_DISCORD_IDS and ALERT_WEBHOOK_URL are configured in .env.');
  }
} catch (err) {
  console.error('FAILED to send test alert:', err.message);
  process.exit(1);
}
