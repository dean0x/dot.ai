import { CodingAgent } from '../types';

/**
 * Registry of available coding agents
 */
const agents = new Map<string, CodingAgent>();

/**
 * Register a coding agent
 */
export function registerAgent(agent: CodingAgent): void {
  agents.set(agent.name, agent);
}

/**
 * Get a coding agent by name
 */
export function getAgent(name: string): CodingAgent {
  const agent = agents.get(name);
  if (!agent) {
    throw new Error(`Unknown agent: ${name}. Available agents: ${Array.from(agents.keys()).join(', ')}`);
  }
  return agent;
}

/**
 * Get all registered agent names
 */
export function getAvailableAgents(): string[] {
  return Array.from(agents.keys());
}

/**
 * Check if an agent is registered
 */
export function hasAgent(name: string): boolean {
  return agents.has(name);
}
