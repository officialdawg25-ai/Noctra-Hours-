const paths = ["/","/services","/services/web-development","/services/ecommerce","/services/digital-systems","/services/website-care","/work","/about","/process","/insights","/contact","/privacy-policy","/terms-of-service"];
const xmlEscape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&apos;");
export async function onRequest({request,env}) {
  let origin=new URL(request.url).origin;
  try { const configured=new URL(env.PUBLIC_SITE_URL); if(configured.protocol==='https:') origin=configured.origin; } catch {}
  const urls=paths.map(path=>"<url><loc>"+xmlEscape(origin+path)+"</loc></url>");
  if(env.SUPABASE_URL&&env.SUPABASE_SERVICE_ROLE_KEY){
    try{
      const query=new URLSearchParams({select:'slug,updated_at',resource:'eq.pages',status:'eq.published',order:'updated_at.desc',limit:'200'});
      const response=await fetch(env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/admin_content?'+query.toString(),{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY}});
      if(response.ok){
        for(const page of await response.json()){
          const slug=String(page.slug||'').replace(/^\/+|\/+$/g,'');
          if(!slug||! /^[a-z0-9-]+$/i.test(slug))continue;
          const lastmod=page.updated_at?'<lastmod>'+xmlEscape(new Date(page.updated_at).toISOString().slice(0,10))+'</lastmod>':'';
          urls.push('<url><loc>'+xmlEscape(origin+'/'+slug)+'</loc>'+lastmod+'</url>');
        }
      }
    }catch(error){console.error('Dynamic sitemap content unavailable',error?.message||'unknown');}
  }
  const xml='<?xml version="1.0" encoding="UTF-8"?>'+'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.join('')+'</urlset>';
  return new Response(xml,{headers:{"content-type":"application/xml; charset=utf-8","cache-control":"public, max-age=3600"}});
}
