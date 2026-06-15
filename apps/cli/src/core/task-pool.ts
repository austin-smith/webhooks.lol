// Runs async tasks with a bounded concurrency limit. A slow or stuck delivery
// only blocks once `limit` deliveries are already in flight, so live capture
// keeps flowing.
export class TaskPool {
  private readonly active = new Set<Promise<void>>()

  constructor(private readonly limit: number) {}

  async run(task: () => Promise<void>): Promise<void> {
    while (this.active.size >= this.limit) {
      await Promise.race(this.active)
    }

    const promise = task().finally(() => {
      this.active.delete(promise)
    })
    this.active.add(promise)
  }

  async drain(): Promise<void> {
    await Promise.allSettled(this.active)
  }
}
