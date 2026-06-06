import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllProblems, getProblem } from './problemLoader.js';
import { checkSolution } from './checker.js';
import { getJavaSession, sendJavaSessionInput, startJavaSession } from './runner.js';
import { checkSecurity } from './security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// API routes
app.get('/api/problems', (_req, res) => {
  try {
    const problems = getAllProblems();
    res.json(problems);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load problems' });
  }
});

app.get('/api/problems/:id', (req, res) => {
  try {
    const problem = getProblem(req.params.id);
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }
    res.json(sanitizeProblemForClient(problem));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load problem' });
  }
});

app.post('/api/submit', async (req, res) => {
  const { problemId, level, code } = req.body;

  if (!problemId || !level || !code) {
    return res.status(400).json({ error: 'Missing problemId, level, or code' });
  }

  const problem = getProblem(problemId);
  if (!problem) {
    return res.status(404).json({ error: 'Problem not found' });
  }

  if (!problem.levels[level]) {
    return res.status(400).json({ error: `Invalid level: ${level}` });
  }

  if (code.length > 50000) {
    return res.status(400).json({ error: 'Code too long (max 50KB)' });
  }

  try {
    const result = await checkSolution(problem, level, code);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: `Server error: ${err.message}` });
  }
});

app.post('/api/run', async (req, res) => {
  const { problemId, level, code } = req.body;

  if (!problemId || !level || !code) {
    return res.status(400).json({ error: 'Missing problemId, level, or code' });
  }

  const problem = getProblem(problemId);
  if (!problem) {
    return res.status(404).json({ error: 'Problem not found' });
  }

  const levelData = problem.levels[level];
  if (!levelData) {
    return res.status(400).json({ error: `Invalid level: ${level}` });
  }

  if (code.length > 50000) {
    return res.status(400).json({ error: 'Code too long (max 50KB)' });
  }

  const security = checkSecurity(code);
  if (!security.safe) {
    return res.json({
      mode: 'run',
      input: levelData.visibleSample?.input || '',
      compile: { pass: false, message: `Blocked code: ${security.issues[0]}` },
      output: '',
      runtimeError: `Security check failed: ${security.issues.join('; ')}`,
      timedOut: false,
    });
  }

  try {
    const result = startJavaSession(code);
    res.json({
      mode: 'run',
      input: '',
      sessionId: result.sessionId,
      compile: result.compile,
      output: result.output || '',
      runtimeError: result.runtimeError || null,
      done: result.done,
    });
  } catch (err) {
    res.status(500).json({ error: `Server error: ${err.message}` });
  }
});

app.post('/api/run/input', (req, res) => {
  const { sessionId, input } = req.body;
  if (!sessionId || typeof input !== 'string') {
    return res.status(400).json({ error: 'Missing sessionId or input' });
  }
  res.json(sendJavaSessionInput(sessionId, input));
});

app.get('/api/run/session/:sessionId', (req, res) => {
  res.json(getJavaSession(req.params.sessionId));
});

function sanitizeProblemForClient(problem) {
  return {
    ...problem,
    levels: Object.fromEntries(
      Object.entries(problem.levels || {}).map(([level, data]) => {
        const { hiddenTests, ...clientLevel } = data;
        return [level, clientLevel];
      })
    ),
  };
}

// Serve static frontend in production
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Java Hands-on Reviewer server running on http://localhost:${PORT}`);
});
