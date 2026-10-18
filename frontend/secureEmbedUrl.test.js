import assert from 'node:assert/strict'
import test from 'node:test'
import { secureEmbedUrl } from './src/admin/pages/secureEmbedUrl.js'

test('accepts a secure report embed url', () => {
  const result = secureEmbedUrl('https://app.powerbi.com/reportEmbed?reportId=abc&autoAuth=true&ctid=example')
  assert.equal(result.problem, '')
  assert.match(result.url, /reportEmbed/)
})

test('rejects a sharing link and publish to web', () => {
  assert.equal(secureEmbedUrl('https://app.powerbi.com/links/example?ctid=example').problem, 'share-link')
  assert.equal(secureEmbedUrl('https://app.powerbi.com/view?r=example').problem, 'publish-to-web')
  assert.equal(secureEmbedUrl('').problem, 'missing')
})
