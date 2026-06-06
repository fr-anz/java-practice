import { execFileSync, execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RUN_TIMEOUT_MS, MAX_OUTPUT_SIZE } from './security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, 'temp', 'submissions');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export async function runJava(code, input) {
  const id = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const workDir = path.join(TEMP_DIR, id);
  fs.mkdirSync(workDir, { recursive: true });

  const javaFile = path.join(workDir, 'Main.java');

  try {
    fs.writeFileSync(javaFile, code, 'utf-8');

    // Compile
    let compileResult;
    try {
      execFileSync('javac', ['Main.java'], { cwd: workDir, timeout: 10000, encoding: 'utf-8' });
      compileResult = { pass: true, message: 'Compilation successful' };
    } catch (err) {
      const stderr = (err.stderr || err.stdout || err.message || '').replace(workDir.replace(/\\/g, '/'), '').trim();
      return {
        compile: { pass: false, message: stderr || 'Compilation failed' },
        tests: [],
        error: stderr || 'Compilation failed',
        cleanup: () => cleanup(workDir),
      };
    }

    // Run
    try {
      const result = await runWithInput(workDir, input);
      return {
        compile: compileResult,
        output: result.output,
        error: result.error,
        timedOut: result.timedOut,
        cleanup: () => cleanup(workDir),
      };
    } catch (err) {
      return {
        compile: compileResult,
        output: '',
        error: err.message || 'Runtime error',
        timedOut: false,
        cleanup: () => cleanup(workDir),
      };
    }
  } catch (err) {
    cleanup(workDir);
    return {
      compile: { pass: false, message: err.message },
      tests: [],
      error: err.message,
      cleanup: () => {},
    };
  }
}

function runWithInput(workDir, input) {
  return new Promise((resolve) => {
    const child = execFile('java', ['Main'], {
      cwd: workDir,
      timeout: RUN_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_SIZE * 2,
      encoding: 'utf-8',
    });

    let output = '';
    let error = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, RUN_TIMEOUT_MS);

    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }

    child.stdout.on('data', (data) => {
      output += data;
      if (output.length > MAX_OUTPUT_SIZE) {
        child.kill('SIGTERM');
      }
    });

    child.stderr.on('data', (data) => {
      error += data;
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({ output: output.slice(0, MAX_OUTPUT_SIZE), error: 'Program timed out (>5s)', timedOut: true });
      } else if (code !== 0 && !error) {
        error = `Process exited with code ${code}`;
      }
      resolve({
        output: output.slice(0, MAX_OUTPUT_SIZE),
        error: error || null,
        timedOut: false,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ output: '', error: err.message, timedOut: false });
    });
  });
}

function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {}
}
