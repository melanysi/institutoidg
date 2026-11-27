(()=>{"use strict";
const root=document.getElementById("idg-natal-review");if(!root)return;
const cfg=window.IDG_SUPABASE_CONFIG;if(!cfg?.url||!cfg?.publishableKey||!window.supabase)return;
const db=window.supabase.createClient(cfg.url,cfg.publishableKey),$=id=>document.getElementById(id);
const tbody=$("idg-natal-rows"),notice=$("idg-natal-feedback"),search=$("idg-natal-search"),filter=$("idg-natal-filter"),stats=$("idg-natal-stats"),editor=$("idg-natal-editor");
let records=[],current=null,allowed=false;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
const empty=v=>!String(v??"").trim();
const missing=r=>[empty(r.nome_crianca),empty(r.idade_original),empty(r.roupa_original),empty(r.sapato_original),empty(r.genero_confirmar)].some(Boolean);
const status=r=>r.situacao_importacao==="validado"?"validado":"aguardando_conferencia";
async function isAdmin(){const {data:{user},error}=await db.auth.getUser();if(error||!user)return null;const {data,error:e}=await db.from("profiles").select("role,status").eq("id",user.id).maybeSingle();if(e||data?.role!=="admin"||data?.status!=="active")return null;return user}
function message(v,isError=false){notice.textContent=v;notice.style.color=isError?"#9d3030":""}
function render(){stats.replaceChildren();for(const [label,count] of [["Importadas",records.length],["Validadas",records.filter(r=>status(r)==="validado").length],["Aguardando",records.filter(r=>status(r)!=="validado").length],["Com informações pendentes",records.filter(missing).length]]){const box=el("div");box.className="idg-natal-stat";box.append(el("strong",String(count)),el("span",label));stats.append(box)}
const term=search.value.trim().toLocaleLowerCase("pt-BR");const group=records.filter(r=>(!term||[r.nome_crianca,r.id_origem,r.responsavel].some(v=>String(v||"").toLocaleLowerCase("pt-BR").includes(term)))&&(!filter.value||(filter.value==="incompleto"?missing(r):filter.value===status(r))));tbody.replaceChildren();$("idg-natal-count").textContent=group.length+" registro(s) exibido(s)";
for(const r of group){const tr=el("tr");const summary=[r.nome_crianca||"Sem nome",r.idade_original||"Não informada",r.roupa_original||"—",r.sapato_original||"—",status(r)==="validado"?"Validado":missing(r)?"Dados pendentes":"Aguardando"];for(const v of summary)tr.append(el("td",v));const td=el("td"),btn=el("button","Conferir");btn.type="button";btn.className="secondary";btn.addEventListener("click",()=>open(r));td.append(btn);tr.append(td);tbody.append(tr)}if(!group.length){const tr=el("tr"),td=el("td","Nenhum registro encontrado.");td.colSpan=6;tr.append(td);tbody.append(tr)}}
function open(r){current=r;editor.hidden=false;$("idg-natal-edit-title").textContent="Conferir: "+r.nome_crianca;for(const [field,key] of Object.entries({nome:"nome_crianca",idade:"idade_original",roupa:"roupa_original",sapato:"sapato_original",responsavel:"responsavel",contato:"contato_original",genero:"genero_confirmar",pendencias:"pendencias"}))$("idg-natal-"+field).value=r[key]||"";$("idg-natal-situacao").value=status(r);editor.scrollIntoView({behavior:"smooth",block:"start"});}
async function loadPortalRegistrations(){
    const list=$("idg-natal-portal-list");
    list.textContent="Carregando inscrições do Portal da Família…";
    const events=await db.from("idg_events").select("id,title")
        .gte("starts_at","2026-01-01T03:00:00Z").lt("starts_at","2027-01-01T03:00:00Z");
    if(events.error){
        list.textContent="Não foi possível carregar as ações.";
        return;
    }
    const eventIds=events.data.filter(event=>/^natal\s+solid[aá]rio\b/i.test(event.title.trim())).map(event=>event.id);
    const registrations=[];
    for(let offset=0;eventIds.length;offset+=100){
        const page=await db.from("idg_event_registrations").select("id,family_member_id,status,clothing_size,shoe_size")
            .in("event_id",eventIds).order("created_at",{ascending:false}).order("id").range(offset,offset+99);
        if(page.error){
            list.textContent="Não foi possível carregar as inscrições do portal.";
            return;
        }
        registrations.push(...page.data);
        if(page.data.length<100)break;
    }
    if(!registrations.length){
        list.textContent="Nenhuma inscrição do Portal da Família encontrada.";
        return;
    }
    const memberIds=[...new Set(registrations.map(row=>row.family_member_id))];
    const names=new Map();
    for(let offset=0;offset<memberIds.length;offset+=100){
        const members=await db.from("idg_family_members").select("id,full_name")
            .in("id",memberIds.slice(offset,offset+100));
        if(members.error){
            list.textContent="Não foi possível consultar os participantes do portal.";
            return;
        }
        for(const member of members.data)names.set(member.id,member.full_name);
    }
    if(!allowed)return;
    const labels={received:"Recebida",confirmed:"Confirmada",waitlist:"Lista de espera",cancelled:"Cancelada"};
    const rows=registrations.map(row=>{
        const item=el("li");
        const missingSizes=!row.clothing_size?.trim()||!row.shoe_size?.trim();
        const details=el("p",`${labels[row.status]||row.status} · Roupa: ${row.clothing_size||"A confirmar"} · Calçado: ${row.shoe_size||"A confirmar"}`);
        item.append(el("strong",names.get(row.family_member_id)||"Participante"),details);
        if(missingSizes)item.append(el("p","Dados pendentes"));
        const editor=el("details");
        editor.append(el("summary","Editar roupa e calçado"));
        const form=el("form");
        const clothing=el("input"), shoes=el("input");
        const clothingLabel=el("label","Tamanho da roupa"), shoesLabel=el("label","Número do calçado (BR)");
        clothing.required=shoes.required=true;
        clothing.maxLength=30;
        shoes.maxLength=5;
        shoes.pattern="[0-9]{1,2}([/][0-9]{1,2})?";
        shoes.inputMode="numeric";
        clothing.value=row.clothing_size||"";
        shoes.value=row.shoe_size||"";
        clothingLabel.append(clothing);
        shoesLabel.append(shoes);
        const save=el("button","Salvar tamanhos");
        save.type="submit";
        const feedback=el("p");
        feedback.setAttribute("role","status");
        form.append(clothingLabel,shoesLabel,save,feedback);
        form.addEventListener("submit",async event=>{
            event.preventDefault();
            if(!allowed||save.disabled)return;
            const clothingSize=clothing.value.trim();
            if(!clothingSize){
                feedback.textContent="Informe o tamanho da roupa.";
                clothing.focus();
                return;
            }
            save.disabled=true;
            feedback.textContent="Salvando…";
            const {data,error}=await db.from("idg_event_registrations")
                .update({clothing_size:clothingSize,shoe_size:shoes.value.trim()})
                .eq("id",row.id).select("id").maybeSingle();
            save.disabled=false;
            if(error||!data){
                feedback.textContent="Não foi possível salvar os tamanhos. Atualize a lista e tente novamente.";
                return;
            }
            await loadPortalRegistrations();
            message("Tamanhos salvos.");
        });
        editor.append(form);
        item.append(editor);
        return item;
    });
    const entries=el("ul");
    entries.append(...rows);
    list.replaceChildren(entries);
}
async function reload(){
    const user=await isAdmin();
    allowed=Boolean(user);
    root.hidden=!allowed;
    if(!allowed){
        $("idg-natal-portal-list").replaceChildren();
        return;
    }
    message("Carregando cadastros importados…");
    await Promise.all([loadPortalRegistrations(),loadImportedRegistrations()]);
}
async function loadImportedRegistrations(){
    const {data,error}=await db.from("idg_natal_2026_importacao").select("id_origem,nome_crianca,idade_original,roupa_original,sapato_original,responsavel,contato_original,genero_confirmar,situacao_importacao,pendencias").order("id_origem").range(0,999);
    if(!allowed)return;
    if(error){
        message("Falha ao carregar os cadastros importados: "+error.message,true);
        return;
    }
    records=data||[];
    render();
    message("Cadastros importados atualizados.");
}
$("idg-natal-reload").addEventListener("click",reload);search.addEventListener("input",render);filter.addEventListener("change",render);$("idg-natal-cancel").addEventListener("click",()=>{editor.hidden=true;current=null});
$("idg-natal-form").addEventListener("submit",async e=>{e.preventDefault();if(!current||!allowed)return;const user=await isAdmin();if(!user){message("Sessão sem permissão administrativa.",true);return}
const body={nome_crianca:$("idg-natal-nome").value.trim(),idade_original:$("idg-natal-idade").value.trim(),roupa_original:$("idg-natal-roupa").value.trim(),sapato_original:$("idg-natal-sapato").value.trim(),responsavel:$("idg-natal-responsavel").value.trim(),contato_original:$("idg-natal-contato").value.trim(),genero_confirmar:$("idg-natal-genero").value,situacao_importacao:$("idg-natal-situacao").value,pendencias:$("idg-natal-pendencias").value.trim()};
if(body.situacao_importacao==="validado"&&[body.nome_crianca,body.idade_original,body.roupa_original,body.sapato_original,body.genero_confirmar].some(empty)){message("Preencha nome, idade, roupa, calçado e gênero confirmado antes de validar.",true);return}
const save=$("idg-natal-save");save.disabled=true;message("Salvando conferência…");const {data,error}=await db.from("idg_natal_2026_importacao").update(body).eq("id_origem",current.id_origem).select("id_origem").maybeSingle();save.disabled=false;if(error||!data){message("Não foi possível atualizar: "+(error?.message||"Registro não retornado"),true);return}editor.hidden=true;current=null;await reload();message("Conferência salva com sucesso. Nenhum cartão foi publicado.");});
db.auth.onAuthStateChange(()=>setTimeout(reload,0));reload();
})();