import { fetchProblems, fetchProblem, fetchRunSession, sendRunInput, submitCode, runCode } from './api.js';
import { initEditor, getCode, resetToDefault } from './editor.js';

const state = {
  problems: [],
  currentProblemId: null,
  currentProblem: null,
  currentLevel: 'easy',
  runSessionId: null,
  runPollTimer: null,
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
  $('#btn-reset').addEventListener('click', () => {
    clearRunPolling();
    state.runSessionId = null;
    resetToDefault();
    showResultsPlaceholder();
  });
  bindCompilerResize();

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

function bindCompilerResize() {
  const handle = $('#compiler-resize-handle');
  const panel = $('#results-panel');
  const editorPanel = $('#editor-panel');
  if (!handle || !panel || !editorPanel) return;

  let startY = 0;
  let startHeight = 0;

  handle.addEventListener('pointerdown', (event) => {
    startY = event.clientY;
    startHeight = panel.getBoundingClientRect().height;
    document.body.classList.add('resizing-compiler');
    handle.setPointerCapture(event.pointerId);

    const onPointerMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const maxHeight = Math.max(180, editorPanel.getBoundingClientRect().height * 0.7);
      const nextHeight = Math.min(maxHeight, Math.max(130, startHeight - deltaY));
      panel.style.height = `${nextHeight}px`;
    };

    const onPointerUp = () => {
      document.body.classList.remove('resizing-compiler');
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
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
  clearRunPolling();
  state.runSessionId = null;
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
  const referenceTables = lvl.referenceTables?.length ? renderReferenceTables(lvl.referenceTables) : '';

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
    ${referenceTables}
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

function renderReferenceTables(tables) {
  return `<div class="problem-section">
    <h3>Reference Tables</h3>
    <div class="reference-table-stack">
      ${tables.map(table => `
        <div class="reference-table-block">
          <h4>${escapeHtml(table.title)}</h4>
          <table class="reference-table">
            <thead>
              <tr>${table.columns.map(column => `<th>${escapeHtml(column)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${table.rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    </div>
  </div>`;
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
  clearRunPolling();
  state.runSessionId = null;

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
  clearRunPolling();
  state.runSessionId = null;

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

  if (result.sessionId) {
    state.runSessionId = result.sessionId;
    renderInteractiveConsole(result);
    startRunPolling(result.sessionId);
    return;
  }

  let html = `<div class="shell-pane">
    <div class="shell-tabs">
      <button class="shell-tab active">Compiler</button>
      <span class="shell-status ${result.compile?.pass ? 'shell-ok' : 'shell-error'}">${escapeHtml(result.compile?.message || 'Compilation failed')}</span>
    </div>
    <div class="shell-body">`;

  if (result.runtimeError) {
    html += `<div class="shell-group">
      <div class="shell-prompt shell-error">Runtime error</div>
      <pre class="shell-error">${escapeHtml(result.runtimeError)}</pre>
    </div>`;
  }

  html += `<div class="shell-group">
      <div class="shell-prompt">Output</div>
      <pre>${escapeHtml(result.output || '(no output)')}</pre>
    </div>
    <div class="shell-hint">Interactive console session was not started. Redeploy the backend with the latest code if this is hosted.</div>
    </div>
  </div>`;

  panel.innerHTML = html;
}

function renderInteractiveConsole(result) {
  const panel = $('#results-panel');
  panel.innerHTML = `<div class="shell-pane">
    <div class="shell-tabs">
      <button class="shell-tab active">Compiler</button>
      <span id="shell-status" class="shell-status ${result.compile?.pass ? 'shell-ok' : 'shell-error'}">${escapeHtml(result.compile?.message || 'Compilation failed')}</span>
    </div>
    <div class="shell-body shell-body-interactive">
      <pre id="console-output">${escapeHtml(result.output || '')}</pre>
      <div id="console-error" class="shell-error">${escapeHtml(result.runtimeError || '')}</div>
      <form id="console-input-form" class="console-input-row">
        <label for="console-input">Input</label>
        <input id="console-input" type="text" autocomplete="off" spellcheck="false" placeholder="Type the next value here, then press Enter" ${result.done ? 'disabled' : ''} />
      </form>
    </div>
  </div>`;

  $('#console-input-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('#console-input');
    const value = input.value;
    if (!state.runSessionId || !value.length) return;
    input.value = '';
    input.disabled = true;
    try {
      const session = await sendRunInput(state.runSessionId, value);
      updateInteractiveConsole(session);
    } finally {
      if (input && !$('#console-input')?.disabled) return;
      const latestInput = $('#console-input');
      if (latestInput && !$('#shell-status')?.textContent.includes('finished')) {
        latestInput.disabled = false;
        latestInput.focus();
      }
    }
  });

  $('#console-input')?.focus();
}

function startRunPolling(sessionId) {
  clearRunPolling();
  state.runPollTimer = setInterval(async () => {
    try {
      const session = await fetchRunSession(sessionId);
      updateInteractiveConsole(session);
      if (session.done || session.error) {
        clearRunPolling();
      }
    } catch (_) {
      clearRunPolling();
    }
  }, 500);
}

function clearRunPolling() {
  if (state.runPollTimer) {
    clearInterval(state.runPollTimer);
    state.runPollTimer = null;
  }
}

function updateInteractiveConsole(session) {
  if (session.error) {
    const errorEl = $('#console-error');
    if (errorEl) errorEl.textContent = session.error;
    return;
  }

  const outputEl = $('#console-output');
  const errorEl = $('#console-error');
  const inputEl = $('#console-input');
  const statusEl = $('#shell-status');

  if (outputEl) outputEl.textContent = session.output || '';
  if (errorEl) errorEl.textContent = session.runtimeError || '';

  if (session.done) {
    if (statusEl) {
      statusEl.textContent = session.runtimeError ? 'Program finished with errors' : 'Program finished';
      statusEl.className = `shell-status ${session.runtimeError ? 'shell-error' : 'shell-ok'}`;
    }
    if (inputEl) {
      inputEl.disabled = true;
      inputEl.placeholder = 'Program finished';
    }
  }
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
    html += `<div class="score-display ${scoreClass}">${score}/100<span>Difficulty: ${escapeHtml(state.currentLevel.charAt(0).toUpperCase() + state.currentLevel.slice(1))}</span></div>`;
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
