const json = (body, status=200) => new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean = (v, max) => typeof v === 'string' ? v.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').slice(0,max) : '';
export async function onRequestPost({request, env}) {
  try {
    if(request.headers.get('content-type')?.split(';')[0] !== 'application/json') return json({error:'Unsupported content type.'},415);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if(!env.ENQUIRY_RATE_LIMIT || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.TURNSTILE_SECRET_KEY) return json({error:'Enquiry submission is not configured yet. Please contact us directly.'},503);
    const limit = await env.ENQUIRY_RATE_LIMIT.limit({key:ip});
    if(!limit.success) return json({error:'Too many attempts. Please wait and try again.'},429);
    const body = await request.json();
    const full_name=clean(body.full_name,120), business_name=clean(body.business_name,160), email=clean(body.email,254).toLowerCase(), whatsapp=clean(body.whatsapp,40), industry=clean(body.industry,100), service_required=clean(body.service_required,100), project_description=clean(body.project_description,5000), estimated_budget=clean(body.estimated_budget,80), desired_timeline=clean(body.desired_timeline,80), preferred_contact_method=clean(body.preferred_contact_method,30);
    if(full_name.length<2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || project_description.length<20 || !service_required || body.privacy_consent!==true) return json({error:'Please check the required fields and privacy consent.'},400);
    if(!['Email','WhatsApp','Phone'].includes(preferred_contact_method)) return json({error:'Invalid contact preference.'},400);
    const token=clean(body.turnstile_token,2048);
    if(!token) return json({error:'Please complete the verification check.'},400);
    const verify=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:ip})});
    const verdict=await verify.json();
    if(!verdict.success) return json({error:'Verification failed. Please try again.'},400);
    const fingerprint=await crypto.subtle.digest('SHA-256',new TextEncoder().encode([email,full_name,project_description,ip].join('|')));
    const submission_fingerprint=Array.from(new Uint8Array(fingerprint)).map(x=>x.toString(16).padStart(2,'0')).join('');
    const record={full_name,business_name:business_name||null,email,whatsapp:whatsapp||null,industry:industry||null,service_required,project_description,estimated_budget:estimated_budget||null,desired_timeline:desired_timeline||null,preferred_contact_method,privacy_consent:true,submission_fingerprint};
    const response=await fetch(env.SUPABASE_URL.replace(/\/$/, '')+'/rest/v1/project_enquiries',{method:'POST',headers:{'content-type':'application/json','apikey':env.SUPABASE_SERVICE_ROLE_KEY,'authorization':'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'prefer':'return=minimal'},body:JSON.stringify(record)});
    if(response.status===409) return json({ok:true,message:'Your enquiry has already been received.'});
    if(!response.ok){const detail=await response.text();console.error('Enquiry storage failed',response.status,detail.slice(0,300));return json({error:'We could not save your enquiry. Please try again later.'},502);}
    if(env.RESEND_API_KEY && env.NOTIFICATION_EMAIL && env.FROM_EMAIL) {
      const message='New Noctra Hours project enquiry\n\nName: '+full_name+'\nBusiness: '+(business_name||'Not supplied')+'\nEmail: '+email+'\nWhatsApp: '+(whatsapp||'Not supplied')+'\nIndustry: '+(industry||'Not supplied')+'\nService: '+service_required+'\nBudget: '+(estimated_budget||'Not supplied')+'\nTimeline: '+(desired_timeline||'Not supplied')+'\nPreferred contact: '+preferred_contact_method+'\n\nProject description:\n'+project_description;
      const mail=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'authorization':'Bearer '+env.RESEND_API_KEY,'content-type':'application/json'},body:JSON.stringify({from:env.FROM_EMAIL,to:[env.NOTIFICATION_EMAIL],reply_to:email,subject:'New project enquiry — Noctra Hours',text:message})});
      if(!mail.ok) console.error('Enquiry notification failed',mail.status,(await mail.text()).slice(0,250));
      const ack=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'authorization':'Bearer '+env.RESEND_API_KEY,'content-type':'application/json'},body:JSON.stringify({from:env.FROM_EMAIL,to:[email],subject:'We received your project enquiry | Noctra Hours',text:'Thank you for contacting Noctra Hours. Your project enquiry has been received. We will review the information and follow up using your preferred contact method.'})});
      if(!ack.ok) console.error('Enquiry acknowledgement failed',ack.status);
    } else console.warn('Email notifications are not configured; enquiry was stored.');
    return json({ok:true});
  } catch(error) { console.error('Enquiry handler error',error?.message||'unknown'); return json({error:'Something went wrong. Please try again.'},500); }
}