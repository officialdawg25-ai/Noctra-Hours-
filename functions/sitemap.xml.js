const paths = ["/","/services","/services/web-development","/services/ecommerce","/services/digital-systems","/services/website-care","/work","/about","/process","/insights","/contact","/privacy-policy","/terms-of-service"];
export async function onRequest({request}) {
  const origin = new URL(request.url).origin;
  const urls = paths.map(path => "<url><loc>" + origin + path + "</loc></url>").join("");
  const xml = '<?xml version="1.0" encoding="UTF-8"?>' + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + '</urlset>';
  return new Response(xml,{headers:{"content-type":"application/xml; charset=utf-8","cache-control":"public, max-age=3600"}});
}
