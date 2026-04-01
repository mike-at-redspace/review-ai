export {
  isGitRepository,
  getCurrentBranch,
  getRecentCommits,
  getAllChanges,
  setGitExecutor,
} from "./git.js";

export {
  sanitizeDiff,
  getLanguageFromPath,
  isImportLine,
  collapseImportLines,
  pathPriority,
  getSmartDiff,
} from "./smartDiff.js";
