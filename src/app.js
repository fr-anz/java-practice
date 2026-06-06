import { fetchProblems, fetchProblem, submitCode, runCode } from './api.js';
import { initEditor, getCode, resetToDefault } from './editor.js';

const state = {
  problems: [],
  currentProblemId: null,
  currentProblem: null,
  currentLevel: 'easy',
};

const $ = (sel) => document.querySelector(sel);

const GENERAL_REQUIREMENTS = [
  'Create a simple Java console-based application.',
  'Read and process user input based on the selected problem.',
  'Organize the solution using user-defined methods.',
  'Use appropriate conditional logic for decisions and categories.',
  'Handle menu or code-based choices clearly when required.',
  'Validate numeric input and handle invalid values properly.',
  'Display the required formatted output after all inputs are processed.',
  'Write readable code that follows standard Java syntax and structure.'
];

function init() {
  initEditor();
  loadProblems();
  bindEvents();
}

function bindEvents() {
  $('#btn-run').addEventListener('click', () => handleRun());
  $('#btn-submit').addEventListener('click', () => handleSubmit(true));
  $('#btn-reset').addEventListener('click', () => resetToDefault());

  document.getElementById('difficulty-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.diff-tab');
    if (!tab) return;
    state.currentLevel = tab.dataset.level;
    document.querySelectorAll('.diff-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    if (state.currentProblemId) {
      loadProblemContent(state.currentProblemId);
    }
  });
}

async function loadProblems() {
  try {
    state.problems = await fetchProblems();
    renderProblemNav();
  } catch (err) {
    console.error('Failed to load problems:', err);
    $('#problem-nav').innerHTML = '<div style="padding:16px;color:var(--red)">Failed to load problems. Is the server running?</div>';
  }
}

function renderProblemNav() {
  const nav = $('#problem-nav');

  nav.innerHTML = state.problems.map(p => `
    <div class="problem-nav-item${p.id === state.currentProblemId ? ' active' : ''}"
         data-id="${p.id}">
      <div class="nav-title">${p.title}</div>
      <div class="nav-category">${p.category}</div>
    </div>
  `).join('');

  nav.querySelectorAll('.problem-nav-item').forEach(item => {
    item.addEventListener('click', () => selectProblem(item.dataset.id));
  });
}

async function selectProblem(id) {
  state.currentProblemId = id;
  state.currentLevel = 'easy';
  document.querySelectorAll('.diff-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.diff-tab[data-level="easy"]')?.classList.add('active');
  renderProblemNav();
  await loadProblemContent(id);
  resetToDefault();
  showResultsPlaceholder();
}

async function loadProblemContent(id) {
  try {
    const problem = await fetchProblem(id);
    state.currentProblem = problem;
    renderProblemContent(problem, state.currentLevel);
  } catch (err) {
    console.error('Failed to load problem:', err);
  }
}

function renderProblemContent(problem, level) {
  const lvl = problem.levels[level];
  if (!lvl) return;

  $('#problem-title').textContent = problem.title;
  const container = $('#problem-content');

  const sampleInput = lvl.visibleSample?.input || 'N/A';
  const sampleOutput = lvl.visibleSample?.expectedOutput?.join('\n') || 'N/A';

  container.innerHTML = `
    <div class="problem-section">
      <h3>Description</h3>
      <p>${escapeHtml(problem.description)}</p>
    </div>
    <div class="problem-section">
      <h3>Exam Rules</h3>
      <ul>${GENERAL_REQUIREMENTS.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
    </div>
    <div class="problem-section">
      <h3>Level: ${level.charAt(0).toUpperCase() + level.slice(1)}</h3>
      <p>${escapeHtml(lvl.summary)}</p>
    </div>
    <div class="problem-section">
      <h3>Instructions</h3>
      <ul>${lvl.requirements.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
    </div>
    <div class="problem-section">
      <h3>Sample Input</h3>
      <pre>${escapeHtml(sampleInput)}</pre>
    </div>
    <div class="problem-section">
      <h3>Expected Output Values</h3>
      <pre>${escapeHtml(sampleOutput)}</pre>
    </div>
  `;
}

