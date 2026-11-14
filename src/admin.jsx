import React, {useCallback, useEffect, useMemo, useState} from 'react';

const nav = [
  {group:'OVERVIEW',items:[['dashboard','Dashboard']]},
  {group:'WEBSITE CONTENT',items:[
    ['pages','Homepage & Pages'],['industries','Industries'],['services','Services'],
    ['capabilities','Capabilities'],['projects','Selected Work'],['ventures','Companies & Ventures'],
    ['testimonials','Testimonials'],['navigation','Navigation']
  ]},
  {group:'BUSINESS',items:[['enquiries','Enquiries'],['settings','Website Settings']]},
  {group:'DISCOVERABILITY',items:[['redirects','Redirects & SEO']]},
  {group:'SYSTEM',items:[['audit','Audit Log'],['media','Media Library'],['users','Users & Permissions']]}
];
const labels = Object.fromEntries(nav.flatMap(group=>group.items));
const resources = new Set(['pages','industries','services','capabilities','projects','ventures','testimonials','navigation']);
const request = async (url, options={}) => {
  const response = await fetch(url,{credentials:'same-origin',...options,headers:{accept:'application/json',...(options.headers||{})}});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
};
const post = (action,payload={}) => request('/api/admin?action='+encodeURIComponent(action),{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)
});
const pretty = value => JSON.stringify(value ?? {},null,2);
const date = value => value ? new Date(value).toLocaleString() : '—';

function Field({label,value,onChange,placeholder,type='text',multiline=false}) {
  return <label className="nh-field"><span>{label}</span>{multiline
    ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||''} rows={5}/>
    : <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||''}/>}</label>;
}

