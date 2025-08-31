import { contentType } from "jsr:@std/media-types/content-type";

/**
 * Interfaz que define los parámetros necesarios para crear headers de respuesta HTTP,
 * incluyendo la opción de añadir headers personalizados.
 */
interface ResponseHeadersOptions {
  /** Código de estado HTTP para la respuesta (por defecto: 200) */
  status?: number;
  /** Extensión del archivo para determinar el Content-Type */
  ext?: string;
  /** Método HTTP permitido (GET, POST, etc) (por defecto: '*') */
  method?: string;
  /** Origen permitido para CORS (por defecto: '*') */
  origin?: string;
  /** Headers personalizados para agregar a la respuesta */
  customHeaders?: Record<string, string>;
}

/**
 * Determina el Content-Type basado en la extensión del archivo
 * 
 * @param ext - La extensión del archivo (con o sin punto inicial)
 * @returns El valor del Content-Type sin parámetros adicionales
 */
function getContentTypeFromExtension(ext = ''): string {
  const mediaType = contentType(ext);
  // Si no se encuentra un tipo de contenido, devolvemos el tipo genérico por defecto
  return mediaType ?? "application/octet-stream";
}

/**
 * Crea los headers para una respuesta HTTP con soporte para CORS y headers personalizados.
 * 
 * @param options - Opciones para configurar los headers
 * @returns Un objeto con los headers y el código de estado
 */
export default function createResponseHeaders(options: ResponseHeadersOptions) {
  const { 
    status = 200, 
    ext, 
    origin = '*', 
    method = '*',
    customHeaders
  } = options;
  
  const contentTypeValue = getContentTypeFromExtension(ext);
  
  // Crear los headers básicos
  const headers = new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": method,
    "Content-Type": contentTypeValue,
  });

  // Agregar headers personalizados si se proporcionan
  if (customHeaders) {
    for (const [key, value] of Object.entries(customHeaders)) {
      headers.set(key, value);
    }
  }
  
  return { 
    headers, 
    status 
  };
}
