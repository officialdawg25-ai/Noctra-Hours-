import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/public-content.js';

test('public CMS endpoint returns safe empty collections when server credentials are absent', async () => {
  const response = await onRequestGet({ env: {} });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    cms_available:false, industries: [], services: [], capabilities: [], ventures: [],
    projects: [], testimonials: [], navigation: [], pages: [], settings: {}
  });
});

test('public CMS endpoint exposes only published, allowlisted and verified public fields', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async input => {
    const url = String(input);
    calls.push(url);
    let payload = [];
    if (url.includes('resource=eq.industries')) payload = [{
      id:'industry-1',title:'Commerce & Retail',slug:'commerce-retail',summary:'Public summary',sort_order:1,
      data:{display_number:'01',tag:'INDUSTRY',visual_url:'https://cdn.example/industry.webp',internal_notes:'must not leak'}
    }];
    else if (url.includes('resource=eq.services')) payload = [{
      id:'service-1',title:'Website Development',slug:'website-development',summary:'Public service',sort_order:1,
      data:{tag:'DIGITAL PRESENCE',href:'/services/web-development',private_costs:'must not leak'}
    }];
    else if (url.includes('resource=eq.capabilities')) payload = [{
      id:'capability-1',title:'Strategy & Discovery',slug:'strategy-discovery',summary:'Public capability',sort_order:1,
      data:{tag:'STRATEGY',technologies:['Discovery'],internal_notes:'must not leak'}
    }];
    else if (url.includes('resource=eq.ventures')) payload = [{
      id:'venture-1',title:'VUE House',slug:'vue-house',summary:'Public venture',sort_order:1,
      data:{relationship_type:'ecosystem_venture',website_url:'https://example.com',internal_contact:'must not leak'}
    }];
    else if (url.includes('resource=eq.projects')) payload = [{
      id:'project-1',title:'Commerce platform concept',slug:'commerce-platform-concept',summary:'A published portfolio entry',sort_order:1,
      data:{project_type:'Ecommerce website',cover_image_url:'https://cdn.example/work.webp',live_url:'https://example.com',private_repository:'must not leak'}
    }];
    else if (url.includes('resource=eq.testimonials')) payload = [
      {id:'testimonial-1',title:'Approved feedback',slug:'approved-feedback',summary:'Verified quote',sort_order:1,data:{quote:'A verified statement.',author_name:'A Client',verification_status:'verified',approval_status:'approved',private_email:'must not leak'}},
      {id:'testimonial-2',title:'Unverified feedback',slug:'unverified-feedback',summary:'Do not expose',sort_order:2,data:{quote:'Unverified.',verification_status:'pending',approval_status:'approved'}}
    ];
    else if (url.includes('resource=eq.navigation')) payload = [{
      id:'nav-1',title:'Work',slug:'work',sort_order:1,data:{label:'Work',href:'/work',private_notes:'must not leak'}
    }];
    else if (url.includes('resource=eq.pages')) payload = [{
      id:'page-1',title:'Studio',slug:'studio',summary:'Studio page',sort_order:1,
      data:{eyebrow:'STUDIO',sections:[{heading:'About',body:'Public copy'}],seo_title:'Studio | Noctra',private_notes:'must not leak'}
    }];
    else if (url.includes('admin_site_settings')) payload = [
      {key:'site_identity',value:{name:'Noctra Hours',tagline:'Digital infrastructure',logo_url:'https://cdn.example/logo.svg',private_key:'must not leak'}},
      {key:'homepage_sections',value:{industries:true,services:true,selected_work:true,private_flag:'must not leak'}},
      {key:'seo_defaults',value:{title:'Noctra Hours',description:'Digital studio',private_token:'must not leak'}},
      {key:'social_links',value:[{label:'Instagram',url:'https://instagram.com/noctra'}]},
      {key:'maintenance_mode',value:false}
    ];
    return new Response(JSON.stringify(payload), {status:200,headers:{'content-type':'application/json'}});
  };

  try {
    const response = await onRequestGet({env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only-test-secret'}});
    assert.equal(response.status,200);
    const body = await response.json();
    assert.equal(body.cms_available,true);
    assert.equal(body.industries[0].data.display_number,'01');
    assert.equal(body.industries[0].data.internal_notes,undefined);
    assert.equal(body.services[0].data.href,'/services/web-development');
    assert.equal(body.services[0].data.private_costs,undefined);
    assert.equal(body.capabilities[0].data.technologies[0],'Discovery');
    assert.equal(body.capabilities[0].data.internal_notes,undefined);
    assert.equal(body.ventures[0].data.relationship_type,'ecosystem_venture');
    assert.equal(body.ventures[0].data.internal_contact,undefined);
    assert.equal(body.projects[0].data.live_url,'https://example.com');
    assert.equal(body.projects[0].data.private_repository,undefined);
    assert.equal(body.testimonials.length,1);
    assert.equal(body.testimonials[0].data.author_name,'A Client');
    assert.equal(body.testimonials[0].data.private_email,undefined);
    assert.equal(body.navigation[0].href,'/work');
    assert.equal(body.navigation[0].private_notes,undefined);
    assert.equal(body.pages[0].data.seo_title,'Studio | Noctra');
    assert.equal(body.pages[0].data.private_notes,undefined);
    assert.equal(body.settings.site_identity.name,'Noctra Hours');
    assert.equal(body.settings.site_identity.private_key,undefined);
    assert.equal(body.settings.homepage_sections.private_flag,undefined);
    assert.equal(body.settings.social_links[0].url,'https://instagram.com/noctra');
    assert.equal(body.settings.maintenance_mode,false);
    assert.equal(JSON.stringify(body).includes('server-only-test-secret'),false);
    assert.equal(calls.filter(url=>url.includes('status=eq.published')).length,8);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
