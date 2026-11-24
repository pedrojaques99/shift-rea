import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { foldHistory, type ChatHistory, type ChatRecord } from "../../shared/agent/chat";

/**
 * The agent chat's conversations on disk: one append-only JSON Lines file per
 * document, so a conversation survives a restart, a crash or a reload.
 *
 * @remarks
 * Every record is appended as it happens, from main, so a reply streaming
 * while the window reloads is still kept. A line that can't be read (a write
 * cut short) is skipped, never fatal.
 */
export class ConversationLog {
  readonly #directory: string;

  constructor(directory: string) {
    this.#directory = directory;
  }

  /** The conversation since its last reset, and the session each provider continues. */
  history(conversation: string): ChatHistory {
    return foldHistory(this.#read(conversation));
  }

  append(conversation: string, record: ChatRecord): void {
    fs.mkdirSync(this.#directory, { recursive: true });
    fs.appendFileSync(this.#file(conversation), `${JSON.stringify(record)}\n`);
  }

  #read(conversation: string): ChatRecord[] {
    let text: string;
    try {
      text = fs.readFileSync(this.#file(conversation), "utf8");
    } catch {
      return [];
    }
    return text.split("\n").flatMap((line) => {
      if (!line.trim()) return [];
      try {
        return [JSON.parse(line) as ChatRecord];
      } catch {
        return [];
      }
    });
  }

  /** Document keys can be paths; the file is named by their hash. */
  #file(conversation: string): string {
    const name = crypto.createHash("sha256").update(conversation).digest("hex").slice(0, 32);
    return path.join(this.#directory, `${name}.jsonl`);
  }
}
