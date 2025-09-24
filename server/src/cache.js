// Simple in-memory TTL cache
class Cache {
  constructor() {
    this.store = new Map();
  }
  set(key, value, ttlMs) {
    const expires = Date.now() + ttlMs;
    this.store.set(key, { value, expires });
  }
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }
}

const cache = new Cache();
export default cache;
