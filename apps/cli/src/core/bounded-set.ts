// Insertion-ordered set with a fixed capacity, evicting the oldest entry once
// full. Used to remember recently delivered request ids for deduplication
// between live events and reconnect backfill without unbounded growth.
export class BoundedSet<T> {
  private readonly items = new Set<T>()

  constructor(private readonly capacity: number) {}

  has(value: T): boolean {
    return this.items.has(value)
  }

  add(value: T): void {
    if (this.items.has(value)) {
      return
    }

    if (this.items.size >= this.capacity) {
      const oldest = this.items.values().next().value
      if (oldest !== undefined) {
        this.items.delete(oldest)
      }
    }

    this.items.add(value)
  }
}
