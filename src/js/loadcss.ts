let katexCssPromise: Promise<void> | null = null;

export function loadCSSOnce(href: string, id = 'katex-css'): Promise<void> {
  if (document.getElementById(id)) return Promise.resolve();
  if (katexCssPromise) return katexCssPromise;

  katexCssPromise = new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;        // <-- tu ruta a katex.min.css
    link.id = id;
    link.onload = () => resolve();
    link.onerror = () => {
      console.warn('[KaTeX] No se pudo cargar el CSS, continúo sin estilos.');
      resolve(); // no bloquees el preview si falla
    };
    document.head.appendChild(link);
  });

  return katexCssPromise;
};
