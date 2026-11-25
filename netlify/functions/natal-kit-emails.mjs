export const config = { schedule: "*/5 * * * *" };
const institute = "Instituto Desafiando Gigantes";
const team = "despertando.idg@gmail.com";
const website = "https://idgoficial.netlify.app";
const instagram = "https://www.instagram.com/institutodesafiandogigantes/";
function escapeHtml(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value).replace(/[&<>"']/g, char => entities[char]);
}
function confirmation(row, donor, when) {
  const heading = donor ? "Seu apadrinhamento está confirmado!" : "Novo kit apadrinhado";
  const intro = donor
    ? `Obrigada por apadrinhar o kit complementar de ${row.child_name}! Guarde estas informações para o dia da entrega.`
    : `O kit complementar de ${row.child_name} foi apadrinhado. Confira os detalhes para acompanhar a doação.`;
  const details = [
    ["Presente", row.gift || "À escolha de quem apadrinhou"],
    ["Onde e quando entregar", row.delivery],
    ["Data e local do Natal Solidário", row.event_details],
    ["Apadrinhamento confirmado em", when]
  ];
  if (!donor) details.unshift(["Contato de quem apadrinhou", row.email]);
  const text = [heading, intro, ...details.map(([label, value]) => label + ": " + value),
    institute, team, "Instagram: " + instagram, "Site: " + website].join("\n\n");
  const blocks = details.map(([label, value]) =>
    `<p style="margin:0 0 16px"><strong>${label}</strong><br>${escapeHtml(value).replace(/\r?\n/g,"<br>")}</p>`
  ).join("");
  const html = `<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width, initial-scale=1"><body style="margin:0;background:#f7f3ec;color:#302623;font:16px/1.5 Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#fff;text-align:left">
    <tr><td style="padding:24px;background:#812536;color:white"><strong>Natal Solidário 2026</strong><h1 style="font-size:25px;line-height:1.2;margin:10px 0 0">${heading}</h1></td></tr>
    <tr><td style="padding:24px"><p style="margin:0 0 22px">${escapeHtml(intro)}</p>${blocks}</td></tr>
    <tr><td style="padding:24px;background:#fff8ec;border-top:2px solid #c59450">
    <img src="${website}/images/idg_logo_transparente.png" width="88" alt="IDG" style="display:block;margin-bottom:12px">
    <strong>${institute}</strong><br><a style="color:#812536" href="${instagram}">@institutodesafiandogigantes</a><br>
    <a style="color:#812536" href="${website}">Site do Instituto</a> · <a style="color:#812536" href="mailto:${team}">Fale com a equipe</a>
    </td></tr></table></td></tr></table></body></html>`;
  return { text, html };
}
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
      const message = confirmation(row, donor, when);
      const sent = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: "Bearer " + mailKey, "Content-Type": "application/json",
          "Idempotency-Key": "natal26-" + encodeURIComponent(row.child_id) + "-" + field },
        body: JSON.stringify({ from, to: donor ? row.email : team, reply_to: team,
          subject: "Kit de " + row.child_name + " — apadrinhamento confirmado", ...message })
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
