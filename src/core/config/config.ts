import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { ReviewConfig } from "./types.js";
import {
  CONFIG_FILENAME,
  DEFAULT_COPILOT_MODEL,
  DEFAULT_PREMIUM_MODEL,
  MAX_DIFF_LENGTH,
} from "./constants.js";

const DEFAULT_CONFIG: ReviewConfig = {
  model: DEFAULT_COPILOT_MODEL,
  premiumModel: DEFAULT_PREMIUM_MODEL,
  minSeverity: "nitpick",
  focusCategories: [],
  outputPath: "./PR-REVIEW.md",
  autoOpen: false,
};

function resolveConfigPath(): string | null {
  const paths = [
    join(process.cwd(), CONFIG_FILENAME),
    join(homedir(), CONFIG_FILENAME),
  ];
  for (const path of paths) {
    if (existsSync(path)) return path;
  }
  return null;
}

function validateConfig(config: Partial<ReviewConfig>): string[] {
  const warnings: string[] = [];
  if (
    config.maxDiffLength !== undefined &&
    (config.maxDiffLength < 0 || config.maxDiffLength > 2 * 1024 * 1024)
  ) {
    warnings.push("maxDiffLength should be between 0 and 2MB");
  }
  if (
    config.maxDiffTokens !== undefined &&
    (config.maxDiffTokens < 0 || config.maxDiffTokens > 500_000)
  ) {
    warnings.push("maxDiffTokens should be between 0 and 500000");
  }
  return warnings;
}

export function loadConfig(): ReviewConfig {
  const configPath = resolveConfigPath();
  let fileConfig: Partial<ReviewConfig> = {};

  if (configPath) {
    try {
      const content = readFileSync(configPath, "utf-8");
      fileConfig = JSON.parse(content);
      const warnings = validateConfig(fileConfig);
      if (warnings.length > 0 && process.env.DEBUG) {
        console.warn("Config warnings:", warnings.join(", "));
      }
    } catch (error) {
      if (process.env.DEBUG) {
        console.warn(
          `Failed to parse config at ${configPath}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  if (process.env.REVIEW_AI_MODEL) {
    fileConfig.model = process.env.REVIEW_AI_MODEL;
  }

  return { ...DEFAULT_CONFIG, ...fileConfig };
}

export function getConfigTemplate(): string {
  return JSON.stringify(
    {
      model: DEFAULT_COPILOT_MODEL,
      premiumModel: DEFAULT_PREMIUM_MODEL,
      minSeverity: "nitpick",
      focusCategories: [],
      maxDiffLength: MAX_DIFF_LENGTH,
      ignoreWhitespaceInDiff: false,
      importCollapse: true,
      outputPath: "./PR-REVIEW.md",
      autoOpen: false,
    },
    null,
    2
  );
}
