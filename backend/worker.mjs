import {
  validateAndNormalizeDiagnosisPayload,
  detectImmediateSafetyStop,
  buildSafetyStopResponse,
  generateDiagnosisFromProvider,
  createBackendErrorResponse
} from './diagnosis-service.mjs';

const MAX_PHOTOS = 6;
const MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_MULTIPART_REQUEST_BYTES = 25 * 1024 * 1024;
const API_ROUTES = new Set(['/api/diagnose', '/api/health']);

function normalizeOrigin(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    return new URL(text).origin;
  } catch {
    return '';
  }
}

function getConfiguredOrigins(env) {
  const configured = String(env?.ALLOWED_ORIGINS || '').trim();
  if (!configured) return new Set();
  return new Set(
    configured
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
      .map(value => (value === '*' ? '*' : normalizeOrigin(value)))
      .filter(Boolean)
  );
}

function getAllowedOrigin(request, env) {
  const origin = normalizeOrigin(request.headers.get('Origin'));
  if (!origin) return '';
  const allowed = getConfiguredOrigins(env);
  if (allowed.has('*')) return '*';
  if (allowed.has(origin)) return origin;
  return '';
}

function corsHeaders(request, env, allowMethods = 'POST, OPTIONS') {
  const allowedOrigin = getAllowedOrigin(request, env);
  const requestedHeaders = request.headers.get('Access-Control-Request-Headers');
  const headers = {
    'Access-Control-Allow-Methods': allowMethods,
    'Access-Control-Allow-Headers': requestedHeaders || 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
  if (allowedOrigin) headers['Access-Control-Allow-Origin'] = allowedOrigin;

  return headers;
}

function isDisallowedCorsPreflight(request, env) {
  return request.method === 'OPTIONS'
    && Boolean(request.headers.get('Origin'))
    && !getAllowedOrigin(request, env);
}

function isDisallowedCorsRequest(request, env) {
  return Boolean(request.headers.get('Origin')) && !getAllowedOrigin(request, env);
}

function jsonResponse(body, status, request, env, allowMethods) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(request, env, allowMethods)
    }
  });
}

async function parseDiagnosisRequest(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength && contentLength > MAX_MULTIPART_REQUEST_BYTES) {
      const err = new Error('Upload is too large for this diagnosis endpoint.');
      err.status = 413;
      throw err;
    }
    const formData = await request.formData();
    const requestField = formData.get('request');
    if (!requestField) {
      const err = new Error('Missing request field in multipart payload.');
      err.status = 400;
      throw err;
    }

    let payload;
    try {
      payload = JSON.parse(String(requestField));
    } catch {
      const err = new Error('Invalid JSON in multipart request field.');
      err.status = 400;
      throw err;
    }
    const photos = formData.getAll('photos').filter(Boolean);
    if (photos.length > MAX_PHOTOS) {
      const err = new Error(`Too many photos. Maximum allowed is ${MAX_PHOTOS}.`);
      err.status = 413;
      throw err;
    }
    let totalPhotoBytes = 0;
    for (const file of photos) {
      const isFileLike = file && typeof file === 'object' && typeof file.arrayBuffer === 'function' && typeof file.size === 'number';
      if (!isFileLike) {
        const err = new Error('Each photos item must be a file upload.');
        err.status = 400;
        throw err;
      }
      if (typeof file?.size === 'number' && file.size > MAX_PHOTO_SIZE_BYTES) {
        const err = new Error('One or more photos exceed the maximum allowed size (8MB).');
        err.status = 413;
        throw err;
      }
      if (typeof file?.size === 'number') {
        totalPhotoBytes += file.size;
        if (totalPhotoBytes > MAX_TOTAL_PHOTO_BYTES) {
          const err = new Error('Total photo upload size exceeds the maximum allowed limit (20MB).');
          err.status = 413;
          throw err;
        }
      }
    }

    if (!payload.attachmentSummary || typeof payload.attachmentSummary !== 'object') {
      payload.attachmentSummary = {};
    }
    payload.attachmentSummary.photoCount = photos.length;
    return payload;
  }

  if (contentType.includes('application/json')) {
    try {
      return await request.json();
    } catch {
      const err = new Error('Invalid JSON request body.');
      err.status = 400;
      throw err;
    }
  }

  const err = new Error('Unsupported content type. Use multipart/form-data or application/json.');
  err.status = 415;
  throw err;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const normalizedPath = url.pathname.endsWith('/') && url.pathname.length > 1
      ? url.pathname.slice(0, -1)
      : url.pathname;

    if (request.method === 'OPTIONS') {
      if (!API_ROUTES.has(normalizedPath)) {
        return new Response(null, { status: 404 });
      }
      if (isDisallowedCorsPreflight(request, env)) {
        return new Response(null, { status: 403 });
      }
      const allowMethods = normalizedPath === '/api/health' ? 'GET, OPTIONS' : 'POST, OPTIONS';
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env, allowMethods)
      });
    }

    if (API_ROUTES.has(normalizedPath) && isDisallowedCorsRequest(request, env)) {
      return jsonResponse({ error: 'cors_forbidden', message: 'Origin is not allowed for this backend.' }, 403, request, env, normalizedPath === '/api/health' ? 'GET, OPTIONS' : 'POST, OPTIONS');
    }

    if (normalizedPath === '/api/health' && request.method === 'GET') {
      return jsonResponse({
      ok: true,
      service: 'a-to-z-wise-ai-diagnosis-backend',
      providerConfigured: Boolean(String(env?.AI_PROVIDER_API_KEY || env?.OPENAI_API_KEY || '').trim())
      }, 200, request, env, 'GET, OPTIONS');
    }

    if (normalizedPath === '/api/health' && request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'method_not_allowed', message: 'Use GET /api/health.' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        Allow: 'GET, OPTIONS',
        ...corsHeaders(request, env, 'GET, OPTIONS')
      }
      });
    }

    if (normalizedPath !== '/api/diagnose') {
      return jsonResponse({ error: 'not_found', message: 'Endpoint not found.' }, 404, request, env);
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'method_not_allowed', message: 'Use POST /api/diagnose.' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Allow: 'POST, OPTIONS',
          ...corsHeaders(request, env)
        }
      });
    }

    try {
      const rawPayload = await parseDiagnosisRequest(request);
      const payload = validateAndNormalizeDiagnosisPayload(rawPayload);

      const dangerRule = detectImmediateSafetyStop(payload);
      if (dangerRule) {
        return jsonResponse(buildSafetyStopResponse(payload, dangerRule), 200, request, env);
      }

      const diagnosis = await generateDiagnosisFromProvider(payload, env);
      return jsonResponse(diagnosis, 200, request, env);
    } catch (error) {
      const failure = createBackendErrorResponse(error);
      return jsonResponse(failure.body, failure.status, request, env);
    }
  }
};
