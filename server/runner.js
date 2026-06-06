import { execFileSync, execFile, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RUN_TIMEOUT_MS, MAX_OUTPUT_SIZE } from './security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, 'temp', 'submissions');
const sessions = new Map();
const SESSION_TTL_MS = 5 * 60 * 1000;

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

export function startJavaSession(code) {
  const id = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const workDir = path.join(TEMP_DIR, id);
  fs.mkdirSync(workDir, { recursive: true });

  const javaFile = path.join(workDir, 'Main.java');

  try {
    fs.writeFileSync(javaFile, code, 'utf-8');
    try {
      execFileSync('javac', ['Main.java'], { cwd: workDir, timeout: 10000, encoding: 'utf-8' });
    } catch (err) {
      const stderr = (err.stderr || err.stdout || err.message || '').replace(workDir.replace(/\\/g, '/'), '').trim();
      cleanup(workDir);
      return {
        sessionId: null,
        compile: { pass: false, message: stderr || 'Compilation failed' },
        output: '',
        runtimeError: stderr || 'Compilation failed',
        done: true,
      };
    }

    const child = spawn('java', ['Main'], {
      cwd: workDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });

    const session = {
      id,
      child,
      workDir,
      output: '',
      runtimeError: '',
      done: false,
      startedAt: Date.now(),
      lastTouchedAt: Date.now(),
      timer: null,
    };

    session.timer = setTimeout(() => {
      if (!session.done) {
        session.runtimeError += 'Interactive session timed out';
        child.kill('SIGTERM');
      }
    }, SESSION_TTL_MS);

    child.stdout.on('data', (data) => {
      session.output += data.toString();
      session.lastTouchedAt = Date.now();
      if (session.output.length > MAX_OUTPUT_SIZE) {
        session.runtimeError += 'Output limit exceeded';
        child.kill('SIGTERM');
      }
    });

    child.stderr.on('data', (data) => {
      session.runtimeError += data.toString();
      session.lastTouchedAt = Date.now();
    });

    child.on('close', (code) => {
      clearTimeout(session.timer);
      session.done = true;
      if (code !== 0 && !session.runtimeError) {
        session.runtimeError = `Process exited with code ${code}`;
      }
      cleanup(workDir);
      setTimeout(() => sessions.delete(id), SESSION_TTL_MS);
    });

    child.on('error', (err) => {
      clearTimeout(session.timer);
      session.done = true;
      session.runtimeError += err.message;
      cleanup(workDir);
      setTimeout(() => sessions.delete(id), SESSION_TTL_MS);
    });

    sessions.set(id, session);

    return {
      sessionId: id,
      compile: { pass: true, message: 'Compilation successful' },
      output: '',
      runtimeError: null,
      done: false,
    };
  } catch (err) {
    cleanup(workDir);
    return {
      sessionId: null,
      compile: { pass: false, message: err.message },
      output: '',
      runtimeError: err.message,
      done: true,
    };
  }
}

export function sendJavaSessionInput(sessionId, input) {
  const session = sessions.get(sessionId);
  if (!session) return { error: 'Run session not found' };
  if (session.done) return { error: 'Program has already finished' };

  session.child.stdin.write(`${input}\n`);
  session.lastTouchedAt = Date.now();
  return getJavaSession(sessionId);
}

export function getJavaSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return { error: 'Run session not found' };

  return {
    sessionId,
    output: session.output.slice(0, MAX_OUTPUT_SIZE),
    runtimeError: session.runtimeError || null,
    done: session.done,
  };
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
