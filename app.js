(() => {
    const config = window.IDG_SUPABASE_CONFIG;
    const statusElement = document.querySelector("#account-status");
    const adminArea = document.querySelector("#admin-applications");
    const loginForm = document.querySelector("#login-form");
    const passwordResetRequest = document.querySelector("#password-reset-request");
    const passwordUpdateForm = document.querySelector("#password-update-form");
    const submitEndpoint = config
        ? `${config.url}/functions/v1/submit-application`
        : null;
    const client = config && window.supabase
        ? window.supabase.createClient(config.url, config.publishableKey)
        : null;
    const captchaWidgets = new Map();
    let passwordRecoveryInProgress = false;

    const labels = {
        volunteer: "Voluntariado",
        beneficiary: "Solicitação de apoio",
        course: "Inscrição em curso",
        sponsor: "Parceria ou patrocínio",
        donation: "Oferta de doação"
    };

    const statusLabels = {
        pending: "Pendente",
        reviewing: "Em análise",
        approved: "Aprovado",
        rejected: "Não aprovado",
        completed: "Concluído"
    };

    function navigateParticipation() {
        const hashValue = window.location.hash.slice(1);
        const target = document.getElementById(decodeURIComponent(hashValue));
        const journeyPages = [...document.querySelectorAll("[data-journey-page]")];
        const landing = document.querySelector("#participe");
        const recoveryRedirect = passwordRecoveryInProgress ||
            new URLSearchParams(hashValue).get("type") === "recovery";
        const selectedPage = (recoveryRedirect ? document.querySelector("#acesso") : null) ||
            target?.closest("[data-journey-page]") ||
            (target === landing || !window.location.hash ? landing : null);

        for (const page of journeyPages) {
            page.hidden = page !== selectedPage;
        }
        landing.hidden = selectedPage !== landing;

        for (const panel of document.querySelectorAll("[data-journey-form]")) {
            panel.hidden = true;
        }

        const formPanel = target?.closest("[data-journey-form]");
        if (formPanel && selectedPage) {
            formPanel.hidden = false;
            window.requestAnimationFrame(() => {
                formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
            });
            window.dispatchEvent(new CustomEvent("idg:form-visible", { detail: formPanel }));
        } else if (selectedPage && selectedPage !== landing) {
            window.requestAnimationFrame(() => {
                selectedPage.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        }
    }

    function showStatus(message, isError = false) {
        if (!statusElement) return;
        statusElement.textContent = message;
        statusElement.dataset.state = isError ? "error" : "success";
    }

    function showFormStatus(form, message, isError = false) {
        const result = form.querySelector(".form-result");
        if (!result) return;
        result.textContent = message;
        result.dataset.state = isError ? "error" : "success";
        result.hidden = false;
    }

    function getErrorMessage(error) {
        if (/email rate limit exceeded|too many requests/i.test(error?.message || "")) {
            return "O Supabase limitou temporariamente os e-mails de recuperação. Aguarde antes de solicitar outro link e confira também a caixa de spam.";
        }
        return error && error.message
            ? error.message
            : "Ocorreu um erro inesperado. Tente novamente.";
    }

    function collectDetails(form) {
        const details = {};
        for (const [key, value] of new FormData(form).entries()) {
            if (["full_name", "email", "phone", "privacy_consent", "website"].includes(key)) {
                continue;
            }
            const normalizedValue = String(value).trim();
            if (normalizedValue) details[key] = normalizedValue;
        }
        return details;
    }

    function isAdult(dateValue) {
        if (!dateValue) return false;
        const birthDate = new Date(`${dateValue}T00:00:00`);
        if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) return false;
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDifference = today.getMonth() - birthDate.getMonth();
        if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age >= 18;
    }

    function addAgeValidation(form) {
        const birthDate = form.querySelector('[name="date_of_birth"]');
        if (!birthDate) return;
        const latestBirthDate = new Date();
        latestBirthDate.setFullYear(latestBirthDate.getFullYear() - 18);
        birthDate.max = [
            latestBirthDate.getFullYear(),
            String(latestBirthDate.getMonth() + 1).padStart(2, "0"),
            String(latestBirthDate.getDate()).padStart(2, "0")
        ].join("-");
        birthDate.addEventListener("input", () => {
            birthDate.setCustomValidity(
                isAdult(birthDate.value)
                    ? ""
                    : "É necessário ter 18 anos ou mais para se inscrever."
            );
        });
    }

    function updateMinorFields(form) {
        const selector = form.querySelector("[data-minor-selector]");
        if (!selector) return;
        const isMinor = selector.value === "yes";
        for (const field of form.querySelectorAll("[data-minor-field]")) {
            field.hidden = !isMinor;
            const input = field.querySelector("input, select");
            input.required = isMinor;
            if (!isMinor) input.value = "";
        }
    }

    async function submitApplication(form) {
        if (!submitEndpoint || !config) {
            throw new Error("O serviço de cadastro não está configurado. Nenhum dado foi enviado.");
        }
        const formData = new FormData(form);
        const dateOfBirth = formData.get("date_of_birth");
        if (dateOfBirth && !isAdult(String(dateOfBirth))) {
            throw new Error("Este cadastro é destinado a pessoas com 18 anos ou mais.");
        }
        const turnstileToken = form.dataset.turnstileToken;
        if (!turnstileToken) {
            throw new Error("Conclua a verificação antispam antes de enviar.");
        }

        const response = await fetch(submitEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": config.publishableKey
            },
            body: JSON.stringify({
                applicationType: form.dataset.applicationForm,
                fullName: String(formData.get("full_name") || "").trim(),
                email: String(formData.get("email") || "").trim(),
                phone: String(formData.get("phone") || "").trim(),
                privacyConsent: formData.get("privacy_consent") === "on",
                turnstileToken,
                website: String(formData.get("website") || ""),
                details: collectDetails(form)
            })
        });

        let result;
        try {
            result = await response.json();
        } catch {
            throw new Error("O serviço respondeu com um formato inválido. A equipe não recebeu confirmação do envio.");
        }
        if (!response.ok) {
            throw new Error(result.error || "Não foi possível enviar o formulário.");
        }
        if (result.received !== true) {
            throw new Error("O serviço não confirmou o recebimento do formulário.");
        }

        return result;
    }

    async function refreshAdmin() {
        if (!client) {
            showStatus("O serviço administrativo não carregou. Verifique a conexão e a configuração do Supabase.", true);
            return;
        }

        const { data: { session }, error: sessionError } = await client.auth.getSession();
        if (sessionError) {
            showStatus(getErrorMessage(sessionError), true);
            return;
        }

        if (!session) {
            adminArea.hidden = true;
            loginForm.hidden = false;
            showStatus("Área restrita. Faça login com a conta administrativa autorizada pelo Instituto.");
            return;
        }

        const { data: profile, error: profileError } = await client
            .from("profiles")
            .select("full_name, role, status")
            .eq("id", session.user.id)
            .maybeSingle();
        if (profileError) {
            showStatus(getErrorMessage(profileError), true);
            return;
        }
        if (!profile || profile.role !== "admin" || profile.status !== "active") {
            adminArea.hidden = true;
            loginForm.hidden = true;
            passwordUpdateForm.hidden = true;
            showStatus("Esta conta não tem autorização administrativa. Entre em contato com a equipe do Instituto.", true);
            return;
        }

        if (passwordRecoveryInProgress) {
            adminArea.hidden = true;
            loginForm.hidden = true;
            passwordUpdateForm.hidden = false;
            showStatus("Crie uma senha com pelo menos 12 caracteres para acessar a área administrativa.");
            return;
        }

        passwordUpdateForm.hidden = true;
        loginForm.hidden = true;
        adminArea.hidden = false;
        showStatus(`Acesso administrativo: ${profile.full_name}.`);
        await loadAdminApplications();
    }

    async function loadAdminApplications() {
        const list = adminArea.querySelector("[data-admin-list]");
        const typeFilter = adminArea.querySelector("[data-filter-type]");
        const statusFilter = adminArea.querySelector("[data-filter-status]");
        list.replaceChildren();

        let query = client
            .from("applications")
            .select("id, application_type, full_name, email, phone, details, status, internal_notes, created_at")
            .order("created_at", { ascending: false });
        if (typeFilter.value) query = query.eq("application_type", typeFilter.value);
        if (statusFilter.value) query = query.eq("status", statusFilter.value);

        const { data, error } = await query;
        if (error) {
            showStatus(getErrorMessage(error), true);
            return;
        }
        if (!data.length) {
            list.textContent = "Nenhum cadastro encontrado para este filtro.";
            return;
        }

        for (const application of data) {
            const card = document.createElement("article");
            card.className = "admin-card";

            const heading = document.createElement("h3");
            heading.textContent = `${labels[application.application_type] || "Cadastro"} — ${application.full_name}`;

            const contact = document.createElement("p");
            contact.textContent = `${application.email} · ${application.phone} · ${new Date(application.created_at).toLocaleDateString("pt-BR")}`;

            const details = document.createElement("pre");
            details.textContent = JSON.stringify(application.details, null, 2);

            const controls = document.createElement("div");
            controls.className = "admin-actions";
            const state = document.createElement("span");
            state.textContent = `Status: ${statusLabels[application.status] || application.status}`;
            controls.append(state);

            const select = document.createElement("select");
            select.setAttribute("aria-label", `Status de ${application.full_name}`);
            for (const [value, label] of Object.entries(statusLabels)) {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = label;
                option.selected = application.status === value;
                select.append(option);
            }
            const updateButton = document.createElement("button");
            updateButton.type = "button";
            updateButton.className = "btn-header btn-primary";
            updateButton.textContent = "Atualizar status";
            updateButton.addEventListener("click", () =>
                updateApplication(application.id, { status: select.value })
            );
            controls.append(select, updateButton);

            const notesLabel = document.createElement("label");
            notesLabel.className = "form-field";
            notesLabel.textContent = "Anotações internas da equipe";
            const notes = document.createElement("textarea");
            notes.maxLength = 3000;
            notes.value = application.internal_notes || "";
            notesLabel.append(notes);
            const saveNotesButton = document.createElement("button");
            saveNotesButton.type = "button";
            saveNotesButton.className = "btn-header btn-outline-navy";
            saveNotesButton.textContent = "Salvar anotação";
            saveNotesButton.addEventListener("click", () =>
                updateApplication(application.id, { internal_notes: notes.value })
            );

            card.append(heading, contact, details, controls, notesLabel, saveNotesButton);
            list.append(card);
        }
    }

    async function updateApplication(id, changes) {
        const { error } = await client
            .from("applications")
            .update(changes)
            .eq("id", id);
        if (error) {
            showStatus(getErrorMessage(error), true);
            return;
        }
        showStatus("Cadastro atualizado.");
        await loadAdminApplications();
    }

    document.querySelectorAll("[data-application-form]").forEach(form => {
        addAgeValidation(form);
        const minorSelector = form.querySelector("[data-minor-selector]");
        if (minorSelector) {
            updateMinorFields(form);
            minorSelector.addEventListener("change", () => updateMinorFields(form));
        }

        form.addEventListener("submit", async event => {
            event.preventDefault();
            const submitButton = form.querySelector('[type="submit"]');
            submitButton.disabled = true;
            try {
                const result = await submitApplication(form);
                form.reset();
                if (minorSelector) updateMinorFields(form);
                const confirmation = result.emailSent
                    ? "Recebemos suas informações! 💛 Agradecemos pelo interesse em fazer parte das nossas ações. Enviamos uma confirmação por e-mail. Nossa equipe irá analisar as informações e, quando necessário, entrará em contato pelos dados informados. O envio não garante vaga, participação, benefício, parceria ou aprovação."
                    : "Recebemos suas informações! 💛 Agradecemos pelo interesse em fazer parte das nossas ações. Nossa equipe irá analisar as informações e, quando necessário, entrará em contato pelos dados informados no formulário. O envio não garante vaga, participação, benefício, parceria ou aprovação.";
                showFormStatus(form, confirmation);
            } catch (error) {
                showFormStatus(form, getErrorMessage(error), true);
            } finally {
                const widgetId = captchaWidgets.get(form);
                if (window.turnstile && widgetId !== undefined) {
                    form.dataset.turnstileToken = "";
                    submitButton.disabled = true;
                    window.turnstile.reset(widgetId);
                } else {
                    submitButton.disabled = false;
                }
            }
        });
    });

    function prepareCaptcha(form) {
        const submitButton = form.querySelector('[type="submit"]');
        if (captchaWidgets.has(form)) return;
        if (!config || !config.turnstileSiteKey || !window.turnstile) {
            submitButton.disabled = true;
            showFormStatus(
                form,
                "O formulário será habilitado após configurar a proteção antispam e publicar o serviço seguro de cadastro.",
                true
            );
            return;
        }

        const widgetId = window.turnstile.render(form.querySelector("[data-turnstile-widget]"), {
            sitekey: config.turnstileSiteKey,
            callback: token => {
                form.dataset.turnstileToken = token;
                submitButton.disabled = false;
            },
            "expired-callback": () => {
                form.dataset.turnstileToken = "";
                submitButton.disabled = true;
            },
            "error-callback": () => {
                form.dataset.turnstileToken = "";
                submitButton.disabled = true;
                showFormStatus(form, "A verificação antispam falhou. Atualize a página e tente novamente.", true);
            }
        });
        captchaWidgets.set(form, widgetId);
    }

    window.addEventListener("idg:form-visible", event => {
        const form = event.detail.querySelector("[data-application-form]");
        if (form) prepareCaptcha(form);
    });

    document.querySelectorAll("[data-course-choice]").forEach(link => {
        link.addEventListener("click", () => {
            const select = document.querySelector("#course-choice");
            if (select) select.value = link.dataset.courseChoice;
        });
    });

    document.querySelectorAll("[data-filter-type], [data-filter-status]").forEach(filter => {
        filter.addEventListener("change", loadAdminApplications);
    });

    if (loginForm) {
        loginForm.addEventListener("submit", async event => {
            event.preventDefault();
            if (!client) {
                showStatus("O serviço administrativo não está configurado.", true);
                return;
            }
            const submitButton = loginForm.querySelector('[type="submit"]');
            submitButton.disabled = true;
            const form = new FormData(loginForm);
            const { error } = await client.auth.signInWithPassword({
                email: String(form.get("email")).trim(),
                password: String(form.get("password"))
            });
            submitButton.disabled = false;
            if (error) {
                showStatus(getErrorMessage(error), true);
                return;
            }
            loginForm.reset();
            await refreshAdmin();
        });
    }

    passwordResetRequest?.addEventListener("click", async () => {
        const emailInput = loginForm?.elements.namedItem("email");
        if (!(emailInput instanceof HTMLInputElement) || !emailInput.reportValidity()) return;
        if (!client) {
            showStatus("O serviço administrativo não está configurado.", true);
            return;
        }

        passwordResetRequest.disabled = true;
        const { error } = await client.auth.resetPasswordForEmail(emailInput.value.trim());
        passwordResetRequest.disabled = false;
        if (error) {
            showStatus(getErrorMessage(error), true);
            return;
        }
        showStatus("Enviamos um link para definir sua senha. Abra o e-mail neste mesmo computador e use o link antes que ele expire.");
    });

    passwordUpdateForm?.addEventListener("submit", async event => {
        event.preventDefault();
        if (!client) {
            showStatus("O serviço administrativo não está configurado.", true);
            return;
        }

        const form = new FormData(passwordUpdateForm);
        const password = String(form.get("password"));
        if (password !== String(form.get("password_confirmation"))) {
            showStatus("As senhas não conferem. Verifique os dois campos.", true);
            return;
        }

        const submitButton = passwordUpdateForm.querySelector('[type="submit"]');
        submitButton.disabled = true;
        const { error } = await client.auth.updateUser({ password });
        submitButton.disabled = false;
        if (error) {
            showStatus(getErrorMessage(error), true);
            return;
        }

        passwordRecoveryInProgress = false;
        passwordUpdateForm.reset();
        passwordUpdateForm.hidden = true;
        await refreshAdmin();
        showStatus("Senha definida com sucesso. Você já pode acessar a área administrativa.");
    });

    const assistant = document.querySelector(".faq-assistant");
    const assistantKnowledge = window.IDG_ASSISTANT_KNOWLEDGE;
    const assistantPanel = document.querySelector("#faq-assistant-panel");
    const assistantToggle = document.querySelector(".faq-assistant-toggle");
    const assistantNudge = document.querySelector("#faq-assistant-nudge");
    const assistantNudgeDismiss = document.querySelector(".faq-assistant-nudge-dismiss");
    const assistantMinimize = document.querySelector("#faq-assistant-minimize");
    const assistantClose = document.querySelector(".faq-assistant-close");
    const assistantMessages = document.querySelector("#faq-assistant-messages");
    const assistantQuickActions = document.querySelector(".faq-assistant-quick-actions");
    const assistantForm = document.querySelector("#faq-assistant-form");
    const assistantInput = document.querySelector("#faq-assistant-input");
    let pendingAssistantOffer = null;
    let assistantReplyPending = false;

    function normalizeQuestion(value) {
        return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    }

    function addAssistantMessage(text, isUser = false) {
        const row = document.createElement("div");
        row.className = `faq-assistant-message-row${isUser ? " is-user" : ""}`;

        if (!isUser) {
            const avatar = document.createElement("span");
            avatar.className = "assistant-avatar";
            const image = document.createElement("img");
            image.src = "images/assistente-idg.png";
            image.alt = "";
            avatar.append(image);
            row.append(avatar);
        }

        const bubble = document.createElement("p");
        bubble.className = "faq-assistant-message";
        bubble.textContent = text;
        row.append(bubble);
        assistantMessages.append(row);
        assistantMessages.scrollTop = assistantMessages.scrollHeight;
        return row;
    }

    function addAssistantActions(parent, options) {
        if (!options || options.length === 0) return;
        const actions = document.createElement("div");
        actions.className = "faq-assistant-message-actions";
        for (const option of options) {
            if (option.href) {
                const link = document.createElement("a");
                link.href = option.href;
                link.textContent = option.label;
                if (option.type === "course") link.dataset.assistantCourseSubmit = option.course;
                if (option.donationType) link.dataset.assistantDonationType = option.donationType;
                if (option.primary) link.classList.add("is-primary");
                actions.append(link);
                continue;
            }

            const button = document.createElement("button");
            button.type = "button";
            button.textContent = option.label;
            if (option.course) button.dataset.assistantCourse = option.course;
            if (option.choice) button.dataset.assistantChoice = option.choice;
            if (option.primary) button.classList.add("is-primary");
            actions.append(button);
        }
        parent.after(actions);
        assistantMessages.scrollTop = assistantMessages.scrollHeight;
    }

    function addAssistantTyping() {
        const row = document.createElement("div");
        row.className = "faq-assistant-message-row";
        row.setAttribute("aria-label", "Assistente digitando");
        const avatar = document.createElement("span");
        avatar.className = "assistant-avatar";
        const image = document.createElement("img");
        image.src = "images/assistente-idg.png";
        image.alt = "";
        avatar.append(image);
        const bubble = document.createElement("p");
        bubble.className = "faq-assistant-message faq-assistant-typing";
        bubble.innerHTML = "<span></span><span></span><span></span>";
        row.append(avatar, bubble);
        assistantMessages.append(row);
        assistantMessages.scrollTop = assistantMessages.scrollHeight;
        return row;
    }

    function findIntentById(id) {
        return assistantKnowledge.intents.find(intent => intent.id === id);
    }

    function answerForCourse(course) {
        pendingAssistantOffer = {
            type: "course",
            course,
            label: "Fazer minha inscrição",
            href: "#form-inscricao"
        };
        return {
            text: `${course}: ${assistantKnowledge.courseInfo}\n\nGostaria de fazer sua inscrição?`,
            actions: [
                { label: "Sim, quero me inscrever", choice: "yes", primary: true },
                { label: "Agora não", choice: "no" }
            ]
        };
    }

    function resolveAssistantResponse(question, selectedIntent) {
        const normalized = normalizeQuestion(question);
        const yesWords = assistantKnowledge.yesWords.map(normalizeQuestion);
        const noWords = assistantKnowledge.noWords.map(normalizeQuestion);
        const startsWithAnswer = words => words.some(word =>
            new RegExp(`^${word}(?:$|[\\s,.!?])`).test(normalized)
        );

        if (pendingAssistantOffer && startsWithAnswer(yesWords)) {
            const offer = pendingAssistantOffer;
            pendingAssistantOffer = null;
            return {
                text: "Claro! A equipe analisará as informações enviadas pelo formulário. O envio não confirma automaticamente vaga, matrícula, parceria, apoio ou participação.",
                actions: [{ ...offer, primary: true }]
            };
        }
        if (pendingAssistantOffer && startsWithAnswer(noWords)) {
            pendingAssistantOffer = null;
            return { text: "Tudo bem! Se precisar, estou por aqui. 💙" };
        }

        if (selectedIntent === "other") {
            return {
                text: assistantKnowledge.fallback,
                link: { label: "Falar com a equipe", href: `mailto:${assistantKnowledge.contactEmail}` }
            };
        }

        const matchedCourse = assistantKnowledge.courses.find(course =>
            normalized.includes(normalizeQuestion(course))
        );
        if (matchedCourse) return answerForCourse(matchedCourse);

        const intent = selectedIntent
            ? findIntentById(selectedIntent)
            : assistantKnowledge.intents
                .map(item => ({
                    item,
                    score: Math.max(...item.keywords.map(keyword =>
                        normalized.includes(normalizeQuestion(keyword))
                            ? normalizeQuestion(keyword).length
                            : 0
                    ))
                }))
                .filter(match => match.score > 0)
                .sort((first, second) => second.score - first.score)[0]?.item;

        if (!intent) {
            return {
                text: assistantKnowledge.fallback,
                link: { label: "Falar com a equipe", href: `mailto:${assistantKnowledge.contactEmail}` }
            };
        }

        if (intent.id === "location") {
            return {
                text: `${intent.answer}\n\nOs cursos acontecem de segunda a sexta-feira, das 19h às 22h, conforme o cronograma de cada curso.`,
                link: { label: "Consultar cursos", href: "#cursos" }
            };
        }

        const response = { text: intent.answer };
        if (intent.link) response.link = intent.link;
        if (intent.courseChoices) {
            response.actions = assistantKnowledge.courses.map(course => ({
                label: course,
                course
            }));
        }
        if (intent.followUp && intent.offer) {
            pendingAssistantOffer = intent.offer;
            response.text += `\n\n${intent.followUp}`;
            response.actions = [
                { label: "Sim, tenho interesse", choice: "yes", primary: true },
                { label: "Agora não", choice: "no" }
            ];
        }
        return response;
    }

    function answerAssistant(question, selectedIntent = null) {
        if (assistantReplyPending) return;
        assistantReplyPending = true;
        const thinking = addAssistantTyping();
        window.setTimeout(() => {
            thinking.remove();
            const response = resolveAssistantResponse(question, selectedIntent);
            const row = addAssistantMessage(response.text);
            if (response.link) {
                const link = document.createElement("a");
                link.href = response.link.href;
                link.textContent = response.link.label;
                if (link.href.startsWith("mailto:")) {
                    link.setAttribute("aria-label", `${response.link.label}: ${assistantKnowledge.contactEmail}`);
                }
                const linkContainer = document.createElement("div");
                linkContainer.className = "faq-assistant-message-actions";
                linkContainer.append(link);
                row.after(linkContainer);
            }
            addAssistantActions(row, response.actions);
            assistantReplyPending = false;
            assistantMessages.scrollTop = assistantMessages.scrollHeight;
        }, 520);
    }

    function openAssistant() {
        assistantPanel.hidden = false;
        assistantPanel.setAttribute("aria-hidden", "false");
        assistantToggle.setAttribute("aria-expanded", "true");
        assistantToggle.classList.remove("is-waving");
        void assistantToggle.offsetWidth;
        assistantToggle.classList.add("is-waving");
        assistantNudge.hidden = true;
        assistantInput.focus();
    }

    function closeAssistant(restoreFocus = true) {
        assistantPanel.hidden = true;
        assistantPanel.setAttribute("aria-hidden", "true");
        assistantToggle.setAttribute("aria-expanded", "false");
        if (restoreFocus) assistantToggle.focus();
    }

    function submitAssistantQuestion(question, selectedIntent = null) {
        const trimmedQuestion = question.trim();
        if (!trimmedQuestion || assistantReplyPending) return;
        addAssistantMessage(trimmedQuestion, true);
        answerAssistant(trimmedQuestion, selectedIntent);
    }

    assistantToggle?.addEventListener("click", openAssistant);
    assistantMinimize?.addEventListener("click", () => closeAssistant());
    assistantClose?.addEventListener("click", () => closeAssistant());
    assistantNudgeDismiss?.addEventListener("click", () => {
        assistantNudge.hidden = true;
        sessionStorage.setItem("idg-assistant-nudge-dismissed", "true");
    });
    assistantNudge?.addEventListener("click", event => {
        if (event.target !== assistantNudgeDismiss) openAssistant();
    });

    assistantForm?.addEventListener("submit", event => {
        event.preventDefault();
        const question = assistantInput.value;
        submitAssistantQuestion(question);
        assistantForm.reset();
        assistantInput.focus();
    });

    assistantQuickActions?.addEventListener("click", event => {
        const button = event.target.closest("[data-assistant-intent]");
        if (!button || assistantReplyPending) return;
        const intentId = button.dataset.assistantIntent;
        submitAssistantQuestion(button.textContent.trim(), intentId);
    });

    assistantMessages?.addEventListener("click", event => {
        const courseButton = event.target.closest("button[data-assistant-course]");
        if (courseButton) {
            const course = courseButton.dataset.assistantCourse;
            submitAssistantQuestion(course);
            return;
        }

        const choiceButton = event.target.closest("[data-assistant-choice]");
        if (choiceButton) {
            submitAssistantQuestion(choiceButton.textContent.trim());
        }
    });

    assistantMessages?.addEventListener("click", event => {
        const courseLink = event.target.closest("a[data-assistant-course-submit]");
        if (courseLink) {
            const courseChoice = document.querySelector("#course-choice");
            if (courseChoice) courseChoice.value = courseLink.dataset.assistantCourseSubmit;
        }
        const donationLink = event.target.closest("a[data-assistant-donation-type]");
        if (donationLink) {
            const donationType = document.querySelector('#form-doacao select[name="donation_type"]');
            if (donationType) donationType.value = donationLink.dataset.assistantDonationType;
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !assistantPanel.hidden) closeAssistant();
    });

    window.setTimeout(() => {
        if (!assistantPanel.hidden || sessionStorage.getItem("idg-assistant-nudge-dismissed") === "true") return;
        assistantNudge.hidden = false;
        assistantToggle.classList.add("is-waving");
    }, 3200);

    document.querySelector("#sign-out")?.addEventListener("click", async () => {
        if (!client) {
            showStatus("O serviço administrativo não está configurado.", true);
            return;
        }
        const { error } = await client.auth.signOut();
        if (error) showStatus(getErrorMessage(error), true);
        else await refreshAdmin();
    });

    window.addEventListener("hashchange", navigateParticipation);
    navigateParticipation();

    if (client) {
        client.auth.onAuthStateChange(event => {
            if (event === "PASSWORD_RECOVERY") {
                passwordRecoveryInProgress = true;
                navigateParticipation();
            }
            window.setTimeout(refreshAdmin, 0);
        });
        refreshAdmin();
    } else {
        showStatus("O serviço administrativo não carregou. Verifique a conexão e a configuração do Supabase.", true);
    }
})();
