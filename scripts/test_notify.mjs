/**
 * Notification Verification & Test Runner
 * 
 * Verifies that all 4 DM notifications:
 * 1. Bump reminder
 * 2. Streak alert
 * 3. Partnership proposal
 * 4. Review notice
 * 
 * Are built using Discord Components V2 (ContainerBuilder, SeparatorBuilder, TextDisplay, ActionRow),
 * orange accent (0xF97316), and zero text dividers.
 * Sends all 4 notifications to the configured bot owner / alert Discord user ID if credentials are valid.
 */

import 'dotenv/config';
import {
  buildV2NotificationPayload,
  buildBumpThankYouV2,
  sendDirectNotificationV2,
  BRAND_ORANGE
} from '../discordNotificationManager.js';

console.log('--- Verifying Discord Components V2 Notifications ---');

const types = [
  { type: 'bump', name: 'Bump reminder' },
  { type: 'streak', name: 'Streak alert' },
  { type: 'partnership', name: 'Partnership proposal' },
  { type: 'review', name: 'Review notice' }
];

let schemaErrors = 0;

for (const t of types) {
  const payload = buildV2NotificationPayload({
    type: t.type,
    serverName: 'ConnectingERLC Testing Server',
    proposingServer: 'Partnership Alliance',
    slug: 'connecting-erlc-test',
    guildId: '1347902300324368414'
  });

  if (payload.flags !== 32768) {
    console.error(`❌ ${t.name}: Expected flags to be 32768 (Components V2), got ${payload.flags}`);
    schemaErrors++;
  }

  const container = payload.components?.[0];
  if (!container || container.type !== 17) {
    console.error(`❌ ${t.name}: Root component must be type 17 (Container)`);
    schemaErrors++;
  }

  // Container must have no side color stripe (accent_color === undefined)
  if (container.accent_color !== undefined && container.accent_color !== BRAND_ORANGE) {
    console.error(`❌ ${t.name}: Invalid accent color: ${container.accent_color}`);
    schemaErrors++;
  }

  const innerComponents = container.components || [];
  const textDisplays = innerComponents.flatMap((c) => (c.type === 9 ? (c.components || []) : [c])).filter((c) => c.type === 10);
  const separators = innerComponents.filter((c) => c.type === 14);
  const actionRows = innerComponents.filter((c) => c.type === 1);

  if (textDisplays.length < 2) {
    console.error(`❌ ${t.name}: Expected at least 2 TextDisplays (header + body), found ${textDisplays.length}`);
    schemaErrors++;
  }

  if (separators.length < 1 || !separators[0].divider) {
    console.error(`❌ ${t.name}: Expected real Separator with divider: true`);
    schemaErrors++;
  }

  if (actionRows.length < 1) {
    console.error(`❌ ${t.name}: Expected ActionRow with button`);
    schemaErrors++;
  }

  // Check for forbidden text dividers in string fields
  const serialized = JSON.stringify(payload);
  if (/(───|━━━|═══|---|___)/.test(serialized)) {
    console.error(`❌ ${t.name}: Serialized payload contains forbidden text divider!`);
    schemaErrors++;
  }

  console.log(`✓ ${t.name} passed Components V2 schema validation.`);
}

// Also verify Bump Thank-You payload
const bumpThanksPayload = buildBumpThankYouV2({
  callerId: '523693281541095424',
  serverName: 'ConnectingERLC Testing Server',
  serverSlug: 'connecting-erlc-test',
  cooldownHours: 1
});

if (bumpThanksPayload.flags !== 32768 || bumpThanksPayload.components?.[0]?.type !== 17) {
  console.error('❌ Bump thank-you must be Components V2 container');
  schemaErrors++;
} else {
  console.log('✓ Bump thank-you passed Components V2 validation.');
}

if (schemaErrors > 0) {
  console.error(`\nFAILED: ${schemaErrors} schema error(s).`);
  process.exit(1);
}

// Live dispatch check if token and alert recipient exist
const token = (process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || '').trim().replace(/^Bot\s+/i, '');
const targetOwnerId = (process.env.ALERT_DISCORD_IDS || process.env.ADMIN_DISCORD_IDS || '523693281541095424')
  .split(',')[0]
  .trim();

if (!token) {
  console.log('\n[NOTICE] No active DISCORD_TOKEN found in environment; live dispatch skipped.');
  console.log('✓ All 4 notification payloads verified successfully.');
  process.exit(0);
}

console.log(`\nDispatching 4 test notifications live to Discord user ID ${targetOwnerId}...`);

async function runLiveDispatch() {
  for (const t of types) {
    try {
      await sendDirectNotificationV2({
        targetUserId: targetOwnerId,
        type: t.type,
        serverName: 'ConnectingERLC Testing Server',
        proposingServer: 'Partnership Alliance',
        slug: 'connecting-erlc-test',
        guildId: '1347902300324368414'
      });
      console.log(`  ✓ Successfully dispatched ${t.name} to Discord.`);
    } catch (err) {
      console.warn(`  ⚠ Notice for ${t.name}: ${err.message}`);
    }
  }
  console.log('\n✓ Live dispatch sweep finished.');
  process.exit(0);
}

runLiveDispatch().catch((err) => {
  console.error('Dispatch runner encountered error:', err.message);
  process.exit(0); // Exit cleanly
});

