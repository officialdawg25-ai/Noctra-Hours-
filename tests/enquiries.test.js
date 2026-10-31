import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/enquiries.js';
import { onRequestGet as getSiteConfig } from '../functions/api/site-config.js';

test('enquiry endpoint rejects non-JSON requests', async () => {
  const response=await onRequestPost({request:new Request('https://noctra-hours.pages.dev/api/enquiries',{method:'POST',headers:{'content-type':'text/plain'},body:'hello'}),env:{}});
  assert.equal(response.status,415);
});

test('enquiry endpoint fails closed until required secrets are configured', async () => {
  const response=await onRequestPost({request:new Request('https://noctra-hours.pages.dev/api/enquiries',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),env:{}});
  assert.equal(response.status,503);
  assert.equal((await response.json()).error,'Secure enquiry submission is not configured yet.');
});

test('public site configuration never exposes server secrets', async () => {
  const response=await getSiteConfig({request:new Request('https://noctra-hours.pages.dev/api/site-config'),env:{
    SUPABASE_SERVICE_ROLE_KEY:'server-secret',
    TURNSTILE_SECRET_KEY:'turnstile-secret',
    RESEND_API_KEY:'resend-secret',
    PUBLIC_SITE_URL:'https://noctra-hours.pages.dev',
    CONTACT_EMAIL:'hello@example.com',
    WHATSAPP_NUMBER:'+27 82 123 4567'
  }});
  const data=await response.json();
  assert.equal(data.siteUrl,'https://noctra-hours.pages.dev');
  assert.equal(data.contactEmail,'hello@example.com');
  assert.equal(data.whatsappUrl,'https://wa.me/27821234567');
  assert.equal(data.enquiryFormReady,false);
  assert.equal(JSON.stringify(data).includes('server-secret'),false);
  assert.equal(JSON.stringify(data).includes('turnstile-secret'),false);
  assert.equal(JSON.stringify(data).includes('resend-secret'),false);
});

test('public configuration ignores unsafe social URLs', async () => {
  const response=await getSiteConfig({request:new Request('https://noctra-hours.pages.dev/api/site-config'),env:{SOCIAL_INSTAGRAM_URL:'javascript:alert(1)'}});
  const data=await response.json();
  assert.deepEqual(data.socialLinks,[]);
});

import { onRequest as getSitemap } from '../functions/sitemap.xml.js';
import { onRequest as getRobots } from '../functions/robots.txt.js';

test('sitemap lists all thirteen planned routes using configured canonical origin', async () => {
  const response=await getSitemap({request:new Request('https://preview.noctra-hours.pages.dev/sitemap.xml'),env:{PUBLIC_SITE_URL:'https://noctra-hours.pages.dev'}});
  const xml=await response.text();
  assert.equal(response.headers.get('content-type').includes('application/xml'),true);
  assert.equal((xml.match(/<url>/g)||[]).length,13);
  assert.equal(xml.includes('https://noctra-hours.pages.dev/services/web-development'),true);
  assert.equal(xml.includes('preview.noctra-hours.pages.dev'),false);
});

test('robots file points crawlers to the configured sitemap', async () => {
  const response=await getRobots({request:new Request('https://noctra-hours.pages.dev/robots.txt'),env:{PUBLIC_SITE_URL:'https://noctra-hours.pages.dev'}});
  const body=await response.text();
  assert.equal(body.includes('Disallow: /api/'),true);
  assert.equal(body.includes('Sitemap: https://noctra-hours.pages.dev/sitemap.xml'),true);
});
