import fs from "node:fs";
import path from "node:path";
import { safeStorage } from "electron";
import { API_VENDORS, type ApiVendor, type ApiKeysState } from "../../shared/agent/chat";

/**
 * The user's own API keys for the agent chat, encrypted with the operating
 * system's keychain (Electron `safeStorage`) and kept beside this build's data.
 *
 * @remarks
 * Keys never leave main: the renderer learns only which vendors have one.
 */
export class AgentKeys {
  readonly #file: string;

  constructor(directory: string) {
    this.#file = path.join(directory, "agent-keys.json");
  }

  /** Which vendors have a key. */
  state(): ApiKeysState {
    const stored = this.#read();
    return Object.fromEntries(
      API_VENDORS.map((vendor) => [vendor, vendor in stored]),
    ) as ApiKeysState;
  }

  /** The key for `vendor`, decrypted, or null when there is none. */
  key(vendor: ApiVendor): string | null {
    const encrypted = this.#read()[vendor];
    if (!encrypted) return null;

    return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  }

  /**
   * Stores `key` for `vendor`, or removes it when null or blank.
   *
   * @throws {Error} when the system keychain cannot encrypt.
   */
  set(vendor: ApiVendor, key: string | null): ApiKeysState {
    const stored = this.#read();
    const trimmed = key?.trim() ?? "";
    if (trimmed) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error(
          "This computer's keychain is unavailable, so the key can't be stored safely",
        );
      }
      stored[vendor] = safeStorage.encryptString(trimmed).toString("base64");
    } else {
      delete stored[vendor];
    }
    fs.mkdirSync(path.dirname(this.#file), { recursive: true });
    fs.writeFileSync(this.#file, JSON.stringify(stored, null, 2));
    return this.state();
  }

  #read(): Partial<Record<ApiVendor, string>> {
    try {
      return JSON.parse(fs.readFileSync(this.#file, "utf8")) as Partial<Record<ApiVendor, string>>;
    } catch {
      return {};
    }
  }
}
