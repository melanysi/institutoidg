window.IDG_ASSISTANT_KNOWLEDGE = {
    contactEmail: "despertando.idg@gmail.com",
    fallback: "Ainda não tenho essa informação disponível. 💙 Posso te orientar a entrar em contato com a equipe do Instituto.",
    quickActions: [
        { id: "courses", label: "📚 Cursos profissionalizantes" },
        { id: "registration", label: "📝 Quero me inscrever" },
        { id: "location", label: "📍 Endereço e horários" },
        { id: "projects", label: "💙 Projetos e ações" },
        { id: "volunteer", label: "🙋 Quero ser voluntário(a)" },
        { id: "partner", label: "🤝 Quero ser parceiro(a)" },
        { id: "donation", label: "💰 Quero fazer uma doação" },
        { id: "other", label: "❓ Outras dúvidas" }
    ],
    courses: [
        "Manicure",
        "Cuidador de Idoso",
        "Recepcionista",
        "Portaria e Controlador de Acesso",
        "Trancista",
        "Cuidador Infantil",
        "Panificação"
    ],
    intents: [
        {
            id: "greeting",
            keywords: ["oi", "ola", "bom dia", "boa tarde", "boa noite", "ajuda"],
            answer: "Olá! ☀️ Sou a Sol e posso ajudar com informações oficiais sobre cursos, inscrições, endereço, horários, projetos, voluntariado, parcerias e apoio. 💙"
        },
        {
            id: "location",
            keywords: ["endereco", "onde fica", "onde fica o instituto", "como chegar", "localizacao", "local do instituto"],
            answer: "O Instituto fica na Rua Danças Húngaras, 72, na Zona Leste de São Paulo."
        },
        {
            id: "hours",
            keywords: ["horario", "horarios", "que horas", "quando tem aula", "horario das aulas", "funciona de que horas"],
            answer: "Os cursos acontecem de segunda a sexta-feira, das 19h às 22h, conforme o cronograma de cada curso. Os horários dos projetos e eventos podem variar; consulte a equipe.",
            link: { label: "Ver cursos", href: "#cursos" }
        },
        {
            id: "course-requirements",
            keywords: ["requisito", "idade", "quantos anos", "experiencia", "certificado", "precisa ter experiencia"],
            answer: "Os cursos são 100% gratuitos, destinados a pessoas com 18 anos ou mais, não exigem experiência anterior e oferecem certificado de conclusão.",
            link: { label: "Consultar cursos", href: "#cursos" }
        },
        {
            id: "course-price",
            keywords: ["gratuito", "de graca", "pagar", "preco", "valor do curso", "curso custa"],
            answer: "Todos os cursos profissionalizantes publicados no site são 100% gratuitos.",
            link: { label: "Ver cursos", href: "#cursos" }
        },
        {
            id: "courses",
            keywords: ["cursos", "quais cursos", "lista de cursos", "curso disponivel", "cursos disponiveis", "curso tem"],
            answer: "Os cursos publicados são Manicure, Cuidador de Idoso, Recepcionista, Portaria e Controlador de Acesso, Trancista, Cuidador Infantil e Panificação. São gratuitos, para pessoas com 18 anos ou mais, sem exigência de experiência anterior e com certificado. As aulas ocorrem em dias úteis, das 19h às 22h, conforme o cronograma. A inscrição é analisada pela equipe e não confirma uma vaga automaticamente.",
            followUp: "Gostaria de fazer sua inscrição?",
            offer: { type: "course", label: "Fazer minha inscrição", href: "#form-inscricao" }
        },
        {
            id: "registration",
            keywords: ["inscricao", "inscrever", "matricula", "vaga", "quero participar do curso"],
            answer: "Os cursos publicados são Manicure, Cuidador de Idoso, Recepcionista, Portaria e Controlador de Acesso, Trancista, Cuidador Infantil e Panificação. Escolha um curso para consultar informações e seguir para o formulário.",
            courseChoices: true
        },
        {
            id: "projects",
            keywords: ["projeto", "projetos", "acoes", "acoes sociais", "esporte", "educacao", "eventos", "evento", "crianca feliz", "natal solidario", "pascoa", "festa caipira", "dia das criancas", "setembro amarelo", "outubro rosa", "novembro azul"],
            answer: "O Instituto publica ações de esporte e educação para crianças e jovens, o Projeto Criança Feliz, ações de Páscoa e Natal, Festa Caipira, Festa de Dia das Crianças e campanhas de conscientização. Datas, locais e disponibilidade podem variar conforme cada atividade.",
            link: { label: "Conhecer projetos e ações", href: "#projetos" }
        },
        {
            id: "volunteer",
            keywords: ["voluntario", "voluntaria", "voluntariado", "ser voluntario", "ajudar como voluntario"],
            answer: "O voluntariado é destinado a pessoas com 18 anos ou mais que queiram contribuir com tempo, conhecimentos e habilidades em atividades de educação, esporte, ações com crianças e jovens, eventos, comunicação ou apoio administrativo. A manifestação será analisada pela equipe e não garante vaga automaticamente.",
            followUp: "Gostaria de registrar seu interesse?",
            offer: { type: "link", label: "Registrar meu interesse", href: "#form-voluntariado" }
        },
        {
            id: "partner",
            keywords: ["parceria", "parcerias", "parceiro", "parceira", "ser parceiro", "empresa", "instituicao parceira"],
            answer: "Empresas, organizações, instituições, profissionais e grupos podem apresentar propostas de projetos, ações, eventos, serviços ou outras iniciativas. A proposta será analisada pela equipe e não confirma uma parceria automaticamente.",
            followUp: "Gostaria de apresentar uma proposta de parceria?",
            offer: { type: "link", label: "Apresentar proposta", href: "#form-parcerias" }
        },
        {
            id: "donation",
            keywords: ["doacao", "doar", "doacoes", "doacao de alimentos", "doacao de materiais", "patrocinio", "apoiar", "apoio financeiro"],
            answer: "O site prevê propostas de patrocínio, apoio a projetos e eventos, doação de materiais, alimentos ou itens necessários, prestação de serviços e outras contribuições. A equipe precisa confirmar a necessidade e disponibilidade. Contribuições financeiras só devem ser feitas por uma forma institucional oficial divulgada pelo Instituto.",
            followUp: "Gostaria de apresentar uma proposta de apoio?",
            offer: { type: "link", label: "Apresentar proposta de apoio", href: "#form-doacao" }
        },
        {
            id: "contact",
            keywords: ["contato", "falar com alguem", "falar com a equipe", "email"],
            answer: "O contato oficial publicado no site é o e-mail despertando.idg@gmail.com.",
            link: { label: "Enviar e-mail", href: "mailto:despertando.idg@gmail.com" }
        }
    ],
    courseInfo: "Os cursos são gratuitos, destinados a pessoas com 18 anos ou mais, não exigem experiência anterior e oferecem certificado. As aulas acontecem de segunda a sexta-feira, das 19h às 22h, conforme o cronograma. A inscrição será analisada pela equipe e não garante vaga automaticamente.",
    yesWords: ["sim", "quero", "quero sim", "pode", "vamos", "isso", "claro", "yes"],
    noWords: ["nao", "agora nao", "depois", "nao obrigado", "nao obrigada", "no"]
};
