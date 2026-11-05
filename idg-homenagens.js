(()=>{"use strict";const groups=[
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
const biographies={};for(const [category,people] of groups)for(const [name,description] of people)biographies[name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()]={name,description,category};biographies["mariele franco"]=biographies["marielle franco"];window.IDG_TURMA_HOMENAGENS=biographies;})();