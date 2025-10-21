/**
 * Agent registry - Pure agent management
 *
 * Manages the registry of available coding agents.
 */

import { CodingAgent } from '../types';
import { Result, Ok, Err } from '../utils/result';
import { AgentError } from '../types/errors';

/**
 * Registry of available coding agents
 */
const agents = new Map<string, CodingAgent>();

/**
 * Register a coding agent
 *
 * PURE: Simple Map.set operation
 */
export function registerAgent(agent: CodingAgent): void {
  agents.set(agent.name, agent);
}

/**
 * Get a coding agent by name
 *
 * Returns Result instead of throwing for explicit error handling
 */
export function getAgent(name: string): Result<CodingAgent, AgentError> {
  const agent = agents.get(name);
  if (!agent) {
    const available = Array.from(agents.keys()).join(', ');
    return new Err(
      new AgentError(
        `Unknown agent: "${name}". Available agents: ${available || '(none)'}`,
        'NOT_FOUND',
        { requestedAgent: name, availableAgents: Array.from(agents.keys()) }
      )
    );
  }
  return new Ok(agent);
}

/**
 * Get all registered agent names
 *
 * PURE: Read-only operation
 */
export function getAvailableAgents(): string[] {
  return Array.from(agents.keys());
}

/**
 * Check if an agent is registered
 *
 * PURE: Simple Map.has check
 */
export function hasAgent(name: string): boolean {
  return agents.has(name);
}
