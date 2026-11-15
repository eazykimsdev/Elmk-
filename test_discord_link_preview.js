import fs from 'fs';
import assert from 'assert';
import { buildWebsiteV2Card } from './discordNotificationManager.js';
import { GLOBAL_BOT_COMMANDS } from './botCommands.js';

console.log('======================================================================');
console.log(' RUNNING VERIFICATION: DISCORD COMPONENTS V2 CARD FOR /website');
console.log('======================================================================\n');

// 1. COMPONENTS V2 CARD STRUCTURE
console.log('--- TEST 1: COMPONENTS V2 CARD SPECIFICATION ---');
const card = buildWebsiteV2Card();
assert.strictEqual(card.flags, 32768, 'Must have flags: 32768 (IS_COMPONENTS_V2)');
assert.strictEqual(card.content, undefined, 'Must not send content field');
assert.strictEqual(card.embeds, undefined, 'Must not send embeds field');

const container = card.components[0];
assert.strictEqual(container.type, 17, 'Root component must be Container (type 17)');
assert.strictEqual(container.accent_color, undefined, 'Container must have no color stripe / accent color');

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
console.log('PASS: Components V2 card matches all specifications.\n');

// 2. /website COMMAND REGISTERED
console.log('--- TEST 2: /website GLOBAL SLASH COMMAND ---');
const websiteCmd = GLOBAL_BOT_COMMANDS.find(c => c.name === 'website');
assert(websiteCmd, '/website command must be present in GLOBAL_BOT_COMMANDS');
assert.deepStrictEqual(websiteCmd.contexts, [0, 1, 2], '/website command must be usable in Guilds, DMs, and Private channels');
const commandsSrc = fs.readFileSync('botCommands.js', 'utf8');
assert(commandsSrc.includes("commandName === 'website'"), 'botCommands.js must handle /website execution');
assert(commandsSrc.includes('buildWebsiteV2Card'), 'botCommands.js must call buildWebsiteV2Card');
console.log('PASS: /website command registered globally and hooked to buildWebsiteV2Card.\n');

// 3. AUTO-UNFURL AND EXTRA INTENTS REMOVED
console.log('--- TEST 3: AUTO-UNFURL & EXTRA INTENTS REMOVED ---');
const gatewaySrc = fs.readFileSync('botGateway.js', 'utf8');
assert(!gatewaySrc.includes("type === 'MESSAGE_CREATE'"), 'botGateway must NOT listen for MESSAGE_CREATE events');
assert(!gatewaySrc.includes('handleMessageCreate'), 'botGateway must NOT have handleMessageCreate');
assert(gatewaySrc.includes('intents: 1 | 2'), 'botGateway must use strictly basic intents (1 | 2)');
assert(!gatewaySrc.includes('32768') && !gatewaySrc.includes('512'), 'botGateway must NOT require Message Content (32768) or Guild Messages (512)');
console.log('PASS: Auto-unfurl removed; intents strictly basic (1 | 2); no Administrator or Message Content needed.\n');

// 4. WEBSITE META TAGS NORMALIZED
console.log('--- TEST 4: WEBSITE META TAGS NORMALIZED ---');
const indexHtml = fs.readFileSync('index.html', 'utf8');
const webIndexHtml = fs.readFileSync('web/index.html', 'utf8');
const distIndexHtml = fs.readFileSync('dist/index.html', 'utf8');

for (const [name, content] of Object.entries({ 'root index.html': indexHtml, 'web index.html': webIndexHtml, 'dist index.html': distIndexHtml })) {
  assert(content.includes('property="og:site_name" content="ConnectingERLC"'), `${name} must include normal og:site_name ConnectingERLC`);
  assert(content.includes('property="og:title" content="ConnectingERLC"'), `${name} must include normal og:title ConnectingERLC`);
  assert(content.includes('property="og:url" content="https://connectingerlc.xyz/"'), `${name} must include normal og:url https://connectingerlc.xyz/`);
  assert(content.includes('name="theme-color" content="#09090B"'), `${name} must use dark theme-color #09090B`);
}
console.log('PASS: Website meta tags restored to clean, normal metadata.\n');

console.log('======================================================================');
console.log(' ALL REQUIREMENTS VERIFIED AND PASSED (4/4)');
console.log('======================================================================');
