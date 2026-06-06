const API_BASE = '/api';

export async function fetchProblems() {
  const res = await fetch(`${API_BASE}/problems`);
  if (!res.ok) throw new Error('Failed to fetch problems');
  return res.json();
}

export async function fetchProblem(id) {
  const res = await fetch(`${API_BASE}/problems/${id}`);
  if (!res.ok) throw new Error('Failed to fetch problem');
  return res.json();
}

export async function submitCode(problemId, level, code) {
  const res = await fetch(`${API_BASE}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problemId, level, code }),
  });
  return res.json();
}

export async function runCode(problemId, level, code) {
  const res = await fetch(`${API_BASE}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problemId, level, code }),
  });
  return res.json();
}
