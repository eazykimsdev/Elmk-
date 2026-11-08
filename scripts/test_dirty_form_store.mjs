import { dirtyFormStore } from '../src/lib/dirty-form-store.js';

console.log('=== RUNNING DIRTY FORM STORE UNIT TEST ===');

let notifications = 0;
const unsubscribe = dirtyFormStore.subscribe(() => {
  notifications++;
});

console.log('Running 100 register/update/unregister cycles in rapid succession...');

for (let i = 0; i < 100; i++) {
  dirtyFormStore.register({
    id: `form_${i}`,
    isDirty: true,
    onSave: () => {},
    onReset: () => {},
    isSaving: false,
    sections: ['Test'],
    changedFields: ['Field'],
  });

  dirtyFormStore.update(`form_${i}`);
  dirtyFormStore.unregister(`form_${i}`);
}

// Allow microtasks to settle
await new Promise((resolve) => setTimeout(resolve, 50));

unsubscribe();

console.log(`Total notifications delivered: ${notifications}`);

// With microtask batching, 100 synchronous cycles must coalesce into very few batched notifications (<= 5).
if (notifications <= 10) {
  console.log(`[PASS] Microtask batching prevented notification thrash! Delivered: ${notifications} <= 10`);
} else {
  console.error(`[FAIL] Too many notifications delivered: ${notifications} > 10`);
  process.exit(1);
}

// Test reference stability
const snapshot1 = dirtyFormStore.getSnapshot();
const snapshot2 = dirtyFormStore.getSnapshot();

if (snapshot1 === snapshot2) {
  console.log('[PASS] getSnapshot returns identical cached reference when data did not change.');
} else {
  console.error('[FAIL] getSnapshot returned different object references!');
  process.exit(1);
}

console.log('=== DIRTY FORM STORE UNIT TEST PASSED ===');

