import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": Deno.env.get("IDG_ALLOWED_ORIGIN") ?? "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
};

const applicationTypes = new Set([
    "volunteer",
    "beneficiary",
    "course",
    "sponsor",
    "donation",
]);

const courseNames = new Set([
    "Manicure",
    "Cuidador de Idoso",
    "Recepcionista",
    "Portaria e Controlador de Acesso",
    "Trancista",
    "Cuidador Infantil",
    "Panificação",
]);

const detailRules: Record<string, Record<string, { required: boolean; max: number }>> = {
    volunteer: {
        date_of_birth: { required: true, max: 10 },
        neighborhood: { required: true, max: 100 },
        interests: { required: true, max: 120 },
        skills: { required: true, max: 1000 },
        availability: { required: true, max: 200 },
        motivation: { required: true, max: 1000 },
    },
    beneficiary: {
        neighborhood: { required: false, max: 100 },
        support_type: { required: true, max: 120 },
        involves_minor: { required: true, max: 3 },
        minor_first_name: { required: false, max: 80 },
        minor_age_range: { required: false, max: 20 },
        message: { required: true, max: 1000 },
    },
    course: {
        date_of_birth: { required: true, max: 10 },
        neighborhood: { required: true, max: 100 },
        course_name: { required: true, max: 100 },
        availability: { required: true, max: 160 },
    },
    sponsor: {
        organization: { required: false, max: 160 },
        cnpj: { required: false, max: 18 },
        support_type: { required: true, max: 120 },
        message: { required: true, max: 1000 },
    },
    donation: {
        donation_type: { required: true, max: 120 },
        quantity: { required: false, max: 100 },
        description: { required: true, max: 1000 },
    },
};

function jsonResponse(status: number, body: Record<string, unknown>) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

