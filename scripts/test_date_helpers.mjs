import { parseDateSafe, formatDate, formatDateTime, formatRelative, formatLastBump } from '../src/lib/format.ts';

console.log('--- Testing Safe Date Formatting Helpers ---');

const tests = [
  { name: 'null', input: null, expectedNull: true },
  { name: 'undefined', input: undefined, expectedNull: true },
  { name: 'empty string', input: '', expectedNull: true },
  { name: 'literal "null"', input: 'null', expectedNull: true },
  { name: 'literal "Never"', input: 'Never', expectedNull: true },
  { name: 'garbage string', input: 'invalid_date_xyz', expectedNull: true },
  { name: 'ISO string', input: '2026-11-06T00:00:00.000Z', expectedNull: false },
  { name: 'seconds timestamp', input: 1762387200, expectedNull: false },
  { name: 'milliseconds timestamp', input: 1762387200000, expectedNull: false },
  { name: 'Date object', input: new Date(1762387200000), expectedNull: false },
];

let failed = 0;

for (const t of tests) {
  const parsed = parseDateSafe(t.input);
  const isNull = parsed === null;
  if (isNull !== t.expectedNull) {
    console.error(`FAIL: parseDateSafe for ${t.name}: got ${parsed}, expected null=${t.expectedNull}`);
    failed++;
  } else {
    console.log(`✓ parseDateSafe(${t.name}) -> ${parsed ? parsed.toISOString() : 'null'}`);
  }

  const formatted = formatDate(t.input);
  if (formatted.includes('Invalid Date')) {
    console.error(`FAIL: formatDate for ${t.name} returned "Invalid Date"!`);
    failed++;
  }

  const bumpInfo = formatLastBump(t.input);
  if (bumpInfo.relative.includes('Invalid') || bumpInfo.exact.includes('Invalid')) {
    console.error(`FAIL: formatLastBump for ${t.name} produced Invalid:`, bumpInfo);
    failed++;
  }
}

// Check null fallback is strictly "Never"
const nullBump = formatLastBump(null);
if (nullBump.relative !== 'Never' || nullBump.exact !== 'Never') {
  console.error(`FAIL: formatLastBump(null) did not return 'Never':`, nullBump);
  failed++;
} else {
  console.log('✓ formatLastBump(null) correctly returns "Never"');
}

// Check ISO string gives valid relative and exact strings
const isoBump = formatLastBump('2026-11-06T00:00:00.000Z', new Date('2026-11-06T01:30:00.000Z'));
console.log('✓ formatLastBump(ISO) ->', isoBump);
if (isoBump.relative !== '2h ago') {
  console.error(`FAIL: Expected ~2h ago, got ${isoBump.relative}`);
  failed++;
}

// Check seconds timestamp is converted correctly
const secBump = formatLastBump(1762387200); // 1.76 billion seconds = 1.76 trillion ms
console.log('✓ formatLastBump(seconds) ->', secBump);

if (failed === 0) {
  console.log('\nALL DATE TESTS PASSED 100%! ZERO INVALID DATES.');
} else {
  console.error(`\n${failed} DATE TESTS FAILED!`);
  process.exit(1);
}

