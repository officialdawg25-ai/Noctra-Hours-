import React,{useEffect,useState} from 'react';
import './admin-preview.css';

export default function AdminPreview(){
  const id=new URLSearchParams(window.location.search).get('id');
  const [item,setItem]=useState(null);const [device,setDevice]=useState('desktop');const [error,setError]=useState('');const [loading,setLoading]=useState(true);
  useEffect(()=>{
    if(!id){setError('No content record was selected.');setLoading(false);return;}
    fetch('/api/admin?resource=preview&id='+encodeURIComponent(id),{credentials:'same-origin',headers:{accept:'application/json'}})
      .then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Preview could not be loaded.');return data;})
      .then(data=>setItem(data.item)).catch(err=>setError(err.message)).finally(()=>setLoading(false));
  },[id]);
  const data=item?.data||{};
  const image=data.visual_url||data.cover_image_url||data.logo_url||'';
  return <main className="nh-preview-page">
    <header className="nh-preview-toolbar"><a href="/admin">← Back to administration</a><div><span>CONTENT PREVIEW</span><strong>{item?.resource||'—'} / {item?.status||'—'}</strong></div><div className="nh-device-switch">{[['desktop','Desktop'],['tablet','Tablet'],['mobile','Mobile']].map(([value,label])=><button key={value} className={device===value?'active':''} onClick={()=>setDevice(value)}>{label}</button>)}</div></header>
    {loading?<div className="nh-preview-message">Loading preview…</div>:error?<div className="nh-preview-message">{error}</div>:<section className={'nh-preview-stage '+device}><article className="nh-preview-content">
      <div className="nh-preview-brand"><span>N</span> NOCTRA HOURS</div>
      <div className="nh-preview-kicker">{String(item.resource||'CONTENT').replaceAll('_',' ').toUpperCase()} / DRAFT PREVIEW</div>
      {image&&<img className="nh-preview-image" src={image} alt={data.alt_text||item.title}/>}
      <h1>{item.title}</h1>
      {item.summary&&<p className="nh-preview-summary">{item.summary}</p>}
      {data.description&&<p className="nh-preview-description">{data.description}</p>}
      {data.scope&&<section><h2>Scope</h2><pre>{JSON.stringify(data.scope,null,2)}</pre></section>}
      {data.deliverables&&<section><h2>Deliverables</h2><pre>{JSON.stringify(data.deliverables,null,2)}</pre></section>}
      {data.website_url&&<p><a href={data.website_url} target="_blank" rel="noreferrer">{data.website_url}</a></p>}
      <div className="nh-preview-footer">PREVIEW ONLY · THIS CONTENT IS NOT PUBLIC UNTIL APPROVED AND PUBLISHED</div>
    </article></section>}
  </main>;
}
