import 'dotenv/config';
import fs from 'fs';
import assert from 'assert';
import { buildWebsiteV2Card } from '../discordNotificationManager.js';
import { GLOBAL_BOT_COMMANDS } from '../botCommands.js';

console.log('======================================================================');
console.log(' PROOF EXECUTION: DISCORD COMPONENTS V2 CARD FOR /website');
console.log('======================================================================\n');

// 1. GENERATE PAYLOAD
const cardPayload = buildWebsiteV2Card();

console.log('--- 1. EXACT JSON PAYLOAD SENT TO DISCORD ---');
console.log(JSON.stringify(cardPayload, null, 2));
console.log('\n');

// Assertions on payload structure
assert.strictEqual(cardPayload.flags, 32768, 'Must have flags: 32768 (IS_COMPONENTS_V2)');
assert.strictEqual(cardPayload.content, undefined, 'Must not send content field');
assert.strictEqual(cardPayload.embeds, undefined, 'Must not send embeds field');

const container = cardPayload.components[0];
assert.strictEqual(container.type, 17, 'Root component must be Container (type 17)');
assert.strictEqual(container.accent_color, undefined, 'Container must have no colored stripe / accent color');

const section = container.components[0];
assert.strictEqual(section.type, 9, 'First child must be Section (type 9)');
const textComp = section.components[0];
assert.strictEqual(textComp.type, 10, 'Section must have TextDisplay (type 10)');
assert(textComp.content.startsWith('**ConnectingERLC**\n'), 'Title must be bold **ConnectingERLC**');
assert(textComp.content.includes('The leading growth platform for Emergency Response: Liberty County. Promote your server, partner with other servers, recruit active players and track your invites. Completely free.'), 'Description must match requested wording');

assert.strictEqual(section.accessory.type, 11, 'Section accessory must be Thumbnail (type 11)');
assert(section.accessory.media.url.includes('/brand/logo.png'), 'Thumbnail must reference logo.png');

const separator = container.components[1];
assert.strictEqual(separator.type, 14, 'Second child must be Separator (type 14)');
assert.strictEqual(separator.divider, true, 'Separator must have divider: true');

const actionRow = container.components[2];
assert.strictEqual(actionRow.type, 1, 'Third child must be ActionRow (type 1)');
assert.strictEqual(actionRow.components.length, 3, 'Must have exactly 3 buttons');

assert.strictEqual(actionRow.components[0].label, 'Website');
assert.strictEqual(actionRow.components[0].style, 5);
assert.strictEqual(actionRow.components[1].label, 'Add the bot');
assert.strictEqual(actionRow.components[1].style, 5);
assert.strictEqual(actionRow.components[2].label, 'Join our server');
assert.strictEqual(actionRow.components[2].style, 5);

// Check /website command is defined globally
const websiteCmd = GLOBAL_BOT_COMMANDS.find(c => c.name === 'website');
assert(websiteCmd, '/website command must be present in GLOBAL_BOT_COMMANDS');
assert.deepStrictEqual(websiteCmd.contexts, [0, 1, 2], '/website command must be usable in Guilds, DMs, and Private channels');

// 2. DISPATCH TO LIVE DISCORD CHANNEL FOR REAL PROOF
const token = (process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || '').trim().replace(/^Bot\s+/i, '');
const testChannelId = '1554678757585854594'; // 'test' channel in 'Bot test' guild

console.log(`--- 2. DISPATCHING TO DISCORD API (Channel: ${testChannelId}) ---`);
const res = await fetch(`https://discord.com/api/v10/channels/${testChannelId}/messages`, {
  method: 'POST',
  headers: {
    Authorization: `Bot ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(cardPayload)
});

console.log(`Discord API HTTP Status: ${res.status} ${res.statusText}`);
const discordData = await res.json();

console.log('--- 3. LIVE DISCORD API RESPONSE ---');
console.log(JSON.stringify(discordData, null, 2));
console.log('\n');

assert(res.ok, `Discord returned error status ${res.status}: ${JSON.stringify(discordData)}`);
assert(discordData.id, 'Discord response must contain created message ID');
assert.strictEqual(discordData.flags, 32768, 'Discord response message flags must be 32768 (IS_COMPONENTS_V2)');

console.log('======================================================================');
console.log(` SUCCESS: Message sent to Discord!`);
console.log(` Message ID : ${discordData.id}`);
console.log(` Channel ID : ${discordData.channel_id}`);
console.log(` Timestamp  : ${discordData.timestamp}`);
console.log('======================================================================');
