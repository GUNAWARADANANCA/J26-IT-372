/** Accept only Power BI secure website/portal embed URLs. Reject share links and Publish to web. */

export function secureEmbedUrl(value) {
  const text = String(value || '').trim()
  if (!text) {
    return { url: '', problem: 'missing' }
  }
  let parsed
  try {
    parsed = new URL(text)
  } catch {
    return { url: '', problem: 'invalid' }
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'app.powerbi.com') {
    return { url: '', problem: 'invalid' }
  }
  if (parsed.pathname === '/view' || parsed.pathname.startsWith('/view/')) {
    return { url: '', problem: 'publish-to-web' }
  }
  if (parsed.pathname.startsWith('/links/')) {
    return { url: '', problem: 'share-link' }
  }
  if (parsed.pathname !== '/reportEmbed' || !parsed.searchParams.get('reportId')) {
    return { url: '', problem: 'invalid' }
  }
  return { url: parsed.toString(), problem: '' }
}
