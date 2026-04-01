import type { ReviewConfig } from "@core/config";
import { CHARS_PER_TOKEN } from "@core/config";

// Copilot models ordered by context size (ascending).
// Each tier: best quality-per-cost at that context window.
//   gpt-5-mini      192K  0.33x — fast & cheap for small diffs
//   gpt-5.1-codex   256K  1x    — codex quality for medium diffs
//   gpt-5.3-codex   400K  1x    — full codex for large diffs
const MODEL_TIERS = [
  { name: "gpt-5-mini", maxTokens: 192_000 },
  { name: "gpt-5.1-codex", maxTokens: 256_000 },
  { name: "gpt-5.3-codex", maxTokens: 400_000 },
] as const;

// Token budget reserved beyond the diff itself.
const RESERVED_TOKENS =
  3_000 + // system prompt + tool instructions
  2_000 + // repo file map
  4_000 + // response headroom
  8_000; // files read via read_file during exploration

const SMALL_DIFF_THRESHOLD = 8_000;

const estimateTokens = (text: string) =>
  Math.ceil(text.length / CHARS_PER_TOKEN);

export function selectModel(
  diffText: string,
  { model, premiumModel }: ReviewConfig
): string {
  if (model !== "auto") return model;

  const diffTokens = estimateTokens(diffText);

  // Small diffs: fast mini model
  if (diffTokens <= SMALL_DIFF_THRESHOLD) return MODEL_TIERS[0].name;

  // Larger diffs: prefer premium if configured
  if (premiumModel) return premiumModel;

  // Otherwise, find the smallest tier that fits
  const required = diffTokens + RESERVED_TOKENS;
  const fit = MODEL_TIERS.find((t) => required <= t.maxTokens);
  return fit?.name ?? MODEL_TIERS[MODEL_TIERS.length - 1].name;
}
