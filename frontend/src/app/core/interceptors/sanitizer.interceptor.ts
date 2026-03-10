import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';

/** Sanitiza TODA request de saída: remove caracteres perigosos e limita tamanho */
export const sanitizerInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  if (req.method === 'GET' || req.method === 'DELETE') {
    return next(req);
  }

  try {
    const body = req.body;
    if (body && typeof body === 'object') {
      const sanitized = deepSanitize(body);
      return next(req.clone({ body: sanitized }));
    }
  } catch {
    // Se falhar na sanitização, deixa passar e loga
    console.warn('[SanitizerInterceptor] Falha ao sanitizar request:', req.url);
  }

  return next(req);
};

function deepSanitize(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(deepSanitize);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, deepSanitize(v)])
    );
  }
  return obj;
}

function sanitizeString(str: string): string {
  return str
    .replace(/<script[\s\S]*?<\/script>/gi, '')  // Remove scripts
    .replace(/javascript:/gi, '')                  // Remove JS inline
    .replace(/on\w+\s*=/gi, '')                    // Remove event handlers
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Remove control chars
    .slice(0, 50_000);                              // Limite de 50k chars
}
