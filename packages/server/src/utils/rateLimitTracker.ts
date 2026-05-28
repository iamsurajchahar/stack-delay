interface BudgetEntry {
  remaining: number;
  resetAt: number;
}

const budgets = new Map<string, BudgetEntry>();

const CONSERVE_THRESHOLD = 100;
const PAUSE_THRESHOLD = 20;

export function updateBudget(service: string, remaining: number, resetAt: number): void {
  budgets.set(service, { remaining, resetAt });
}

export function getBudget(service: string): BudgetEntry {
  const entry = budgets.get(service);
  if (!entry) {
    return { remaining: Infinity, resetAt: 0 };
  }
  // If the reset time has passed, treat the budget as fully replenished
  if (Date.now() > entry.resetAt) {
    budgets.delete(service);
    return { remaining: Infinity, resetAt: 0 };
  }
  return entry;
}

/**
 * Returns true when the remaining budget is below the conserve threshold (< 100).
 * In conserve mode, non-essential requests should be deferred or cached more aggressively.
 */
export function isConserving(service: string): boolean {
  const { remaining } = getBudget(service);
  return remaining < CONSERVE_THRESHOLD;
}

/**
 * Returns true when the remaining budget is critically low (< 20).
 * In paused mode, only essential requests should proceed.
 */
export function isPaused(service: string): boolean {
  const { remaining } = getBudget(service);
  return remaining < PAUSE_THRESHOLD;
}
