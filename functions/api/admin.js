const COOKIE = 'noctra_admin_session';
const RESOURCES = new Set(['industries','services','capabilities','projects','ventures','testimonials','pages','navigation']);
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', ...headers }
});
const enc = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64 = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
const originAllowed = request => {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
};
const baseUrl = env => String(env.SUPABASE_URL || '').replace(/\/$/,'');
const anonKey = env => env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || '';
const serviceKey = env => env.SUPABASE_SERVICE_ROLE_KEY || '';

async function sessionKey(env) {
  if (!env.ADMIN_SESSION_SECRET || String(env.ADMIN_SESSION_SECRET).length < 32) throw new Error('Session configuration unavailable');
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(env.ADMIN_SESSION_SECRET));
  return crypto.subtle.importKey('raw', digest, {name:'AES-GCM'}, false, ['encrypt','decrypt']);
}
async function seal(value, env) {
  const key = await sessionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, enc.encode(JSON.stringify(value)));
  return b64(iv) + '.' + b64(new Uint8Array(encrypted));
}
async function unseal(value, env) {
  try {
    const [ivText, cipherText] = String(value || '').split('.');
    if (!ivText || !cipherText) return null;
    const key = await sessionKey(env);
    const plain = await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(ivText)}, key, unb64(cipherText));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch { return null; }
}
function cookieValue(request) {
  const raw = request.headers.get('Cookie') || '';
  const entry = raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
  return entry ? entry.slice(COOKIE.length + 1) : '';
}
async function sessionCookie(tokens, env) {
  const value = await seal({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + Number(tokens.expires_in || 3600) * 1000
  }, env);
  return COOKIE + '=' + value + '; Path=/api/admin; Max-Age=28800; HttpOnly; Secure; SameSite=Lax';
}
const clearCookie = () => COOKIE + '=; Path=/api/admin; Max-Age=0; HttpOnly; Secure; SameSite=Lax';

