begin;

create table public.idg_finance_opening_balance (
  id boolean primary key default true check (id),
  amount numeric(14,2) not null,
  opening_date date not null
);

alter table public.idg_finance_opening_balance enable row level security;
revoke all on public.idg_finance_opening_balance from public, anon, authenticated;
grant select, insert on public.idg_finance_opening_balance to authenticated;
create policy "IDG admins read opening balance" on public.idg_finance_opening_balance
  for select to authenticated using ((select public.is_idg_admin()));
create policy "IDG admins record opening balance" on public.idg_finance_opening_balance
  for insert to authenticated with check (
    (select public.is_idg_admin())
    and opening_date <= (now() at time zone 'America/Sao_Paulo')::date
  );

alter table public.idg_finance_entries
  add column rent_month date,
  add constraint idg_finance_rent_month_check check (
    rent_month is null or (kind = 'saida' and extract(day from rent_month) = 1)
  );

alter table public.partner_accountability_reports
  add column finance_balance numeric(14,2),
  add column finance_balance_date date,
  add constraint idg_report_finance_balance_check
    check ((finance_balance is null) = (finance_balance_date is null));

create function public.idg_finance_summary(p_date date default null)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with reference as (
    select least(coalesce(p_date, today), today) as as_of
    from (select (now() at time zone 'America/Sao_Paulo')::date as today) local_date
  ), totals as (
    select r.as_of, o.opening_date,
      case when o.opening_date <= r.as_of then o.amount + coalesce(sum(
        case e.kind when 'entrada' then e.amount else -e.amount end
      ) filter (where e.entry_date >= o.opening_date), 0) end as balance,
      coalesce(sum(e.amount) filter (
        where e.rent_month = date_trunc('month', r.as_of::timestamp)::date
      ), 0) as rent_paid
    from reference r
    left join public.idg_finance_opening_balance o on o.id
    left join public.idg_finance_entries e on e.entry_date <= r.as_of
    group by r.as_of, o.opening_date, o.amount
  )
  select jsonb_build_object(
    'as_of', as_of,
    'opening_date', opening_date,
    'balance', balance,
    'rent_due_date', date_trunc('month', as_of::timestamp)::date + 9,
    'rent_amount', 1200,
    'rent_paid', rent_paid,
    'rent_remaining', greatest(1200 - rent_paid, 0)
  )
  from totals
  where (select public.is_idg_admin());
$$;

revoke all on function public.idg_finance_summary(date) from public, anon, authenticated;
grant execute on function public.idg_finance_summary(date) to authenticated;

create function public.idg_finance_record(
  p_id uuid, p_entry jsonb, p_file_name text default null, p_storage_path text default null
)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  rent_period date := (p_entry->>'rent_month')::date;
  saved_id uuid;
begin
  if not (select public.is_idg_admin()) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  select id into saved_id from public.idg_finance_entries where id = p_id;
  if found then
    return saved_id;
  end if;

  if (p_file_name is null) <> (p_storage_path is null)
      or (rent_period is not null and p_storage_path is null) then
    raise exception 'Anexe o comprovante do pagamento.';
  end if;

  if p_storage_path is not null and (
    split_part(p_storage_path, '/', 1) <> p_id::text
    or not exists (
      select 1 from storage.objects
      where bucket_id = 'idg-finance-receipts' and name = p_storage_path
    )
  ) then
    raise exception 'O comprovante ainda não foi recebido.';
  end if;

  insert into public.idg_finance_entries
    (id, kind, description, category, project, amount, entry_date, rent_month)
  values (
    p_id, p_entry->>'kind', p_entry->>'description', p_entry->>'category',
    p_entry->>'project', (p_entry->>'amount')::numeric, (p_entry->>'entry_date')::date, rent_period
  )
  on conflict (id) do nothing
  returning id into saved_id;

  if saved_id is not null and p_storage_path is not null then
    insert into public.idg_finance_receipts (entry_id, file_name, storage_path)
    values (saved_id, p_file_name, p_storage_path);
  end if;

  return p_id;
end;
$$;

revoke all on function public.idg_finance_record(uuid, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.idg_finance_record(uuid, jsonb, text, text) to authenticated;

commit;
