const safeUrl = value => {
  try { const url=new URL(value); return url.protocol==='https:'?url.toString():null; } catch { return null; }
};
export async function onRequestGet({request,env}) {
  const siteUrl=safeUrl(env.PUBLIC_SITE_URL)||new URL(request.url).origin;
  const whatsappNumber=String(env.WHATSAPP_NUMBER||'').replace(/[^0-9]/g,'');
  const socialLinks=[
    ['Instagram',env.SOCIAL_INSTAGRAM_URL],
    ['LinkedIn',env.SOCIAL_LINKEDIN_URL],
    ['Facebook',env.SOCIAL_FACEBOOK_URL]
  ].map(([label,value])=>({label,url:safeUrl(value)})).filter(item=>item.url);
  const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','TURNSTILE_SECRET_KEY','TURNSTILE_SITE_KEY','TURNSTILE_ALLOWED_HOSTNAMES','RATE_LIMIT_HASH_SECRET','ALLOWED_ORIGIN','RESEND_API_KEY','NOTIFICATION_EMAIL','FROM_EMAIL'];
  const enquiryFormReady=required.every(key=>typeof env[key]==='string'&&env[key].trim())&&String(env.RATE_LIMIT_HASH_SECRET).length>=32;
  return new Response(JSON.stringify({
    siteUrl,
    contactEmail:env.CONTACT_EMAIL||'',
    whatsappNumber,
    whatsappUrl:whatsappNumber?'https://wa.me/'+whatsappNumber:'',
    turnstileSiteKey:env.TURNSTILE_SITE_KEY||'',
    enquiryFormReady,
    socialLinks
  }),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300'}});
}