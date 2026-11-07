/**
 * Web Storage can be blocked (a private window) or missing (the server's render); then nothing is
 * found or kept.
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
    getJson(key: string): unknown {
      try {
        return JSON.parse(globalThis[name].getItem(key) ?? "null");
      } catch {
        return null;
      }
    },
    keys(prefix: string): string[] {
      try {
        const storage = globalThis[name];

        return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
          (key): key is string => key?.startsWith(prefix) === true,
        );
      } catch {
        return [];
      }
    },
    remove(key: string): boolean {
      try {
        globalThis[name].removeItem(key);
        return true;
      } catch {
        return false;
      }
    },
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
