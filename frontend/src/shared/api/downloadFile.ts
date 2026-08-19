import { httpClient } from './httpClient';

/**
 * Descarga un archivo protegido por JWT. No se puede usar un <a href> plano
 * porque la navegación nativa del navegador no envía el header
 * Authorization; en su lugar se pide el binario como blob vía axios
 * (que sí adjunta el token) y se simula el click de descarga en memoria.
 */
export async function downloadFile(
  url: string,
  fileName: string,
  params?: Record<string, unknown>,
): Promise<void> {
  const response = await httpClient.get(url, { params, responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(response.data);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(blobUrl);
}
