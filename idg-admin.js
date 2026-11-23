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
   const meta=document.createElement("div");meta.className="muted";meta.textContent=new Date(ev.starts_at).toLocaleString("pt-BR")+" · "+ev.status+(ev.is_published?" · Público":" · Não publicado")+(ev.capacity===null||ev.capacity===undefined?" · Sem limite de vagas":" · "+ev.capacity+" vaga(s)");
   text.append(title,meta);
   const edit=document.createElement("button");edit.type="button";edit.className="secondary";edit.textContent="Editar";
   edit.addEventListener("click",()=>{editing=ev.id;$("title").value=ev.title;$("starts").value=localValue(ev.starts_at);$("ends").value=localValue(ev.ends_at);$("place").value=ev.location_name||"";$("partners").value=(ev.partner_names||[]).join(", ");$("capacity").value=ev.capacity??"";$("status").value=ev.status;$("description").value=ev.description||"";$("published").checked=ev.is_published;$("form-heading").textContent="Editar ação";$("save").textContent="Atualizar ação";$("event-form").scrollIntoView({behavior:"smooth"})});
   const remove=document.createElement("button");remove.type="button";remove.className="danger";remove.textContent="Excluir";remove.addEventListener("click",async()=>{if(!confirm("Excluir definitivamente a ação '"+ev.title+"'? As fotos vinculadas ficarão sem ação."))return;remove.disabled=true;try{if(!await isAdmin())throw new Error("Sessão sem autorização.");const {data:deleted,error}=await client.from("idg_events").delete().eq("id",ev.id).select("id");if(error)throw error;if(!deleted?.some(row=>row.id===ev.id))throw new Error("A ação não foi excluída. Verifique as permissões e tente novamente.");await refresh();message("Ação excluída.");}catch(err){reportError(err)}finally{remove.disabled=false}});const controls=document.createElement("div");controls.className="actions";controls.append(edit,remove);item.append(text,controls);$("events").append(item);
 }
 if(!records.length)$("events").textContent="Nenhuma ação cadastrada ainda.";
 await refreshMedia();
}
let mediaRefresh = 0;

async function refreshMedia() {
 const request = ++mediaRefresh;
 const photos = [];
 const pageSize = 200;
 for (let start = 0; ; start += pageSize) {
  const { data, error } = await client.from("idg_media")
   .select("id,alt_text,caption,storage_path,event_id,is_published")
   .order("created_at", { ascending: false }).order("id")
   .range(start, start + pageSize - 1);
  if (error) throw error;
  if (request !== mediaRefresh) return;
  photos.push(...data);
  if (data.length < pageSize) break;
 }

 const items = document.createDocumentFragment();
 for (const photo of photos) items.append(mediaItem(photo));
 $("media-list").replaceChildren(photos.length ? items : "Nenhuma fotografia enviada.");
}

