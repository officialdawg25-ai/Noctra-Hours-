export async function onRequest({request,env}) {
  let origin=new URL(request.url).origin;
  try { const configured=new URL(env.PUBLIC_SITE_URL); if(configured.protocol==='https:') origin=configured.origin; } catch {}
  const body="User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: "+origin+"/sitemap.xml\n";
  return new Response(body,{headers:{"content-type":"text/plain; charset=utf-8","cache-control":"public, max-age=3600"}});
}