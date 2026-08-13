alter function public.kos_update_contact(uuid,uuid,text,text,text,text,uuid,text) security invoker;
alter function public.kos_add_contact_note(uuid,uuid,text) security invoker;
alter function public.kos_create_follow_up(uuid,uuid,text,date,smallint) security invoker;
