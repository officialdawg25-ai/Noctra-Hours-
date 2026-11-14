const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>Object.prototype.hasOwnProperty.call(value||{},key)).map(key=>[key,value[key]]));
const safeLink=value=>{try{const url=new URL(value);return url.protocol==='https:'?url.toString():null}catch{return typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')?value:null}};
export async function onRequestGet({env}){
 const base=String(env.SUPABASE_URL||'').replace(/\/$/,''),key=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)return json({cms_available:false,industries:[],services:[],capabilities:[],ventures:[],projects:[],testimonials:[],navigation:[],pages:[],settings:{}});
 const headers={apikey:key,authorization:'Bearer '+key,accept:'application/json'};
 const get=async path=>{const response=await fetch(base+'/rest/v1/'+path,{headers});if(!response.ok)throw new Error('CMS query failed');return response.json();};
 try{
  const [industries,services,capabilities,ventures,projects,testimonials,navigation,pages,settings]=await Promise.all([
   get('admin_content?select=id,title,slug,summary,sort_order,data&resource=eq.industries&status=eq.published&order=sort_order.asc'),
   get('admin_content?select=id,title,slug,summary,sort_order,data&resource=eq.services&status=eq.published&order=sort_order.asc'),
   get('admin_content?select=id,title,slug,summary,sort_order,data&resource=eq.capabilities&status=eq.published&order=sort_order.asc'),
   get('admin_content?select=id,title,slug,summary,sort_order,data&resource=eq.ventures&status=eq.published&order=sort_order.asc'),
   get('admin_content?select=id,title,slug,summary,sort_order,data&resource=eq.projects&status=eq.published&order=sort_order.asc'),
   get('admin_content?select=id,title,slug,summary,sort_order,data&resource=eq.testimonials&status=eq.published&order=sort_order.asc'),
   get('admin_content?select=id,title,slug,summary,sort_order,data&resource=eq.navigation&status=eq.published&order=sort_order.asc'),
   get('admin_content?select=id,title,slug,summary,sort_order,data&resource=eq.pages&status=eq.published&order=sort_order.asc'),
   get('admin_site_settings?select=key,value&key=in.(site_identity,homepage_sections,seo_defaults,contact,social_links,footer,business_profile,brand_tokens,maintenance_mode)')
  ]);
  const publicIndustries=(industries||[]).map(({id,title,slug,summary,sort_order,data})=>({id,title,slug,summary,sort_order,data:{...pick(data,['display_number','description','alt_text','related_services','related_capabilities','related_projects','seo_title','seo_description','href','tag','positioning','related_solutions']),visual_url:safeLink(data?.visual_url)||''}}));
  const publicServices=(services||[]).map(({id,title,slug,summary,sort_order,data})=>({id,title,slug,summary,sort_order,data:pick(data,['display_number','description','scope','deliverables','pricing','show_pricing','estimated_delivery','related_industries','related_projects','is_featured','tag'])}));
  const publicCapabilities=(capabilities||[]).map(({id,title,slug,summary,sort_order,data})=>({id,title,slug,summary,sort_order,data:pick(data,['display_number','description','scope','href','tag','related_services','related_industries','related_projects','technologies'])}));
  const publicVentures=(ventures||[]).map(({id,title,slug,summary,sort_order,data})=>({id,title,slug,summary,sort_order,data:{...pick(data,['description','industry','relationship_type','is_featured','tag']),logo_url:safeLink(data?.logo_url)||'',website_url:safeLink(data?.website_url)||''}}));
  const publicProjects=(projects||[]).map(({id,title,slug,summary,sort_order,data})=>({id,title,slug,summary,sort_order,data:{...pick(data,['project_type','project_objective','industry','services_delivered','technologies','delivery_status','relationship_type','is_featured']),cover_image_url:safeLink(data?.cover_image_url)||'',live_url:safeLink(data?.live_url)||'',image_alt:String(data?.image_alt||'').slice(0,200)}}));
  const publicTestimonials=(testimonials||[]).filter(item=>item.data?.verification_status==='verified'&&item.data?.approval_status==='approved').map(({id,title,slug,summary,sort_order,data})=>({id,title,slug,summary,sort_order,data:pick(data,['quote','author_name','author_role','company_name','verification_status','approval_status'])}));
  const publicNavigation=(navigation||[]).map(({id,title,slug,sort_order,data})=>({id,title,slug,sort_order,label:String(data?.label||title).slice(0,80),href:safeLink(data?.href||'/')||'/'}));
  const publicPages=(pages||[]).map(({id,title,slug,summary,sort_order,data})=>({id,title,slug,summary,sort_order,data:{...pick(data,['eyebrow','body','sections','seo_title','seo_description']),og_image_url:safeLink(data?.og_image_url)||''}}));
  const raw=Object.fromEntries((settings||[]).map(item=>[item.key,item.value??{}]));
  const identity=pick(raw.site_identity,['name','tagline']);identity.logo_url=safeLink(raw.site_identity?.logo_url)||'';identity.favicon_url=safeLink(raw.site_identity?.favicon_url)||'';
  const visibility=pick(raw.homepage_sections,['industries','services','capabilities','selected_work','ventures','testimonials','process','why']);
  const seo=pick(raw.seo_defaults,['title','description']);seo.og_image_url=safeLink(raw.seo_defaults?.og_image_url)||'';
  const contact=pick(raw.contact,['email','phone','whatsapp_number','whatsappNumber']);
  const socialLinks=(Array.isArray(raw.social_links)?raw.social_links:[]).map(item=>({label:String(item.label||'').slice(0,40),url:safeLink(item.url)})).filter(item=>item.label&&item.url);
  const footer=pick(raw.footer,['description','location','copyright_line']);
  const business=pick(raw.business_profile,['city','region','country','address']);
  const brand=pick(raw.brand_tokens,['background','surface','foreground','muted','accent','border']);
  const maintenance=raw.maintenance_mode===true||raw.maintenance_mode?.enabled===true;
  return json({cms_available:true,industries:publicIndustries,services:publicServices,capabilities:publicCapabilities,ventures:publicVentures,projects:publicProjects,testimonials:publicTestimonials,navigation:publicNavigation,pages:publicPages,settings:{site_identity:identity,homepage_sections:visibility,seo_defaults:seo,contact,social_links:socialLinks,footer,business_profile:business,brand_tokens:brand,maintenance_mode:maintenance}});
 }catch{return json({cms_available:false,industries:[],services:[],capabilities:[],ventures:[],projects:[],testimonials:[],navigation:[],pages:[],settings:{}},200);}
}
