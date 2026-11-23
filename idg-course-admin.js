(() => {
    "use strict";

    const panel = document.getElementById("idg-course-availability");
    const list = document.getElementById("idg-course-availability-list");
    const message = document.getElementById("idg-course-availability-message");
    const config = window.IDG_SUPABASE_CONFIG;
    if (!panel || !config?.url || !config?.publishableKey || !window.supabase) return;

    const client = window.supabase.createClient(config.url, config.publishableKey);
    const table = "idg_course_availability";
    let sessionCheck = 0;

    async function loadCourses() {
        const { data, error } = await client.from(table)
            .select("course_name,is_open").order("course_name");
        if (error) throw error;
        if (panel.hidden) return;
        list.replaceChildren(...data.map(courseItem));
    }

    function courseItem({ course_name: name, is_open: open }) {
        const row = document.createElement("div");
        row.className = "item";
        const info = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = name;
        const status = document.createElement("div");
        status.className = "muted";
        status.textContent = open ? "Inscrições abertas" : "Aguarde novas turmas";
        info.append(title, status);

        const button = document.createElement("button");
        button.type = "button";
        button.className = open ? "secondary" : "";
        button.textContent = open ? "Encerrar inscrições" : "Abrir inscrições";
        button.setAttribute("aria-label", `${button.textContent} para ${name}`);
        button.addEventListener("click", async () => {
            button.disabled = true;
            try {
                const { data, error } = await client.from(table).update({ is_open: !open })
                    .eq("course_name", name).eq("is_open", open).select("course_name").maybeSingle();
                if (error) throw error;
                message.textContent = data
                    ? `${name} · ${open ? "Inscrições encerradas" : "Inscrições abertas"}.`
                    : "O status já foi alterado. A lista foi atualizada.";
                await loadCourses();
            } catch {
                message.textContent = "Não foi possível confirmar a alteração. Confira o status e tente novamente.";
            } finally {
                button.disabled = false;
            }
        });

        row.append(info, button);
        return row;
    }

    async function showForAdmin() {
        const check = ++sessionCheck;
        try {
            const { data: { user } } = await client.auth.getUser();
            if (!user || check !== sessionCheck) return;
            const { data, error } = await client.rpc("is_idg_admin");
            if (check !== sessionCheck || error || !data) return;
            panel.hidden = false;
            await loadCourses();
        } catch {
            message.textContent = "Não foi possível carregar a disponibilidade dos cursos.";
        }
    }

    client.auth.onAuthStateChange(event => {
        if (event === "SIGNED_OUT") {
            sessionCheck++;
            panel.hidden = true;
            list.replaceChildren();
            message.textContent = "";
        } else if (event === "SIGNED_IN") {
            setTimeout(showForAdmin, 0);
        }
    });

    void showForAdmin();
})();
