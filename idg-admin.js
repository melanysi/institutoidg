(() => {
"use strict";
const cfg=window.IDG_SUPABASE_CONFIG;
const $=id=>document.getElementById(id);
const client=cfg?.url&&cfg?.publishableKey&&window.supabase?window.supabase.createClient(cfg.url,cfg.publishableKey):null;
let records=[],editing=null;
const message=(text,error=false)=>{$("message").textContent=text;$("message").className=error?"error":"ok"};
const reportError=e=>message(e?.message||"Não foi possível concluir a operação.",true);
const isAdmin=async()=>{
 const {data:{user},error}=await client.auth.getUser();if(error||!user)return false;
 const {data,error:profileError}=await client.from("profiles").select("role,status").eq("id",user.id).maybeSingle();
 if(profileError)throw profileError;
 return data?.role==="admin"&&data?.status==="active";
};
const setAccess=allowed=>{
 $("dashboard").classList.toggle("hidden",!allowed);
 $("login-panel").classList.toggle("hidden",allowed);
 $("logout").classList.toggle("hidden",!allowed);
};
const localValue=iso=>{if(!iso)return "";const d=new Date(iso);const p=n=>String(n).padStart(2,"0");return [d.getFullYear(),p(d.getMonth()+1),p(d.getDate())].join("-")+"T"+p(d.getHours())+":"+p(d.getMinutes())};
const reset=()=>{editing=null;$("event-form").reset();$("form-heading").textContent="Cadastrar ação";$("save").textContent="Salvar ação"};
async function refresh(){
 const {data,error}=await client.from("idg_events").select("*").order("starts_at",{ascending:false}).limit(200);
 if(error)throw error;
 records=data||[];
 $("events").replaceChildren();
 $("media-event").replaceChildren(new Option("Sem ação vinculada",""));
 for(const ev of records){
   $("media-event").add(new Option(ev.title,ev.id));
   const item=document.createElement("div");item.className="item";
   const text=document.createElement("div");const title=document.createElement("strong");title.textContent=ev.title;
   const meta=document.createElement("div");meta.className="muted";meta.textContent=new Date(ev.starts_at).toLocaleString("pt-BR")+" · "+ev.status+(ev.is_published?" · Público":" · Não publicado");
   text.append(title,meta);
   const edit=document.createElement("button");edit.type="button";edit.className="secondary";edit.textContent="Editar";
   edit.addEventListener("click",()=>{editing=ev.id;$("title").value=ev.title;$("starts").value=localValue(ev.starts_at);$("ends").value=localValue(ev.ends_at);$("place").value=ev.location_name||"";$("partners").value=(ev.partner_names||[]).join(", ");$("status").value=ev.status;$("description").value=ev.description||"";$("published").checked=ev.is_published;$("form-heading").textContent="Editar ação";$("save").textContent="Atualizar ação";$("event-form").scrollIntoView({behavior:"smooth"})});
   const remove=document.createElement("button");remove.type="button";remove.className="danger";remove.textContent="Excluir";remove.addEventListener("click",async()=>{if(!confirm("Excluir definitivamente a ação '"+ev.title+"'? As fotos vinculadas ficarão sem ação."))return;remove.disabled=true;try{if(!await isAdmin())throw new Error("Sessão sem autorização.");const {error}=await client.from("idg_events").delete().eq("id",ev.id);if(error)throw error;await refresh();message("Ação excluída.");}catch(err){reportError(err)}finally{remove.disabled=false}});const controls=document.createElement("div");controls.className="actions";controls.append(edit,remove);item.append(text,controls);$("events").append(item);
 }
 if(!records.length)$("events").textContent="Nenhuma ação cadastrada ainda.";
 await refreshMedia();
}
async function refreshMedia(){
 const {data,error}=await client.from("idg_media").select("id,alt_text,caption,storage_path,event_id,created_at").order("created_at",{ascending:false}).limit(100);
 if(error)throw error;
 $("media-list").replaceChildren();
 for(const media of data||[]){
  const item=document.createElement("div");item.className="item";
  const details=document.createElement("div");const title=document.createElement("strong");title.textContent=media.alt_text;
  const meta=document.createElement("div");meta.className="muted";meta.textContent=media.caption||media.storage_path;
  details.append(title,meta);
  const preview=document.createElement("button");preview.type="button";preview.className="secondary";preview.textContent="Visualizar";
  preview.addEventListener("click",async()=>{const {data,error}=await client.storage.from("idg-media").createSignedUrl(media.storage_path,60);if(error)return reportError(error);window.open(data.signedUrl,"_blank","noopener,noreferrer")});
  const remove=document.createElement("button");remove.type="button";remove.className="danger";remove.textContent="Excluir";remove.addEventListener("click",async()=>{if(!confirm("Excluir definitivamente esta fotografia?"))return;remove.disabled=true;try{if(!await isAdmin())throw new Error("Sessão sem autorização.");const {error:storageError}=await client.storage.from("idg-media").remove([media.storage_path]);if(storageError)throw storageError;const {error}=await client.from("idg_media").delete().eq("id",media.id);if(error)throw error;await refreshMedia();message("Fotografia excluída.");}catch(err){reportError(err)}finally{remove.disabled=false}});const controls=document.createElement("div");controls.className="actions";controls.append(preview,remove);item.append(details,controls);$("media-list").append(item);
 }
 if(!data?.length)$("media-list").textContent="Nenhuma fotografia enviada.";
}
async function initialize(){
 if(!client){message("Configuração do Supabase não encontrada.",true);return}
 try{const allowed=await isAdmin();setAccess(allowed);if(allowed){await refresh();message("Acesso administrativo autorizado.")}else message("Entre com uma conta administrativa ativa.");}catch(e){setAccess(false);reportError(e)}
}
$("login-form").addEventListener("submit",async e=>{
 e.preventDefault();if(!client)return;
 const button=e.target.querySelector("button");button.disabled=true;
 try{const {error}=await client.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(error)throw error;
 if(!await isAdmin()){await client.auth.signOut();throw new Error("Esta conta não possui permissão administrativa ativa.")}
 $("password").value="";setAccess(true);await refresh();message("Login realizado.");
 }catch(err){reportError(err)}finally{button.disabled=false}
});
$("logout").addEventListener("click",async()=>{await client?.auth.signOut();setAccess(false);reset();message("Sessão encerrada.")});
$("clear").addEventListener("click",reset);
$("event-form").addEventListener("submit",async e=>{
 e.preventDefault();const button=$("save");button.disabled=true;
 try{
 if(!await isAdmin())throw new Error("Sessão sem autorização.");
 const start=new Date($("starts").value),end=$("ends").value?new Date($("ends").value):null;
 if(!Number.isFinite(start.getTime())||(end&&end<start))throw new Error("Confira as datas da ação.");
 const payload={title:$("title").value.trim(),description:$("description").value.trim(),starts_at:start.toISOString(),ends_at:end?.toISOString()||null,location_name:$("place").value.trim(),partner_names:$("partners").value.split(",").map(s=>s.trim()).filter(Boolean),status:$("status").value,is_published:$("published").checked,updated_at:new Date().toISOString()};
 const query=editing?client.from("idg_events").update(payload).eq("id",editing):client.from("idg_events").insert(payload);
 const {error}=await query;if(error)throw error;
 reset();await refresh();message("Ação salva com sucesso.");
 }catch(err){reportError(err)}finally{button.disabled=false}
});
$("media-form").addEventListener("submit",async e=>{
 e.preventDefault();const button=e.target.querySelector("button");button.disabled=true;
 try{
 if(!await isAdmin())throw new Error("Sessão sem autorização.");
 const file=$("file").files[0];if(!file)throw new Error("Selecione uma imagem.");
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>10*1024*1024)throw new Error("Use JPG, PNG ou WebP com até 10 MB.");
 const {data:{user}}=await client.auth.getUser();
 const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type];
 const path=user.id+"/"+crypto.randomUUID()+"."+ext;
 const {error:uploadError}=await client.storage.from("idg-media").upload(path,file,{contentType:file.type,upsert:false});
 if(uploadError)throw uploadError;
 const {error}=await client.from("idg_media").insert({storage_path:path,event_id:$("media-event").value||null,alt_text:$("alt").value.trim(),caption:$("caption").value.trim(),uploaded_by:user.id});
 if(error){await client.storage.from("idg-media").remove([path]);throw error}
 e.target.reset();await refreshMedia();message("Imagem armazenada de forma privada.");
 }catch(err){reportError(err)}finally{button.disabled=false}
});
initialize();
})();