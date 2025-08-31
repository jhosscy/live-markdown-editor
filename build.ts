import { bundleAsync } from 'lightningcss';

const entrypoints = ['styles.css', 'standalone.css', 'katex.css'];
const outDir = 'src/dist/css';

await Promise.all(entrypoints.map(async (entry) => {
  const { code } = await bundleAsync({
    filename: `src/css/${entry}`,
    minify: true,
  });

  // crea la carpeta (y padres) si no existe; no falla si ya existe
  await Deno.mkdir(outDir, { recursive: true });

  // aseguramos que lo que pasamos a Deno.writeFile sea Uint8Array
  const data =
    code instanceof Uint8Array
      ? code
      : (typeof code === "string" ? new TextEncoder().encode(code) : Uint8Array.from(code));

  await Deno.writeFile(`${outDir}/${entry}`, data);
}));

