/**
 * Web Storage that can be blocked (a private window, the browser's settings) or missing (the
 * server's render): then nothing is found and nothing is kept, so what it would keep lasts as long
 * as the page.
 */
function createDeviceStorage(name: "localStorage" | "sessionStorage") {
  return {
    get(key: string): string | null {
      try {
        return globalThis[name].getItem(key);
      } catch {
        return null;
      }
    },
    /** The value kept as JSON, or null when it's missing or unreadable. */
    getJson(key: string): unknown {
      try {
        return JSON.parse(globalThis[name].getItem(key) ?? "null");
      } catch {
        return null;
      }
    },
    remove(key: string) {
      try {
        globalThis[name].removeItem(key);
      } catch {
        // Nothing to remove without storage.
      }
    },
    set(key: string, value: string) {
      try {
        globalThis[name].setItem(key, value);
      } catch {
        // Nothing is kept without storage.
      }
    },
  };
}

export const deviceStorage = createDeviceStorage("localStorage");
export const tabStorage = createDeviceStorage("sessionStorage");
