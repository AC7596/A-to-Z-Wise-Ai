import {
  validateAndNormalizeDiagnosisPayload,
  detectImmediateSafetyStop,
  buildSafetyStopResponse,
  generateDiagnosisFromProvider,
  createBackendErrorResponse
} from './diagnosis-service.mjs';

const MAX_PHOTOS = 6;
const MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024;

function getAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  const configured = String(env?.ALLOWED_ORIGINS || '').trim();

  if (!configured) return '*';

  const allowed = configured.split(',').map(value => value.trim()).filter(Boolean);
  if (allowed.includes('*')) return '*';
  if (origin && allowed.includes(origin)) return origin;
  return allowed[0] || 'null';
}

function corsHeaders(request, env) {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(request, env),
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function jsonResponse(body, status, request, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(request, env)
    }
  });
}

async function parseDiagnosisRequest(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const requestField = formData.get('request');
    if (!requestField) {
      const err = new Error('Missing request field in multipart payload.');
      err.status = 400;
      throw err;
    }

    const payload = JSON.parse(String(requestField));
    const photos = formData.getAll('photos').filter(Boolean);
    if (photos.length > MAX_PHOTOS) {
      const err = new Error(`Too many photos. Maximum allowed is ${MAX_PHOTOS}.`);
      err.status = 413;
      throw err;
    }
    photos.forEach(file => {
      if (typeof file?.size === 'number' && file.size > MAX_PHOTO_SIZE_BYTES) {
        const err = new Error('One or more photos exceed the maximum allowed size (8MB).');
        err.status = 413;
        throw err;
      }
    });

    if (!payload.attachmentSummary || typeof payload.attachmentSummary !== 'object') {
      payload.attachmentSummary = {};
    }
    payload.attachmentSummary.photoCount = photos.length;
    return payload;
  }

  if (contentType.includes('application/json')) {
    return await request.json();
  }

  const err = new Error('Unsupported content type. Use multipart/form-data or application/json.');
  err.status = 415;
  throw err;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env)
      });
    }

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return jsonResponse({ ok: true, service: 'a-to-z-wise-ai-diagnosis-backend' }, 200, request, env);
    }

    if (url.pathname !== '/api/diagnose') {
      return jsonResponse({ error: 'not_found', message: 'Endpoint not found.' }, 404, request, env);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'method_not_allowed', message: 'Use POST /api/diagnose.' }, 405, request, env);
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
