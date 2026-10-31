const json = (body, status=200) => new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean = (value, max) => {
  if (typeof value !== 'string') return '';
  return value.trim().split('').filter(character => {
    const code=character.charCodeAt(0);
    return !(code<=8 || code===11 || code===12 || (code>=14&&code<=31) || code===127);
  }).join('').slice(0,max);
};
const digest = async value => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');
};
const required = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','TURNSTILE_SECRET_KEY','TURNSTILE_SITE_KEY','TURNSTILE_ALLOWED_HOSTNAMES','RATE_LIMIT_HASH_SECRET','ALLOWED_ORIGIN','RESEND_API_KEY','NOTIFICATION_EMAIL','FROM_EMAIL'];
export async function onRequestPost({request, env}) {
  try {
    if(request.headers.get('content-type')?.split(';')[0] !== 'application/json') return json({error:'Unsupported content type.'},415);
    if(!required.every(key=>typeof env[key]==='string'&&env[key].trim()) || env.RATE_LIMIT_HASH_SECRET.length<32) return json({error:'Secure enquiry submission is not configured yet.'},503);
    const origin=request.headers.get('Origin');
    if(!origin || origin !== env.ALLOWED_ORIGIN) return json({error:'Request origin is not allowed.'},403);
    const ip=request.headers.get('CF-Connecting-IP');
    if(!ip) return json({error:'Request could not be verified.'},400);
    const raw=await request.text();
    if(raw.length>16000) return json({error:'The submitted information is too large.'},413);
    let body;
    try { body=JSON.parse(raw); } catch { return json({error:'Invalid request body.'},400); }
    if(clean(body.website,200)) return json({ok:true},200);

    const supabaseUrl=env.SUPABASE_URL.endsWith('/')?env.SUPABASE_URL.slice(0,-1):env.SUPABASE_URL;
    const rateKey=await digest(ip+'|'+env.RATE_LIMIT_HASH_SECRET);
    const rateResponse=await fetch(supabaseUrl+'/rest/v1/rpc/consume_enquiry_rate_limit',{
      method:'POST',
      headers:{'content-type':'application/json','apikey':env.SUPABASE_SERVICE_ROLE_KEY,'authorization':'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY},
      body:JSON.stringify({p_key:rateKey,p_window_seconds:60,p_max_requests:5})
    });
    if(!rateResponse.ok){console.error('Enquiry rate limit service unavailable',rateResponse.status);return json({error:'Secure enquiry submission is temporarily unavailable.'},503);}
    if((await rateResponse.json())!==true) return json({error:'Too many attempts. Please wait and try again.'},429);

    const full_name=clean(body.full_name,120);
    const business_name=clean(body.business_name,160);
    const email=clean(body.email,254).toLowerCase();
    const whatsapp=clean(body.whatsapp,40);
    const industry=clean(body.industry,100);
    const service_required=clean(body.service_required,100);
    const project_description=clean(body.project_description,5000);
    const estimated_budget=clean(body.estimated_budget,80);
    const desired_timeline=clean(body.desired_timeline,80);
    const preferred_contact_method=clean(body.preferred_contact_method,30);
    const emailParts=email.split('@');
    if(full_name.length<2 || emailParts.length!==2 || !emailParts[1].includes('.') || emailParts.some(part=>!part) || project_description.length<20 || !service_required || body.privacy_consent!==true) return json({error:'Please check the required fields and privacy consent.'},400);
    if(!['Email','WhatsApp','Phone'].includes(preferred_contact_method)) return json({error:'Invalid contact preference.'},400);

    const token=clean(body.turnstile_token,2048);
    if(!token) return json({error:'Please complete the verification check.'},400);
    const verify=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:ip})
    });
    if(!verify.ok) return json({error:'Verification is temporarily unavailable. Please try again.'},503);
    const verdict=await verify.json();
    const allowedHosts=env.TURNSTILE_ALLOWED_HOSTNAMES.split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
    if(!verdict.success || !allowedHosts.includes(String(verdict.hostname||'').toLowerCase())) return json({error:'Verification failed. Please try again.'},400);

    const submission_fingerprint=await digest([email,full_name,project_description].join('|'));
    const record={full_name,business_name:business_name||null,email,whatsapp:whatsapp||null,industry:industry||null,service_required,project_description,estimated_budget:estimated_budget||null,desired_timeline:desired_timeline||null,preferred_contact_method,privacy_consent:true,submission_fingerprint};
    const response=await fetch(supabaseUrl+'/rest/v1/project_enquiries',{
      method:'POST',
      headers:{'content-type':'application/json','apikey':env.SUPABASE_SERVICE_ROLE_KEY,'authorization':'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'prefer':'return=minimal'},
      body:JSON.stringify(record)
    });
    if(response.status===409) return json({ok:true,duplicate:true});
    if(!response.ok){console.error('Enquiry storage failed',response.status,(await response.text()).slice(0,250));return json({error:'We could not save your enquiry. Please try again later.'},502);}

    const message=[
      'New Noctra Hours project enquiry',
      '',
      'Name: '+full_name,
      'Business: '+(business_name||'Not supplied'),
      'Email: '+email,
      'WhatsApp: '+(whatsapp||'Not supplied'),
      'Industry: '+(industry||'Not supplied'),
      'Service: '+service_required,
      'Budget: '+(estimated_budget||'Not supplied'),
      'Timeline: '+(desired_timeline||'Not supplied'),
      'Preferred contact: '+preferred_contact_method,
      '',
      'Project description:',
      project_description
    ].join('\n');
    const mailPayloads=[
      {from:env.FROM_EMAIL,to:[env.NOTIFICATION_EMAIL],reply_to:email,subject:'New project enquiry — Noctra Hours',text:message},
      {from:env.FROM_EMAIL,to:[email],subject:'We received your project enquiry | Noctra Hours',text:'Thank you for contacting Noctra Hours. Your project enquiry has been received. We will review the information and follow up using your preferred contact method.'}
    ];
    const deliveries=await Promise.allSettled(mailPayloads.map(payload=>fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{'authorization':'Bearer '+env.RESEND_API_KEY,'content-type':'application/json'},
      body:JSON.stringify(payload)
    })));
    const emailResults=await Promise.all(deliveries.map(async result=>{
      if(result.status!=='fulfilled') return false;
      if(!result.value.ok){console.error('Enquiry email delivery failed',result.value.status);return false;}
      return true;
    }));
    return json({ok:true,notifications_sent:emailResults.every(Boolean)});
  } catch(error) {
    console.error('Enquiry handler error',error?.message||'unknown');
    return json({error:'Something went wrong. Please try again.'},500);
  }
}