function AccessScreen({mode,onSuccess}) {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [displayName,setDisplayName]=useState('');
  const [token,setToken]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const submit=async event=>{
    event.preventDefault();setBusy(true);setError('');
    try {
      const result=await post(mode==='setup'?'bootstrap':'login',{
        email,password,display_name:displayName,token
      });
      onSuccess(result);
    } catch(err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <main className="nh-access">
    <div className="nh-access-mark"><span>N</span><i>NOCTRA HOURS</i></div>
    <div className="nh-access-panel">
      <div className="nh-overline">NOCTRA HOURS / ADMINISTRATION</div>
      <h1>{mode==='setup'?'Establish administrator access.':'Administrative sign in.'}</h1>
      <p>{mode==='setup'
        ? 'Create the first authorised administrator. This one-time setup is restricted to the configured owner email and bootstrap secret.'
        : 'Sign in with an authorised Noctra Hours administrator account.'}</p>
      <form onSubmit={submit}>
        {mode==='setup'&&<Field label="Display name" value={displayName} onChange={setDisplayName} placeholder="Your name"/>}
        <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="name@company.com"/>
        <Field label="Password" type="password" value={password} onChange={setPassword} placeholder={mode==='setup'?'At least 12 characters':'Your password'}/>
        {mode==='setup'&&<Field label="One-time setup key" type="password" value={token} onChange={setToken} placeholder="Cloudflare bootstrap secret"/>}
        {error&&<div className="nh-alert">{error}</div>}
        <button className="nh-primary" disabled={busy}>{busy?'Please wait…':mode==='setup'?'Create super administrator':'Sign in'} <span>↗</span></button>
      </form>
      <div className="nh-access-foot">PRIVATE ADMINISTRATIVE ENVIRONMENT <span>·</span> SECURE SESSION</div>
    </div>
    <footer>NOCTRA HOURS <span>—</span> DIGITAL DEVELOPMENT STUDIO</footer>
  </main>;
}

function Dashboard({data,onNavigate}) {
  const stats=[
    ['CONTENT RECORDS',data?.content_count ?? 0],
    ['PUBLISHED',data?.published_count ?? 0],
    ['AWAITING REVIEW',data?.review_count ?? 0],
    ['ENQUIRIES',data?.enquiry_count ?? 0]
  ];
  return <div className="nh-page">
    <div className="nh-page-heading"><div><div className="nh-overline">OVERVIEW / 01</div><h1>Studio overview</h1><p>A live view of the website and its current administrative workload.</p></div><span className="nh-live"><i/> LIVE DATABASE</span></div>
    <div className="nh-stat-grid">{stats.map(([label,value])=><div className="nh-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="nh-dashboard-grid">
      <section className="nh-panel"><div className="nh-panel-head"><div><span className="nh-overline">CONTENT / RECENT</span><h2>Recently updated</h2></div><button className="nh-text-button" onClick={()=>onNavigate('industries')}>Manage content ↗</button></div>
        {(data?.recent_content||[]).length ? data.recent_content.map(item=><div className="nh-list-row" key={item.id}><div><strong>{item.title || item.resource}</strong><small>{item.resource} · {item.slug}</small></div><span className={'nh-status '+item.status}>{item.status}</span></div>) : <div className="nh-empty">No content activity has been recorded.</div>}
      </section>
      <section className="nh-panel"><div className="nh-panel-head"><div><span className="nh-overline">BUSINESS / RECENT</span><h2>Recent enquiries</h2></div><button className="nh-text-button" onClick={()=>onNavigate('enquiries')}>View enquiries ↗</button></div>
        {(data?.recent_enquiries||[]).length ? data.recent_enquiries.map(item=><div className="nh-list-row" key={item.id}><div><strong>{item.status}</strong><small>{date(item.created_at)}</small></div><span className="nh-mono">{item.id.slice(0,8)}</span></div>) : <div className="nh-empty">No enquiries have been received yet.</div>}
      </section>
    </div>
    <p className="nh-note">Figures reflect records returned by the connected database. They are not estimates or visitor analytics.</p>
  </div>;
}

function ContentModule({resource,items,onReload,permissions}) {
  const [editing,setEditing]=useState(null);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const blank=()=>({id:null,title:'',slug:'',summary:'',sort_order:items.length+1,data:{},change_note:''});
  const openNew=()=>{setError('');setSuccess('');setEditing(blank());};
  const openItem=item=>{setError('');setSuccess('');setEditing({...item,change_note:''});};
  const save=async event=>{
    event.preventDefault();setError('');setSuccess('');
    let data;
    try { data=typeof editing.data==='string'?JSON.parse(editing.data):editing.data; }
    catch { setError('The structured content must be valid JSON.');return; }
    if (!data || typeof data!=='object' || Array.isArray(data)) {setError('Structured content must be a JSON object.');return;}
    setSaving(true);
    try {
      await post(editing.id?'update-content':'create-content',{
        resource,title:editing.title,slug:editing.slug,summary:editing.summary,
        sort_order:Number(editing.sort_order),data,id:editing.id,change_note:editing.change_note
      });
      setEditing(null);setSuccess('Draft saved successfully.');await onReload();
    } catch(err){setError(err.message);}
    finally{setSaving(false);}
  };
  const workflow=async(operation,item)=>{
    setError('');setSuccess('');
    try { await post('content-workflow',{operation,resource,id:item.id});setSuccess('Publication state updated.');await onReload(); }
    catch(err){setError(err.message);}
  };
  return <div className="nh-page">
    <div className="nh-page-heading"><div><div className="nh-overline">WEBSITE / CONTENT MANAGEMENT</div><h1>{labels[resource]}</h1><p>Manage structured records, prepare drafts and control publication.</p></div>
      {permissions.includes('content.write')&&<button className="nh-primary nh-small" onClick={openNew}>New entry <span>＋</span></button>}</div>
    {error&&<div className="nh-alert nh-alert-wide">{error}</div>}{success&&<div className="nh-success">{success}</div>}
    <section className="nh-panel nh-content-list">
      <div className="nh-table-head"><span>NAME / SLUG</span><span>STATUS</span><span>UPDATED</span><span>ACTION</span></div>
      {items.length ? items.map(item=><div className="nh-table-row" key={item.id}>
        <div><strong>{item.title}</strong><small>{item.slug}</small></div>
        <span className={'nh-status '+item.status}>{item.status}</span>
        <span className="nh-date">{date(item.updated_at)}</span>
        <button className="nh-outline" onClick={()=>openItem(item)}>Edit</button>
      </div>) : <div className="nh-empty">No {resource} records are available. Create the first draft when ready.</div>}
    </section>
    {editing&&<div className="nh-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null);}}>
      <section className="nh-editor" role="dialog" aria-modal="true" aria-label="Edit website content">
        <div className="nh-editor-head"><div><span className="nh-overline">{editing.id?'EDIT RECORD':'NEW RECORD'} / {resource.toUpperCase()}</span><h2>{editing.id?'Edit content':'Create content'}</h2></div><button className="nh-close" onClick={()=>setEditing(null)} aria-label="Close">×</button></div>
        <form onSubmit={save}>
          <Field label="Title" value={editing.title} onChange={v=>setEditing(x=>({...x,title:v}))}/>
          <Field label="URL slug" value={editing.slug} onChange={v=>setEditing(x=>({...x,slug:v.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/--+/g,'-')}))}/>
          <Field label="Short description" value={editing.summary} onChange={v=>setEditing(x=>({...x,summary:v}))} multiline/>
          <Field label="Display order" type="number" value={String(editing.sort_order ?? 0)} onChange={v=>setEditing(x=>({...x,sort_order:v}))}/>
          <Field label="Structured content (JSON)" value={typeof editing.data==='string'?editing.data:pretty(editing.data)} onChange={v=>setEditing(x=>({...x,data:v}))} multiline/>
          {editing.id&&<Field label="Revision note" value={editing.change_note} onChange={v=>setEditing(x=>({...x,change_note:v}))} placeholder="Describe this change"/>}
          {error&&<div className="nh-alert">{error}</div>}
          <div className="nh-editor-actions"><button type="button" className="nh-outline" onClick={()=>setEditing(null)}>Cancel</button><button className="nh-primary" disabled={saving}>{saving?'Saving…':'Save draft'} <span>↗</span></button></div>
        </form>
        {editing.id&&<div className="nh-workflow"><span className="nh-overline">PUBLICATION WORKFLOW</span><div>
          {permissions.includes('content.submit')&&<button className="nh-outline" onClick={()=>workflow('submit',editing)}>Submit for review</button>}
          {permissions.includes('content.review')&&<button className="nh-outline" onClick={()=>workflow('approve',editing)}>Approve</button>}
          {permissions.includes('content.publish')&&<button className="nh-outline" onClick={()=>workflow('publish',editing)}>Publish</button>}
          {permissions.includes('content.publish')&&<button className="nh-outline" onClick={()=>workflow('unpublish',editing)}>Unpublish</button>}
        </div></div>}
      </section>
    </div>}
  </div>;
}

function EnquiriesModule({items,onReload}) {
  const [selected,setSelected]=useState(null);
  const [note,setNote]=useState('');
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const statuses=['new','reviewed','contacted','qualified','proposal_sent','in_progress','won','lost','archived','received','reviewing','consultation','proposal','accepted','onboarding','closed'];
  const update=async(id,status)=>{
    try{await post('update-enquiry',{id,status});await onReload();}
    catch(err){setError(err.message);}
  };
  const addNote=async()=>{
    if(!selected||!note.trim())return;
    setSaving(true);setError('');
    try{await post('add-enquiry-note',{enquiry_id:selected.id,note});setNote('');}
    catch(err){setError(err.message);}
    finally{setSaving(false);}
  };
  return <div className="nh-page">
    <div className="nh-page-heading"><div><div className="nh-overline">BUSINESS / CLIENT RELATIONSHIPS</div><h1>Enquiries</h1><p>Private project enquiries received through the public website.</p></div><span className="nh-live">{items.length} RECORDS</span></div>
    {error&&<div className="nh-alert nh-alert-wide">{error}</div>}
    <section className="nh-panel nh-content-list">
      <div className="nh-table-head nh-enquiry-grid"><span>CONTACT</span><span>SERVICE</span><span>STATUS</span><span>RECEIVED</span><span>DETAILS</span></div>
      {items.length?items.map(item=><div className="nh-table-row nh-enquiry-grid" key={item.id}>
        <div><strong>{item.full_name}</strong><small>{item.business_name||item.email}</small></div>
        <span>{item.service_required}</span>
        <select className="nh-status-select" value={item.status} onChange={e=>update(item.id,e.target.value)}>{statuses.map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</select>
        <span className="nh-date">{date(item.created_at)}</span>
        <button className="nh-outline" onClick={()=>setSelected(item)}>Open</button>
      </div>):<div className="nh-empty">No enquiries have been received. This is a genuine empty state.</div>}
    </section>
    {selected&&<div className="nh-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}><section className="nh-editor nh-enquiry-detail">
      <div className="nh-editor-head"><div><span className="nh-overline">ENQUIRY / PRIVATE RECORD</span><h2>{selected.full_name}</h2></div><button className="nh-close" onClick={()=>setSelected(null)}>×</button></div>
      <dl className="nh-detail-grid"><dt>Business</dt><dd>{selected.business_name||'Not supplied'}</dd><dt>Email</dt><dd>{selected.email}</dd><dt>WhatsApp</dt><dd>{selected.whatsapp||'Not supplied'}</dd><dt>Industry</dt><dd>{selected.industry||'Not supplied'}</dd><dt>Service</dt><dd>{selected.service_required}</dd><dt>Budget</dt><dd>{selected.estimated_budget||'Not supplied'}</dd><dt>Timeline</dt><dd>{selected.desired_timeline||'Not supplied'}</dd><dt>Project</dt><dd>{selected.project_description}</dd></dl>
      <div className="nh-note-editor"><Field label="Internal note" value={note} onChange={setNote} multiline placeholder="Private note for authorised team members only"/><button className="nh-primary" onClick={addNote} disabled={saving||!note.trim()}>{saving?'Saving…':'Add note'} <span>↗</span></button></div>
    </section></div>}
  </div>;
}

export default function AdminApp() {
  const [auth,setAuth]=useState({loading:true,authenticated:false,setup_required:false,configuration_missing:false});
  const [active,setActive]=useState('dashboard');
  const [data,setData]=useState([]);
  const [dashboard,setDashboard]=useState(null);
  const [roles,setRoles]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const permissions=auth.permissions||[];
  const loadAuth=useCallback(async()=>{
    try{const result=await request('/api/admin?action=session');setAuth({loading:false,...result});}
    catch{setAuth({loading:false,authenticated:false,configuration_missing:true});}
  },[]);
  useEffect(()=>{loadAuth();},[loadAuth]);
  const load=useCallback(async(resource=active)=>{
    setLoading(true);setError('');
    try{
      if(resource==='dashboard'){setDashboard(await request('/api/admin?resource=dashboard'));setData([]);}
      else if(resources.has(resource)){const result=await request('/api/admin?resource='+resource);setData(result.items||[]);}
      else if(resource==='enquiries'){const result=await request('/api/admin?resource=enquiries');setData(result.items||[]);}
      else if(resource==='settings'){const result=await request('/api/admin?resource=settings');setData(result.items||[]);}
      else if(resource==='audit'){const result=await request('/api/admin?resource=audit');setData(result.items||[]);}
      else if(resource==='redirects'){const result=await request('/api/admin?resource=redirects');setData(result.items||[]);}
      else setData([]);
    }catch(err){setError(err.message);}
    finally{setLoading(false);}
  },[active]);
  useEffect(()=>{if(auth.authenticated)load(active);},[auth.authenticated,active,load]);
  const loginSuccess=result=>setAuth({loading:false,...result,authenticated:true});
  const logout=async()=>{await post('logout').catch(()=>{});setAuth({loading:false,authenticated:false,setup_required:false});setActive('dashboard');};
  const navigate=id=>{setActive(id);setError('');};
  const title=labels[active]||'Administration';
  if(auth.loading)return <div className="nh-loading">NOCTRA HOURS <span>CONNECTING TO ADMINISTRATION…</span></div>;
  if(auth.configuration_missing || auth.bootstrap_unavailable)return <main className="nh-access"><div className="nh-access-panel"><div className="nh-overline">ADMINISTRATION / CONFIGURATION REQUIRED</div><h1>Administrative access is not configured.</h1><p>The secure server connection or one-time administrator bootstrap is missing required Cloudflare Pages environment variables. No browser-side database access will be enabled as a workaround.</p><p className="nh-note">Required: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SESSION_SECRET. For first-time setup also configure ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_SECRET.</p></div></main>;
  if(!auth.authenticated)return <AccessScreen mode={auth.setup_required?'setup':'login'} onSuccess={loginSuccess}/>;
  return <div className="nh-admin">
    <aside className="nh-sidebar">
      <a className="nh-admin-brand" href="/"><span>N</span><div>NOCTRA HOURS<small>ADMINISTRATION</small></div></a>
      <div className="nh-sidebar-scroll">{nav.map(group=><div className="nh-nav-group" key={group.group}><span className="nh-nav-label">{group.group}</span>{group.items.map(([id,label])=><button key={id} className={active===id?'active':''} onClick={()=>navigate(id)}>{label}<span>↗</span></button>)}</div>)}</div>
      <div className="nh-sidebar-bottom"><span>{auth.user?.display_name||auth.user?.email}</span><small>{String(auth.role||'').replaceAll('_',' ')}</small><button onClick={logout}>Sign out <span>↗</span></button><a href="/" target="_blank" rel="noreferrer">View public website ↗</a></div>
    </aside>
    <main className="nh-main">
      <header className="nh-topbar"><div><span>NOCTRA HOURS</span><i>/</i><strong>{title}</strong></div><span className="nh-top-user">ADMINISTRATIVE ENVIRONMENT <b>●</b></span></header>
      {error&&<div className="nh-global-error">{error}</div>}
      {loading?<div className="nh-loading-inline">Loading verified records…</div>:active==='dashboard'?<Dashboard data={dashboard} onNavigate={navigate}/>
        :resources.has(active)?<ContentModule resource={active} items={data} onReload={()=>load(active)} permissions={permissions}/>
        :active==='enquiries'?<EnquiriesModule items={data} onReload={()=>load(active)}/>
        :active==='settings'?<SettingsModule items={data} onReload={()=>load(active)}/>
        :active==='audit'?<AuditModule items={data}/>
        :active==='redirects'?<RedirectModule items={data} onReload={()=>load(active)}/>
        :<UnavailableModule active={active}/>}
    </main>
  </div>;
}

function SettingsModule({items,onReload}) {
  const [key,setKey]=useState('');const [value,setValue]=useState('{}');const [error,setError]=useState('');const [saving,setSaving]=useState(false);
  const edit=item=>{setKey(item.key);setValue(pretty(item.value));};
  const save=async()=>{let parsed;try{parsed=JSON.parse(value);}catch{setError('Enter valid JSON.');return;}setSaving(true);setError('');try{await post('update-setting',{key,value:parsed});await onReload();}catch(err){setError(err.message);}finally{setSaving(false);}};
  return <div className="nh-page"><div className="nh-page-heading"><div><div className="nh-overline">BUSINESS / CONFIGURATION</div><h1>Website settings</h1><p>Manage approved settings stored in the existing configuration table.</p></div></div>{error&&<div className="nh-alert">{error}</div>}<div className="nh-dashboard-grid"><section className="nh-panel"><div className="nh-panel-head"><h2>Configuration keys</h2></div>{items.map(item=><button className="nh-setting-row" key={item.key} onClick={()=>edit(item)}><span>{item.key}</span><small>{date(item.updated_at)}</small></button>)}</section><section className="nh-panel nh-setting-editor"><span className="nh-overline">EDIT CONFIGURATION</span><h2>{key||'Select a setting'}</h2>{key&&<><textarea value={value} onChange={e=>setValue(e.target.value)} rows={12}/><button className="nh-primary" onClick={save} disabled={saving}>{saving?'Saving…':'Save setting'} ↗</button></>}</section></div></div>;
}
function AuditModule({items}) {
  return <div className="nh-page"><div className="nh-page-heading"><div><div className="nh-overline">SYSTEM / ACCOUNTABILITY</div><h1>Administrative audit log</h1><p>Recorded actions from the administrative environment.</p></div></div><section className="nh-panel">{items.length?items.map(item=><div className="nh-list-row" key={item.id}><div><strong>{item.action}</strong><small>{item.resource} / {item.resource_id||'—'} · {date(item.created_at)}</small></div><span className={'nh-status '+(item.outcome||'success')}>{item.outcome||'success'}</span></div>):<div className="nh-empty">No administrative activity has been recorded.</div>}</section></div>;
}
function RedirectModule({items,onReload}) {
  const [source,setSource]=useState('');const [destination,setDestination]=useState('');const [status,setStatus]=useState('301');const [error,setError]=useState('');
  return <div className="nh-page"><div className="nh-page-heading"><div><div className="nh-overline">DISCOVERABILITY / SEO</div><h1>Redirects</h1><p>Review and manage explicit URL redirects. No redirect is created automatically.</p></div></div><section className="nh-panel nh-redirect-form"><Field label="Source path" value={source} onChange={setSource} placeholder="/old-page"/><Field label="Destination URL or path" value={destination} onChange={setDestination} placeholder="/new-page"/><label className="nh-field"><span>Status code</span><select value={status} onChange={e=>setStatus(e.target.value)}><option>301</option><option>302</option><option>307</option><option>308</option></select></label><button className="nh-primary" onClick={async()=>{try{await post('create-redirect',{source_path:source,destination_url:destination,status_code:Number(status)});setSource('');setDestination('');setError('');await onReload();}catch(err){setError(err.message);}}}>Add redirect ↗</button>{error&&<div className="nh-alert">{error}</div>}</section><section className="nh-panel">{items.length?items.map(item=><div className="nh-list-row" key={item.id}><div><strong>{item.source_path}</strong><small>{item.destination_url}</small></div><span>{item.status_code}</span></div>):<div className="nh-empty">No redirects have been configured.</div>}</section></div>;
}
function UsersModule({items,roles,currentUserId,onReload}) {
  const [email,setEmail]=useState('');const [displayName,setDisplayName]=useState('');const [roleId,setRoleId]=useState(roles.find(r=>r.name==='administrator')?.id||'');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  useEffect(()=>{if(!roleId&&roles.length)setRoleId(roles.find(r=>r.name==='administrator')?.id||roles[0].id);},[roles,roleId]);
  const invite=async event=>{event.preventDefault();setBusy(true);setError('');setNotice('');try{const result=await post('invite-user',{email,display_name:displayName,role_id:roleId});setNotice('Invitation created for '+email+'. Supabase email delivery must be configured.');setEmail('');setDisplayName('');await onReload();}catch(err){setError(err.message);}finally{setBusy(false);}};
  const changeRole=async(userId,nextRole)=>{setError('');try{await post('update-role',{user_id:userId,role_id:nextRole});setNotice('Administrative role updated.');await onReload();}catch(err){setError(err.message);}};
  const suspend=async userId=>{if(!window.confirm('Suspend this administrator? Their next server request will be denied.'))return;setError('');try{await post('suspend-user',{user_id:userId});setNotice('Administrator access suspended.');await onReload();}catch(err){setError(err.message);}};
  return <div className="nh-page"><div className="nh-page-heading"><div><div className="nh-overline">SYSTEM / ACCESS CONTROL</div><h1>Users & permissions</h1><p>Manage Supabase Auth identities and their existing Noctra administrative memberships.</p></div></div>
    {error&&<div className="nh-alert nh-alert-wide">{error}</div>}{notice&&<div className="nh-success">{notice}</div>}
    <section className="nh-panel nh-user-invite"><div className="nh-panel-head"><div><span className="nh-overline">INVITE / AUTHORISED ACCESS</span><h2>Invite an administrator</h2></div></div>
      <form onSubmit={invite} className="nh-invite-form"><Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="person@company.com"/><Field label="Display name" value={displayName} onChange={setDisplayName} placeholder="Name"/><label className="nh-field"><span>Role</span><select value={roleId} onChange={e=>setRoleId(e.target.value)}>{roles.map(r=><option key={r.id} value={r.id}>{r.name.replaceAll('_',' ')}</option>)}</select></label><button className="nh-primary" disabled={busy||!roleId}>{busy?'Sending…':'Send invitation'} ↗</button></form>
    </section>
    <section className="nh-panel nh-user-list"><div className="nh-panel-head"><h2>Administrative accounts</h2><span className="nh-live">{items.length} MEMBERSHIPS</span></div>
      {items.length?items.map(item=><div className="nh-user-row" key={item.user_id}><div><strong>{item.display_name||item.email||'Administrator'}</strong><small>{item.email||item.user_id}</small></div><select aria-label={'Role for '+(item.email||item.user_id)} value={item.role_id} disabled={item.user_id===currentUserId||!item.active} onChange={e=>changeRole(item.user_id,e.target.value)}>{roles.map(r=><option key={r.id} value={r.id}>{r.name.replaceAll('_',' ')}</option>)}</select><span className={'nh-status '+(item.active?'success':'archived')}>{item.active?'active':'suspended'}</span>{item.user_id!==currentUserId&&item.active&&<button className="nh-outline" onClick={()=>suspend(item.user_id)}>Suspend</button>}</div>):<div className="nh-empty">No administrative memberships have been created.</div>}
    </section>
  </div>;
}

function UnavailableModule({active}) {
  const copy={
    media:'The existing media metadata table and storage bucket have been discovered. Upload, replacement and reference-safe deletion controls are not yet enabled.',
    users:'Role and permission records exist. User invitations, suspension controls and session revocation are being completed after initial administrator bootstrap.',
  };
  return <div className="nh-page"><div className="nh-page-heading"><div><div className="nh-overline">SYSTEM / IN PROGRESS</div><h1>{labels[active]}</h1><p>{copy[active]||'This module is not yet enabled.'}</p></div></div><section className="nh-panel nh-empty">This module is not represented as complete until its backend operations and permission checks have been verified.</section></div>;
}
