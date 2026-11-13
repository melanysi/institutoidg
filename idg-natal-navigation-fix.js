(()=>{'use strict';const ID='idg-christmas-page-v2';let globeTimer;function snowGlobe(overlay){if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const old=overlay.querySelector('.idg-snow-intro');if(old)old.remove();const intro=document.createElement('div');intro.className='idg-snow-intro';intro.setAttribute('role','status');intro.setAttribute('aria-label','Bem-vindo ao Natal Solidário do IDG');intro.innerHTML='<div class="idg-snow-globe" aria-hidden="true"><div class="idg-snow-sky"><span class="idg-snow-tree">🎄</span><span class="idg-snow-gifts">🎁</span><span class="idg-snow-flakes">❄ ✦ ❅ ✧ ❄ ✦ ❅</span></div><div class="idg-snow-base">IDG • 2026</div></div><h2>Bem-vindo ao Natal Solidário!</h2><p>Pequenos gestos, grandes sorrisos. 💜</p><button type="button" class="idg-snow-skip">Pular animação</button>';overlay.append(intro);const finish=()=>{clearTimeout(globeTimer);intro.classList.add('idg-snow-out');setTimeout(()=>intro.remove(),400)};intro.querySelector('button').addEventListener('click',finish);globeTimer=setTimeout(finish,3600)};async function loadApprovedCards(overlay){
 const grid=overlay.querySelector('#idg-christmas-grid');
 const disclaimer=overlay.querySelector('.idg-christmas-disclaimer');
 if(!grid)return;
 grid.replaceChildren();
 const loading=document.createElement('p');
 loading.className='idg-christmas-empty';
 loading.textContent='Consultando crianças validadas e apadrinhamentos…';
 grid.append(loading);
 const cfg=window.IDG_SUPABASE_CONFIG;
 if(!cfg?.url||!cfg?.publishableKey||!window.supabase){loading.textContent='Não foi possível conectar ao sistema. Atualize a página.';return}
 const make=(tag,content)=>{const node=document.createElement(tag);if(content!==undefined)node.textContent=content;return node};
 try{
  const db=window.supabase.createClient(cfg.url,cfg.publishableKey);
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user){loading.textContent='Entre com uma conta de parceiro aprovado para apadrinhar.';return}
  const [cardResult,statusResult]=await Promise.all([
   db.from('idg_natal_partner_cards').select('id_origem,nome_crianca,idade,roupa,calcado,genero,image_path').order('nome_crianca').range(0,999),
   db.rpc('idg_natal_card_sponsorship_status')
  ]);
  if(cardResult.error){loading.textContent='A lista não está disponível para esta conta.';return}
  if(statusResult.error){loading.textContent='Não foi possível confirmar a disponibilidade das crianças. Tente novamente.';return}
  const data=cardResult.data||[];
  const statusMap=new Map((statusResult.data||[]).map(item=>[item.child_id,item]));
  grid.replaceChildren();
  if(!data.length){grid.append(make('p','Nenhuma criança validada está disponível para esta conta.'));return}
  overlay.querySelector('.idg-christmas-info>p').textContent=data.length+' crianças validadas · apadrinhamento exclusivo para parceiros aprovados.';
  if(disclaimer)disclaimer.textContent='Cada criança pode ter um único apadrinhamento ativo. O Instituto confirma as entregas. Dados de responsáveis e contatos não são exibidos.';
  const summary=make('p');
  summary.className='idg-natal-availability-summary';
  const reserved=[...statusMap.values()].filter(v=>v.status==='reserved').length;
  const delivered=[...statusMap.values()].filter(v=>v.status==='delivered').length;
  summary.textContent='Disponíveis: '+(data.length-reserved-delivered)+' · Apadrinhadas: '+reserved+' · Entregues: '+delivered;
  grid.before(summary);
  const refresh=async()=>{summary.remove();await loadApprovedCards(overlay)};
  for(const child of data){
   const state=statusMap.get(child.id_origem);
   const card=make('article');card.className='idg-christmas-card';
   const art=make('div');art.className='idg-christmas-art';
   if(child.image_path?.startsWith('images/')){
    const img=make('img');img.src=child.image_path.split('/').map(encodeURIComponent).join('/');
    img.alt='Personagem ilustrativo';img.loading='lazy';
    img.addEventListener('error',()=>{art.replaceChildren(make('span','Personagem indisponível'))});
    art.append(img);
   }else art.append(make('span','Personagem em preparação'));
   const body=make('div');body.className='idg-christmas-cardbody';
   const tag=make('small','Natal Solidário 2026');
   const title=make('h3',child.nome_crianca);
   const age=make('p','Idade: '+child.idade);
   const sizes=make('div');sizes.className='idg-christmas-sizes';
   for(const [label,value] of [['Roupa',child.roupa],['Calçado',child.calcado]]){
    const box=make('div');box.append(make('small',label),make('strong',value));sizes.append(box);
   }
   const status=make('p');
   status.className='idg-natal-card-status';
   const action=make('button');
   action.type='button';action.className='idg-natal-sponsor-action';
   const feedback=make('p');feedback.className='idg-natal-card-feedback';feedback.setAttribute('role','status');
   if(state?.status==='delivered'){
    status.textContent='Presente entregue';action.textContent='Entrega concluída';action.disabled=true;
   }else if(state?.status==='reserved'){
    status.textContent=state.is_mine?'Você apadrinhou esta criança':'Criança já apadrinhada';
    if(state.is_mine&&state.sponsorship_id){
     action.textContent='Cancelar meu apadrinhamento';
     action.addEventListener('click',async()=>{
      if(!window.confirm('Deseja cancelar este apadrinhamento? A criança ficará disponível novamente.'))return;
      action.disabled=true;feedback.textContent='Cancelando…';
      const {error}=await db.rpc('idg_natal_cancel_my_reservation',{p_sponsorship_id:state.sponsorship_id});
      if(error){feedback.textContent=error.message;action.disabled=false;return}
      await refresh();
     });
    }else{action.textContent='Já apadrinhada';action.disabled=true}
   }else{
    status.textContent='Disponível para apadrinhamento';
    action.textContent='Quero apadrinhar';
    action.addEventListener('click',async()=>{
     if(!window.confirm('Confirma o apadrinhamento de '+child.nome_crianca+'? A reserva ficará vinculada à sua conta.'))return;
     action.disabled=true;feedback.textContent='Confirmando apadrinhamento…';
     const {error}=await db.rpc('idg_natal_reserve_child',{p_child_id:child.id_origem});
     if(error){feedback.textContent=error.message;action.disabled=false;return}
     await refresh();
    });
   }
   body.append(tag,title,age,sizes,status,action,feedback);
   card.append(art,body);grid.append(card);
  }
 }catch(_err){loading.textContent='Erro ao consultar o Natal Solidário. Atualize a página e tente novamente.'}
}
function show(addToHistory=false){const portal=document.getElementById('portal');if(!portal||portal.classList.contains('hidden'))return;let overlay=document.getElementById(ID);if(!overlay){overlay=document.createElement('div');overlay.id=ID;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Natal Solidário 2026');overlay.innerHTML='<div class="idg-christmas-wrap"><div class="idg-christmas-nav"><button type="button" id="idg-christmas-back">← Voltar ao painel</button><span>INSTITUTO DESAFIANDO GIGANTES</span></div><header class="idg-christmas-banner"><span class="idg-christmas-stars" aria-hidden="true">✦ ✧ ✦ ✧ ✦</span><p>UMA CAMPANHA PARA TRANSFORMAR VIDAS</p><h1>Natal Solidário <em>2026</em></h1><h2>Pequenos gestos, grandes sorrisos.</h2><p>Um gesto de carinho pode tornar o Natal de uma criança ainda mais especial.</p></header><section class="idg-christmas-info"><h2>Conheça as crianças</h2><p>Acompanhe os cadastros da campanha. As crianças serão exibidas aqui após a liberação dos registros oficiais.</p><div class="idg-christmas-grid" id="idg-christmas-grid"></div></section><p class="idg-christmas-disclaimer">Os cadastros oficiais ainda não foram disponibilizados. O apadrinhamento será habilitado após a ativação segura do sistema.</p><footer class="idg-christmas-copyright" style="padding:18px;text-align:center;font:12px/1.5 system-ui,sans-serif;color:#647067">© 2026 Melany Kauane Souza Inacio. Todos os direitos reservados.</footer></div>';document.body.append(overlay);const grid=overlay.querySelector('#idg-christmas-grid');const empty=document.createElement('p');empty.className='idg-christmas-empty';empty.textContent='Aguardando a importação e a liberação dos cadastros oficiais das crianças.';grid.append(empty);const catalog=window.IDG_NATAL_CHARACTERS?.items||[];if(catalog.length){const section=overlay.querySelector('.idg-christmas-info');const title=document.createElement('h3');title.className='idg-natal-catalog-title';title.textContent='Personagens disponíveis ('+catalog.length+')';const note=document.createElement('p');note.className='idg-natal-catalog-note';note.textContent='Prévia das ilustrações cadastradas. Estas imagens não representam crianças aprovadas nem apadrinhamentos disponíveis.';const gallery=document.createElement('div');gallery.className='idg-natal-catalog-preview';for(const item of catalog.slice(0,12)){const card=document.createElement('figure');card.className='idg-natal-catalog-item';const img=document.createElement('img');img.src=item.path;img.alt='Personagem '+item.name;img.loading='lazy';img.addEventListener('error',()=>{img.hidden=true;card.classList.add('idg-natal-image-error')});const cap=document.createElement('figcaption');cap.textContent=item.name;card.append(img,cap);gallery.append(card)}section.append(title,note,gallery)}overlay.querySelector('#idg-christmas-back').addEventListener('click',hide)}overlay.hidden=false;loadApprovedCards(overlay);if(location.hash!=='#idg-natal-demo'){const url=location.pathname+location.search+'#idg-natal-demo';if(addToHistory)history.pushState({idgNatalOverlay:true},'',url);else history.replaceState(history.state,'',url)}document.body.classList.add('idg-christmas-active');overlay.querySelector('#idg-christmas-back').focus();snowGlobe(overlay)}function hide(){clearTimeout(globeTimer);document.querySelector('.idg-snow-intro')?.remove();const el=document.getElementById(ID);if(el)el.hidden=true;document.body.classList.remove('idg-christmas-active');if(location.hash==='#idg-natal-demo'){if(history.state?.idgNatalOverlay)history.back();else history.replaceState(history.state,'',location.pathname+location.search+'#partner-overview')}document.querySelector('#portal .idg-partner-side a[href="#idg-natal-demo"]')?.focus()}document.addEventListener('click',e=>{const target=e.target.closest?.('a[href="#idg-natal-demo"],.idg-natal-go');if(!target)return;e.preventDefault();e.stopImmediatePropagation();show(true)},true);document.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});const portal=document.getElementById('portal');if(portal){const restore=()=>{if(portal.classList.contains('hidden'))return;if(location.hash==='#idg-natal-demo')show();else{const overlay=document.getElementById(ID);if(overlay&&!overlay.hidden)hide()}};new MutationObserver(()=>{if(portal.classList.contains('hidden')){const el=document.getElementById(ID);if(el)el.hidden=true;document.body.classList.remove('idg-christmas-active')}else restore()}).observe(portal,{attributes:true,attributeFilter:['class']});window.addEventListener('hashchange',restore);window.addEventListener('popstate',restore);restore()}})();