function isAdult(dateOfBirth: unknown) {
    if (typeof dateOfBirth !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
        return false;
    }
    const birthDate = new Date(`${dateOfBirth}T00:00:00Z`);
    if (Number.isNaN(birthDate.getTime()) || birthDate.toISOString().slice(0, 10) !== dateOfBirth) {
        return false;
    }
    const today = new Date();
    let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
    const monthDifference = today.getUTCMonth() - birthDate.getUTCMonth();
    if (monthDifference < 0 || (monthDifference === 0 && today.getUTCDate() < birthDate.getUTCDate())) {
        age--;
    }
    return age >= 18 && birthDate <= today;
}

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    if (request.method !== "POST") {
        return jsonResponse(405, { error: "Método não permitido." });
    }

    const expectedKey = Deno.env.get("IDG_PUBLIC_KEY");
    if (!expectedKey || request.headers.get("apikey") !== expectedKey) {
        return jsonResponse(401, { error: "Não foi possível validar o envio." });
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 16384) {
        return jsonResponse(413, { error: "O formulário excede o tamanho permitido." });
    }

    let parsedBody: unknown;
    try {
        const rawBody = await request.text();
        if (new TextEncoder().encode(rawBody).byteLength > 16384) {
            return jsonResponse(413, { error: "O formulário excede o tamanho permitido." });
        }
        parsedBody = JSON.parse(rawBody);
    } catch {
        return jsonResponse(400, { error: "Os dados enviados não são válidos." });
    }
    if (typeof parsedBody !== "object" || parsedBody === null || Array.isArray(parsedBody)) {
        return jsonResponse(400, { error: "Os dados enviados não são válidos." });
    }
    const body = parsedBody as Record<string, unknown>;

    if (typeof body.website === "string" && body.website.trim()) {
        return jsonResponse(400, { error: "Não foi possível enviar o formulário." });
    }

    const type = body.applicationType;
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const details = body.details;

    if (
        typeof type !== "string" || !applicationTypes.has(type) ||
        !fullName || fullName.length > 120 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
        !phone || phone.length > 40 ||
        body.privacyConsent !== true ||
        typeof details !== "object" || details === null || Array.isArray(details) ||
        JSON.stringify(details).length > 10000
    ) {
        return jsonResponse(400, { error: "Confira os campos obrigatórios e tente novamente." });
    }

    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    const allowedHostname = Deno.env.get("IDG_ALLOWED_HOSTNAME");
    if (
        !turnstileSecret || !allowedHostname ||
        typeof body.turnstileToken !== "string" || !body.turnstileToken
    ) {
        return jsonResponse(503, { error: "A proteção antispam ainda não está configurada. Nenhum dado foi enviado." });
    }
    const turnstileBody = new URLSearchParams({
        secret: turnstileSecret,
        response: body.turnstileToken,
    });
    let captchaValid = false;
    try {
        const captchaResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: turnstileBody,
        });
        const captchaResult = await captchaResponse.json();
        captchaValid = captchaResponse.ok &&
            captchaResult.success === true &&
            captchaResult.hostname === allowedHostname;
    } catch {
        return jsonResponse(503, { error: "Não foi possível validar a proteção antispam. Tente novamente." });
    }
    if (!captchaValid) {
        return jsonResponse(400, { error: "A verificação antispam expirou ou não foi concluída. Tente novamente." });
    }

    const rawDetails = details as Record<string, unknown>;
    const rules = detailRules[type as string];
    const safeDetails: Record<string, string> = {};
    for (const [field, rule] of Object.entries(rules)) {
        const value = rawDetails[field];
        if (typeof value !== "string") {
            if (rule.required) {
                return jsonResponse(400, { error: "Preencha todos os campos obrigatórios." });
            }
            continue;
        }
        const normalizedValue = value.trim();
        if (normalizedValue.length > rule.max || (rule.required && !normalizedValue)) {
            return jsonResponse(400, { error: "Confira os campos obrigatórios e o tamanho das respostas." });
        }
        if (normalizedValue) safeDetails[field] = normalizedValue;
    }

    if (type === "beneficiary") {
        if (!["yes", "no"].includes(safeDetails.involves_minor)) {
            return jsonResponse(400, { error: "Informe se a solicitação envolve uma criança ou adolescente." });
        }
        if (safeDetails.involves_minor === "yes") {
            if (
                !safeDetails.minor_first_name ||
                !["Até 5 anos", "6 a 11 anos", "12 a 17 anos"].includes(safeDetails.minor_age_range)
            ) {
                return jsonResponse(400, { error: "Informe o primeiro nome e a faixa etária da pessoa menor de idade." });
            }
        } else {
            delete safeDetails.minor_first_name;
            delete safeDetails.minor_age_range;
        }
    }
    const allowedOptions: Record<string, string[]> = {
        volunteer: [
            "Esporte", "Educação", "Atividades com crianças e jovens",
            "Cursos profissionalizantes", "Eventos e ações sociais",
            "Comunicação e redes sociais", "Apoio administrativo", "Outra área",
        ],
        beneficiary: [
            "Informações sobre projetos", "Participação em uma ação social",
            "Apoio para minha família", "Outro tipo de orientação",
        ],
        sponsor: [
            "Apoio financeiro", "Doação de materiais, alimentos ou equipamentos",
            "Apoio a cursos", "Disponibilização de espaço", "Serviços profissionais",
            "Voluntariado", "Divulgação", "Realização conjunta de ação ou projeto",
            "Outra forma de parceria",
        ],
        donation: [
            "Alimentos", "Roupas ou brinquedos", "Materiais escolares",
            "Materiais para cursos e oficinas",
            "Equipamentos ou itens para ações sociais", "Serviços profissionais",
            "Patrocínio a projetos", "Patrocínio a eventos e ações",
            "Apoio financeiro — quero conversar com a equipe", "Outro tipo de doação",
        ],
    };
    const optionField = type === "volunteer"
        ? "interests"
        : type === "beneficiary"
            ? "support_type"
            : type === "sponsor"
                ? "support_type"
                : type === "donation"
                    ? "donation_type"
                    : null;
    if (
        optionField &&
        !allowedOptions[type as string].includes(safeDetails[optionField])
    ) {
        return jsonResponse(400, { error: "Selecione uma das opções disponíveis no formulário." });
    }

    if ((type === "volunteer" || type === "course") && !isAdult(safeDetails.date_of_birth)) {
        return jsonResponse(400, { error: "As inscrições para voluntariado e cursos são destinadas a pessoas com 18 anos ou mais." });
    }
    if (type === "course" && !courseNames.has(safeDetails.course_name)) {
        return jsonResponse(400, { error: "Selecione um dos cursos disponíveis." });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
        console.error("Submission service is missing Supabase server configuration.");
        return jsonResponse(500, { error: "O serviço de cadastro ainda não está configurado. Nenhum dado foi enviado." });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: insertError } = await serviceClient.from("applications").insert({
        application_type: type,
        full_name: fullName,
        email,
        phone,
        details: safeDetails,
        privacy_consent: true,
    });
    if (insertError) {
        console.error("Could not save application:", insertError.message);
        return jsonResponse(500, { error: "Não foi possível salvar o formulário. Tente novamente mais tarde." });
    }

    let emailSent = false;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const sender = Deno.env.get("IDG_FROM_EMAIL");
    if (resendKey && sender) {
        try {
            const response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${resendKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: sender,
                    to: [email],
                    subject: "Recebemos sua solicitação — Instituto Desafiando Gigantes",
                    text: `Olá, ${fullName}.\n\nRecebemos seu envio para o Instituto Desafiando Gigantes. A equipe irá analisar as informações e entrará em contato pelos dados informados. O envio não confirma vaga, benefício ou parceria.\n\nInstituto Desafiando Gigantes`,
                }),
            });
            emailSent = response.ok;
            if (!response.ok) {
                console.error("Email confirmation provider returned status:", response.status);
            }
        } catch (error) {
            console.error("Could not send application confirmation email:", error instanceof Error ? error.message : "unknown error");
        }
    }

    return jsonResponse(201, { received: true, emailSent });
});
