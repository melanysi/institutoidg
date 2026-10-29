(()=>{"use strict";
const root=document.getElementById("idg-static-agenda");
if(!root)return;
const cfg=window.IDG_SUPABASE_CONFIG;
if(!cfg?.url||!cfg?.publishableKey||!window.supabase)return;
const client=window.supabase.createClient(cfg.url,cfg.publishableKey);
const fmt=new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
const escStatus={planned:"Planejada",confirmed:"Confirmada",completed:"Realizada",cancelled:"Cancelada",draft:"Rascunho"};
const entries=document.createElement("div");entries.id="idg-agenda-live";entries.setAttribute("aria-live","polite");
const initial=root.querySelector(".idg-agenda-entry");initial?.after(entries);
const add=(tag,cls,value)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(value!=null)el.textContent=value;return el};
async function load(){
 const {data,error}=await client.from("idg_events").select("title,description,starts_at,location_name,status").eq("is_published",true).order("starts_at",{ascending:true}).limit(50);
 if(error){console.warn("Agenda IDG indisponível; mantendo informações provisórias.");return}
 const events=(data||[]).filter(ev=>ev.title&&ev.starts_at&&["planned","confirmed","completed","cancelled"].includes(ev.status)).sort((a,b)=>{const now=Date.now(),ta=new Date(a.starts_at).getTime(),tb=new Date(b.starts_at).getTime();const group=t=>t>=now?0:1;return group(ta)-group(tb)||(group(ta)===0?ta-tb:tb-ta)}).slice(0,12);
 if(!events.length)return;
 initial?.remove();root.querySelector(".idg-agenda-footnote")?.remove();
 const intro=root.querySelector(".muted");if(intro)intro.textContent="Atividades publicadas pela equipe do Instituto.";
 entries.replaceChildren();
 for(const ev of events){
  const item=add("article","idg-agenda-entry");
  const date=new Date(ev.starts_at);
  const parts=new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"short",year:"numeric"}).formatToParts(date);
  const val=t=>parts.find(p=>p.type===t)?.value||"";
  const box=add("div","idg-agenda-date");
  box.append(add("strong",null,val("day")),add("span",null,val("month").replace(".","").toUpperCase()),add("span",null,val("year")));
  const info=add("div","idg-agenda-detail");
  const status=escStatus[ev.status]||"Informação publicada";
  info.append(add("span","idg-agenda-tag",status),add("h3",null,ev.title),add("p",null,fmt.format(date)+(ev.location_name?" · "+ev.location_name:"")));
  if(ev.description)info.append(add("small",null,ev.description));if(ev.status==="planned")info.append(add("small",null,"Data planejada; confirme a programação com o Instituto."));if(ev.status==="cancelled")info.append(add("small",null,"Atividade cancelada pela equipe."));
  item.append(box,info);entries.append(item);
 }
}
load().catch(()=>{});
})();