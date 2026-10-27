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
    /** Whether the browser removed it. */
    remove(key: string): boolean {
      try {
        globalThis[name].removeItem(key);
        return true;
      } catch {
        return false;
      }
    },
    /** Whether the browser kept it: a full storage can refuse a write it would read. */
    set(key: string, value: string): boolean {
      try {
        globalThis[name].setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export const deviceStorage = createDeviceStorage("localStorage");
export const tabStorage = createDeviceStorage("sessionStorage");
