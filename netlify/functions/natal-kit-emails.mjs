export const config = { schedule: "*/5 * * * *" };
const institute = "Instituto Desafiando Gigantes";
const team = "despertando.idg@gmail.com";
export default async function () {
  const { SUPABASE_SERVICE_ROLE_KEY: key, RESEND_API_KEY: mailKey, NATAL_EMAIL_FROM: from } = process.env;
  if (!key || !mailKey || !from) throw new Error("Configure as três variáveis de e-mail do Natal Solidário.");
  const endpoint = "https://ejbgxvvgpjagempjromj.supabase.co/rest/v1/idg_kit_reservations";
  const headers = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
  const response = await fetch(endpoint + "?or=(donor_sent.eq.false,team_sent.eq.false)&order=created_at.asc&limit=10", { headers });
  if (!response.ok) throw new Error("Falha ao consultar confirmações pendentes.");
  let failed = false;
  for (const row of await response.json()) {
    for (const field of ["donor_sent", "team_sent"]) {
      if (row[field]) continue;
      const donor = field === "donor_sent";
      const when = new Date(row.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const text = [
        donor ? "Obrigada por participar do Natal Solidário 2026!" : "Um parceiro confirmou um kit complementar.",
        "Criança: " + row.child_name, "Modalidade: Kit complementar",
        "Presente: " + (row.gift || "À escolha de quem apadrinhou"),
        !donor && "Contato do parceiro: " + row.email, "Confirmação: " + when,
        "Entrega da doação: " + row.delivery, "Natal Solidário: " + row.event_details,
        institute, team, "@institutodesafiandogigantes"
      ].filter(Boolean).join("\n\n");
      const sent = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: "Bearer " + mailKey, "Content-Type": "application/json",
          "Idempotency-Key": "natal26-" + encodeURIComponent(row.child_id) + "-" + field },
        body: JSON.stringify({ from, to: donor ? row.email : team, reply_to: team,
          subject: "Kit de " + row.child_name + " — apadrinhamento confirmado", text })
      });
      if (!sent.ok) { failed = true; continue; }
      const saved = await fetch(endpoint + "?child_id=eq." + encodeURIComponent(row.child_id), {
        method: "PATCH", headers, body: JSON.stringify({ [field]: true })
      });
      if (!saved.ok) failed = true;
    }
  }
  if (failed) throw new Error("Há confirmações pendentes para a próxima tentativa.");
}
