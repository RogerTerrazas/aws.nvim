import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

class Logger {
  private readonly logPath: string

  constructor() {
    // Prefer the XDG state directory that Neovim already uses, so all
    // nvim-related logs live in one place.  Fall back to $HOME if the
    // directory doesn't exist (e.g. non-Linux systems without XDG setup).
    const xdgStateDir = path.join(os.homedir(), '.local', 'state', 'nvim')
    const dir = fs.existsSync(xdgStateDir) ? xdgStateDir : os.homedir()
    this.logPath = path.join(dir, 'nvim-aws.log')
  }

  // -------------------------------------------------------------------------
  // Internal write — synchronous so no log lines are ever dropped, even if
  // the process crashes or an unhandled rejection propagates.
  // -------------------------------------------------------------------------

  private write(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void {
    const ts = new Date().toISOString()
    const ctx = context ? ' ' + JSON.stringify(context) : ''
    const line = `[${ts}] [${level.padEnd(5)}] ${message}${ctx}\n`
    try {
      fs.appendFileSync(this.logPath, line, 'utf8')
    } catch {
      // If we can't write to the log file (permissions, disk full, etc.)
      // there is nothing useful we can do — swallow silently rather than
      // crashing the plugin.
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  debug(message: string, context?: Record<string, unknown>): void {
    this.write('DEBUG', message, context)
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.write('INFO', message, context)
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.write('WARN', message, context)
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.write('ERROR', message, context)
  }

  /**
   * Returns the absolute path of the log file so it can be surfaced to the
   * user on startup (e.g. via the startup INFO line in index.ts).
   */
  getLogPath(): string {
    return this.logPath
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const logger = new Logger()
