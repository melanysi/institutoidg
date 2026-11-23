(() => {
  "use strict";

  const cfg = window.IDG_SUPABASE_CONFIG;
  if (!cfg || !window.supabase) return;
  const db = window.supabase.createClient(cfg.url, cfg.publishableKey);
  const $ = id => document.getElementById(id);
  const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const localDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" });
  const money = value => value == null ? "—" : currency.format(value);
  const dateLabel = date => date.split("-").reverse().join("/");
  const message = text => { $("finance-message").textContent = text; };
  const bucket = db.storage.from("idg-finance-receipts");
  const fileTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  let entries = [];
  let receipts = [];
  let pendingEntry;
  let loadSequence = 0;

  async function allRows(table, dateColumn) {
    const rows = [];
    const pageSize = 500;
    let offset = 0;
    while (true) {
      const { data, error } = await db.from(table).select("*")
        .order(dateColumn, { ascending: false }).order("id").range(offset, offset + pageSize - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < pageSize) return rows;
      offset += pageSize;
    }
  }

  function renderSummary(summary) {
    const { balance, rent_due_date: dueDate, rent_amount: rent,
      rent_paid: paid, rent_remaining: remaining, opening_date: openingDate, as_of: today } = summary;
    const reserved = balance == null ? null : Math.min(Math.max(balance, 0), remaining);
    $("finance-balance").textContent = money(balance);
    $("finance-reserved").textContent = money(reserved);
    $("finance-shortfall").textContent = money(reserved == null ? null : remaining - reserved);
    $("finance-available").textContent = money(reserved == null ? null : Math.max(0, balance - reserved));
    const status = remaining === 0 ? "Pago" : today > dueDate ? "Em atraso" : "Pendente";
    const outstanding = remaining > 0 ? ` · Falta pagar ${money(remaining)}` : "";
    $("finance-rent-status").textContent =
      `Aluguel do mês · ${money(rent)} · Vencimento ${dateLabel(dueDate)} · ${status} · Pago ${money(paid)}${outstanding}`;
    $("finance-opening-form").hidden = Boolean(openingDate);
    $("finance-opening-note").textContent = openingDate
      ? `Saldo inicial registrado em ${dateLabel(openingDate)}.`
      : "Registre o saldo inicial para calcular o saldo atual e a reserva.";
  }

  function filtered() {
    const month = $("finance-month").value;
    const project = $("finance-project-filter").value.trim().toLowerCase();
    return entries.filter(entry => (!month || entry.entry_date.startsWith(month)) &&
      (!project || (entry.project || "").toLowerCase().includes(project)));
  }

  function columnTotal(data, kind) {
    return data.reduce((cents, entry) => cents +
      (entry.kind === kind ? Math.round(Number(entry.amount) * 100) : 0), 0) / 100;
  }

  function button(label, className, action) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = className;
    element.textContent = label;
    element.addEventListener("click", () => run(element, action));
    return element;
  }

  function receiptInput(label, action) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.png,.jpg,.jpeg,.webp";
    input.setAttribute("aria-label", label);
    input.addEventListener("change", () => {
      const file = input.files[0];
      if (file) run(input, () => action(file));
    });
    return input;
  }

  function renderEntries() {
    const data = filtered();
    $("finance-income").textContent = money(columnTotal(data, "entrada"));
    $("finance-expense").textContent = money(columnTotal(data, "saida"));
    const root = $("finance-list");
    root.replaceChildren();
    if (!data.length) root.textContent = "Nenhuma movimentação para este filtro.";

    for (const entry of data) {
      const box = document.createElement("article");
      box.className = "finance-item";
      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = entry.description;
      const detail = document.createElement("p");
      const rentMonth = entry.rent_month?.split("-").slice(0, 2).reverse().join("/");
      detail.textContent = [dateLabel(entry.entry_date), entry.category, entry.project,
        entry.kind === "entrada" ? "Entrada" : "Saída",
        rentMonth && `Aluguel de ${rentMonth}`].filter(Boolean).join(" · ");
      info.append(title, detail);
      const value = document.createElement("strong");
      value.textContent = (entry.kind === "entrada" ? "+ " : "− ") + money(entry.amount);
      const actions = document.createElement("div");
      actions.className = "finance-actions";
      actions.append(receiptInput(`Anexar comprovante de ${entry.description}`,
        file => saveReceipt(entry, file)));
      const documents = receipts.filter(receipt => receipt.entry_id === entry.id);
      for (const receipt of documents) {
        const label = document.createElement("label");
        label.textContent = "Trocar comprovante";
        label.append(receiptInput(`Trocar ${receipt.file_name}`, file => saveReceipt(entry, file, receipt)));
        actions.append(button(`Abrir: ${receipt.file_name}`, "secondary", async () => {
          const { data, error } = await bucket.createSignedUrl(receipt.storage_path, 60);
          if (error) throw error;
          window.open(data.signedUrl, "_blank", "noopener");
        }), label);
      }
      actions.append(button("Excluir", "danger", async () => {
        if (!confirm("Excluir movimentação e comprovantes associados?")) return;
        const { error } = await db.from("idg_finance_entries").delete().eq("id", entry.id);
        if (error) throw error;
        const cleanup = documents.length && await bucket.remove(documents.map(doc => doc.storage_path));
        await load();
        message(cleanup?.error ? "Movimentação excluída. Falhou a remoção dos arquivos privados." : "Movimentação excluída.");
      }));
      box.append(info, value, actions);
      root.append(box);
    }
  }

  async function load() {
    const request = ++loadSequence;
    const [summary, newEntries, newReceipts] = await Promise.all([
      db.rpc("idg_finance_summary"),
      allRows("idg_finance_entries", "entry_date"),
      allRows("idg_finance_receipts", "created_at")
    ]);
    if (request !== loadSequence) return;
    if (summary.error || !summary.data) throw summary.error || Error("Saldo indisponível.");
    entries = newEntries;
    receipts = newReceipts;
    renderSummary(summary.data);
    renderEntries();
  }

  async function run(control, action) {
    control.disabled = true;
    try {
      await action();
    } catch (error) {
      message(error.message);
    } finally {
      control.disabled = false;
    }
  }

  function checkFile(file) {
    if (file.size > 10485760 || !fileTypes.includes(file.type)) {
      throw Error("Use um comprovante em PDF, JPG, PNG ou WEBP de até 10 MB.");
    }
  }

  function receiptPath(id, file) {
    return `${id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  }

  function upload(path, file) {
    return bucket.upload(path, file, { contentType: file.type });
  }

  async function saveReceipt(entry, file, previous) {
    checkFile(file);
    const path = receiptPath(entry.id, file);
    const { error } = await upload(path, file);
    if (error) throw error;
    const payload = { file_name: file.name, storage_path: path };
    const save = previous
      ? db.from("idg_finance_receipts").update(payload).eq("id", previous.id).eq("storage_path", previous.storage_path)
      : db.from("idg_finance_receipts").insert({ ...payload, entry_id: entry.id });
    const result = await save.select("id").maybeSingle();
    if (!result.data) {
      const check = await db.from("idg_finance_receipts").select("id").eq("storage_path", path).maybeSingle();
      if (!check.data) {
        if (!check.error) await bucket.remove([path]);
        throw result.error || Error("O comprovante foi alterado por outra pessoa. Recarregue a página.");
      }
    }
    const cleanup = previous && await bucket.remove([previous.storage_path]);
    await load();
    message(cleanup?.error ? "Novo comprovante salvo. Falhou a remoção do arquivo anterior."
      : previous ? "Comprovante substituído." : "Comprovante anexado.");
  }

  function updateEntryFields() {
    const rent = $("finance-kind").value === "aluguel";
    $("finance-category-field").hidden = rent;
    $("finance-category").required = !rent;
    $("finance-rent-field").hidden = !rent;
    $("finance-rent-month").required = rent;
    $("finance-file").required = rent;
    if (rent) {
      $("finance-rent-month").value ||= localDate.format(new Date()).slice(0, 7);
      $("finance-description").value ||= "Pagamento de aluguel";
    }
  }

  function defaults() {
    const today = localDate.format(new Date());
    $("finance-date").value = today;
    $("finance-date").max = today;
    $("finance-opening-date").value = today;
    $("finance-opening-date").max = today;
    $("finance-rent-month").value = today.slice(0, 7);
    updateEntryFields();
  }

  const financeForm = $("finance-form");
  financeForm.addEventListener("submit", event => {
    event.preventDefault();
    run(financeForm.querySelector('button[type="submit"]'), async () => {
      const kind = $("finance-kind").value;
      const rent = kind === "aluguel";
      const file = $("finance-file").files[0];
      if (file) checkFile(file);
      const entry = {
        kind: rent ? "saida" : kind,
        description: $("finance-description").value.trim(),
        category: rent ? "Aluguel" : $("finance-category").value.trim(),
        project: $("finance-project").value.trim(),
        amount: $("finance-amount").value,
        entry_date: $("finance-date").value,
        rent_month: rent ? `${$("finance-rent-month").value}-01` : null
      };
      if (!entry.description || !entry.category) throw Error("Preencha a descrição e a categoria.");
      const signature = JSON.stringify(entry);
      if (pendingEntry?.signature !== signature || pendingEntry?.file !== file) {
        const id = crypto.randomUUID();
        pendingEntry = { id, signature, file, path: file ? receiptPath(id, file) : null };
      }
      const { id, path } = pendingEntry;
      if (file && !pendingEntry.uploaded) {
        const result = await upload(path, file);
        if (result.error) {
          const { data } = await bucket.createSignedUrl(path, 60);
          if (!data?.signedUrl) throw result.error;
        }
        pendingEntry.uploaded = true;
      }
      const { error } = await db.rpc("idg_finance_record", {
        p_id: id, p_entry: entry, p_file_name: file?.name ?? null, p_storage_path: path
      });
      if (error) throw error;
      pendingEntry = undefined;
      financeForm.reset();
      defaults();
      message("Movimentação registrada.");
      await load();
    });
  });

  const openingForm = $("finance-opening-form");
  openingForm.addEventListener("submit", event => {
    event.preventDefault();
    run(openingForm.querySelector('button[type="submit"]'), async () => {
      const { error } = await db.from("idg_finance_opening_balance").insert({
        amount: $("finance-opening-amount").value, opening_date: $("finance-opening-date").value
      });
      if (error && error.code !== "23505") throw error;
      await load();
      message(error ? "O saldo inicial já foi registrado." : "Saldo inicial registrado.");
    });
  });

  $("finance-kind").addEventListener("change", updateEntryFields);
  $("finance-month").addEventListener("change", renderEntries);
  $("finance-project-filter").addEventListener("input", renderEntries);
  $("finance-export").addEventListener("click", () => {
    const rows = [["Data", "Tipo", "Descrição", "Categoria", "Projeto", "Valor", "Mês do aluguel"],
      ...filtered().map(entry => [entry.entry_date, entry.kind, entry.description,
        entry.category, entry.project, entry.amount, entry.rent_month?.slice(0, 7)])];
    const escapeCsv = value => {
      const text = String(value ?? "");
      const safe = typeof value === "string" && /^[\s]*[=+@-]/.test(text) ? "'" + text : text;
      return '"' + safe.replace(/"/g, '""') + '"';
    };
    const csv = "\ufeff" + rows.map(row => row.map(escapeCsv).join(";")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = "prestacao-contas-idg.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
  $("finance-print").addEventListener("click", () => window.print());

  async function start() {
    $("finance-module").hidden = true;
    const { data: { user } } = await db.auth.getUser();
    if (!user) return;
    const { data: allowed, error } = await db.rpc("is_idg_admin");
    if (error) throw error;
    if (!allowed) return;
    await load();
    $("finance-module").hidden = false;
  }
  db.auth.onAuthStateChange(event => {
    if (event === "SIGNED_OUT" || event === "SIGNED_IN") {
      setTimeout(() => start().catch(error => message(error.message)), 0);
    }
  });
  defaults();
  start().catch(error => message(error.message));
})();
