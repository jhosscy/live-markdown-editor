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

    // FIX 1: Pasar explícitamente los nodos a mermaid.run() para controlar el scope
    // y evitar que mermaid intente re-procesar elementos de ejecuciones anteriores.
    //
    // FIX 6: Usar `suppressErrors: true` y envolver en try/catch.
    // mermaid.run() acumula errores de CADA diagrama y al final lanza el primero
    // si hubo alguno. Con muchos bloques basta con que UNO falle (sintaxis,
    // timeout, límite del navegador, etc.) para que la promesa rechace y se
    // aborten los `await` siguientes — perdiendo los controles de TODOS los
    // diagramas, incluso los que SÍ se renderizaron bien.
    // Documentado oficialmente:
    // https://mermaid-js-mermaid.mintlify.app/advanced/error-handling#using-suppresserrors-in-run
    const mermaidNodes = editor.querySelectorAll<HTMLElement>('.mermaid');
    if (mermaidNodes.length > 0) {
      try {
        await mermaid.run({
          nodes: Array.from(mermaidNodes),
          suppressErrors: true,
        });
      } catch (e) {
        // Con suppressErrors:true mermaid no debería lanzar, pero si lo hace
        // (ej. error de configuración) no queremos romper el resto del flujo.
        console.error('[mermaid] error inesperado en mermaid.run:', e);
      }
    }

    // FIX 2: Esperar a que el DOM se estabilice completamente.
    // mermaid.run() con muchos diagramas usa procesamiento en batch internamente
    // y algunos SVGs pueden no estar insertados aún en el DOM cuando la promesa se resuelve.
    // Doble requestAnimationFrame asegura que el browser haya completado todos los repaints.
    await waitForDomStabilization();

    initMermaidContainers();
  } else {
    editor.contentEditable = 'true';
    editor.classList.remove('markdown-editor--preview');
    editor.classList.add('markdown-editor--editing');
    editor.textContent = rawMarkdown;
  }
});

// --- DOM stabilization helper ---

function waitForDomStabilization(): Promise<void> {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Un microtask adicional para asegurar que cualquier
        // promesa interna de mermaid se haya resuelto
        queueMicrotask(() => {
          resolve();
        });
      });
    });
  });
}

// --- Mermaid containers ---

function initMermaidContainers(): void {
  // FIX 3: Usar un selector más robusto que no dependa del tag <pre>.
  // mermaid.run() puede transformar <pre class="mermaid"> en <div> u otro elemento.
  // Buscamos cualquier elemento .mermaid que contenga un SVG.
  // También excluimos los que ya fueron procesados (dentro de un mermaid-zoom-container).
  const processed = new WeakSet<Element>();

  // Marcar los que ya tienen controles (para el caso de re-ejecución)
  editor.querySelectorAll('.mermaid-zoom-container').forEach((c) => processed.add(c));

  // FIX 4: Buscar TODOS los SVGs generados por mermaid dentro del editor,
  // en lugar de depender de que estén dentro de un <pre.mermaid> específico.
  const mermaidElements = editor.querySelectorAll<HTMLElement>('.mermaid');

  mermaidElements.forEach((el) => {
    // Saltar si ya está dentro de un zoom container (ya procesado)
    if (el.closest('.mermaid-zoom-container')) return;

    const svg = el.querySelector('svg');
    if (!svg) return;

    const container = document.createElement('div');
    container.className = 'mermaid-zoom-container';

    el.parentNode?.insertBefore(container, el);
    container.appendChild(svg);
    el.remove();

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

  // FIX 5: Verificar que TODOS los bloques mermaid fueron procesados.
  // Si algún SVG aún no estaba listo (race condition residual), reintentar.
  //
  // FIX 7: No exigir `el.querySelector('svg')` en el filtro. Un diagrama que
  // falló al renderizar (o que aún no terminó) no tendrá SVG, y también necesita
  // ser reintentado / envuelto para mostrarle al usuario el feedback apropiado.
  // El `if (!svg) return;` interno ya maneja los que aún no tienen SVG.
  const remaining = Array.from(editor.querySelectorAll<HTMLElement>('.mermaid')).filter(
    (el) => !el.closest('.mermaid-zoom-container')
  );

  if (remaining.length > 0) {
    console.warn(`[mermaid] ${remaining.length} bloque(s) pendientes, reintentando...`);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        initMermaidContainers();
      });
    });
  }
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
