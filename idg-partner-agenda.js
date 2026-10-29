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
 if(error){return}
 const events=(data||[]).filter(ev=>ev.title&&ev.starts_at&&ev.status!=="draft");
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
  const isPink=date.toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"})==="2026-10-31"&&/outubro rosa/i.test(ev.title||"");
  if(isPink){item.classList.add("idg-agenda-pink");const intro=add("p","idg-agenda-pink-intro","🎀 Um encontro de conscientização, acolhimento e valorização da mulher.");const heading=add("strong","idg-agenda-pink-heading","Nossa programação");const list=add("ul","idg-agenda-pink-program");for(const activity of ["🧘‍♀️ Pilates relaxante","🎤 Empreendedorismo feminino","💗 Relatos sobre o câncer de mama","☕ Coffee break","💆‍♀️ Autocuidado e atendimentos durante o evento"]){list.append(add("li",null,activity))}info.append(intro,heading,list)}else if(ev.description)info.append(add("small",null,ev.description));
  item.append(box,info);entries.append(item);
 }
}
const style=document.createElement("style");style.textContent='.idg-agenda-entry .idg-agenda-detail{min-width:0;overflow-wrap:anywhere}.idg-agenda-pink{border-color:#e6c9df!important;background:#fff8fc!important}.idg-agenda-pink-intro{line-height:1.5;margin:10px 0!important}.idg-agenda-pink-heading{display:block;margin:12px 0 8px;color:#633a7a}.idg-agenda-pink-program{list-style:none;padding:0;margin:0;display:grid;gap:7px}.idg-agenda-pink-program li{padding:9px 10px;background:white;border:1px solid #f0ddec;border-radius:10px;line-height:1.4;font-size:.92rem}@media(max-width:520px){.idg-agenda-pink{gap:10px!important}.idg-agenda-pink .idg-agenda-date{min-width:0!important}.idg-agenda-pink-program li{font-size:.85rem}}';document.head.append(style);load().catch(()=>{});
})();