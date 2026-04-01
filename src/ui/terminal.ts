import { Writable } from "stream";

// DEC 2026: Synchronized Output
// Wraps terminal writes in BSU/ESU sequences so iTerm2 (and other supporting
// terminals) buffer the output and render it as a single atomic frame.
// This prevents visible flicker between clearing old content and painting new.
const BSU = "\x1b[?2026h"; // Begin Synchronized Update
const ESU = "\x1b[?2026l"; // End Synchronized Update

// Alternate screen buffer
const ALT_SCREEN_ENTER = "\x1b[?1049h";
const ALT_SCREEN_EXIT = "\x1b[?1049l";
const CURSOR_HIDE = "\x1b[?25l";
const CURSOR_SHOW = "\x1b[?25h";
const CURSOR_HOME = "\x1b[H";

/**
 * Detect if the terminal supports DEC 2026 synchronized output.
 * Based on claude-src/ink/terminal.ts detection logic.
 */
export function isSynchronizedOutputSupported(): boolean {
  // tmux breaks DEC 2026 pass-through
  if (process.env.TMUX) return false;

  const term = process.env.TERM_PROGRAM ?? "";
  const termVersion = process.env.TERM_PROGRAM_VERSION ?? "";

  // iTerm2 >= 3.6.6
  if (term === "iTerm.app") {
    const parts = termVersion.split(".").map(Number);
    if (parts.length >= 3) {
      const [major, minor, patch] = parts;
      return (
        major > 3 ||
        (major === 3 && minor > 6) ||
        (major === 3 && minor === 6 && patch >= 6)
      );
    }
    return false;
  }

  // Other terminals known to support DEC 2026
  if (
    term === "WezTerm" ||
    term === "ghostty" ||
    term === "Kitty" ||
    term === "Alacritty"
  ) {
    return true;
  }

  return false;
}

/**
 * A writable stream that wraps each write in synchronized output sequences.
 * Ink writes its rendered output via process.stdout; by providing this as
 * Ink's stdout, all frame writes become atomic terminal updates.
 */
export class SyncOutputStream extends Writable {
  private syncSupported: boolean;
  private target: NodeJS.WriteStream;
  private batchBuffer: string = "";
  private batchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(target: NodeJS.WriteStream) {
    super();
    this.syncSupported = isSynchronizedOutputSupported();
    this.target = target;

    // Proxy columns/rows so Ink can read terminal dimensions
    Object.defineProperty(this, "columns", {
      get: () => target.columns,
    });
    Object.defineProperty(this, "rows", {
      get: () => target.rows,
    });
  }

  _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    const data = typeof chunk === "string" ? chunk : chunk.toString();

    if (!this.syncSupported) {
      this.target.write(data, callback);
      return;
    }

    // Batch writes within the same microtask into one synchronized frame
    this.batchBuffer += data;

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flush();
      }, 0);
    }

    callback();
  }

  private flush(): void {
    this.batchTimer = null;
    if (!this.batchBuffer) return;

    const frame = this.batchBuffer;
    this.batchBuffer = "";

    // Wrap the entire frame in BSU/ESU for atomic rendering
    this.target.write(BSU + frame + ESU);
  }

  // Ink checks if stdout is a TTY
  get isTTY(): boolean {
    return this.target.isTTY ?? false;
  }

  // Forward event listeners (Ink listens for 'resize')
  override on(event: string | symbol, listener: (...args: unknown[]) => void) {
    if (event === "resize") {
      this.target.on(event, listener);
    }
    return super.on(event, listener);
  }

  override off(event: string | symbol, listener: (...args: unknown[]) => void) {
    if (event === "resize") {
      this.target.off(event, listener);
    }
    return super.off(event, listener);
  }
}

/**
 * Enter alternate screen buffer and hide cursor.
 * Call before Ink render to prevent scrollback pollution.
 */
export function enterFullscreen(): void {
  process.stdout.write(ALT_SCREEN_ENTER + CURSOR_HIDE + CURSOR_HOME);
}

/**
 * Exit alternate screen buffer and show cursor.
 * Call after Ink exits to restore normal terminal.
 */
export function exitFullscreen(): void {
  process.stdout.write(CURSOR_SHOW + ALT_SCREEN_EXIT);
}

export function restoreTerminal(): void {
  exitFullscreen();
}
