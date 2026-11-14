import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/public-content.js';

test('public CMS endpoint returns safe empty collections when server credentials are absent', async () => {
  const response = await onRequestGet({ env: {} });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    industries: [], services: [], ventures: [], settings: {}
  });
});

test('public CMS endpoint requests published content and allowlists public data fields', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async input => {
    const url = String(input);
    calls.push(url);
    let payload = [];
    if (url.includes('resource=eq.industries')) {
      payload = [{
        id:'industry-1',title:'Commerce & Retail',slug:'commerce-retail',
        summary:'Public summary',sort_order:1,
        data:{display_number:'01',tag:'INDUSTRY',internal_notes:'must not leak'}
      }];
    } else if (url.includes('resource=eq.services')) {
      payload = [{
        id:'service-1',title:'Website Development',slug:'website-development',
        summary:'Public service',sort_order:1,
        data:{tag:'DIGITAL PRESENCE',href:'/services/web-development',private_costs:'must not leak'}
      }];
    } else if (url.includes('resource=eq.ventures')) {
      payload = [{
        id:'venture-1',title:'VUE House',slug:'vue-house',
        summary:'Public venture',sort_order:1,
        data:{relationship_type:'affiliated',website_url:'https://example.com',internal_contact:'must not leak'}
      }];
    } else if (url.includes('admin_site_settings')) {
      payload = [{key:'site_identity',value:{name:'Noctra Hours'}}];
    }
    return new Response(JSON.stringify(payload), {
      status:200,
      headers:{'content-type':'application/json'}
    });
  };

  try {
    const response = await onRequestGet({
      env:{
        SUPABASE_URL:'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY:'server-only-test-secret'
      }
    });
    assert.equal(response.status,200);
    const body = await response.json();
    assert.equal(body.industries[0].data.display_number,'01');
    assert.equal(body.industries[0].data.internal_notes,undefined);
    assert.equal(body.services[0].data.href,'/services/web-development');
    assert.equal(body.services[0].data.private_costs,undefined);
    assert.equal(body.ventures[0].data.relationship_type,'affiliated');
    assert.equal(body.ventures[0].data.internal_contact,undefined);
    assert.deepEqual(body.settings.site_identity,{name:'Noctra Hours'});
    assert.equal(JSON.stringify(body).includes('server-only-test-secret'),false);
    assert.equal(calls.filter(url=>url.includes('status=eq.published')).length,3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
