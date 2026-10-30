export async function onRequest({request}) {
  const origin = new URL(request.url).origin;
  const body = "User-agent: *\nAllow: /\nSitemap: " + origin + "/sitemap.xml\n";
  return new Response(body,{headers:{"content-type":"text/plain; charset=utf-8","cache-control":"public, max-age=3600"}});
}
