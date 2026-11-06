export async function fetchMemberService(fetchImpl, url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    return await fetchImpl(url, { ...options, redirect: 'manual', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