async function authRequest(env, path, method = 'GET', body, token) {
  const key = anonKey(env);
  if (!baseUrl(env) || !key) throw new Error('Authentication configuration unavailable');
  const headers = {'apikey':key,'accept':'application/json'};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = 'Bearer ' + token;
  const response = await fetch(baseUrl(env) + '/auth/v1/' + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json().catch(()=>({}));
  return {ok:response.ok,status:response.status,data};
}
async function rest(env, path, method = 'GET', body, prefer) {
  if (!baseUrl(env) || !serviceKey(env)) throw new Error('Administrative database configuration unavailable');
  const headers = {
    apikey:serviceKey(env),
    authorization:'Bearer ' + serviceKey(env),
    accept:'application/json'
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (prefer) headers.prefer = prefer;
  const response = await fetch(baseUrl(env) + '/rest/v1/' + path, {
    method, headers, body:body === undefined ? undefined : JSON.stringify(body)
  });
  const data = response.status === 204 ? null : await response.json().catch(()=>null);
  if (!response.ok) throw new Error('Administrative data request failed (' + response.status + ')');
  return {data, headers:response.headers};
}
async function adminContext(env, user) {
  const membership = await rest(env,
    'admin_members?select=user_id,display_name,active,suspended_at,role_id&user_id=eq.' + encodeURIComponent(user.id) + '&limit=1');
  const member = membership.data?.[0];
  if (!member || member.active !== true || member.suspended_at) return null;
  const roleResult = await rest(env,'admin_roles?select=id,name,description&id=eq.' + encodeURIComponent(member.role_id) + '&limit=1');
  const role = roleResult.data?.[0];
  if (!role) return null;
  const perms = await rest(env,'admin_role_permissions?select=permission_id&role_id=eq.' + encodeURIComponent(member.role_id));
  return {
    user:{id:user.id,email:user.email || '',display_name:member.display_name || ''},
    role:role.name,
    role_id:role.id,
    permissions:(perms.data || []).map(row=>row.permission_id)
  };
}
async function readSession(request, env) {
  const stored = await unseal(cookieValue(request), env);
  if (!stored?.refresh_token || !stored?.access_token) return null;
  let tokens = stored;
  let refreshed = false;
  if (Number(stored.expires_at || 0) < Date.now() + 60000) {
    const result = await authRequest(env,'token?grant_type=refresh_token','POST',{refresh_token:stored.refresh_token});
    if (!result.ok || !result.data.access_token) return null;
    tokens = {
      access_token:result.data.access_token,
      refresh_token:result.data.refresh_token || stored.refresh_token,
      expires_at:Date.now() + Number(result.data.expires_in || 3600) * 1000
    };
    refreshed = true;
  }
  const verified = await authRequest(env,'user','GET',undefined,tokens.access_token);
  if (!verified.ok || !verified.data?.id) return null;
  const context = await adminContext(env, verified.data);
  if (!context) return null;
  return {context,tokens,cookie:refreshed ? await sessionCookie(tokens,env) : null};
}
async function audit(env, actor, action, resource, resourceId, previousValues, newValues, request, outcome='success') {
  const details = {source:'admin_portal'};
  const requestMetadata = {
    cf_ray:request.headers.get('cf-ray') || null,
    user_agent:(request.headers.get('user-agent') || '').slice(0,240)
  };
  await rest(env,'admin_audit_logs','POST',{
    actor_id:actor?.id || null, action, resource, resource_id:resourceId || null,
    details, outcome, previous_values:previousValues || null,
    new_values:newValues || null, request_metadata:requestMetadata
  },'return=minimal');
}
function can(context, permission) {
  return context.permissions.includes(permission);
}
function cookieHeader(result) {
  return result?.cookie ? {'set-cookie':result.cookie} : {};
}
async function loginWithPassword(env, email, password) {
  const result = await authRequest(env,'token?grant_type=password','POST',{email,password});
  if (!result.ok || !result.data?.access_token) return null;
  const context = await adminContext(env,result.data.user);
  if (!context) return null;
  const tokens = {
    access_token:result.data.access_token,
    refresh_token:result.data.refresh_token,
    expires_at:Date.now() + Number(result.data.expires_in || 3600) * 1000
  };
  return {context,tokens,cookie:await sessionCookie(tokens,env)};
}
const safeContent = row => ({
  id:row.id,resource:row.resource,title:row.title,slug:row.slug,summary:row.summary,
  status:row.status,sort_order:row.sort_order,data:row.data || {},
  published_at:row.published_at,created_at:row.created_at,updated_at:row.updated_at
});

export async function onRequest({request,env}) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'session';
  const method = request.method.toUpperCase();

  if (method === 'GET' && action === 'session') {
    try {
      const session = await readSession(request,env);
      if (session) return json({authenticated:true,...session.context},200,cookieHeader(session));
      if (!serviceKey(env) || !baseUrl(env)) return json({authenticated:false,setup_required:false,configuration_missing:true},503);
      const members = await rest(env,'admin_members?select=user_id&limit=1');
      return json({authenticated:false,setup_required:(members.data || []).length === 0});
    } catch {
      return json({authenticated:false,setup_required:false,configuration_missing:true},503);
    }
  }

  if (method === 'POST') {
    if (!originAllowed(request)) return json({error:'Request origin is not allowed.'},403);
    const raw = await request.text();
    if (raw.length > 150000) return json({error:'Request is too large.'},413);
    let body;
    try { body = JSON.parse(raw || '{}'); } catch { return json({error:'Invalid request body.'},400); }

    if (action === 'bootstrap') {
      const expected = String(env.ADMIN_BOOTSTRAP_SECRET || '');
      const allowedEmail = String(env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
      if (expected.length < 32 || !allowedEmail || !serviceKey(env) || !anonKey(env)) return json({error:'Initial administrator setup is not configured.'},503);
      if (!body.token || body.token !== expected || String(body.email || '').trim().toLowerCase() !== allowedEmail) return json({error:'Initial setup could not be authorised.'},403);
      if (typeof body.password !== 'string' || body.password.length < 12) return json({error:'Use a password of at least 12 characters.'},400);
      try {
        const existing = await rest(env,'admin_members?select=user_id&limit=1');
        if ((existing.data || []).length) return json({error:'Initial setup has already been completed.'},409);
        const roleResult = await rest(env,'admin_roles?select=id&id=eq.a904601f-123b-4e59-87ed-455ebc37d3ab&limit=1');
        const role = roleResult.data?.[0];
        if (!role) return json({error:'The super-administrator role is unavailable.'},500);
        const createUser = await fetch(baseUrl(env) + '/auth/v1/admin/users',{
          method:'POST',
          headers:{apikey:serviceKey(env),authorization:'Bearer '+serviceKey(env),'content-type':'application/json'},
          body:JSON.stringify({email:allowedEmail,password:body.password,email_confirm:true})
        });
        const created = await createUser.json().catch(()=>({}));
        if (!createUser.ok || !created.id) return json({error:'The administrator identity could not be created. Check whether this email already has an account.'},400);
        const displayName = String(body.display_name || allowedEmail.split('@')[0]).slice(0,100);
        await rest(env,'admin_members','POST',{user_id:created.id,role_id:role.id,display_name:displayName,active:true},'return=minimal');
        const session = await loginWithPassword(env,allowedEmail,body.password);
        if (!session) return json({error:'The administrator was created, but sign-in could not be established. Please sign in.'},201);
        await audit(env,session.context.user,'admin.bootstrap','admin_members',created.id,null,{role:'super_administrator'},request);
        return json({authenticated:true,...session.context},200,{'set-cookie':session.cookie});
      } catch {
        return json({error:'Initial administrator setup failed. No credentials were returned.'},500);
      }
    }

    if (action === 'login') {
      if (typeof body.email !== 'string' || typeof body.password !== 'string') return json({error:'Enter your email and password.'},400);
      try {
        const session = await loginWithPassword(env,body.email.trim().toLowerCase(),body.password);
        if (!session) {
          await audit(env,null,'admin.login.denied','admin_members',null,null,null,request,'denied').catch(()=>{});
          return json({error:'The credentials are invalid or this account has no active administrative access.'},401);
        }
        await audit(env,session.context.user,'admin.login','admin_members',session.context.user.id,null,null,request);
        return json({authenticated:true,...session.context},200,{'set-cookie':session.cookie});
      } catch {
        return json({error:'Administrative authentication is temporarily unavailable.'},503);
      }
    }

    if (action === 'logout') {
      const session = await readSession(request,env).catch(()=>null);
      if (session?.tokens?.access_token) await authRequest(env,'logout','POST',undefined,session.tokens.access_token).catch(()=>null);
      return json({ok:true},200,{'set-cookie':clearCookie()});
    }

    const session = await readSession(request,env).catch(()=>null);
    if (!session) return json({error:'Authentication required.'},401,{'set-cookie':clearCookie()});
    const context = session.context;
    const responseHeaders = cookieHeader(session);

    if (action === 'create-content' || action === 'update-content') {
      if (!can(context,'content.write')) return json({error:'You do not have permission to edit content.'},403,responseHeaders);
      if (!RESOURCES.has(body.resource)) return json({error:'Unsupported content type.'},400,responseHeaders);
      if (typeof body.title !== 'string' || !body.title.trim() || typeof body.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)) return json({error:'A title and valid URL slug are required.'},400,responseHeaders);
      if (body.data && (typeof body.data !== 'object' || Array.isArray(body.data))) return json({error:'Content data must be an object.'},400,responseHeaders);
      try {
        if (action === 'create-content') {
          const inserted = await rest(env,'admin_content','POST',{
            resource:body.resource,title:body.title.trim().slice(0,180),slug:body.slug,
            summary:String(body.summary || '').slice(0,1000),status:'draft',
            sort_order:Number.isFinite(Number(body.sort_order))?Number(body.sort_order):0,
            data:body.data || {},created_by:context.user.id,updated_by:context.user.id
          },'return=representation');
          const row = inserted.data?.[0];
          if (!row) return json({error:'Content could not be created.'},500,responseHeaders);
          await rest(env,'admin_content_revisions','POST',{
            content_id:row.id,resource:row.resource,revision_number:1,
            snapshot:row,change_note:'Initial draft',created_by:context.user.id
          },'return=minimal');
          await audit(env,context.user,'content.create',body.resource,row.id,null,safeContent(row),request);
          return json({item:safeContent(row)},201,responseHeaders);
        }
        if (!body.id) return json({error:'Content identifier is required.'},400,responseHeaders);
        const currentResult = await rest(env,'admin_content?select=*&id=eq.'+encodeURIComponent(body.id)+'&limit=1');
        const current = currentResult.data?.[0];
        if (!current || current.resource !== body.resource) return json({error:'Content record not found.'},404,responseHeaders);
        const latest = await rest(env,'admin_content_revisions?select=revision_number&content_id=eq.'+encodeURIComponent(body.id)+'&order=revision_number.desc&limit=1');
        const nextRevision = Number(latest.data?.[0]?.revision_number || 0) + 1;
        await rest(env,'admin_content_revisions','POST',{
          content_id:current.id,resource:current.resource,revision_number:nextRevision,
          snapshot:current,change_note:String(body.change_note || 'Saved draft').slice(0,500),
          created_by:context.user.id
        },'return=minimal');
        const updated = await rest(env,'admin_content?id=eq.'+encodeURIComponent(body.id),'PATCH',{
          title:body.title.trim().slice(0,180),slug:body.slug,
          summary:String(body.summary || '').slice(0,1000),
          sort_order:Number.isFinite(Number(body.sort_order))?Number(body.sort_order):current.sort_order,
          data:body.data || {},updated_by:context.user.id,updated_at:new Date().toISOString(),
          status:current.status === 'published' ? 'draft' : current.status
        },'return=representation');
        const row = updated.data?.[0];
        await audit(env,context.user,'content.update',body.resource,body.id,safeContent(current),safeContent(row || {}),request);
        return json({item:row?safeContent(row):null},200,responseHeaders);
      } catch {
        return json({error:'Content could not be saved. Please try again.'},500,responseHeaders);
      }
    }

    if (action === 'content-workflow') {
      const operation = body.operation;
      const required = operation === 'submit' ? 'content.submit' :
        operation === 'approve' ? 'content.review' :
        operation === 'publish' || operation === 'unpublish' ? 'content.publish' : 'content.write';
      if (!can(context,required)) return json({error:'You do not have permission to perform this publication action.'},403,responseHeaders);
      if (!body.id || !RESOURCES.has(body.resource)) return json({error:'A valid content record is required.'},400,responseHeaders);
      const statuses = {submit:'review',approve:'approved',publish:'published',unpublish:'draft',archive:'archived'};
      if (!statuses[operation]) return json({error:'Unsupported publication action.'},400,responseHeaders);
      try {
        const found = await rest(env,'admin_content?select=*&id=eq.'+encodeURIComponent(body.id)+'&limit=1');
        const current = found.data?.[0];
        if (!current || current.resource !== body.resource) return json({error:'Content record not found.'},404,responseHeaders);
        if (operation === 'publish' && current.status !== 'approved') return json({error:'Content must be approved before publication.'},409,responseHeaders);
        const update = {status:statuses[operation],updated_by:context.user.id,updated_at:new Date().toISOString()};
        if (operation === 'publish') update.published_at = new Date().toISOString();
        if (operation === 'unpublish' || operation === 'archive') update.published_at = null;
        const changed = await rest(env,'admin_content?id=eq.'+encodeURIComponent(body.id),'PATCH',update,'return=representation');
        await rest(env,'admin_publication_history','POST',{
          content_id:current.id,resource:current.resource,action:operation === 'submit'?'submitted':operation === 'approve'?'approved':operation === 'unpublish'?'unpublished':operation === 'archive'?'archived':'published',
          actor_id:context.user.id,details:{previous_status:current.status,next_status:statuses[operation]}
        },'return=minimal');
        await audit(env,context.user,'content.'+operation,body.resource,body.id,{status:current.status},{status:statuses[operation]},request);
        return json({item:changed.data?.[0]?safeContent(changed.data[0]):null},200,responseHeaders);
      } catch {
        return json({error:'The publication change could not be completed.'},500,responseHeaders);
      }
    }

    if (action === 'update-setting') {
      if (!can(context,'settings.manage')) return json({error:'You do not have permission to change website settings.'},403,responseHeaders);
      if (typeof body.key !== 'string' || !/^[a-z0-9_]{2,80}$/.test(body.key)) return json({error:'Invalid setting key.'},400,responseHeaders);
      try {
        const previous = await rest(env,'admin_site_settings?select=*&key=eq.'+encodeURIComponent(body.key)+'&limit=1');
        await rest(env,'admin_site_settings','POST',{key:body.key,value:body.value,updated_by:context.user.id,updated_at:new Date().toISOString()},'resolution=merge-duplicates,return=minimal');
        await audit(env,context.user,'settings.update','admin_site_settings',body.key,previous.data?.[0]?.value || null,body.value,request);
        return json({ok:true},200,responseHeaders);
      } catch { return json({error:'The setting could not be saved.'},500,responseHeaders); }
    }

    if (action === 'update-enquiry') {
      if (!can(context,'enquiries.manage')) return json({error:'You do not have permission to manage enquiries.'},403,responseHeaders);
      if (!body.id) return json({error:'Enquiry identifier is required.'},400,responseHeaders);
      const allowed = ['received','reviewing','consultation','proposal','accepted','onboarding','closed','new','reviewed','contacted','qualified','proposal_sent','in_progress','won','lost','archived'];
      if (body.status && !allowed.includes(body.status)) return json({error:'Invalid enquiry status.'},400,responseHeaders);
      try {
        const previous = await rest(env,'project_enquiries?select=id,status,assigned_to,follow_up_at&id=eq.'+encodeURIComponent(body.id)+'&limit=1');
        if (!previous.data?.length) return json({error:'Enquiry not found.'},404,responseHeaders);
        const patch = {admin_updated_at:new Date().toISOString()};
        if (body.status) patch.status = body.status;
        if (Object.prototype.hasOwnProperty.call(body,'assigned_to')) patch.assigned_to = body.assigned_to || null;
        if (Object.prototype.hasOwnProperty.call(body,'follow_up_at')) patch.follow_up_at = body.follow_up_at || null;
        const changed = await rest(env,'project_enquiries?id=eq.'+encodeURIComponent(body.id),'PATCH',patch,'return=representation');
        await audit(env,context.user,'enquiry.update','project_enquiries',body.id,previous.data[0],changed.data?.[0] || patch,request);
        return json({item:changed.data?.[0] || null},200,responseHeaders);
      } catch { return json({error:'The enquiry could not be updated.'},500,responseHeaders); }
    }

    if (action === 'add-enquiry-note') {
      if (!can(context,'enquiries.manage')) return json({error:'You do not have permission to add enquiry notes.'},403,responseHeaders);
      if (!body.enquiry_id || typeof body.note !== 'string' || !body.note.trim() || body.note.length > 5000) return json({error:'Enter a note of up to 5,000 characters.'},400,responseHeaders);
      try {
        const result = await rest(env,'admin_enquiry_notes','POST',{
          enquiry_id:body.enquiry_id,note:body.note.trim(),created_by:context.user.id
        },'return=representation');
        await audit(env,context.user,'enquiry.note.create','admin_enquiry_notes',result.data?.[0]?.id,null,{enquiry_id:body.enquiry_id},request);
        return json({item:result.data?.[0] || null},201,responseHeaders);
      } catch { return json({error:'The internal note could not be saved.'},500,responseHeaders); }
    }

    return json({error:'Unsupported administrative action.'},400,responseHeaders);
  }

  if (method === 'GET') {
    const session = await readSession(request,env).catch(()=>null);
    if (!session) return json({error:'Authentication required.'},401,{'set-cookie':clearCookie()});
    const context = session.context;
    const resource = url.searchParams.get('resource') || 'dashboard';
    const headers = cookieHeader(session);
    try {
      if (resource === 'dashboard') {
        if (!can(context,'content.read') && !can(context,'enquiries.read')) return json({error:'Permission denied.'},403,headers);
        const [content,enquiries] = await Promise.all([
          can(context,'content.read') ? rest(env,'admin_content?select=id,resource,status,updated_at&order=updated_at.desc&limit=100') : Promise.resolve({data:[]}),
          can(context,'enquiries.read') ? rest(env,'project_enquiries?select=id,status,created_at&order=created_at.desc&limit=100') : Promise.resolve({data:[]})
        ]);
        const contentRows=content.data||[], enquiryRows=enquiries.data||[];
        return json({
          content_count:contentRows.length,
          published_count:contentRows.filter(x=>x.status==='published').length,
          draft_count:contentRows.filter(x=>x.status==='draft').length,
          review_count:contentRows.filter(x=>x.status==='review').length,
          enquiry_count:enquiryRows.length,
          new_enquiries:enquiryRows.filter(x=>['new','received'].includes(x.status)).length,
          recent_enquiries:enquiryRows.slice(0,5),
          recent_content:contentRows.slice(0,5)
        },200,headers);
      }
      if (RESOURCES.has(resource)) {
        if (!can(context,'content.read')) return json({error:'Permission denied.'},403,headers);
        const rows = await rest(env,'admin_content?select=*&resource=eq.'+encodeURIComponent(resource)+'&order=sort_order.asc,updated_at.desc&limit=200');
        return json({items:(rows.data||[]).map(safeContent)},200,headers);
      }
      if (resource === 'enquiries') {
        if (!can(context,'enquiries.read')) return json({error:'Permission denied.'},403,headers);
        const rows = await rest(env,'project_enquiries?select=id,created_at,full_name,business_name,email,whatsapp,industry,service_required,project_description,estimated_budget,desired_timeline,status,source,assigned_to,follow_up_at,admin_updated_at&order=created_at.desc&limit=200');
        return json({items:rows.data||[]},200,headers);
      }
      if (resource === 'enquiry-notes') {
        if (!can(context,'enquiries.read')) return json({error:'Permission denied.'},403,headers);
        const enquiryId=url.searchParams.get('enquiry_id');
        if (!enquiryId) return json({error:'Enquiry identifier required.'},400,headers);
        const rows=await rest(env,'admin_enquiry_notes?select=id,enquiry_id,note,created_by,created_at&enquiry_id=eq.'+encodeURIComponent(enquiryId)+'&order=created_at.desc');
        return json({items:rows.data||[]},200,headers);
      }
      if (resource === 'settings') {
        if (!can(context,'settings.manage')) return json({error:'Permission denied.'},403,headers);
        const rows=await rest(env,'admin_site_settings?select=key,value,updated_at&order=key.asc');
        return json({items:rows.data||[]},200,headers);
      }
      if (resource === 'audit') {
        if (!can(context,'audit.read')) return json({error:'Permission denied.'},403,headers);
        const rows=await rest(env,'admin_audit_logs?select=id,actor_id,action,resource,resource_id,outcome,created_at,details&order=created_at.desc&limit=100');
        return json({items:rows.data||[]},200,headers);
      }
      if (resource === 'redirects') {
        if (!can(context,'seo.manage')) return json({error:'Permission denied.'},403,headers);
        const rows=await rest(env,'admin_redirects?select=*&order=source_path.asc');
        return json({items:rows.data||[]},200,headers);
      }
      return json({error:'Unsupported administrative resource.'},400,headers);
    } catch {
      return json({error:'Administrative data could not be loaded.'},500,headers);
    }
  }

  return json({error:'Method not allowed.'},405,{allow:'GET, POST'});
}
