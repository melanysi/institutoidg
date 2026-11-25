begin;
create table public.idg_kit_settings (
 year integer primary key check (year=2026), delivery text not null default '',
 event_details text not null default '', open boolean not null default false,
 check (not open or (trim(delivery)<>'' and trim(event_details)<>''))
);
insert into public.idg_kit_settings(year) values (2026);
create table public.idg_kit_reservations (
 child_id text primary key, child_name text not null, sponsor uuid not null,
 email text not null, gift text not null check(length(gift)<=180),
 created_at timestamptz not null default now(), delivery text not null, event_details text not null,
 stage text not null default 'Aguardando recebimento' check(stage in ('Aguardando recebimento','Recebido','Separado','Entregue')),
 donor_sent boolean not null default false, team_sent boolean not null default false
);
alter table public.idg_kit_settings enable row level security;
alter table public.idg_kit_reservations enable row level security;
revoke all on public.idg_kit_settings, public.idg_kit_reservations from public, anon, authenticated;
grant select, update(delivery,event_details,open) on public.idg_kit_settings to authenticated;
grant select(child_id,child_name,email,gift,created_at,stage),update(stage) on public.idg_kit_reservations to authenticated;
grant select,update(donor_sent,team_sent) on public.idg_kit_reservations to service_role;
create function public.idg_kit_partner() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select from public.partner_portal_access p join public.applications a on a.id=p.application_id
 where p.user_id=auth.uid() and p.is_active and a.status='approved')
$$;
create policy kit_settings_read on public.idg_kit_settings for select to authenticated using(public.is_idg_admin() or public.idg_kit_partner());
create policy kit_settings_edit on public.idg_kit_settings for update to authenticated using(public.is_idg_admin()) with check(public.is_idg_admin());
create policy kit_team_read on public.idg_kit_reservations for select to authenticated using(public.is_idg_admin());
create policy kit_team_update on public.idg_kit_reservations for update to authenticated using(public.is_idg_admin()) with check(public.is_idg_admin());
create function public.idg_reserved_kits() returns table(child_id text,mine boolean) language sql stable security definer set search_path='' as $$
 select r.child_id,r.sponsor=auth.uid() from public.idg_kit_reservations r where public.idg_kit_partner()
$$;
create function public.idg_reserve_kit(child text, present text default '') returns void language plpgsql security definer set search_path='' as $$
declare settings public.idg_kit_settings; recipient text; contact text;
begin
 if not public.idg_kit_partner() then raise exception 'Acesso exclusivo para parceiros aprovados.'; end if;
 if exists(select from public.idg_kit_reservations where child_id=child and sponsor=auth.uid()) then return; end if;
 select * into settings from public.idg_kit_settings where year=2026 and open for share;
 if not found then raise exception 'A campanha de kits está fechada.'; end if;
 select nome_crianca into strict recipient from public.idg_natal_partner_cards where id_origem::text=child;
 select email into strict contact from auth.users where id=auth.uid();
 insert into public.idg_kit_reservations(child_id,child_name,sponsor,email,gift,delivery,event_details)
 values(child,recipient,auth.uid(),contact,trim(coalesce(present,'')),settings.delivery,settings.event_details)
 on conflict(child_id) do nothing;
 if not exists(select from public.idg_kit_reservations where child_id=child and sponsor=auth.uid()) then
 raise exception 'Este kit já foi apadrinhado.'; end if;
end $$;
revoke all on function public.idg_kit_partner(), public.idg_reserved_kits(), public.idg_reserve_kit(text,text) from public,anon;
grant execute on function public.idg_kit_partner(), public.idg_reserved_kits(), public.idg_reserve_kit(text,text) to authenticated;
commit;
