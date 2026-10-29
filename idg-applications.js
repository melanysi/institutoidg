(() => {
"use strict";
const $ = id => document.getElementById(id);
const cfg = window.IDG_SUPABASE_CONFIG;
const client = cfg?.url && cfg?.publishableKey && window.supabase ? window.supabase.createClient(cfg.url,cfg.publishableKey) : null;
const types = {volunteer:"Voluntariado",beneficiary:"Pedido de apoio",course:"Curso",sponsor:"Parceria / patrocínio",donation:"Doação"};
const states = {pending:"Pendente",reviewing:"Em análise",approved:"Aprovado",rejected:"Não aprovado",completed:"Concluído"};
const fields = {date_of_birth:"Data de nascimento",neighborhood:"Bairro ou região",course_name:"Curso desejado",availability:"Disponibilidade",interests:"Áreas de interesse",skills:"Habilidades",motivation:"Motivação",support_type:"Tipo de apoio",involves_minor:"Envolve menor de idade",minor_first_name:"Primeiro nome",minor_age_range:"Faixa etária",message:"Mensagem",organization:"Organização",cnpj:"CNPJ",donation_type:"Tipo de doação",quantity:"Quantidade",description:"Descrição"};
let entries=[];
function notify(msg,error=false){const el=$("applications-message");el.textContent=msg;el.className=error?"error":"muted"}
async function authorized(){
 if(!client) return false;
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)return false;
 const {data,error:e}=await client.from("profiles").select("role,status").eq("id",user.id).maybeSingle();
 if(e)throw e;
 return data?.role==="admin"&&data?.status==="active";
}
function element(tag,txt,cls){const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;if(cls)n.className=cls;return n}
function render(){
 const root=$("applications-list");root.replaceChildren();
 const type=$("applications-type").value,state=$("applications-status").value,term=$("applications-search").value.trim().toLocaleLowerCase("pt-BR");
 const visible=entries.filter(a=>(!type||a.application_type===type)&&(!state||a.status===state)&&(!term||[a.full_name,a.email,a.phone,types[a.application_type],JSON.stringify(a.details)].join(" ").toLocaleLowerCase("pt-BR").includes(term)));
 $("applications-count").textContent=visible.length+" de "+entries.length+" inscrição(ões)";
 if(!visible.length){root.append(element("p","Nenhuma inscrição encontrada para estes filtros.","muted"));return}
 for(const a of visible){
  const article=element("article",undefined,"application-card");
  const head=element("div",undefined,"application-head");
  const info=element("div");
  info.append(element("strong",a.full_name),element("div",(types[a.application_type]||a.application_type)+" · "+new Date(a.created_at).toLocaleString("pt-BR"),"muted"),element("div","Status: "+(states[a.status]||a.status),"muted"));
  const details=document.createElement("details");details.append(element("summary","Ver respostas e contato"));
  const contact=element("div",undefined,"application-details");
  for(const [label,value] of [["E-mail",a.email],["Telefone",a.phone],...Object.entries(a.details||{}).map(([k,v])=>[fields[k]||k,typeof v==="string"?v:JSON.stringify(v)])]){
   const p=element("p");p.append(element("strong",label+": "),document.createTextNode(value||"—"));contact.append(p);
  }
  details.append(contact);
  const controls=element("div",undefined,"application-controls");
  const select=document.createElement("select");select.setAttribute("aria-label","Status de "+a.full_name);
  for(const [key,label] of Object.entries(states))select.add(new Option(label,key));
  select.value=a.status;
  const statusButton=element("button","Salvar status");statusButton.type="button";
  statusButton.addEventListener("click",()=>save(a,{status:select.value},statusButton));
  const notesLabel=element("label","Anotações internas — "+a.full_name);
  const notes=document.createElement("textarea");notes.maxLength=3000;notes.value=a.internal_notes||"";notes.rows=3;
  const notesButton=element("button","Salvar anotação","secondary");notesButton.type="button";
  notesButton.addEventListener("click",()=>save(a,{internal_notes:notes.value},notesButton));
  const deleteButton=element("button","Excluir cadastro","danger");deleteButton.type="button";deleteButton.addEventListener("click",async()=>{if(!await authorized()){notify("Acesso não autorizado.",true);return}const confirmText=prompt("Excluir definitivamente a inscrição de "+a.full_name+"? Digite EXCLUIR para confirmar.");if(confirmText!=="EXCLUIR")return;deleteButton.disabled=true;try{const {data,error}=await client.functions.invoke("admin-delete-application",{body:{application_id:a.id}});if(error)throw error;if(data?.success!==true)throw Error(data?.message||"Exclusão não confirmada.");entries=entries.filter(item=>item.id!==a.id);render();notify("Cadastro excluído com sucesso.")}catch(e){notify("Não foi possível excluir: "+(e.message||"função administrativa indisponível."),true)}finally{deleteButton.disabled=false}});controls.append(select,statusButton,deleteButton);
  article.append(head,details,controls,notesLabel,notes,notesButton);
  head.append(info);
  root.append(article);
 }
}
async function save(a,changes,button){
 button.disabled=true;
 try{
  if(!await authorized())throw Error("Acesso administrativo não autorizado.");
  const {data,error}=await client.from("applications").update(changes).eq("id",a.id).select("id,status,internal_notes").single();
  if(error)throw error;
  Object.assign(a,data);notify("Alteração salva com sucesso.");render();
 }catch(e){notify(e.message||"Não foi possível salvar.",true)}finally{button.disabled=false}
}
async function load(){
 if(!await authorized()){ $("applications-panel").hidden=true;return }
 $("applications-panel").hidden=false;
 const {data,error}=await client.from("applications").select("id,application_type,full_name,email,phone,details,status,internal_notes,created_at").order("created_at",{ascending:false}).limit(500);
 if(error)throw error;
 entries=data||[];render();notify("Inscrições atualizadas.");
}
async function reload(){try{await load()}catch(e){notify(e.message||"Erro ao carregar inscrições.",true)}}
for(const id of ["applications-type","applications-status","applications-search"])$(id).addEventListener(id==="applications-search"?"input":"change",render);
$("applications-reload").addEventListener("click",reload);
if(client)client.auth.onAuthStateChange(()=>{setTimeout(reload,0)});
reload();
})();