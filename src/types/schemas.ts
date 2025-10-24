/**
 * Zod schemas for runtime validation
 *
 * These schemas validate JSON data at system boundaries to prevent
 * runtime errors from malformed data.
 */

import { z } from 'zod';

/**
 * Schema for AiFileState
 */
export const AiFileStateSchema = z.object({
  lastHash: z.string(),
  lastContent: z.string(),
  lastGenerated: z.string(),
  artifacts: z.array(z.string()),
});

/**
 * Schema for DotAiState (state.json)
 */
export const DotAiStateSchema = z.object({
  version: z.string(),
  files: z.record(z.string(), AiFileStateSchema),
});

/**
 * Schema for DotAiConfig (config.json)
 */
export const DotAiConfigSchema = z.object({
  defaultAgent: z.string().min(1),
  stateFile: z.string().min(1),
});

/**
 * Schema for artifact filename validation
 * Prevents special characters that could cause filesystem issues
 */
export const ArtifactFilenameSchema = z.string().regex(
  /^[a-zA-Z0-9_.-]+$/,
  'Artifact filenames must contain only alphanumeric characters, underscores, hyphens, and dots'
);

/**
 * Export types inferred from schemas for type checking
 */
export type ValidatedDotAiState = z.infer<typeof DotAiStateSchema>;
export type ValidatedDotAiConfig = z.infer<typeof DotAiConfigSchema>;
export type ValidatedAiFileState = z.infer<typeof AiFileStateSchema>;
