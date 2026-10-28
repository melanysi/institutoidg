(()=>{"use strict";const portal=document.getElementById("portal");if(!portal)return;const content=portal.querySelector(".idg-partner-content");if(!content)return;
const mk=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e};
const metrics=document.getElementById("metrics");const intro=mk("p","muted","Indicadores de inscrições recebidas, não matrículas confirmadas.");intro.id="idg-partner-count-note";metrics.before(intro);
const overview=mk("div","idg-partner-dashboard-grid");overview.id="partner-community";
const partners=mk("section","idg-partner-info-panel");partners.id="partner-organizations";partners.append(mk("h3",null,"Organizações parceiras"),mk("p",null,"Organizações vinculadas à rede de apoio do Instituto. Esta lista não representa um histórico individual de doações ou valores."));const names=["Coterleste","Company Academia","Motoclube das Loucas","Padaria Romano","PJC Mecânica","Unio Medical","Casa Rosada","CPS — Centro Paula Souza"];const partnerList=mk("div","idg-partner-directory");const symbols={"Coterleste":"🤝","Company Academia":"💪","Motoclube das Loucas":"🏍️","Padaria Romano":"🥖","PJC Mecânica":"🔧","Unio Medical":"🩺","Casa Rosada":"🏠","CPS — Centro Paula Souza":"🎓"};for(const name of names){const item=mk("div","idg-partner-directory-item");const mark=mk("span","idg-partner-directory-mark",symbols[name]||"🤝");mark.setAttribute("aria-hidden","true");item.append(mark,mk("span","idg-partner-directory-name",name));partnerList.append(item)}partners.append(partnerList,mk("p","idg-partner-directory-note","Contribuições e resultados específicos serão identificados somente quando houver registros publicados pela equipe."));
const schedule=mk("section","idg-partner-info-panel");schedule.id="partner-activities";schedule.append(mk("h3",null,"Agenda e atividades"));const startDate=new Date("2026-11-03T19:30:00-03:00");const upcoming=Date.now()<startDate.getTime();schedule.append(mk("p",null,upcoming?"Curso de Trancista — início previsto para 03/11/2026, às 19h30. Consulte o Instituto para confirmar eventuais alterações.":"Curso de Trancista — início previsto para 03/11/2026, às 19h30. A data prevista já passou; consulte o Instituto para confirmar a situação atual."),mk("p",null,"Outras atividades serão exibidas após publicação e confirmação pela equipe."));
partners.setAttribute("aria-label","Organizações parceiras do Instituto");schedule.setAttribute("aria-label","Agenda e atividades previstas");if(!document.getElementById("idg-static-partner-directory"))overview.append(partners);if(!document.getElementById("idg-static-agenda"))overview.append(schedule);const projectsTitle=document.getElementById("partner-projects");const reportsTitle=document.getElementById("partner-reports");if(projectsTitle){projectsTitle.before(overview);const sectionHeading=mk("h2",null,"Rede de apoio e agenda");sectionHeading.id="partner-network";overview.before(sectionHeading)}else document.getElementById("project-updates")?.before(overview);
// Institutional descriptions only: these are not measured outcomes or published reports.
const projectsRoot=document.getElementById("project-updates");
if(projectsRoot&&!document.getElementById("idg-project-catalogue")){
 const catalogue=mk("section","idg-project-catalogue");
 catalogue.id="idg-project-catalogue";
 catalogue.append(mk("h3",null,"Conheça nossas frentes de atuação"),mk("p","muted","Apresentação institucional das iniciativas do IDG. Resultados, números e evidências aparecem separadamente, quando publicados pela equipe."));
 const projects=[
  ["Educação e qualificação profissional","Cursos profissionalizantes gratuitos","Formações em áreas como Trancista, Manicure, Cuidador de Idosos, Cuidador Infantil, Recepção e Atendimento, Portaria e Controle de Acesso e Panificação.","Formação e oportunidades"],
  ["Ações comunitárias","Criança Feliz","Iniciativa social voltada à infância, desenvolvida em parceria com a Coterleste.","Ação social"],
  ["Solidariedade","Natal Solidário","Mobilização comunitária de solidariedade no período natalino.","Campanha"],
  ["Solidariedade","Páscoa","Ações comunitárias relacionadas à celebração da Páscoa.","Campanha"],
  ["Cultura e convivência","Festa Caipira","Atividade de convivência e valorização das tradições culturais.","Convivência"],
  ["Conscientização","Setembro Amarelo e Outubro Rosa","Iniciativas de informação, acolhimento e conscientização sobre saúde e bem-estar.","Conscientização"]
 ];
 const grid=mk("div","idg-project-catalogue-grid");
 for(const [category,title,description,tag] of projects){
  const card=mk("article","idg-project-catalogue-card");
  card.append(mk("span","idg-project-category",category),mk("h4",null,title),mk("p",null,description),mk("small",null,tag));
  grid.append(card);
 }
 catalogue.append(grid);
 projectsRoot.before(catalogue);
}
const nav=portal.querySelector(".idg-partner-side nav");if(nav){for(const [href,label] of [["#partner-network","♧ Parceiros e agenda"]]){const a=mk("a",null,label);a.href=href;nav.insertBefore(a,nav.lastElementChild)}const anchors=[...nav.querySelectorAll('a[href^="#"]')];function active(){const hash=location.hash||"#partner-overview";for(const a of anchors){if(a.getAttribute("href")===hash)a.setAttribute("aria-current","location");else a.removeAttribute("aria-current")}}window.addEventListener("hashchange",active);active()}
const cfg=window.IDG_SUPABASE_CONFIG;const db=cfg?.url&&cfg?.publishableKey&&window.supabase?window.supabase.createClient(cfg.url,cfg.publishableKey):null;
let request=0;async function load(){const id=++request;if(!db||portal.classList.contains("hidden"))return;const {data:{user},error:authError}=await db.auth.getUser();if(authError||!user)return;const {data:access,error:accessError}=await db.from("partner_portal_access").select("is_active,applications!inner(status)").eq("user_id",user.id).maybeSingle();if(accessError||!access?.is_active||access.applications?.status!=="approved")return;
const {data,error}=await db.rpc("idg_partner_course_counts");if(id!==request||portal.classList.contains("hidden"))return;
const old=document.getElementById("idg-partner-verified-cards");if(old)old.remove();const cards=mk("div","metrics");cards.id="idg-partner-verified-cards";cards.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px";
const valid=!error&&Array.isArray(data)&&data.every(r=>Number.isFinite(Number(r.registrations))&&Number(r.registrations)>=0);const total=valid?data.reduce((n,r)=>n+Number(r.registrations),0):null;const items=[["Inscrições recebidas",total===null?"—":total.toLocaleString("pt-BR"),total===null?"Dados indisponíveis":"Não equivalem a matrículas"],["Vagas oferecidas","140","20 vagas por curso"],["Cursos disponíveis","7","Modalidades oferecidas"],["Matrículas confirmadas","—","Sem total verificado publicado"]];
for(const [label,value,detail] of items){const card=mk("article","metric");card.append(mk("h3",null,label),mk("strong",null,value),mk("p",null,detail));cards.append(card)}
metrics.before(cards);intro.textContent="Panorama dos cursos • dados agregados para parceiros autorizados. Inscrições não são vagas preenchidas.";metrics.hidden=true;
}
// Enhance existing course chart in place, without recreating it or its legend.
const chartObserver=new MutationObserver(()=>{const panel=portal.querySelector("#idg-visual-summary .idg-course-chart");if(!panel||panel.dataset.idgEnhanced)return;const legend=panel.children[1];if(!legend)return;const labels=[...legend.children];const values=labels.map(row=>Number(row.querySelector("strong")?.textContent?.trim()||0));const total=values.reduce((a,b)=>a+b,0);if(!total||values.some(v=>!Number.isFinite(v)||v<0))return;panel.dataset.idgEnhanced="true";labels.forEach((row,i)=>{const value=values[i];const strong=row.querySelector("strong");if(strong){strong.textContent=value.toLocaleString("pt-BR")+" · "+(value/total*100).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%";}});});
chartObserver.observe(portal,{childList:true,subtree:true});
const observer=new MutationObserver(()=>{if(!portal.classList.contains("hidden"))load();else{request++;document.getElementById("idg-partner-verified-cards")?.remove();metrics.hidden=false}});observer.observe(portal,{attributes:true,attributeFilter:["class"]});if(!portal.classList.contains("hidden"))load();
})();
