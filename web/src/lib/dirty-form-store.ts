import { useEffect, useRef, useSyncExternalStore } from 'react';

export type SaveHandler = () => Promise<void> | void;
export type ResetHandler = () => void;

export interface FormRegistration {
  id: string;
  readonly isDirty: boolean;
  onSave: SaveHandler;
  onReset: ResetHandler;
  readonly isSaving?: boolean;
  readonly sections?: string[];
  readonly changedFields?: string[];
}

export interface StoreSnapshot {
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly sections: readonly string[];
  readonly changedFields: readonly string[];
}

const INITIAL_SNAPSHOT: StoreSnapshot = Object.freeze({
  isDirty: false,
  isSaving: false,
  sections: Object.freeze([]),
  changedFields: Object.freeze([]),
});

class DirtyFormStore {
  private forms = new Map<string, FormRegistration>();
  private listeners = new Set<() => void>();
  private snapshot: StoreSnapshot = INITIAL_SNAPSHOT;
  private isMicrotaskScheduled = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', (e) => {
        if (this.snapshot.isDirty) {
          e.preventDefault();
          e.returnValue = '';
          return '';
        }
      });
    }
  }

  register(form: FormRegistration) {
    this.forms.set(form.id, form);
    this.recomputeSnapshot();
  }

  update(id: string) {
    if (this.forms.has(id)) {
      this.recomputeSnapshot();
    }
  }

  unregister(id: string) {
    if (this.forms.has(id)) {
      this.forms.delete(id);
      this.recomputeSnapshot();
    }
  }

  getSnapshot = (): StoreSnapshot => {
    return this.snapshot;
  };

  private recomputeSnapshot() {
    let dirty = false;
    let saving = false;
    const allSections = new Set<string>();
    const allFields = new Set<string>();

    for (const f of this.forms.values()) {
      if (f.isDirty) {
        dirty = true;
        if (f.isSaving) saving = true;
        if (Array.isArray(f.sections)) {
          f.sections.forEach((s) => allSections.add(s));
        }
        if (Array.isArray(f.changedFields)) {
          f.changedFields.forEach((field) => allFields.add(field));
        }
        if (import.meta.env?.DEV) {
          console.debug(`[DirtyFormStore] Form is dirty: "${f.id}"`, {
            sections: f.sections,
            changedFields: f.changedFields,
          });
        }
      }
    }

    const sections = Array.from(allSections);
    const changedFields = Array.from(allFields);

    const prev = this.snapshot;
    const hasChanged =
      prev.isDirty !== dirty ||
      prev.isSaving !== saving ||
      prev.sections.length !== sections.length ||
      prev.changedFields.length !== changedFields.length ||
      prev.sections.some((s, idx) => s !== sections[idx]) ||
      prev.changedFields.some((f, idx) => f !== changedFields[idx]);

    if (hasChanged) {
      this.snapshot = Object.freeze({
        isDirty: dirty,
        isSaving: saving,
        sections: Object.freeze(sections),
        changedFields: Object.freeze(changedFields),
      });
      this.notifyAsync();
    }
  }

  async saveAll(): Promise<void> {
    const promises: (Promise<void> | void)[] = [];
    for (const f of this.forms.values()) {
      if (f.isDirty && f.onSave) {
        promises.push(f.onSave());
      }
    }
    await Promise.all(promises);
  }

  resetAll(): void {
    for (const f of this.forms.values()) {
      if (f.isDirty && f.onReset) {
        f.onReset();
      }
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notifyAsync() {
    if (this.isMicrotaskScheduled) return;
    this.isMicrotaskScheduled = true;

    // Never notify synchronously during render or effect cleanup.
    // Schedule via microtask to guarantee batching and reference stability.
    queueMicrotask(() => {
      this.isMicrotaskScheduled = false;
      this.listeners.forEach((listener) => {
        try {
          listener();
        } catch (err) {
          console.error('[DirtyFormStore] Listener notification error:', err);
        }
      });
    });
  }
}

export const dirtyFormStore = new DirtyFormStore();

export function useDirtyFormState() {
  const snapshot = useSyncExternalStore(
    dirtyFormStore.subscribe,
    dirtyFormStore.getSnapshot,
    dirtyFormStore.getSnapshot
  );

  return {
    isDirty: snapshot.isDirty,
    isSaving: snapshot.isSaving,
    sections: snapshot.sections,
    changedFields: snapshot.changedFields,
    save: () => dirtyFormStore.saveAll(),
    reset: () => dirtyFormStore.resetAll(),
  };
}

export function useRegisterDirtyForm({
  id,
  isDirty,
  onSave,
  onReset,
  isSaving = false,
  sections = [],
  changedFields = [],
}: {
  id: string;
  isDirty: boolean;
  onSave: SaveHandler;
  onReset: ResetHandler;
  isSaving?: boolean;
  sections?: string[];
  changedFields?: string[];
}) {
  const isDirtyRef = useRef(isDirty);
  const isSavingRef = useRef(isSaving);
  const saveRef = useRef(onSave);
  const resetRef = useRef(onReset);
  const sectionsRef = useRef(sections);
  const fieldsRef = useRef(changedFields);

  useEffect(() => {
    isDirtyRef.current = isDirty;
    isSavingRef.current = isSaving;
    saveRef.current = onSave;
    resetRef.current = onReset;
    sectionsRef.current = sections;
    fieldsRef.current = changedFields;
  });

  // Register only once on mount with stable id, unregister on unmount
  useEffect(() => {
    dirtyFormStore.register({
      id,
      get isDirty() {
        return isDirtyRef.current;
      },
      get isSaving() {
        return isSavingRef.current;
      },
      onSave: () => saveRef.current(),
      onReset: () => resetRef.current(),
      get sections() {
        return sectionsRef.current;
      },
      get changedFields() {
        return fieldsRef.current;
      },
    });

    return () => {
      dirtyFormStore.unregister(id);
    };
  }, [id]);

  // Touch store when dirty state or saving state changes, without remounting registration
  useEffect(() => {
    dirtyFormStore.update(id);
  }, [id, isDirty, isSaving]);
}
