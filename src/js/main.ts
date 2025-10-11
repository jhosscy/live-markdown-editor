import { Marked, Renderer } from 'npm:marked';
import { markedHighlight } from 'npm:marked-highlight';
import hljs from 'npm:highlight.js';
import 'npm:katex/contrib/mhchem';
import markedKatex from 'npm:marked-katex-extension';
import { loadCSSOnce } from './loadcss.ts';

const renderer = new Renderer();

renderer.code = (code) => {
  return code.text;
}

const marked = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      try {
        const highlightedCode = hljs.highlight(code, { language }).value;
        return `
          <div class="code-block-container">
            <div class="code-header">
              <span class="code-language">${language}</span>
            </div>
            <pre><code class="hljs language-${language}">${highlightedCode}</code></pre>
          </div>
        `
      } catch (error) {
        return `
          <div class="code-block-container">
            <div class="code-header">
              <span class="code-language">${language}</span>
            </div>
            <pre><code class="hljs language-${language}">${code}</code></pre>
          </div>
        `;
      }
    }
  }),
  {
    renderer: renderer,
    gfm: true,
    pedantic: false,
    breaks: true,
  }
);

marked.use(markedKatex({
  nonStandard: true,
  throwOnError: false,
  strict: 'ignore',
}));

const docEl = document.documentElement;
const switchPreview = document.querySelector<HTMLButtonElement>('.switch--preview > .switch__button');
const switchTheme = document.querySelector<HTMLButtonElement>('.switch--theme > .switch__button');
const pasteButton = document.querySelector<HTMLButtonElement>('.paste-button');
const editor = document.querySelector<HTMLDivElement>('.markdown-editor');

const themeSaved: string | null = localStorage.getItem('theme');

if (themeSaved === 'dark' || window.matchMedia('(prefers-color-scheme: dark)').matches && themeSaved !== 'light') {
  switchTheme.setAttribute('aria-checked', true);
}

if (themeSaved) docEl.setAttribute('data-theme', themeSaved);

let rawMarkdown = '';

switchPreview.addEventListener('click', async () => {
  await loadCSSOnce('static/css/katex.css', 'katex-css');
  await loadCSSOnce('static/css/github-dark.css', 'github-dark');
  const isChecked = switchPreview.getAttribute('aria-checked') === 'true';
  switchPreview.setAttribute('aria-checked', !isChecked);
  rawMarkdown = !isChecked ? editor.innerText : rawMarkdown;
  editor.contentEditable = isChecked;
  if (!isChecked) {
    editor.style.whiteSpace = 'normal';
    editor.innerHTML = marked.parse(rawMarkdown);
    return;
  }
  editor.style.whiteSpace = 'pre-wrap';
  editor.textContent = rawMarkdown;
});

editor.addEventListener('input', () => {
  const htmlContent = editor.innerHTML.trim();
  const isEmpty = htmlContent === '<br>' || htmlContent === '<div><br></div>';
  if (isEmpty) editor.innerHTML = '';
});

switchTheme.addEventListener('click', () => {
  const isChecked = switchTheme.getAttribute('aria-checked') === 'true';
  localStorage.setItem('theme', isChecked ? 'light' : 'dark');
  switchTheme.setAttribute('aria-checked', !isChecked);
  docEl.setAttribute('data-theme', isChecked ? 'light' : 'dark');
});

// Paste button functionality
pasteButton.addEventListener('click', async () => {
  try {
    // Check if clipboard API is available
    if (!navigator.clipboard) {
      throw new Error('Clipboard API no disponible');
    }

    // Check if we're in preview mode
    const isPreviewMode = switchPreview.getAttribute('aria-checked') === 'true';
    
    if (isPreviewMode) {
      // If in preview mode, show a message or do nothing
      console.log('No se puede pegar en modo vista previa');
      return;
    }

    // Read text from clipboard
    const clipboardText = await navigator.clipboard.readText();
    
    if (clipboardText) {
      // Get current cursor position or selection
      const selection = window.getSelection();
      
      if (selection && selection.rangeCount > 0) {
        // If there's a selection, replace it
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(clipboardText));
        
        // Move cursor to end of inserted text
        range.setStartAfter(range.endContainer);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        // If no selection, append to the end
        const currentContent = editor.textContent || '';
        editor.textContent = currentContent + clipboardText;
      }
      
      // Focus the editor
      editor.focus();
      
      // Update rawMarkdown if needed
      rawMarkdown = editor.textContent || '';
    }
  } catch (error) {
    console.error('Error al pegar desde el portapapeles:', error);
    
    // Fallback: show a message to the user
    const originalTitle = pasteButton.title;
    pasteButton.title = 'Error: No se pudo acceder al portapapeles';
    
    setTimeout(() => {
      pasteButton.title = originalTitle;
    }, 2000);
  }
});
