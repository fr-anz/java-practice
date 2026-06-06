let editor = null;
let editorReady = false;
const readyCallbacks = [];

const DEFAULT_STARTER = `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);

    }
}`;

function onReady(cb) {
  if (editorReady) {
    cb();
  } else {
    readyCallbacks.push(cb);
  }
}

function notifyReady() {
  editorReady = true;
  readyCallbacks.forEach(cb => cb());
  readyCallbacks.length = 0;
}

export function initEditor() {
  if (typeof monaco === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs/loader.js';
    script.onload = () => {
      require.config({
        paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs' }
      });
      require(['vs/editor/editor.main'], () => {
        createEditor();
        notifyReady();
      });
    };
    document.head.appendChild(script);
  } else if (monaco.editor) {
    if (!editor) createEditor();
    notifyReady();
  } else {
    monacoReadyCallbacks.push(() => {
      if (!editor) createEditor();
      notifyReady();
    });
  }
}

function createEditor() {
  const container = document.getElementById('monaco-editor');
  if (!container) return;

  editor = monaco.editor.create(container, {
    value: DEFAULT_STARTER,
    language: 'java',
    theme: 'vs',
    fontSize: 13,
    fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
    minimap: { enabled: false },
    quickSuggestions: false,
    suggestOnTriggerCharacters: false,
    acceptSuggestionOnEnter: 'off',
    wordBasedSuggestions: 'off',
    parameterHints: { enabled: false },
    tabCompletion: 'off',
    snippetSuggestions: 'none',
    hover: { enabled: false },
    formatOnType: false,
    formatOnPaste: false,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    renderLineHighlight: 'line',
    lineDecorationsWidth: 8,
    lineNumbersMinChars: 3,
    glyphMargin: false,
    folding: false,
    renderIndentGuides: false,
  });
}

export function getCode() {
  return editor ? editor.getValue() : '';
}

export function setCode(code) {
  onReady(() => {
    if (editor) editor.setValue(code);
  });
}

export function resetToDefault() {
  setCode(DEFAULT_STARTER);
}

export function getEditor() {
  return editor;
}

export function isReady() {
  return editorReady;
}

// Keep a reference for the legacy AMD callback
let monacoReadyCallbacks = [];
window.monacoReadyCallbacks = monacoReadyCallbacks;

export { onReady };
