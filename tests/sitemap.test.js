import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/sitemap.xml.js';

test('sitemap contains the established public routes without database credentials', async () => {
  const response=await onRequest({request:new Request('https://noctra.example/sitemap.xml'),env:{}});
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/application\/xml/);
  const xml=await response.text();
  assert.match(xml,/<loc>https:\/\/noctra\.example\/work<\/loc>/);
  assert.match(xml,/<loc>https:\/\/noctra\.example\/contact<\/loc>/);
});

test('sitemap adds only valid published CMS page slugs', async () => {
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify([
    {slug:'studio',updated_at:'2026-11-14T10:00:00.000Z'},
    {slug:'services-overview',updated_at:'2026-11-13T10:00:00.000Z'},
    {slug:'bad/slug',updated_at:'2026-11-12T10:00:00.000Z'}
  ]),{status:200,headers:{'content-type':'application/json'}});
  try{
    const response=await onRequest({request:new Request('https://noctra.example/sitemap.xml'),env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only'}});
    const xml=await response.text();
    assert.match(xml,/<loc>https:\/\/noctra\.example\/studio<\/loc><lastmod>2026-11-14<\/lastmod>/);
    assert.match(xml,/<loc>https:\/\/noctra\.example\/services-overview<\/loc>/);
    assert.doesNotMatch(xml,/bad\/slug/);
    assert.doesNotMatch(xml,/server-only/);
  }finally{globalThis.fetch=originalFetch;}
});
