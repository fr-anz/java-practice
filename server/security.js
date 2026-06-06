const BLOCKED_KEYWORDS = [
  'File(',
  'FileWriter',
  'FileReader',
  'BufferedWriter',
  'BufferedReader',
  'ProcessBuilder',
  'Runtime.getRuntime()',
  'System.exit(',
  'Thread(',
  'while(true)',
  'for(;;)',
  'Socket(',
  'ServerSocket(',
  'URL(',
  'Class.forName(',
  '.exec(',
];

export function checkSecurity(code) {
  const issues = [];
  for (const kw of BLOCKED_KEYWORDS) {
    if (code.includes(kw)) {
      issues.push(`Blocked keyword detected: ${kw}`);
    }
  }
  return {
    safe: issues.length === 0,
    issues,
  };
}

export const MAX_OUTPUT_SIZE = 10000;
export const RUN_TIMEOUT_MS = 5000;
