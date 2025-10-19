import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import matter from 'gray-matter';
import { AiFile, AiFileFrontmatter } from '../types';

/**
 * Parse a .ai file and extract frontmatter + content
 */
export async function parseAiFile(filePath: string): Promise<AiFile> {
  const absolutePath = path.resolve(filePath);
  const rawContent = await fs.readFile(absolutePath, 'utf-8');

  // Parse frontmatter using gray-matter
  const parsed = matter(rawContent);

  // Validate frontmatter structure
  const frontmatter = validateFrontmatter(parsed.data);

  // Calculate content hash for change detection
  const hash = calculateHash(rawContent);

  return {
    path: absolutePath,
    frontmatter,
    content: parsed.content.trim(),
    hash,
  };
}

/**
 * Validate and normalize frontmatter data
 */
function validateFrontmatter(data: unknown): AiFileFrontmatter {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid frontmatter: must be an object');
  }

  const fm = data as Record<string, unknown>;

  // Agent is required
  if (typeof fm.agent !== 'string' || !fm.agent) {
    throw new Error('Invalid frontmatter: "agent" field is required and must be a string');
  }

  // artifacts defaults to empty array
  const artifacts = Array.isArray(fm.artifacts) ? fm.artifacts : [];
  if (!artifacts.every((a) => typeof a === 'string')) {
    throw new Error('Invalid frontmatter: "artifacts" must be an array of strings');
  }

  // agent_config is optional
  const agentConfig = fm.agent_config;
  if (agentConfig !== undefined && (typeof agentConfig !== 'object' || agentConfig === null)) {
    throw new Error('Invalid frontmatter: "agent_config" must be an object');
  }

  return {
    agent: fm.agent,
    agent_config: agentConfig as Record<string, unknown> | undefined,
    artifacts: artifacts as string[],
  };
}

/**
 * Calculate SHA-256 hash of content
 */
export function calculateHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Update the artifacts list in a .ai file's frontmatter
 */
export async function updateArtifacts(filePath: string, artifacts: string[]): Promise<void> {
  const rawContent = await fs.readFile(filePath, 'utf-8');
  const parsed = matter(rawContent);

  // Update artifacts in frontmatter
  parsed.data.artifacts = artifacts;

  // Stringify back to file format
  const updated = matter.stringify(parsed.content, parsed.data);

  // Write back to file
  await fs.writeFile(filePath, updated, 'utf-8');
}

/**
 * Find all .ai files in a directory tree
 */
export async function findAiFiles(directory: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip .dotai and node_modules
        if (entry.name === '.dotai' || entry.name === 'node_modules' || entry.name === '.git') {
          continue;
        }
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ai')) {
        results.push(fullPath);
      }
    }
  }

  await walk(path.resolve(directory));
  return results;
}
