const json=(body,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});
export async function onRequestGet({env}) {
  const url=String(env.SUPABASE_URL||'').replace(/\/$/,'');
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) return json({industries:[],services:[],ventures:[],settings:{}});
  const headers={apikey:key,authorization:'Bearer '+key,accept:'application/json'};
  const get=async path=>{
    const response=await fetch(url+'/rest/v1/'+path,{headers});
    if(!response.ok) throw new Error('Public content unavailable');
    return response.json();
  };
  try {
    const [industries,services,ventures,settings]=await Promise.all([
      get('admin_content?select=id,title,slug,summary,sort_order,data&resource=eq.industries&status=eq.published&order=sort_order.asc'),
      get('admin_content?select=id,title,slug,summary,sort_order,data&resource=eq.services&status=eq.published&order=sort_order.asc'),
      get('admin_content?select=id,title,slug,summary,sort_order,data&resource=eq.ventures&status=eq.published&order=sort_order.asc'),
      get('admin_site_settings?select=key,value&key=in.(site_identity,homepage_sections,seo_defaults)')
    ]);
    return json({
      industries:(industries||[]).map(({id,title,slug,summary,sort_order,data})=>({id,title,slug,summary,sort_order,data})),
      services:(services||[]).map(({id,title,slug,summary,sort_order,data})=>({id,title,slug,summary,sort_order,data})),
      ventures:(ventures||[]).map(({id,title,slug,summary,sort_order,data})=>({id,title,slug,summary,sort_order,data})),
      settings:Object.fromEntries((settings||[]).map(item=>[item.key,item.value]))
    });
  } catch {
    return json({industries:[],services:[],ventures:[],settings:{}},200);
  }
}
