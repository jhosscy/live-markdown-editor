const cssPromises: Record<string, Promise<void>> = {};

export function loadCSSOnce(href: string, id: string): Promise<void> {
  if (document.getElementById(id)) return Promise.resolve();
  if (cssPromises[id]) return cssPromises[id];

  cssPromises[id] = new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.id = id;
    link.onload = () => resolve();
    link.onerror = () => {
      console.warn(`[CSS Loader] No se pudo cargar el CSS (${href}), continúo sin estilos.`);
      resolve();
    };
    document.head.appendChild(link);
  });

  return cssPromises[id];
}
