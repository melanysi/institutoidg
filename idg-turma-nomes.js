(()=>{"use strict";const select=document.getElementById("historic-name"),input=document.getElementById("class-name"),info=document.getElementById("historic-name-info");if(!select||!input||!info)return;
const groups=[
["Resistência e direitos",[
["Carlos Marighella","Militante político baiano, símbolo da resistência à ditadura militar."],
["Dandara dos Palmares","Figura histórica associada à resistência quilombola de Palmares."],
["Zumbi dos Palmares","Liderança do Quilombo dos Palmares e símbolo da resistência à escravidão."],
["Tereza de Benguela","Liderança quilombola do século XVIII no atual Mato Grosso."],
["Luiz Gama","Advogado, jornalista e abolicionista que lutou pela liberdade de pessoas escravizadas."],
["Abdias Nascimento","Intelectual, artista e ativista do movimento negro brasileiro."],
["Lélia Gonzalez","Intelectual e ativista fundamental para o feminismo negro no Brasil."],
["Antonieta de Barros","Educadora e pioneira da presença de mulheres negras na política brasileira."],
["Marielle Franco","Socióloga e vereadora carioca, defensora dos direitos humanos."],
["Bertha Lutz","Cientista e liderança da luta pelo voto feminino no Brasil."],
["André Rebouças","Engenheiro e abolicionista do século XIX."]]],
["Educação, literatura e cultura",[
["Carolina Maria de Jesus","Escritora que registrou a vida na favela em sua obra Quarto de Despejo."],
["Paulo Freire","Educador pernambucano reconhecido por sua pedagogia crítica."],
["Conceição Evaristo","Escritora brasileira conhecida pelo conceito de escrevivência."],
["Machado de Assis","Escritor e fundador da Academia Brasileira de Letras."],
["Maria Firmina dos Reis","Escritora maranhense, pioneira da literatura abolicionista brasileira."],
["Ruth de Souza","Atriz pioneira na história do teatro e do cinema brasileiro."],
["Clementina de Jesus","Cantora fundamental para a valorização da tradição afro-brasileira."],
["Cartola","Compositor e sambista, figura marcante da música popular brasileira."],
["Mário de Andrade","Escritor e pesquisador da cultura brasileira."],
["Tarsila do Amaral","Artista importante para o modernismo brasileiro."]]],
["Ciência, saúde e pensamento",[
["Nise da Silveira","Psiquiatra que transformou práticas de cuidado em saúde mental."],
["Milton Santos","Geógrafo brasileiro de reconhecimento internacional."],
["Enedina Alves Marques","Pioneira da engenharia entre mulheres negras no Brasil."],
["Oswaldo Cruz","Médico e sanitarista que marcou a história da saúde pública brasileira."],
["Sônia Guimarães","Física e professora pioneira no ensino superior brasileiro."]]],
["Meio ambiente e povos originários",[
["Chico Mendes","Liderança seringueira e ambientalista da Amazônia."],
["Ailton Krenak","Pensador, escritor e liderança indígena brasileira."],
["Raoni Metuktire","Liderança indígena conhecida pela defesa dos territórios e das florestas."],
["Dorothy Stang","Missionária e ativista socioambiental no Pará."]]]
];
for(const [category,people] of groups){const optgroup=document.createElement("optgroup");optgroup.label=category;for(const [name,description] of people){const option=document.createElement("option");option.value=name;option.textContent=name;option.dataset.description=description;optgroup.append(option)}select.append(optgroup)}
select.addEventListener("change",()=>{const option=select.selectedOptions[0];if(!option?.value)return;input.value="Turma "+option.value;info.textContent=option.dataset.description||"";input.dispatchEvent(new Event("input",{bubbles:true}))});
input.addEventListener("input",()=>{if(select.value&&input.value!=="Turma "+select.value){select.value="";info.textContent="Nome personalizado: você pode homenagear outras personalidades também."}});
})();