function mediaItem(photo) {
 const item = document.createElement("div");
 item.className = "item";
 const details = document.createElement("div");
 const title = document.createElement("strong");
 title.textContent = photo.alt_text;
 details.append(title);
 if (photo.caption) {
  const caption = document.createElement("div");
  caption.textContent = photo.caption;
  details.append(caption);
 }
 const state = document.createElement("div");
 state.className = "muted";
 state.textContent = photo.is_published ? "Publicada na página inicial" : "Rascunho privado";
 const action = records.find(event => event.id === photo.event_id);
 if (action) state.textContent += " · " + action.title;
 details.append(state);

 const controls = document.createElement("div");
 controls.className = "actions";
 const preview = mediaButton("Visualizar", async () => {
  const { data, error } = await client.storage.from("idg-media").createSignedUrl(photo.storage_path, 60);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
 }, "secondary");
 const toggle = mediaButton(photo.is_published ? "Retirar da página inicial" : "Publicar na página inicial", async () => {
  const nextState = !photo.is_published;
  const { data, error } = await client.from("idg_media").update({ is_published: nextState })
   .eq("id", photo.id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw Error("A fotografia não está disponível. Atualize o painel.");
  await refreshMedia();
  message(nextState ? "Fotografia publicada em Nossa comunidade em ação." : "Fotografia retirada da página inicial e mantida no ADM.");
 });
 const remove = mediaButton("Excluir", async () => {
  const { data, error } = await client.from("idg_media").delete().eq("id", photo.id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw Error("A fotografia não está disponível. Atualize o painel.");
  const { error: storageError } = await client.storage.from("idg-media").remove([photo.storage_path]);
  await refreshMedia();
  if (storageError) throw Error("O registro foi excluído. O arquivo privado não pôde ser removido.");
  message("Fotografia excluída.");
 }, "danger", () => confirm("Excluir definitivamente esta fotografia?"));
 controls.append(preview, toggle, remove);
 item.append(details, controls);
 return item;
}

function mediaButton(label, action, style = "", shouldRun = () => true) {
 const button = document.createElement("button");
 button.type = "button";
 button.className = style;
 button.textContent = label;
 button.addEventListener("click", async () => {
  if (!shouldRun()) return;
  button.disabled = true;
  try {
   if (!await isAdmin()) throw Error("Sessão sem autorização.");
   await action();
  } catch (error) {
   reportError(error);
  } finally {
   button.disabled = false;
  }
 });
 return button;
}
async function initialize(){
 if(!client){message("Configuração do Supabase não encontrada.",true);return}
 try{if(recovering)return;const allowed=await isAdmin();setAccess(allowed);if(allowed){await refresh();message("Acesso administrativo autorizado.")}else message("Entre com uma conta administrativa ativa.");}catch(e){setAccess(false);reportError(e)}
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
 const capacityInput=$("capacity").value.trim();const capacity=capacityInput===""?null:Number(capacityInput);if(capacity!==null&&(!Number.isSafeInteger(capacity)||capacity<0))throw new Error("Informe um número inteiro de vagas igual ou superior a zero.");
 const payload={capacity,title:$("title").value.trim(),description:$("description").value.trim(),starts_at:start.toISOString(),ends_at:end?.toISOString()||null,location_name:$("place").value.trim(),partner_names:$("partners").value.split(",").map(s=>s.trim()).filter(Boolean),status:$("status").value,is_published:$("published").checked,updated_at:new Date().toISOString()};
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
 const altText = $("alt").value.trim();
 if (!altText) throw Error("Informe uma descrição acessível da imagem.");
 const {data:{user},error:userError}=await client.auth.getUser();
 if (userError || !user) throw Error("Sessão sem autorização.");
 const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type];
 const path="photos/"+crypto.randomUUID()+"."+ext;
 const {error:uploadError}=await client.storage.from("idg-media").upload(path,file,{contentType:file.type,cacheControl:"0",upsert:false});
 if(uploadError)throw uploadError;
 const {error}=await client.from("idg_media").insert({storage_path:path,event_id:$("media-event").value||null,alt_text:altText,caption:$("caption").value.trim(),uploaded_by:user.id,is_published:false});
 if(error){await client.storage.from("idg-media").remove([path]);throw error}
 e.target.reset();await refreshMedia();message("Fotografia salva como rascunho privado.");
 }catch(err){reportError(err)}finally{button.disabled=false}
});

let recovering=false;
const showRecovery=active=>{
 recovering=active;
 $("login-form").classList.toggle("hidden",active);
 $("forgot-password").classList.toggle("hidden",active);
 $("reset-request-form").classList.add("hidden");
 $("new-password-form").classList.toggle("hidden",!active);
 $("dashboard").classList.add("hidden");
 $("logout").classList.add("hidden");
};
$("forgot-password").addEventListener("click",()=>{
 $("reset-request-form").classList.remove("hidden");
 $("recovery-email").value=$("email").value.trim();
});
$("cancel-reset").addEventListener("click",()=>{$("reset-request-form").classList.add("hidden")});
$("reset-request-form").addEventListener("submit",async e=>{
 e.preventDefault();const button=e.target.querySelector('button[type="submit"]');button.disabled=true;
 try{
  if(!client)throw new Error("Supabase indisponível.");
  const redirectTo=new URL("admin.html",window.location.href).href;
  const {error}=await client.auth.resetPasswordForEmail($("recovery-email").value.trim(),{redirectTo});
  if(error)throw error;
  $("reset-request-form").classList.add("hidden");
  message("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
 }catch(err){reportError(err)}finally{button.disabled=false}
});
$("new-password-form").addEventListener("submit",async e=>{
 e.preventDefault();const button=e.target.querySelector("button");button.disabled=true;
 try{
  const password=$("new-password").value;
  if(password.length<12||password!==$("confirm-password").value)throw new Error("As senhas devem coincidir e ter ao menos 12 caracteres.");
  const {error}=await client.auth.updateUser({password});if(error)throw error;
  await client.auth.signOut();
  e.target.reset();showRecovery(false);setAccess(false);
  history.replaceState(null,"",window.location.pathname);
  message("Senha alterada. Entre novamente com sua nova senha.");
 }catch(err){reportError(err)}finally{button.disabled=false}
});
if(client)client.auth.onAuthStateChange((event)=>{
 if(event==="PASSWORD_RECOVERY"){showRecovery(true);message("Defina sua nova senha para concluir a recuperação.");}
});

initialize();
})();