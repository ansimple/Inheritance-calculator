/**
 * Generic Undo/Redo History Stack for State Snapshots
 */

export class UndoRedoManager<T> {
  private past: T[] = [];
  private future: T[] = [];
  private maxHistory: number;

  constructor(maxHistory: number = 30) {
    this.maxHistory = maxHistory;
  }

  push(snapshot: T) {
    this.past.push(snapshot);
    if (this.past.length > this.maxHistory) {
      this.past.shift();
    }
    this.future = [];
  }

  undo(current: T): T | null {
    if (this.past.length === 0) return null;
    const previous = this.past.pop()!;
    this.future.push(current);
    return previous;
  }

  redo(current: T): T | null {
    if (this.future.length === 0) return null;
    const next = this.future.pop()!;
    this.past.push(current);
    return next;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  clear() {
    this.past = [];
    this.future = [];
  }
}
