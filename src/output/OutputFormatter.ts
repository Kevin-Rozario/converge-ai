import type { EngineResult } from "../engine/types.js";

export interface OutputFormatter {
  readonly fileExtension: string;
  render(result: EngineResult): void;
  format(result: EngineResult): string;
}
