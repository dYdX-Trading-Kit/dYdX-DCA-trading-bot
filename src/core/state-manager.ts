import fs from 'node:fs';
import path from 'node:path';
import type { DcaState } from '../types/index.js';
import type { Logger } from '../utils/logger.js';

const STATE_DIR = 'data';
const STATE_FILE = 'dca-state.json';

export class StateManager {
  private readonly statePath: string;
  private readonly logger: Logger;

  constructor(logger: Logger, stateDir = STATE_DIR) {
    this.logger = logger;
    this.statePath = path.join(stateDir, STATE_FILE);

    const dir = path.dirname(this.statePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  load(): DcaState | null {
    try {
      if (!fs.existsSync(this.statePath)) {
        return null;
      }
      const raw = fs.readFileSync(this.statePath, 'utf-8');
      const state = JSON.parse(raw) as DcaState;
      this.logger.debug('DCA state loaded from disk');
      return state;
    } catch (error) {
      this.logger.warn(
        `Failed to load state, starting fresh: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  save(state: DcaState): void {
    try {
      const tempPath = `${this.statePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.statePath);
      this.logger.debug('DCA state saved to disk');
    } catch (error) {
      this.logger.error(
        `Failed to save state: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  reset(): void {
    if (fs.existsSync(this.statePath)) {
      fs.unlinkSync(this.statePath);
      this.logger.info('DCA state reset');
    }
  }
}
