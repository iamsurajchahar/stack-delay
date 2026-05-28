/**
 * Weights for combining individual dimension scores into a composite score.
 */
export const SCORE_WEIGHTS = {
  vulnerability: 0.30,
  maintenance: 0.25,
  eol: 0.20,
  community: 0.15,
  license: 0.10,
} as const;

/**
 * Weights for dependency types when computing repository aggregate scores.
 */
export const DEP_WEIGHTS = {
  direct: 1.0,
  dev: 0.5,
  transitive: 0.3,
} as const;

/**
 * Score thresholds for letter grades.
 */
export const GRADE_THRESHOLDS = {
  A: 80,
  B: 65,
  C: 50,
  D: 35,
  F: 0,
} as const;
