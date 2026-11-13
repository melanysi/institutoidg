(()=>{'use strict';
const $=id=>document.getElementById(id),cfg=window.IDG_SUPABASE_CONFIG;
if(!window.supabase||!cfg?.url||!cfg?.publishableKey){$('notice').textContent='Configuração do banco indisponível.';return}
const db=window.supabase.createClient(cfg.url,cfg.publishableKey);
const el=(tag,text)=>{const a=document.createElement(tag);if(text!==undefined)a.textContent=text;return a};
let records=[];
function notice(text,isError=false){$('notice').textContent=text;$('notice').style.color=isError?'#a93036':'#385c45'}
function render(){
 const root=$('sponsorship-list');root.replaceChildren();
 const term=$('search').value.trim().toLocaleLowerCase('pt-BR');
 const list=records.filter(r=>[r.child_name,r.sponsor_name,r.sponsor_email].some(x=>String(x||'').toLocaleLowerCase('pt-BR').includes(term)));
 for(const record of list){
  const section=el('article');section.className='item';
  section.append(el('h3',record.child_name),el('p','Padrinho: '+record.sponsor_name),
   el('p','Contato do parceiro: '+(record.sponsor_email||'Não informado')),
   el('p','Reservado em: '+new Date(record.reserved_at).toLocaleString('pt-BR')),
   el('p',record.status==='delivered'?'Presente entregue':'Aguardando entrega'));
  if(record.status==='reserved'){
   const actions=el('div');actions.className='actions';
   const deliver=el('button','Confirmar entrega');
   const cancel=el('button','Cancelar reserva');cancel.className='secondary';
   const perform=async(action)=>{
    if(!confirm(action==='delivered'?'Confirmar que o presente foi entregue?':'Cancelar este apadrinhamento e liberar a criança?'))return;
    deliver.disabled=cancel.disabled=true;notice('Atualizando…');
    const {error}=await db.rpc('idg_natal_manage_sponsorship',{p_id:record.sponsorship_id,p_action:action});
    if(error){notice(error.message,true);deliver.disabled=cancel.disabled=false;return}
    await reload();
   };
   deliver.addEventListener('click',()=>perform('delivered'));
   cancel.addEventListener('click',()=>perform('cancelled'));
   actions.append(deliver,cancel);section.append(actions);
  }
  root.append(section);
 }
 if(!list.length)root.append(el('p','Nenhum apadrinhamento encontrado.'));
}
async function reload(){
 const {data,error}=await db.rpc('idg_natal_staff_sponsorships');
 if(error){notice('Acesso não autorizado ou erro ao carregar a gestão: '+error.message,true);$('dashboard').hidden=true;return}
 records=data||[];$('dashboard').hidden=false;$('login-box').hidden=true;$('logout').hidden=false;
 const metrics=$('metrics');metrics.replaceChildren();
 for(const [name,count] of [['Apadrinhadas',records.filter(r=>r.status==='reserved').length],['Entregues',records.filter(r=>r.status==='delivered').length],['Total de reservas ativas',records.length]]){
  const box=el('div');box.className='metric';box.append(el('small',name),el('strong',String(count)));metrics.append(box);
 }
 render();notice('Dados atualizados.');
}
async function refresh(){
 const {data:{user}}=await db.auth.getUser();
 if(!user){$('login-box').hidden=false;$('dashboard').hidden=true;$('logout').hidden=true;return}
 await reload();
}
$('login-form').addEventListener('submit',async e=>{
 e.preventDefault();const b=e.submitter;b.disabled=true;
 const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
 b.disabled=false;if(error){notice('Não foi possível entrar: '+error.message,true);return}await refresh();
});
$('logout').addEventListener('click',async()=>{await db.auth.signOut();records=[];$('login-box').hidden=false;$('dashboard').hidden=true;$('logout').hidden=true;notice('Sessão encerrada.')});
$('reload').addEventListener('click',reload);$('search').addEventListener('input',render);
refresh();
})();