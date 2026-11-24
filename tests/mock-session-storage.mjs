export function mockSessionStorage() {
  const values = new Map();
  return {
    async get(key) {
      return { [key]: structuredClone(values.get(key)) };
    },
    async set(items) {
      for (const [key, value] of Object.entries(items)) {
        values.set(key, structuredClone(value));
      }
    },
    async remove(key) {
      values.delete(key);
    },
  };
}