async function handleRun() {
  if (!state.currentProblemId) {
    showResults('Please select a problem first.');
    return;
  }

  const code = getCode();
  if (!code.trim()) {
    showResults('Please write some code first.');
    return;
  }

  showResults('<div class="loading-spinner"></div> Compiling and running...');

  try {
    const result = await runCode(state.currentProblemId, state.currentLevel, code);
    renderRunResults(result);
  } catch (err) {
    showResults('Failed to connect to the server. Make sure the backend is running.');
  }
}

async function handleSubmit(isFullCheck) {
  if (!state.currentProblemId) {
    showResults('Please select a problem first.');
    return;
  }

  const code = getCode();
  if (!code.trim()) {
    showResults('Please write some code first.');
    return;
  }

  showResults('<div class="loading-spinner"></div> Checking your solution...');

  try {
    const result = await submitCode(state.currentProblemId, state.currentLevel, code);
    renderResults(result, isFullCheck);
  } catch (err) {
    showResults('Failed to connect to the server. Make sure the backend is running.');
  }
}

function renderRunResults(result) {
  const panel = $('#results-panel');

  if (result.error) {
    panel.innerHTML = `<div class="shell-pane">
      <div class="shell-tabs"><button class="shell-tab active">Compiler</button></div>
      <div class="shell-body"><pre class="shell-error">${escapeHtml(result.error)}</pre></div>
    </div>`;
    return;
  }

  let html = `<div class="shell-pane">
    <div class="shell-tabs">
      <button class="shell-tab active">Compiler</button>
      <span class="shell-status ${result.compile?.pass ? 'shell-ok' : 'shell-error'}">${escapeHtml(result.compile?.message || 'Compilation failed')}</span>
    </div>
    <div class="shell-body">`;

  if (result.input) {
    html += `<div class="shell-group">
      <div class="shell-prompt">Sample input</div>
      <pre>${escapeHtml(result.input)}</pre>
    </div>`;
  }

  if (result.runtimeError) {
    html += `<div class="shell-group">
      <div class="shell-prompt shell-error">Runtime error</div>
      <pre class="shell-error">${escapeHtml(result.runtimeError)}</pre>
    </div>`;
  }

  html += `<div class="shell-group">
      <div class="shell-prompt">In [1]:</div>
      <pre>${escapeHtml(result.output || '(no output)')}</pre>
    </div>
    <div class="shell-hint">Run shows console output. Submit checks tests and requirements.</div>
    </div>
  </div>`;

  panel.innerHTML = html;
}

function renderResults(result, isFullCheck) {
  const panel = $('#results-panel');

  if (result.error) {
    panel.innerHTML = `<div class="result-item result-fail"><span class="result-icon">Fail</span><div>${escapeHtml(result.error)}</div></div>`;
    return;
  }

  let html = '';

  if (isFullCheck) {
    const score = result.score ?? 0;
    const scoreClass = score >= 80 ? 'score-high' : score >= 50 ? 'score-mid' : 'score-low';
    html += `<div class="score-display ${scoreClass}">${score}/100</div>`;
  }

  html += `<div class="result-item ${result.compile?.pass ? 'result-pass' : 'result-fail'}">
    <span class="result-icon">${result.compile?.pass ? 'Pass' : 'Fail'}</span>
    <div><strong>Compilation:</strong> ${result.compile?.message || 'Failed'}</div>
  </div>`;

  if (result.tests) {
    result.tests.forEach((t, i) => {
      html += `<div class="result-item ${t.pass ? 'result-pass' : 'result-fail'}">
        <span class="result-icon">${t.pass ? 'Pass' : 'Fail'}</span>
        <div><strong>Test ${i + 1}${t.visible ? ' (sample)' : ''}:</strong> ${t.message || (t.pass ? 'Passed' : 'Failed')}</div>
      </div>`;
    });
  }

  if (result.concepts) {
    result.concepts.forEach(c => {
      html += `<div class="result-item ${c.found ? 'result-pass' : 'result-fail'}">
        <span class="result-icon">${c.found ? 'Pass' : 'Fail'}</span>
        <div><strong>${c.name}:</strong> ${c.found ? 'Detected' : c.message || 'Not found'}</div>
      </div>`;
    });
  }

  panel.innerHTML = html;
}

function showResults(message) {
  $('#results-panel').innerHTML = `<div style="padding:8px;font-size:13px;">${message}</div>`;
}

function showResultsPlaceholder() {
  $('#results-panel').innerHTML = '<div id="results-placeholder">Run or submit your code to see results here.</div>';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

init();
