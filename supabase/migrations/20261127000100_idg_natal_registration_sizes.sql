alter table public.idg_event_registrations
    add column if not exists clothing_size text,
    add column if not exists shoe_size text;

create or replace function public.idg_validate_natal_registration_sizes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if exists (
        select 1
        from public.idg_events as event
        where event.id = new.event_id
          and btrim(event.title) ~* '^natal[[:space:]]+solid[aá]rio([^[:alnum:]_]|$)'
    ) then
        new.clothing_size := btrim(new.clothing_size);
        new.shoe_size := btrim(new.shoe_size);
        if char_length(coalesce(new.clothing_size, '')) not between 1 and 30
            or coalesce(new.shoe_size, '') !~ '^[0-9]{1,2}(/[0-9]{1,2})?$' then
            raise exception 'Informe o tamanho da roupa e o número do calçado (BR).'
                using errcode = '23514';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists idg_validate_natal_registration_sizes on public.idg_event_registrations;
create trigger idg_validate_natal_registration_sizes
before insert or update of event_id, clothing_size, shoe_size on public.idg_event_registrations
for each row execute function public.idg_validate_natal_registration_sizes();
