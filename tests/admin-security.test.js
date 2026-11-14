import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/admin.js';

test('admin session endpoint fails closed when server configuration is absent', async () => {
  const request = new Request('https://noctra.example/api/admin?action=session');
  const response = await onRequest({ request, env: {} });
  assert.equal(response.status,503);
  const body = await response.json();
  assert.equal(body.authenticated,false);
  assert.equal(body.configuration_missing,true);
});

test('admin mutations reject cross-origin requests before processing credentials', async () => {
  const request = new Request('https://noctra.example/api/admin?action=login',{
    method:'POST',
    headers:{
      origin:'https://attacker.example',
      'content-type':'application/json'
    },
    body:JSON.stringify({email:'admin@example.com',password:'not-a-real-password'})
  });
  const response = await onRequest({ request, env: {} });
  assert.equal(response.status,403);
  assert.deepEqual(await response.json(),{error:'Request origin is not allowed.'});
});
