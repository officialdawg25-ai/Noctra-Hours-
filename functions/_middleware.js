export async function onRequest({request,env,next}){
 const url=new URL(request.url);
 if(!['GET','HEAD'].includes(request.method)||url.pathname.startsWith('/api/')||url.pathname.startsWith('/admin'))return next();
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return next();
 try{
  const query=new URLSearchParams({select:'destination_url,status_code',source_path:'eq.'+url.pathname,is_active:'eq.true',limit:'1'});
  const response=await fetch(env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/admin_redirects?'+query.toString(),{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY}});
  if(response.ok){
   const rows=await response.json(),redirect=rows[0];
   if(redirect?.destination_url){
    const target=new URL(redirect.destination_url,url.origin);
    if(target.origin===url.origin&&!target.search)target.search=url.search;
    if(target.href!==url.href)return Response.redirect(target.href,[301,302,307,308].includes(redirect.status_code)?redirect.status_code:301);
   }
  }
 }catch(error){console.error('Redirect lookup failed',error?.message||'unknown');}
 return next();
}
