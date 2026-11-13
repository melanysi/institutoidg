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
 const list=records.filter(r=>[r.child_name,r.child_id].some(x=>String(x||'').toLocaleLowerCase('pt-BR').includes(term)));
 for(const record of list){
  const section=el('article');section.className='item';
  section.append(el('h3',record.child_name||'Cadastro aguardando conferência'));
  const info=el('p','Doador: Correios · Presentes recebidos pelo Instituto');
  const registration=el('p',record.registration_status==='validado'?'Cadastro validado':'Cadastro pendente de conferência');
  const prep=el('p','Separação: '+(record.preparation_status==='pronto'?'Pronto para entregar':'Em separação'));
  const delivery=el('p',record.child_delivery_status==='entregue'?'Entregue à criança':'Entrega à criança pendente');
  section.append(info,registration,prep,delivery);
  if(record.delivered_to_child_at)section.append(el('p','Entrega registrada em '+new Date(record.delivered_to_child_at).toLocaleString('pt-BR')));
  const actions=el('div');actions.className='actions';
  const prepare=el('button',record.preparation_status==='pronto'?'Voltar para separação':'Marcar como separado');
  prepare.className='secondary';
  const deliver=el('button',record.child_delivery_status==='entregue'?'Entrega registrada':'Confirmar entrega à criança');
  deliver.disabled=record.child_delivery_status==='entregue'||record.registration_status!=='validado';
  async function change(preparation,deliveryStatus){
   if(deliveryStatus==='entregue'&&!confirm('Confirma que o presente de '+record.child_name+' já foi entregue à criança?'))return;
   prepare.disabled=deliver.disabled=true;notice('Salvando registro…');
   const {error}=await db.rpc('idg_natal_update_distribution',{p_child_id:record.child_id,p_preparation_status:preparation,p_child_delivery_status:deliveryStatus});
   if(error){notice('Não foi possível salvar: '+error.message,true);prepare.disabled=false;deliver.disabled=false;return}
   await reload();
  }
  prepare.addEventListener('click',()=>change(record.preparation_status==='pronto'?'separando':'pronto',null));
  deliver.addEventListener('click',()=>change('pronto','entregue'));
  actions.append(prepare,deliver);section.append(actions);root.append(section);
 }
 if(!list.length)root.append(el('p','Nenhuma criança encontrada.'));
}
async function reload(){
 const {data,error}=await db.rpc('idg_natal_distribution_overview');
 if(error){notice('Acesso não autorizado ou erro: '+error.message,true);$('dashboard').hidden=true;return}
 records=data||[];$('dashboard').hidden=false;$('login-box').hidden=true;$('logout').hidden=false;
 const metrics=$('metrics');metrics.replaceChildren();
 for(const [name,count] of [['Presentes recebidos',records.length],['Separados',records.filter(r=>r.preparation_status==='pronto').length],['Entregues às crianças',records.filter(r=>r.child_delivery_status==='entregue').length]]){
  const box=el('div');box.className='metric';box.append(el('small',name),el('strong',String(count)));metrics.append(box);
 }
 render();notice('Controle atualizado. Apadrinhamentos encerrados: doação dos Correios.');
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
$('reload').addEventListener('click',reload);$('search').addEventListener('input',render);refresh();
})();