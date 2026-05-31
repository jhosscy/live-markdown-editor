import { Marked, Renderer } from 'npm:marked';
import mermaid from 'npm:mermaid';
import markedMermaid from 'npm:@maddyguthridge/marked-mermaid';
import svgPanZoom from 'npm:svg-pan-zoom';
import { loadCSSOnce } from './loadcss.ts';
import { markedHighlight } from 'npm:marked-highlight';
import hljs from 'npm:highlight.js';
import 'npm:katex/contrib/mhchem';
import markedKatex from 'npm:marked-katex-extension';

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'dark',
});

const renderer = new Renderer();
renderer.code = (code) => {
  return code.text;
}

const codeTemplate = (lang: string, content: string) => `
  <div class="code-block-container">
    <div class="code-header">
      <span class="code-language">${lang}</span>
    </div>
    <pre><code class="hljs language-${lang}">${content}</code></pre>
  </div>`;

const marked = new Marked(
  markedMermaid(),
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      if (lang === 'mermaid') return `<pre class="mermaid">${code}</pre>`;
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      try {
        return codeTemplate(language, hljs.highlight(code, { language }).value);
      } catch {
        return codeTemplate(language, code);
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
const switchPreview = document.querySelector<HTMLButtonElement>('.switch--preview > .switch__button')!;
const switchTheme = document.querySelector<HTMLButtonElement>('.switch--theme > .switch__button')!;
const editor = document.querySelector<HTMLDivElement>('.markdown-editor')!;
const toolbarTpl = document.getElementById('mermaid-toolbar-tpl') as HTMLTemplateElement;

const themeSaved = localStorage.getItem('theme');

if (themeSaved === 'dark' || (!themeSaved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  switchTheme.setAttribute('aria-checked', 'true');
}

if (themeSaved) docEl.setAttribute('data-theme', themeSaved);

let rawMarkdown = '';

function toggleSwitch(el: HTMLElement): boolean {
  const next = el.getAttribute('aria-checked') !== 'true';
  el.setAttribute('aria-checked', String(next));
  return next;
}

// --- Preview toggle ---

switchPreview.addEventListener('click', async () => {
  await loadCSSOnce('static/css/katex.css', 'katex-css');
  await loadCSSOnce('static/css/github-dark.css', 'github-dark');

  const isPreview = toggleSwitch(switchPreview);

  if (isPreview) {
    rawMarkdown = editor.innerText;
    editor.contentEditable = 'false';
    editor.classList.add('markdown-editor--preview');
    editor.classList.remove('markdown-editor--editing');
    editor.innerHTML = marked.parse(rawMarkdown);
    await mermaid.run();
    initMermaidContainers();
  } else {
    editor.contentEditable = 'true';
    editor.classList.remove('markdown-editor--preview');
    editor.classList.add('markdown-editor--editing');
    editor.textContent = rawMarkdown;
  }
});

// --- Mermaid containers ---

function initMermaidContainers(): void {
  editor.querySelectorAll('pre.mermaid').forEach((pre) => {
    const svg = pre.querySelector('svg');
    if (!svg) return;

    const container = document.createElement('div');
    container.className = 'mermaid-zoom-container';

    pre.parentNode?.insertBefore(container, pre);
    container.appendChild(svg);
    pre.remove();

    const panZoomInstance = svgPanZoom(svg as SVGSVGElement, {
      zoomEnabled: true,
      controlIconsEnabled: false,
      fit: true,
      center: true,
      minZoom: 0.1,
      maxZoom: 10,
      zoomScaleSensitivity: 0.3,
    });

    const toolbar = toolbarTpl.content.cloneNode(true) as DocumentFragment;
    container.appendChild(toolbar);

    const toolbarEl = container.querySelector('.mermaid-toolbar')!;
    const fullscreenBtn = container.querySelector('[data-action="fullscreen"]')!;

    toolbarEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
      if (!btn) return;

      switch (btn.dataset.action) {
        case 'zoom-in':    panZoomInstance.zoomIn(); break;
        case 'zoom-out':   panZoomInstance.zoomOut(); break;
        case 'reset':      panZoomInstance.reset(); break;
        case 'fullscreen': toggleFullscreen(container, fullscreenBtn, panZoomInstance); break;
      }
    });
  });
}

// --- Fullscreen ---

function toggleFullscreen(container: HTMLDivElement, btn: Element, instance: ReturnType<typeof svgPanZoom>): void {
  const isFs = container.classList.toggle('mermaid-zoom-container--fullscreen');
  btn.classList.toggle('mermaid-toolbar__button--fullscreen-active', isFs);
  btn.setAttribute('title', isFs ? 'Exit fullscreen' : 'Fullscreen');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      instance.resize();
      instance.fit();
      instance.center();
    });
  });
}

// --- Editor input cleanup ---

editor.addEventListener('input', () => {
  const html = editor.innerHTML.trim();
  if (html === '<br>' || html === '<div><br></div>') editor.innerHTML = '';
});

// --- Theme toggle ---

switchTheme.addEventListener('click', () => {
  const isDark = toggleSwitch(switchTheme);
  const theme = isDark ? 'dark' : 'light';
  localStorage.setItem('theme', theme);
  docEl.setAttribute('data-theme', theme);
});
