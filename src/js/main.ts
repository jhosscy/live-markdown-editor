import { marked } from 'npm:marked';
import 'npm:katex/contrib/mhchem';
import markedKatex from 'npm:marked-katex-extension';
import { loadCSSOnce } from './loadcss.ts';

marked.use(markedKatex({
  nonStandard: true,
  throwOnError: false,
  strict: 'ignore',
}));

const docEl = document.documentElement;
const switchPreview = document.querySelector<HTMLButtonElement>('.switch--preview > .switch__button');
const switchTheme = document.querySelector<HTMLButtonElement>('.switch--theme > .switch__button');
const editor = document.querySelector<HTMLDivElement>('.markdown-editor');

const themeSaved: string | null = localStorage.getItem('theme');

if (themeSaved === 'dark' || window.matchMedia('(prefers-color-scheme: dark)').matches && themeSaved !== 'light') {
  switchTheme.setAttribute('aria-checked', true);
}

if (themeSaved) docEl.setAttribute('data-theme', themeSaved);

let rawMarkdown = '';

switchPreview.addEventListener('click', async () => {
  await loadCSSOnce('static/css/katex.css');
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
