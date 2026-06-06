import { runJava } from './runner.js';
import { checkConcepts } from './conceptChecker.js';
import { checkSecurity } from './security.js';

export async function checkSolution(problem, level, code) {
  const levelData = problem.levels[level];
  if (!levelData) {
    return { error: `Level "${level}" not found for problem "${problem.id}"` };
  }

  // Security check
  const security = checkSecurity(code);
  if (!security.safe) {
    return {
      error: `Security check failed: ${security.issues.join('; ')}`,
      compile: { pass: false, message: `Blocked code: ${security.issues[0]}` },
      concepts: [],
      tests: [],
      score: 0,
    };
  }

  // Run visible sample test
  const sampleInput = levelData.visibleSample?.input || '';
  const sampleExpected = levelData.visibleSample?.expectedOutput || [];

  const result = await runJava(code, sampleInput);

  if (result.error && !result.compile?.pass) {
    if (result.cleanup) result.cleanup();
    return {
      error: result.error,
      compile: result.compile || { pass: false, message: result.error },
      concepts: [],
      tests: [],
      score: 0,
    };
  }

  // Run all tests
  const allTests = [
    { input: sampleInput, expected: sampleExpected, visible: true },
    ...(levelData.hiddenTests || []).map(t => ({
      input: t.input,
      expected: t.expectedContains || [],
      visible: false,
    })),
  ];

  const testResults = [];
  for (const test of allTests) {
    if (test === allTests[0]) {
      // Already ran the first one
      testResults.push(checkOutput(result.output, test.expected, test.visible, result.error));
    } else {
      const r = await runJava(code, test.input);
      testResults.push(checkOutput(r.output, test.expected, test.visible, r.error));
      if (r.cleanup) r.cleanup();
    }
  }

  // Concept checks
  const conceptResults = checkConcepts(code, levelData.conceptChecks || {});

  // Score
  const score = computeScore(result.compile, testResults, conceptResults);

  // Cleanup
  if (result.cleanup) result.cleanup();

  return {
    compile: result.compile,
    tests: testResults,
    concepts: conceptResults,
    score,
  };
}

function checkOutput(output, expectedContains, visible, error) {
  if (error) {
    return { pass: false, message: `Runtime error: ${error.substring(0, 100)}`, visible };
  }

  const normalized = normalizeOutput(output);
  const missing = [];

  for (const keyword of expectedContains) {
    const normalizedKeyword = normalizeOutput(keyword);
    if (!normalized.includes(normalizedKeyword)) {
      missing.push(keyword);
    }
  }

  if (missing.length === 0) {
    return { pass: true, message: 'All expected outputs found', visible };
  }

  return {
    pass: false,
    message: `Missing: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ` and ${missing.length - 3} more` : ''}`,
    visible,
    missing,
  };
}

function normalizeOutput(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function computeScore(compile, testResults, conceptResults) {
  let score = 0;

  // Compilation: 10 points
  if (compile?.pass) score += 10;

  // Output correctness: 60 points (weighted across all tests)
  if (testResults.length > 0) {
    const passed = testResults.filter(t => t.pass).length;
    score += Math.round((passed / testResults.length) * 60);
  }

  // Concept checks: 30 points
  if (conceptResults.length > 0) {
    const passed = conceptResults.filter(c => c.found).length;
    score += Math.round((passed / conceptResults.length) * 30);
  }

  return Math.min(score, 100);
}
