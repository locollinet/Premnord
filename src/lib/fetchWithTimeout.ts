export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 45000,
  timeoutMessage = "Le serveur met trop de temps à répondre (délai dépassé). Veuillez réessayer."
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(timeoutMessage);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
