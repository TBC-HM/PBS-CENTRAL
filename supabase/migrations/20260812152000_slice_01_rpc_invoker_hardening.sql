-- Preserve RLS for every Slice 01 transition and remove anonymous execution.

alter function public.kos_slice_decide_approval(uuid,uuid,boolean,text) security invoker;
alter function public.kos_slice_execute_action(uuid,uuid,text) security invoker;
alter function public.kos_slice_verify_outcome(uuid,uuid,uuid,text) security invoker;

revoke all on function public.kos_slice_record_decision(uuid,uuid,text,text,text) from anon;
revoke all on function public.kos_slice_decide_approval(uuid,uuid,boolean,text) from anon;
revoke all on function public.kos_slice_execute_action(uuid,uuid,text) from anon;
revoke all on function public.kos_slice_verify_outcome(uuid,uuid,uuid,text) from anon;
