import assert from 'assert';
import { processAndSaveBanner, detectImageFormat, MAX_BANNER_SIZE_BYTES } from '../bannerUploadManager.js';
import { buyShopItem, loadShopItems } from '../serverShopManager.js';
import { recordLedgerTransaction } from '../ledgerManager.js';

console.log('=== TEST SUITE: PHASE H - ITEM 3 (BANNER UPLOADS & SECURITY) ===\n');

const testServerId = '158179489638985501';

// 1. Test format detection from magic bytes
console.log('1. Testing format detection from magic bytes...');
const validPngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x08, 0x06, 0x00, 0x00, 0x00, 0x5C, 0x72, 0xA8, 0x66, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);
const validJpgHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9]);
const validWebpHeader = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x1A, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4C]);
const validGifHeader = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3B]);
const fakePngWithSvgContent = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

assert.strictEqual(detectImageFormat(validPngHeader), 'png', 'PNG must be detected');
assert.strictEqual(detectImageFormat(validJpgHeader), 'jpg', 'JPG must be detected');
assert.strictEqual(detectImageFormat(validWebpHeader), 'webp', 'WebP must be detected');
assert.strictEqual(detectImageFormat(validGifHeader), 'gif', 'GIF must be detected');
assert.strictEqual(detectImageFormat(fakePngWithSvgContent), 'svg', 'SVG disguised must be detected as SVG');
console.log('  ✓ Verified: Content-based format detection working accurately.');

// 2. Reject SVG
console.log('\n2. Testing strict SVG rejection...');
try {
  await processAndSaveBanner({
    serverId: testServerId,
    buffer: fakePngWithSvgContent,
    originalFilename: 'malicious.svg'
  });
  assert.fail('SVG must be rejected');
} catch (err) {
  console.log(`  -> Expected error received: "${err.message}" (code: ${err.code})`);
  assert.strictEqual(err.code, 'SVG_REJECTED', 'Must reject SVG');
}
console.log('  ✓ Verified: SVG files strictly rejected.');

// 3. Reject oversized file
console.log('\n3. Testing size limit rejection...');
const oversizedBuffer = Buffer.alloc(MAX_BANNER_SIZE_BYTES + 1024);
// Give it valid PNG magic bytes so it triggers size check first
validPngHeader.copy(oversizedBuffer);
try {
  await processAndSaveBanner({
    serverId: testServerId,
    buffer: oversizedBuffer,
    originalFilename: 'huge.png'
  });
  assert.fail('Oversized buffer must be rejected');
} catch (err) {
  console.log(`  -> Expected error received: "${err.message}" (code: ${err.code})`);
  assert.strictEqual(err.code, 'FILE_TOO_LARGE', 'Must reject oversized file');
}
console.log('  ✓ Verified: Files exceeding size limit strictly rejected.');

// 4. Accept valid PNG, JPG, WebP
console.log('\n4. Testing valid PNG, JPG, WebP upload...');
const pngResult = await processAndSaveBanner({
  serverId: testServerId,
  buffer: validPngHeader,
  originalFilename: 'community-banner.png'
});
console.log('  -> PNG saved:', pngResult.bannerUrl, `(${pngResult.format})`);
assert(pngResult.bannerUrl.startsWith('/uploads/banners/'), 'Must store in /uploads/banners/');
assert(pngResult.bannerUrl.endsWith('.png'), 'Filename must end with .png');

const jpgResult = await processAndSaveBanner({
  serverId: testServerId,
  buffer: validJpgHeader,
  originalFilename: 'header.jpeg'
});
console.log('  -> JPG saved:', jpgResult.bannerUrl, `(${jpgResult.format})`);
assert(jpgResult.bannerUrl.endsWith('.jpg'), 'Filename must end with .jpg');

const webpResult = await processAndSaveBanner({
  serverId: testServerId,
  buffer: validWebpHeader,
  originalFilename: 'artwork.webp'
});
console.log('  -> WebP saved:', webpResult.bannerUrl, `(${webpResult.format})`);
assert(webpResult.bannerUrl.endsWith('.webp'), 'Filename must end with .webp');
console.log('  ✓ Verified: PNG, JPG, and WebP images successfully processed and stored.');

// 5. Test GIF without premium vs with premium
console.log('\n5. Testing GIF upload rules (Premium only)...');
// Server without premium boost
const nonPremiumServerId = '123456789012345678';
try {
  await processAndSaveBanner({
    serverId: nonPremiumServerId,
    buffer: validGifHeader,
    originalFilename: 'cool.gif'
  });
  assert.fail('GIF must be rejected for non-premium server');
} catch (err) {
  console.log(`  -> Expected error received: "${err.message}" (code: ${err.code})`);
  assert.strictEqual(err.code, 'PREMIUM_REQUIRED_FOR_GIF', 'Must require premium for GIF');
}

// Now activate premium on test server and retry
console.log('  -> Activating Premium on server and testing GIF upload...');
const shopItems = await loadShopItems();
const premiumItem = shopItems.find(i => i.effect === 'premium');
recordLedgerTransaction({ serverId: testServerId, amount: 600, type: 'earned', description: 'Test setup for premium banner' });
await buyShopItem({
  serverId: testServerId,
  itemId: premiumItem.id,
  buyerUserId: '111111111111111111',
  buyerUsername: 'TestOwner',
  isOwner: true,
  isManager: true
});

const gifResult = await processAndSaveBanner({
  serverId: testServerId,
  buffer: validGifHeader,
  originalFilename: 'animated.gif'
});
console.log('  -> GIF saved for premium server:', gifResult.bannerUrl, `(${gifResult.format})`);
assert(gifResult.bannerUrl.endsWith('.gif'), 'Filename must end with .gif');
console.log('  ✓ Verified: GIF uploads allowed for premium servers and blocked for standard.');

console.log('\n✓ ALL ITEM 3 TESTS PASSED SUCCESSFULLY!');
process.exit(0);
