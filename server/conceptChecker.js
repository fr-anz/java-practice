export function checkConcepts(code, requiredChecks) {
  const results = [];

  if (requiredChecks.scanner) {
    const hasScanner = /\bScanner\s+\w+\s*=/.test(code) && /new\s+(?:java\.util\.)?Scanner\s*\(\s*System\.in\s*\)/.test(code);
    results.push({
      name: 'Scanner',
      found: hasScanner,
      message: hasScanner ? 'Detected' : 'Scanner not found. Use: Scanner input = new Scanner(System.in);',
    });
  }

  if (requiredChecks.ifElse) {
    const hasIf = /\bif\s*\(/.test(code);
    const hasElse = /\belse\b/.test(code);
    const found = hasIf && hasElse;
    results.push({
      name: 'if-else',
      found,
      message: found ? 'Detected' : 'if-else not found. Make sure to use both if and else blocks.',
    });
  }

  if (requiredChecks.switch) {
    const hasSwitch = /\bswitch\s*\(/.test(code);
    results.push({
      name: 'switch',
      found: hasSwitch,
      message: hasSwitch ? 'Detected' : 'switch statement not found. Use switch for handling multiple cases.',
    });
  }

  if (requiredChecks.loop) {
    const hasLoop = /\b(for|while|do)\b/.test(code);
    results.push({
      name: 'loop',
      found: hasLoop,
      message: hasLoop ? 'Detected' : 'Loop not found. Use for, while, or do-while to repeat operations.',
    });
  }

  if (requiredChecks.exceptionHandling) {
    const hasTryCatch = /\btry\s*(?:\([^)]*\)\s*)?\{[\s\S]*?\}\s*catch\s*\(/.test(code);
    results.push({
      name: 'exception handling',
      found: hasTryCatch,
      message: hasTryCatch ? 'Detected' : 'try-catch not found. Use exception handling for invalid numeric input.',
    });
  }

  if (requiredChecks.scannerClose) {
    const hasScannerClose = /\b\w+\.close\s*\(\s*\)/.test(code) || /\btry\s*\([^)]*(?:Scanner|scanner)[^)]*\)\s*\{/.test(code);
    results.push({
      name: 'Scanner close',
      found: hasScannerClose,
      message: hasScannerClose ? 'Detected' : 'Scanner close not found. Close the Scanner object before the program ends.',
    });
  }

  if (requiredChecks.methods) {
    const methodMatches = code.match(/(?:public|private|protected)?\s*(?:static\s+)?(?:void|\w+(?:\[\])?)\s+(\w+)\s*\(/g) || [];
    const userMethods = methodMatches.filter(m => {
      const name = m.match(/(\w+)\s*\(/)?.[1] || '';
      return name !== 'main' && name !== 'if' && name !== 'for' && name !== 'while' && name !== 'switch';
    });
    const methodCount = userMethods.length;
    const required = requiredChecks.methods;
    results.push({
      name: `Methods (${required}+)`,
      found: methodCount >= required,
      message: methodCount >= required
        ? `Detected (${methodCount})`
        : `Only ${methodCount} user-defined method(s) found. Need at least ${required}.`,
    });
  }

  return results;
}
