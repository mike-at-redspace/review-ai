import type { ReviewConfig } from "@core/config";
import { CHARS_PER_TOKEN } from "@core/config";

interface ModelTier {
  name: string;
  maxContextTokens: number;
}

// Available Copilot models ordered by context size ascending.
// At each tier we pick the best quality-per-cost model:
//   - gpt-5-mini      (192K, 0.33x cost) — fast & cheap for small diffs
//   - gpt-5.1-codex   (256K, 1x cost)    — codex quality for medium diffs
//   - gpt-5.3-codex   (400K, 1x cost)    — full codex for large diffs
const MODEL_TIERS: ModelTier[] = [
  {
    name: "gpt-5-mini",
    maxContextTokens: 192_000,
  },
  {
    name: "gpt-5.1-codex",
    maxContextTokens: 256_000,
  },
  {
    name: "gpt-5.3-codex",
    maxContextTokens: 400_000,
  },
];

const SYSTEM_PROMPT_OVERHEAD_TOKENS = 3_000;
const REPO_MAP_OVERHEAD_TOKENS = 2_000;
const RESPONSE_HEADROOM_TOKENS = 4_000;
// Extra budget for files the model reads via read_file during exploration.
const TOOL_CONTEXT_HEADROOM_TOKENS = 8_000;
const RESERVED_TOKENS =
  SYSTEM_PROMPT_OVERHEAD_TOKENS +
  REPO_MAP_OVERHEAD_TOKENS +
  RESPONSE_HEADROOM_TOKENS +
  TOOL_CONTEXT_HEADROOM_TOKENS;

// Small diffs: use the free mini model for speed.
// Beyond this threshold, step up to codex models.
const SMALL_DIFF_TOKEN_THRESHOLD = 8_000;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function selectModel(diffText: string, config: ReviewConfig): string {
  // If the user explicitly set a model via --model, always respect that
  if (config.model !== "auto") {
    return config.model;
  }

  const diffTokens = estimateTokens(diffText);
  const premiumModel = config.premiumModel;

  // Small diffs: use the fast mini model
  if (diffTokens <= SMALL_DIFF_TOKEN_THRESHOLD) {
    return MODEL_TIERS[0].name;
  }

  // For larger diffs, find the smallest model that fits
  const requiredTokens = diffTokens + RESERVED_TOKENS;

  // If configured, always prefer premium model on larger diffs.
  if (premiumModel) {
    return premiumModel;
  }

  for (const tier of MODEL_TIERS) {
    if (requiredTokens <= tier.maxContextTokens) {
      return tier.name;
    }
  }

  // If diff exceeds even the largest model, use the largest and rely on truncation
  return MODEL_TIERS[MODEL_TIERS.length - 1].name;
}
