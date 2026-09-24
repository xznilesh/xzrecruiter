-- XZ Recruiter locked roadmap Step 3: Recruiter Execution Workspace.
-- Extends existing candidate/application/task/activity systems. No Step-4 scoring/intelligence.

alter table public.recruitment_jobs add column if not exists submission_target_total integer not null default 0;
alter table public.recruitment_jobs add column if not exists submission_target_daily integer not null default 0;
alter table public.recruitment_jobs drop constraint if exists recruitment_jobs_submission_target_total_check;
alter table public.recruitment_jobs add constraint recruitment_jobs_submission_target_total_check check (submission_target_total between 0 and 10000);
alter table public.recruitment_jobs drop constraint if exists recruitment_jobs_submission_target_daily_check;
alter table public.recruitment_jobs add constraint recruitment_jobs_submission_target_daily_check check (submission_target_daily between 0 and 1000);

alter table public.candidate_submissions add column if not exists invalidated_at timestamptz;
alter table public.candidate_submissions add column if not exists withdrawn_at timestamptz;
create index if not exists idx_xzr_submission_daily_target on public.candidate_submissions(agency_id,job_id,created_by_user_id,client_submitted_at) where workflow_status='CLIENT_SUBMITTED' and status='SUBMITTED' and invalidated_at is null and withdrawn_at is null;

create table if not exists public.requirement_recruiter_assignments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  job_id uuid not null references public.recruitment_jobs(id) on delete cascade,
  recruiter_user_id uuid not null references public.users(id) on delete cascade,
  assignment_status text not null default 'ACTIVE'
    check (assignment_status in ('ACTIVE','PAUSED','COMPLETED','REMOVED')),
  daily_submission_target integer not null default 1 check (daily_submission_target >= 0 and daily_submission_target <= 1000),
  manager_priority text not null default 'NORMAL' check (manager_priority in ('LOW','NORMAL','HIGH','URGENT')),
  manager_instructions text,
  blocker_reason text,
  blocker_owner_user_id uuid references public.users(id) on delete set null,
  assigned_by_user_id uuid not null references public.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(agency_id,job_id,recruiter_user_id)
);

create index if not exists idx_xzr_req_assign_recruiter
  on public.requirement_recruiter_assignments(agency_id,recruiter_user_id,assignment_status,manager_priority,updated_at desc);
create index if not exists idx_xzr_req_assign_job
  on public.requirement_recruiter_assignments(agency_id,job_id,assignment_status);

alter table public.requirement_recruiter_assignments add column if not exists total_submission_target integer not null default 0;
alter table public.requirement_recruiter_assignments add column if not exists blocker_type text;
alter table public.requirement_recruiter_assignments drop constraint if exists requirement_recruiter_assignments_total_target_check;
alter table public.requirement_recruiter_assignments add constraint requirement_recruiter_assignments_total_target_check check (total_submission_target between 0 and 10000);

alter table public.requirement_recruiter_assignments enable row level security;
drop policy if exists xzrecruiter_data_api_deny on public.requirement_recruiter_assignments;
create policy xzrecruiter_data_api_deny on public.requirement_recruiter_assignments
for all to anon,authenticated using(false) with check(false);

-- Source attribution belongs to the candidacy/application because the same person can be sourced
-- differently for different requirements.
alter table public.applications add column if not exists source_type text;
alter table public.applications add column if not exists source_reference text;
alter table public.applications add column if not exists sourcing_notes text;
alter table public.applications add column if not exists sourced_by_user_id uuid references public.users(id) on delete set null;
alter table public.applications add column if not exists sourced_at timestamptz;
alter table public.applications add column if not exists intake_idempotency_key text;

alter table public.applications drop constraint if exists applications_source_type_check;
alter table public.applications add constraint applications_source_type_check
check (source_type is null or source_type in (
  'LINKEDIN','MONSTER','DICE','INDEED','NAUKRI','INTERNAL_DATABASE','REFERRAL','APPLICANT','CSV','OTHER'
));

create index if not exists idx_xzr_applications_recruiter_work
  on public.applications(agency_id,owner_user_id,job_id,stage_id,last_activity_at desc);
create index if not exists idx_xzr_applications_source
  on public.applications(agency_id,job_id,source_type,sourced_at desc);
create unique index if not exists uq_xzr_application_intake_idempotency
  on public.applications(agency_id,intake_idempotency_key) where intake_idempotency_key is not null and archived_at is null;

-- Reuse the existing CRM task engine for recruitment execution tasks.
alter table public.crm_tasks add column if not exists job_id uuid references public.recruitment_jobs(id) on delete cascade;
alter table public.crm_tasks add column if not exists candidate_id uuid references public.candidates(id) on delete cascade;
alter table public.crm_tasks add column if not exists application_id uuid references public.applications(id) on delete cascade;
alter table public.crm_tasks add column if not exists task_type text;
alter table public.crm_tasks add column if not exists idempotency_key text;

alter table public.crm_tasks drop constraint if exists crm_task_parent_required;
alter table public.crm_tasks add constraint crm_task_parent_required
check (
  client_id is not null or contact_id is not null or opportunity_id is not null or
  job_id is not null or candidate_id is not null or application_id is not null
);

alter table public.crm_tasks drop constraint if exists crm_task_task_type_check;
alter table public.crm_tasks add constraint crm_task_task_type_check
check (task_type is null or task_type in (
  'CONTACT_CANDIDATE','FOLLOW_UP','COLLECT_RESUME','CONFIRM_AVAILABILITY',
  'SCREENING_DUE','MISSING_INFORMATION','MANAGER_CLARIFICATION'
));

create unique index if not exists uq_xzr_task_idempotency
  on public.crm_tasks(agency_id,idempotency_key)
  where idempotency_key is not null and archived_at is null;
create index if not exists idx_xzr_execution_tasks
  on public.crm_tasks(agency_id,assigned_user_id,status,due_at,job_id)
  where archived_at is null;

create or replace function private.xzrecruiter_step3_business_role(
  p_agency_id uuid,p_user_id uuid,p_membership_role text
) returns text
language sql stable security invoker set search_path='public','private','pg_temp'
as $$
  select private.xzrecruiter_business_role(p_agency_id,p_user_id,p_membership_role);
$$;
revoke all on function private.xzrecruiter_step3_business_role(uuid,uuid,text) from public,anon,authenticated;

create or replace function private.xzrecruiter_is_assigned_recruiter(
  p_agency_id uuid,p_user_id uuid,p_job_id uuid
) returns boolean
language sql stable security invoker set search_path='public','pg_temp'
as $$
  select exists(
    select 1 from public.requirement_recruiter_assignments a
    where a.agency_id=p_agency_id and a.recruiter_user_id=p_user_id and a.job_id=p_job_id
      and a.assignment_status='ACTIVE'
  );
$$;
revoke all on function private.xzrecruiter_is_assigned_recruiter(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function private.xzrecruiter_step3_can_view_job(
  p_agency_id uuid,p_user_id uuid,p_business_role text,p_job_id uuid
) returns boolean
language sql stable security invoker set search_path='public','private','pg_temp'
as $$
  select case
    when upper(coalesce(p_business_role,'')) in ('OWNER','ADMIN','ACCOUNT_MANAGER','RECRUITMENT_MANAGER')
      then exists(select 1 from public.recruitment_jobs j where j.id=p_job_id and j.agency_id=p_agency_id and j.archived_at is null)
    when upper(coalesce(p_business_role,''))='RECRUITER'
      then private.xzrecruiter_is_assigned_recruiter(p_agency_id,p_user_id,p_job_id)
    else false
  end;
$$;
revoke all on function private.xzrecruiter_step3_can_view_job(uuid,uuid,text,uuid) from public,anon,authenticated;

create or replace function private.xzrecruiter_step3_timezone(p_agency_id uuid,p_user_id uuid)
returns text
language sql stable security invoker set search_path='public','pg_temp'
as $
  select coalesce(
    (select s.timezone_id from public.workspace_global_settings s where s.agency_id=p_agency_id limit 1),
    'UTC'
  );
$;
revoke all on function private.xzrecruiter_step3_timezone(uuid,uuid) from public,anon,authenticated;

create or replace function public.xzrecruiter_assign_requirement(
  p_token text,p_job_id uuid,p_recruiter_user_id uuid,p_target integer default 1,
  p_priority text default 'NORMAL',p_instructions text default null,p_status text default 'ACTIVE',
  p_blocker_reason text default null,p_blocker_owner_user_id uuid default null
) returns jsonb
language plpgsql security definer
set search_path='public','private','extensions','pg_temp'
as $fn$
declare
  v_agency uuid;v_user uuid;v_membership_role text;v_business_role text;
  v_recruiter_role text;v_priority text:=upper(coalesce(p_priority,'NORMAL'));
  v_status text:=upper(coalesce(p_status,'ACTIVE'));v_id uuid;
begin
  select agency_id,user_id,role into v_agency,v_user,v_membership_role
  from private.xzrecruiter_session_context(p_token);
  if v_agency is null then return jsonb_build_object('ok',false,'error','unauthorized'); end if;
  v_business_role:=private.xzrecruiter_step3_business_role(v_agency,v_user,v_membership_role);
  if v_business_role not in ('OWNER','ADMIN','ACCOUNT_MANAGER','RECRUITMENT_MANAGER') then
    return jsonb_build_object('ok',false,'error','assignment_forbidden');
  end if;
  if v_priority not in ('LOW','NORMAL','HIGH','URGENT') then return jsonb_build_object('ok',false,'error','invalid_priority'); end if;
  if v_status not in ('ACTIVE','PAUSED','COMPLETED','REMOVED') then return jsonb_build_object('ok',false,'error','invalid_assignment_status'); end if;
  if coalesce(p_target,0)<0 or coalesce(p_target,0)>1000 then return jsonb_build_object('ok',false,'error','invalid_target'); end if;

  if not exists(
    select 1 from public.recruitment_jobs j
    where j.id=p_job_id and j.agency_id=v_agency and j.archived_at is null
      and j.recruiter_ready=true and j.requirement_state='OPEN'
  ) then return jsonb_build_object('ok',false,'error','requirement_not_recruiter_ready'); end if;

  select private.xzrecruiter_business_role(m.agency_id,m.user_id,m.role)
  into v_recruiter_role
  from public.agency_memberships m
  where m.agency_id=v_agency and m.user_id=p_recruiter_user_id
  limit 1;
  if coalesce(v_recruiter_role,'') not in ('RECRUITER','RECRUITMENT_MANAGER') then
    return jsonb_build_object('ok',false,'error','invalid_recruiter');
  end if;

  if p_blocker_owner_user_id is not null and not exists(
    select 1 from public.agency_memberships m where m.agency_id=v_agency and m.user_id=p_blocker_owner_user_id
  ) then return jsonb_build_object('ok',false,'error','invalid_blocker_owner'); end if;

  insert into public.requirement_recruiter_assignments(
    agency_id,job_id,recruiter_user_id,assignment_status,daily_submission_target,
    manager_priority,manager_instructions,blocker_reason,blocker_owner_user_id,assigned_by_user_id
  ) values(
    v_agency,p_job_id,p_recruiter_user_id,v_status,coalesce(p_target,1),v_priority,
    nullif(btrim(coalesce(p_instructions,'')),''),
    nullif(btrim(coalesce(p_blocker_reason,'')),''),
    p_blocker_owner_user_id,v_user
  )
  on conflict(agency_id,job_id,recruiter_user_id) do update set
    assignment_status=excluded.assignment_status,
    daily_submission_target=excluded.daily_submission_target,
    manager_priority=excluded.manager_priority,
    manager_instructions=excluded.manager_instructions,
    blocker_reason=excluded.blocker_reason,
    blocker_owner_user_id=excluded.blocker_owner_user_id,
    assigned_by_user_id=v_user,
    assigned_at=case when public.requirement_recruiter_assignments.assignment_status<>'ACTIVE' and excluded.assignment_status='ACTIVE' then now() else public.requirement_recruiter_assignments.assigned_at end,
    updated_at=now()
  returning id into v_id;

  perform private.xzrecruiter_log_activity(
    v_agency,v_user,'job',p_job_id,'requirement.assigned','Recruiter assignment updated',
    jsonb_build_object('assignment_id',v_id,'recruiter_user_id',p_recruiter_user_id,'target',p_target,'priority',v_priority,'status',v_status)
  );
  return jsonb_build_object('ok',true,'id',v_id);
end;$fn$;

create or replace function public.xzrecruiter_recruiter_command_center(p_token text)
returns jsonb
language plpgsql stable security definer
set search_path='public','private','extensions','pg_temp'
as $fn$
declare
  v_agency uuid;v_user uuid;v_membership_role text;v_business_role text;v_timezone text;v_today date;
  v_requirements jsonb:='[]'::jsonb;v_tasks jsonb:='[]'::jsonb;v_interviews jsonb:='[]'::jsonb;
  v_target integer:=0;v_done integer:=0;v_due_tasks integer:=0;v_screening integer:=0;
begin
  select agency_id,user_id,role into v_agency,v_user,v_membership_role
  from private.xzrecruiter_session_context(p_token);
  if v_agency is null then return jsonb_build_object('ok',false,'error','unauthorized'); end if;
  v_business_role:=private.xzrecruiter_step3_business_role(v_agency,v_user,v_membership_role);
  v_timezone:=private.xzrecruiter_step3_timezone(v_agency,v_user);
  if v_business_role not in ('OWNER','ADMIN','RECRUITMENT_MANAGER','RECRUITER') then
    return jsonb_build_object('ok',false,'error','recruiter_workspace_forbidden');
  end if;
  v_timezone:=private.xzrecruiter_step3_timezone(v_agency,v_user);
  v_today:=(now() at time zone v_timezone)::date;

  with assigned as (
    select a.*,j.title,j.priority job_priority,j.openings,j.target_fill_date,j.status job_status,
      j.requirement_state,j.recruiter_ready,j.opened_at,j.client_id,c.name client_name,
      hb.hiring_brief,hb.search_blueprint,
      coalesce(nullif(a.daily_submission_target,0),j.submission_target_daily,0) effective_daily_target,
      coalesce(nullif(a.total_submission_target,0),j.submission_target_total,0) effective_total_target,
      coalesce((
        select count(distinct cs.application_id) from public.candidate_submissions cs
        join public.applications ap on ap.id=cs.application_id and ap.agency_id=v_agency
        where cs.agency_id=v_agency and ap.job_id=j.id and cs.created_by_user_id=v_user
          and cs.workflow_status='CLIENT_SUBMITTED' and cs.status='SUBMITTED'
          and cs.invalidated_at is null and cs.withdrawn_at is null
          and cs.client_submitted_at is not null
          and (cs.client_submitted_at at time zone v_timezone)::date=v_today
      ),0)::integer valid_today,
      coalesce((
        select count(*) from public.applications ap
        where ap.agency_id=v_agency and ap.job_id=j.id and ap.owner_user_id=v_user and ap.archived_at is null
      ),0)::integer pipeline_candidates,
      coalesce((
        select count(*) from public.applications ap
        left join public.pipeline_stages ps on ps.id=ap.stage_id and ps.agency_id=v_agency
        where ap.agency_id=v_agency and ap.job_id=j.id and ap.owner_user_id=v_user and ap.archived_at is null
          and upper(coalesce(ps.code,ap.stage,''))='SCREENING'
      ),0)::integer screening_pending,
      coalesce((
        select count(*) from public.applications ap
        left join public.pipeline_stages ps on ps.id=ap.stage_id and ps.agency_id=v_agency
        where ap.agency_id=v_agency and ap.job_id=j.id and ap.owner_user_id=v_user and ap.archived_at is null
          and upper(coalesce(ps.code,ap.stage,'')) in ('SCREENING','QUALIFIED','SHORTLISTED')
      ),0)::integer ready_candidates,
      coalesce((
        select count(*) from public.crm_tasks t
        where t.agency_id=v_agency and t.job_id=j.id and t.assigned_user_id=v_user
          and t.archived_at is null and t.status in ('OPEN','IN_PROGRESS')
          and t.due_at is not null and t.due_at<=now()
      ),0)::integer overdue_tasks
    from public.requirement_recruiter_assignments a
    join public.recruitment_jobs j on j.id=a.job_id and j.agency_id=v_agency and j.archived_at is null
    left join public.recruitment_clients c on c.id=j.client_id and c.agency_id=v_agency
    left join public.requirement_hiring_briefs hb on hb.id=j.approved_hiring_brief_id and hb.agency_id=v_agency and hb.brief_status='APPROVED'
    where a.agency_id=v_agency and a.recruiter_user_id=v_user and a.assignment_status='ACTIVE'
      and j.recruiter_ready=true and j.requirement_state='OPEN'
  ), scored as (
    select *,
      greatest(effective_daily_target-valid_today,0) remaining_target,
      (
        greatest(effective_daily_target-valid_today,0)*20 +
        case manager_priority when 'URGENT' then 32 when 'HIGH' then 24 when 'NORMAL' then 16 else 8 end +
        case
          when target_fill_date is null then 0
          when target_fill_date<v_today then 30
          when target_fill_date<=v_today+1 then 25
          when target_fill_date<=v_today+3 then 20
          when target_fill_date<=v_today+7 then 10
          else 0
        end +
        least(5,greatest(0,floor(extract(epoch from (now()-coalesce(opened_at,assigned_at)))/86400)))::integer +
        least(ready_candidates,5) -
        case when blocker_reason is not null then 2 else 0 end
      ) priority_score
    from assigned
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id',id,'job_id',job_id,'title',title,'client_name',client_name,
    'priority',manager_priority,'job_priority',job_priority,'openings',openings,
    'daily_target',effective_daily_target,'total_target',effective_total_target,'valid_submissions_today',valid_today,
    'remaining_target',remaining_target,'target_progress',
      case when effective_daily_target=0 then 0 else least(100,round(valid_today*100.0/effective_daily_target)) end,
    'deadline',target_fill_date,'requirement_status',job_status,'assignment_status',assignment_status,
    'manager_instructions',manager_instructions,'blocker_reason',blocker_reason,
    'blocker_owner_user_id',blocker_owner_user_id,'pipeline_candidates',pipeline_candidates,
    'screening_pending',screening_pending,'ready_candidates',ready_candidates,
    'overdue_tasks',overdue_tasks,'priority_score',priority_score,
    'brief_summary',coalesce(hiring_brief->>'roleSummary',''),
    'must_haves',coalesce(hiring_brief->'mustHaveCriteria','[]'::jsonb)
  ) order by priority_score desc,target_fill_date nulls last,title),'[]'::jsonb)
  into v_requirements from scored;

  select coalesce(sum((x->>'daily_target')::integer),0),
         coalesce(sum((x->>'valid_submissions_today')::integer),0)
  into v_target,v_done
  from jsonb_array_elements(v_requirements) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.overdue desc,x.due_at nulls last,x.created_at desc),'[]'::jsonb),
         coalesce(count(*) filter(where x.overdue),0)::integer
  into v_tasks,v_due_tasks
  from (
    select t.id,t.title,t.task_type,t.status,t.priority,t.due_at,t.job_id,t.candidate_id,t.application_id,
      j.title job_title,c.full_name candidate_name,t.created_at,
      (t.due_at is not null and t.due_at<now()) overdue
    from public.crm_tasks t
    left join public.recruitment_jobs j on j.id=t.job_id and j.agency_id=v_agency
    left join public.candidates c on c.id=t.candidate_id and c.agency_id=v_agency
    where t.agency_id=v_agency and t.assigned_user_id=v_user and t.archived_at is null
      and t.status in ('OPEN','IN_PROGRESS')
      and (t.job_id is null or private.xzrecruiter_is_assigned_recruiter(v_agency,v_user,t.job_id))
    order by (t.due_at is not null and t.due_at<now()) desc,t.due_at nulls last
    limit 50
  ) x;

  select count(*)::integer into v_screening
  from public.applications ap
  left join public.pipeline_stages ps on ps.id=ap.stage_id and ps.agency_id=v_agency
  where ap.agency_id=v_agency and ap.owner_user_id=v_user and ap.archived_at is null
    and private.xzrecruiter_is_assigned_recruiter(v_agency,v_user,ap.job_id)
    and upper(coalesce(ps.code,ap.stage,''))='SCREENING';

  select coalesce(jsonb_agg(to_jsonb(x) order by x.scheduled_at),'[]'::jsonb)
  into v_interviews
  from (
    select i.id,i.application_id,ap.job_id,i.scheduled_at,i.timezone,i.status,c.full_name candidate_name,j.title job_title
    from public.interviews i
    join public.applications ap on ap.id=i.application_id and ap.agency_id=v_agency
    join public.candidates c on c.id=ap.candidate_id and c.agency_id=v_agency
    join public.recruitment_jobs j on j.id=ap.job_id and j.agency_id=v_agency
    where i.agency_id=v_agency and ap.owner_user_id=v_user
      and private.xzrecruiter_is_assigned_recruiter(v_agency,v_user,ap.job_id)
      and i.status in ('SCHEDULED','RESCHEDULED') and i.scheduled_at>=now()-interval '2 hours'
    order by i.scheduled_at limit 20
  ) x;

  return jsonb_build_object(
    'ok',true,'timezone',v_timezone,'business_date',v_today,'business_role',v_business_role,
    'today',jsonb_build_object(
      'daily_target',v_target,'valid_submissions_completed',v_done,
      'remaining_target',greatest(v_target-v_done,0),'jobs_requiring_attention',jsonb_array_length(v_requirements),
      'due_followups',v_due_tasks,'screening_actions_due',v_screening,
      'interview_actions',coalesce(jsonb_array_length(v_interviews),0)
    ),
    'requirements',v_requirements,'tasks',v_tasks,'interviews',v_interviews
  );
end;$fn$;

create or replace function public.xzrecruiter_recruiter_requirement_workspace(p_token text,p_job_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path='public','private','extensions','pg_temp'
as $fn$
declare
  v_agency uuid;v_user uuid;v_membership_role text;v_business_role text;v_timezone text;v_today date;
  v_job jsonb;v_brief jsonb;v_criteria jsonb;v_assignment jsonb;v_queue jsonb;v_tasks jsonb;
  v_valid integer:=0;v_target integer:=0;v_members jsonb:='[]'::jsonb;
begin
  select agency_id,user_id,role into v_agency,v_user,v_membership_role
  from private.xzrecruiter_session_context(p_token);
  if v_agency is null then return jsonb_build_object('ok',false,'error','unauthorized'); end if;
  v_business_role:=private.xzrecruiter_step3_business_role(v_agency,v_user,v_membership_role);
  if not private.xzrecruiter_step3_can_view_job(v_agency,v_user,v_business_role,p_job_id) then
    return jsonb_build_object('ok',false,'error','requirement_access_denied');
  end if;
  v_timezone:=private.xzrecruiter_step3_timezone(v_agency,v_user);
  v_today:=(now() at time zone v_timezone)::date;

  select jsonb_build_object(
    'id',j.id,'title',j.title,'client_id',j.client_id,'client_name',c.name,'status',j.status,
    'priority',j.priority,'openings',j.openings,'target_fill_date',j.target_fill_date,
    'location',j.location,'city',j.city,'region',j.region,'country_code',j.country_code,
    'workplace_type',j.workplace_type,'experience_min',j.experience_min,'experience_max',j.experience_max,
    'salary_min',j.salary_min,'salary_max',j.salary_max,'salary_currency',j.salary_currency,
    'salary_period',j.salary_period,'work_authorization_requirements',j.work_authorization_requirements,
    'recruiter_ready',j.recruiter_ready,'requirement_state',j.requirement_state,
    'submission_target_daily',j.submission_target_daily,'submission_target_total',j.submission_target_total
  ) into v_job
  from public.recruitment_jobs j
  left join public.recruitment_clients c on c.id=j.client_id and c.agency_id=v_agency
  where j.id=p_job_id and j.agency_id=v_agency and j.archived_at is null;

  select jsonb_build_object(
    'id',hb.id,'version_number',hb.version_number,'hiring_brief',hb.hiring_brief,
    'search_blueprint',hb.search_blueprint,'approved_at',hb.approved_at,'approval_note',hb.approval_note
  ) into v_brief
  from public.recruitment_jobs j
  join public.requirement_hiring_briefs hb on hb.id=j.approved_hiring_brief_id and hb.agency_id=v_agency
  where j.id=p_job_id and j.agency_id=v_agency and hb.brief_status='APPROVED';

  select coalesce(jsonb_agg(jsonb_build_object(
    'kind',c.criterion_kind,'label',c.label,'value',c.value_text,'evidence',c.evidence,
    'amConfirmed',c.am_confirmed,'status',c.extraction_status
  ) order by c.sort_order),'[]'::jsonb)
  into v_criteria
  from public.requirement_criteria c
  join public.requirement_hiring_briefs hb on hb.id=c.brief_id and hb.agency_id=v_agency
  join public.recruitment_jobs j on j.approved_hiring_brief_id=hb.id and j.agency_id=v_agency
  where j.id=p_job_id and c.agency_id=v_agency;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'recruiter_user_id',a.recruiter_user_id,'recruiter_name',u.display_name,
    'daily_target',a.daily_submission_target,'total_target',a.total_submission_target,'priority',a.manager_priority,
    'manager_instructions',a.manager_instructions,'assignment_status',a.assignment_status,
    'blocker_type',a.blocker_type,'blocker_reason',a.blocker_reason,'blocker_owner_user_id',a.blocker_owner_user_id,
    'blocker_owner_name',bo.display_name,'assigned_at',a.assigned_at
  ) order by a.assigned_at),'[]'::jsonb)
  into v_assignment
  from public.requirement_recruiter_assignments a
  join public.users u on u.id=a.recruiter_user_id
  left join public.users bo on bo.id=a.blocker_owner_user_id
  where a.agency_id=v_agency and a.job_id=p_job_id
    and (v_business_role<>'RECRUITER' or a.recruiter_user_id=v_user);

  select coalesce(max(coalesce(nullif(a.daily_submission_target,0),j.submission_target_daily,0)),0) into v_target
  from public.requirement_recruiter_assignments a
  join public.recruitment_jobs j on j.id=a.job_id and j.agency_id=v_agency
  where a.agency_id=v_agency and a.job_id=p_job_id and a.recruiter_user_id=v_user and a.assignment_status='ACTIVE';

  select count(distinct cs.application_id)::integer into v_valid
  from public.candidate_submissions cs
  join public.applications ap on ap.id=cs.application_id and ap.agency_id=v_agency
  where cs.agency_id=v_agency and ap.job_id=p_job_id and cs.created_by_user_id=v_user
    and cs.workflow_status='CLIENT_SUBMITTED' and cs.status='SUBMITTED'
    and cs.invalidated_at is null and cs.withdrawn_at is null
    and cs.client_submitted_at is not null
    and (cs.client_submitted_at at time zone v_timezone)::date=v_today;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.last_activity_at desc),'[]'::jsonb)
  into v_queue
  from (
    select ap.id application_id,ap.candidate_id,ap.stage,coalesce(ps.code,ap.stage) stage_code,
      ap.source_type,ap.source_reference,ap.sourcing_notes,ap.sourced_at,ap.last_activity_at,
      c.full_name,c.current_title,c.current_company,c.city,c.country_code,c.email,c.phone,
      exists(select 1 from public.candidate_documents d where d.agency_id=v_agency and d.candidate_id=c.id and d.archived_at is null and d.document_type='RESUME') has_resume,
      case
        when upper(coalesce(ps.code,ap.stage,''))='SCREENING' then 'SCREENING_PENDING'
        when upper(coalesce(ps.code,ap.stage,'')) in ('QUALIFIED','SHORTLISTED') then 'READY_FOR_NEXT_ACTION'
        when upper(coalesce(ps.code,ap.stage,'')) in ('REJECTED','WITHDRAWN','PLACED','HIRED') then 'COMPLETED_NO_ACTION'
        when upper(coalesce(ps.code,ap.stage,'')) in ('APPLIED','NEW') then 'NEW_WORK'
        else 'SOURCING'
      end queue_group,
      private.xzrecruiter_canonical_candidacy_state(coalesce(ps.code,ap.stage)) canonical_state,
      exists(
        select 1 from public.crm_tasks bt
        where bt.agency_id=v_agency and bt.application_id=ap.id and bt.archived_at is null
          and bt.status in ('OPEN','IN_PROGRESS') and bt.task_type in ('MISSING_INFORMATION','MANAGER_CLARIFICATION')
      ) blocked
    from public.applications ap
    join public.candidates c on c.id=ap.candidate_id and c.agency_id=v_agency
    left join public.pipeline_stages ps on ps.id=ap.stage_id and ps.agency_id=v_agency
    where ap.agency_id=v_agency and ap.job_id=p_job_id and ap.archived_at is null
      and (v_business_role<>'RECRUITER' or ap.owner_user_id=v_user)
    order by ap.last_activity_at desc limit 100
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.due_at nulls last,x.created_at desc),'[]'::jsonb)
  into v_tasks
  from (
    select t.id,t.title,t.description,t.task_type,t.status,t.priority,t.due_at,t.candidate_id,t.application_id,
      c.full_name candidate_name,t.created_at,t.completed_at,(t.due_at is not null and t.due_at<now()) overdue
    from public.crm_tasks t
    left join public.candidates c on c.id=t.candidate_id and c.agency_id=v_agency
    where t.agency_id=v_agency and t.job_id=p_job_id and t.archived_at is null
      and (v_business_role<>'RECRUITER' or t.assigned_user_id=v_user)
    order by t.due_at nulls last,t.created_at desc limit 100
  ) x;

  if v_business_role in ('OWNER','ADMIN','ACCOUNT_MANAGER','RECRUITMENT_MANAGER') then
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id',m.user_id,'display_name',coalesce(u.display_name,u.email),'business_role',private.xzrecruiter_business_role(m.agency_id,m.user_id,m.role)
    ) order by u.display_name),'[]'::jsonb)
    into v_members
    from public.agency_memberships m join public.users u on u.id=m.user_id
    where m.agency_id=v_agency
      and private.xzrecruiter_business_role(m.agency_id,m.user_id,m.role) in ('RECRUITER','RECRUITMENT_MANAGER');
  end if;

  return jsonb_build_object(
    'ok',true,'business_role',v_business_role,'timezone',v_timezone,'business_date',v_today,
    'job',v_job,'brief',coalesce(v_brief,'{}'::jsonb),'criteria',coalesce(v_criteria,'[]'::jsonb),
    'assignments',coalesce(v_assignment,'[]'::jsonb),'eligible_recruiters',v_members,
    'can_manage_assignments',v_business_role in ('OWNER','ADMIN','ACCOUNT_MANAGER','RECRUITMENT_MANAGER'),
    'blockers',coalesce((
      select jsonb_agg(jsonb_build_object(
        'blocker_type',coalesce(a.blocker_type,'EXPLICIT_BLOCKER'),
        'reason',a.blocker_reason,
        'owner',coalesce(bo.display_name,bo.email,'Unassigned')
      ) order by a.updated_at desc)
      from public.requirement_recruiter_assignments a
      left join public.users bo on bo.id=a.blocker_owner_user_id
      where a.agency_id=v_agency and a.job_id=p_job_id and a.assignment_status='ACTIVE'
        and a.blocker_reason is not null
        and (v_business_role<>'RECRUITER' or a.recruiter_user_id=v_user)
    ),'[]'::jsonb),
    'execution',jsonb_build_object(
      'daily_target',v_target,
      'requirement_daily_target',coalesce((v_job->>'submission_target_daily')::integer,0),
      'requirement_total_target',coalesce((v_job->>'submission_target_total')::integer,0),
      'valid_submissions_today',v_valid,'remaining_target',greatest(v_target-v_valid,0),
      'progress',case when v_target=0 then 0 else least(100,round(v_valid*100.0/v_target)) end
    ),
    'queue',v_queue,'tasks',v_tasks
  );
end;$fn$;

create or replace function public.xzrecruiter_execution_candidate_search(
  p_token text,p_job_id uuid,p_query text default '',p_limit integer default 20
) returns jsonb
language plpgsql stable security definer
set search_path='public','private','extensions','pg_temp'
as $fn$
declare
  v_agency uuid;v_user uuid;v_membership_role text;v_business_role text;v_rows jsonb;
  v_q text:=lower(btrim(coalesce(p_query,'')));v_limit integer:=least(greatest(coalesce(p_limit,20),1),50);
begin
  select agency_id,user_id,role into v_agency,v_user,v_membership_role
  from private.xzrecruiter_session_context(p_token);
  if v_agency is null then return jsonb_build_object('ok',false,'error','unauthorized'); end if;
  v_business_role:=private.xzrecruiter_step3_business_role(v_agency,v_user,v_membership_role);
  if not private.xzrecruiter_step3_can_view_job(v_agency,v_user,v_business_role,p_job_id) then
    return jsonb_build_object('ok',false,'error','requirement_access_denied');
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc),'[]'::jsonb) into v_rows
  from (
    select c.id,c.full_name,c.email,c.phone,c.current_title,c.current_company,c.city,c.country_code,c.availability_status,c.updated_at,
      exists(select 1 from public.applications ap where ap.agency_id=v_agency and ap.job_id=p_job_id and ap.candidate_id=c.id and ap.archived_at is null) already_on_requirement
    from public.candidates c
    where c.agency_id=v_agency and c.archived_at is null and c.merged_into_candidate_id is null
      and (
        v_q='' or lower(c.full_name) like '%'||v_q||'%' or lower(coalesce(c.current_title,'')) like '%'||v_q||'%'
        or lower(coalesce(c.current_company,'')) like '%'||v_q||'%'
      )
    order by c.updated_at desc limit v_limit
  ) x;
  return jsonb_build_object('ok',true,'rows',v_rows);
end;$fn$;

create or replace function public.xzrecruiter_source_candidate(
  p_token text,p_job_id uuid,p_candidate jsonb,p_existing_candidate_id uuid,
  p_source_type text,p_source_reference text default null,p_sourcing_notes text default null
) returns jsonb
language plpgsql security definer
set search_path='public','private','extensions','pg_temp'
as $fn$
declare
  v_agency uuid;v_user uuid;v_membership_role text;v_business_role text;v_candidate uuid;v_application uuid;
  v_name text;v_email text;v_phone text;v_source text:=upper(coalesce(p_source_type,''));v_pipeline uuid;v_stage uuid;v_stage_name text;v_client uuid;
  v_existing uuid;
begin
  select agency_id,user_id,role into v_agency,v_user,v_membership_role
  from private.xzrecruiter_session_context(p_token);
  if v_agency is null then return jsonb_build_object('ok',false,'error','unauthorized'); end if;
  v_business_role:=private.xzrecruiter_step3_business_role(v_agency,v_user,v_membership_role);
  if v_business_role not in ('OWNER','ADMIN','RECRUITMENT_MANAGER','RECRUITER') then
    return jsonb_build_object('ok',false,'error','recruiter_execution_forbidden');
  end if;
  if v_business_role='RECRUITER' and not private.xzrecruiter_is_assigned_recruiter(v_agency,v_user,p_job_id) then
    return jsonb_build_object('ok',false,'error','requirement_access_denied');
  end if;
  if v_source not in ('LINKEDIN','MONSTER','DICE','INDEED','NAUKRI','INTERNAL_DATABASE','REFERRAL','APPLICANT','CSV','OTHER') then
    return jsonb_build_object('ok',false,'error','invalid_source');
  end if;

  select pipeline_id,client_id into v_pipeline,v_client
  from public.recruitment_jobs
  where id=p_job_id and agency_id=v_agency and archived_at is null and recruiter_ready=true and requirement_state='OPEN';
  if not found then return jsonb_build_object('ok',false,'error','requirement_not_recruiter_ready'); end if;

  if p_existing_candidate_id is not null then
    select id into v_candidate from public.candidates
    where id=p_existing_candidate_id and agency_id=v_agency and archived_at is null and merged_into_candidate_id is null;
    if v_candidate is null then return jsonb_build_object('ok',false,'error','candidate_not_found'); end if;
  else
    v_name:=btrim(coalesce(p_candidate->>'fullName',''));
    v_email:=nullif(lower(btrim(coalesce(p_candidate->>'email',''))),'');
    v_phone:=nullif(regexp_replace(coalesce(p_candidate->>'phone',''),'[^0-9+]','','g'),'');
    if v_name='' or (v_email is null and v_phone is null) then return jsonb_build_object('ok',false,'error','name_and_contact_required'); end if;

    select id into v_existing from public.candidates
    where agency_id=v_agency and archived_at is null and merged_into_candidate_id is null
      and ((v_email is not null and lower(email)=v_email) or (v_phone is not null and phone=v_phone))
    limit 1;
    if v_existing is not null then
      return jsonb_build_object('ok',false,'error','existing_candidate_found','candidate_id',v_existing);
    end if;

    if nullif(upper(p_candidate->>'countryCode'),'') is not null and not exists(
      select 1 from public.global_country_profiles g
      where g.country_code=upper(p_candidate->>'countryCode') and g.active=true
    ) then return jsonb_build_object('ok',false,'error','invalid_country'); end if;

    v_candidate:=gen_random_uuid();
    insert into public.candidates(
      id,agency_id,full_name,email,phone,current_title,current_company,city,country_code,
      source,dedupe_key,created_by_user_id,owner_user_id,updated_by_user_id
    ) values(
      v_candidate,v_agency,v_name,v_email,v_phone,nullif(p_candidate->>'currentTitle',''),
      nullif(p_candidate->>'currentCompany',''),nullif(p_candidate->>'city',''),
      nullif(upper(p_candidate->>'countryCode'),''),
      v_source,encode(extensions.digest(lower(v_name)||'|'||coalesce(v_email,'')||'|'||coalesce(v_phone,''),'sha256'),'hex'),
      v_user,v_user,v_user
    );
    perform private.xzrecruiter_log_activity(v_agency,v_user,'candidate',v_candidate,'candidate.sourced','Candidate sourced',
      jsonb_build_object('source_type',v_source,'source_reference',nullif(p_source_reference,''),'job_id',p_job_id));
  end if;

  select id into v_application from public.applications
  where agency_id=v_agency and job_id=p_job_id and candidate_id=v_candidate and archived_at is null limit 1;
  if v_application is not null then
    return jsonb_build_object('ok',true,'candidate_id',v_candidate,'application_id',v_application,'reused',true);
  end if;

  if v_pipeline is null then
    select id into v_pipeline from public.recruitment_pipelines
    where agency_id=v_agency and pipeline_kind='RECRUITMENT' and is_default=true and active=true limit 1;
  end if;
  select id,name into v_stage,v_stage_name from public.pipeline_stages
  where agency_id=v_agency and pipeline_id=v_pipeline and code in ('APPLIED','NEW')
  order by case code when 'APPLIED' then 0 else 1 end limit 1;

  v_application:=gen_random_uuid();
  insert into public.applications(
    id,agency_id,job_id,candidate_id,stage,status,match_evidence,owner_user_id,created_by_user_id,
    client_id,pipeline_id,stage_id,stage_entered_at,last_activity_at,
    source_type,source_reference,sourcing_notes,sourced_by_user_id,sourced_at
  ) values(
    v_application,v_agency,p_job_id,v_candidate,coalesce(v_stage_name,'Applied'),'ACTIVE','{}'::jsonb,v_user,v_user,
    v_client,v_pipeline,v_stage,now(),now(),v_source,nullif(p_source_reference,''),
    nullif(p_sourcing_notes,''),v_user,now()
  );
  insert into public.application_stage_history(agency_id,application_id,to_stage_id,to_stage,changed_by_user_id)
  values(v_agency,v_application,v_stage,coalesce(v_stage_name,'Applied'),v_user);

  perform private.xzrecruiter_log_activity(v_agency,v_user,'application',v_application,'candidate.associated','Candidate associated with requirement',
    jsonb_build_object('candidate_id',v_candidate,'job_id',p_job_id,'source_type',v_source));
  return jsonb_build_object('ok',true,'candidate_id',v_candidate,'application_id',v_application,'reused',p_existing_candidate_id is not null);
exception
  when unique_violation then return jsonb_build_object('ok',false,'error','duplicate_or_concurrent_intake');
end;$fn$;

create or replace function public.xzrecruiter_save_execution_task(
  p_token text,p_task jsonb
) returns jsonb
language plpgsql security definer
set search_path='public','private','extensions','pg_temp'
as $fn$
declare
  v_agency uuid;v_user uuid;v_membership_role text;v_business_role text;
  v_id uuid;v_job uuid;v_candidate uuid;v_application uuid;v_assigned uuid;v_type text;v_title text;v_status text;v_priority text;v_key text;v_timezone text;
begin
  select agency_id,user_id,role into v_agency,v_user,v_membership_role
  from private.xzrecruiter_session_context(p_token);
  if v_agency is null then return jsonb_build_object('ok',false,'error','unauthorized'); end if;
  v_business_role:=private.xzrecruiter_step3_business_role(v_agency,v_user,v_membership_role);
  if v_business_role not in ('OWNER','ADMIN','RECRUITMENT_MANAGER','RECRUITER') then
    return jsonb_build_object('ok',false,'error','recruiter_execution_forbidden');
  end if;
  v_job:=nullif(p_task->>'jobId','')::uuid;v_candidate:=nullif(p_task->>'candidateId','')::uuid;
  v_application:=nullif(p_task->>'applicationId','')::uuid;
  v_assigned:=coalesce(nullif(p_task->>'assignedUserId','')::uuid,v_user);
  v_type:=upper(coalesce(p_task->>'taskType','FOLLOW_UP'));
  v_title:=btrim(coalesce(p_task->>'title',''));
  v_status:=upper(coalesce(p_task->>'status','OPEN'));v_priority:=upper(coalesce(p_task->>'priority','NORMAL'));
  v_key:=nullif(left(coalesce(p_task->>'idempotencyKey',''),160),'');
  if v_job is null or v_title='' then return jsonb_build_object('ok',false,'error','job_and_title_required'); end if;
  if v_type not in ('CONTACT_CANDIDATE','FOLLOW_UP','COLLECT_RESUME','CONFIRM_AVAILABILITY','SCREENING_DUE','MISSING_INFORMATION','MANAGER_CLARIFICATION') then
    return jsonb_build_object('ok',false,'error','invalid_task_type'); end if;
  if v_status not in ('OPEN','IN_PROGRESS') then return jsonb_build_object('ok',false,'error','invalid_task_status'); end if;
  if v_priority not in ('LOW','NORMAL','HIGH','URGENT') then return jsonb_build_object('ok',false,'error','invalid_priority'); end if;

  if v_business_role='RECRUITER' then
    if v_assigned<>v_user then return jsonb_build_object('ok',false,'error','recruiter_cannot_assign_others'); end if;
    if not private.xzrecruiter_is_assigned_recruiter(v_agency,v_user,v_job) then
      return jsonb_build_object('ok',false,'error','requirement_access_denied'); end if;
  elsif not exists(select 1 from public.agency_memberships m where m.agency_id=v_agency and m.user_id=v_assigned) then
    return jsonb_build_object('ok',false,'error','invalid_assignee');
  elsif v_assigned<>v_user and not private.xzrecruiter_is_assigned_recruiter(v_agency,v_assigned,v_job) then
    return jsonb_build_object('ok',false,'error','assignee_not_assigned_to_requirement');
  end if;

  if v_candidate is not null and not exists(select 1 from public.candidates c where c.id=v_candidate and c.agency_id=v_agency and c.archived_at is null) then
    return jsonb_build_object('ok',false,'error','candidate_not_found'); end if;
  if v_application is not null and not exists(select 1 from public.applications a where a.id=v_application and a.agency_id=v_agency and a.job_id=v_job and a.archived_at is null) then
    return jsonb_build_object('ok',false,'error','application_not_found'); end if;

  if v_key is not null then
    select id into v_id from public.crm_tasks where agency_id=v_agency and idempotency_key=v_key and archived_at is null limit 1;
    if v_id is not null then return jsonb_build_object('ok',true,'id',v_id,'reused',true); end if;
  end if;

  v_id:=gen_random_uuid();
  insert into public.crm_tasks(
    id,agency_id,title,description,status,priority,due_at,assigned_user_id,created_by_user_id,
    job_id,candidate_id,application_id,task_type,idempotency_key
  ) values(
    v_id,v_agency,v_title,nullif(p_task->>'description',''),v_status,v_priority,
    case
      when nullif(p_task->>'dueAt','') is not null then (p_task->>'dueAt')::timestamptz
      when nullif(p_task->>'dueLocal','') is not null then (p_task->>'dueLocal')::timestamp at time zone v_timezone
      else null
    end,v_assigned,v_user,v_job,v_candidate,v_application,v_type,v_key
  );
  perform private.xzrecruiter_log_activity(v_agency,v_user,'crm_task',v_id,'followup.created','Recruiter execution task created',
    jsonb_build_object('job_id',v_job,'candidate_id',v_candidate,'application_id',v_application,'task_type',v_type,'assigned_user_id',v_assigned));
  return jsonb_build_object('ok',true,'id',v_id,'reused',false);
exception
  when unique_violation then
    if v_key is not null then
      select id into v_id from public.crm_tasks where agency_id=v_agency and idempotency_key=v_key and archived_at is null limit 1;
      return jsonb_build_object('ok',true,'id',v_id,'reused',true);
    end if;
    return jsonb_build_object('ok',false,'error','task_conflict');
end;$fn$;

create or replace function public.xzrecruiter_complete_execution_task(p_token text,p_task_id uuid)
returns jsonb
language plpgsql security definer
set search_path='public','private','extensions','pg_temp'
as $fn$
declare
  v_agency uuid;v_user uuid;v_membership_role text;v_business_role text;v_assigned uuid;v_status text;v_job uuid;
begin
  select agency_id,user_id,role into v_agency,v_user,v_membership_role
  from private.xzrecruiter_session_context(p_token);
  if v_agency is null then return jsonb_build_object('ok',false,'error','unauthorized'); end if;
  v_business_role:=private.xzrecruiter_step3_business_role(v_agency,v_user,v_membership_role);

  select assigned_user_id,status,job_id into v_assigned,v_status,v_job
  from public.crm_tasks where id=p_task_id and agency_id=v_agency and archived_at is null;
  if not found then return jsonb_build_object('ok',false,'error','task_not_found'); end if;
  if v_business_role='RECRUITER' and (v_assigned<>v_user or not private.xzrecruiter_is_assigned_recruiter(v_agency,v_user,v_job)) then
    return jsonb_build_object('ok',false,'error','task_access_denied'); end if;
  if v_business_role not in ('OWNER','ADMIN','RECRUITMENT_MANAGER','RECRUITER') then
    return jsonb_build_object('ok',false,'error','task_access_denied'); end if;
  if v_status='DONE' then return jsonb_build_object('ok',true,'id',p_task_id,'reused',true,'status','DONE'); end if;
  if v_status='CANCELLED' then return jsonb_build_object('ok',false,'error','invalid_task_transition'); end if;

  update public.crm_tasks set status='DONE',completed_at=now(),updated_at=now()
  where id=p_task_id and agency_id=v_agency;
  perform private.xzrecruiter_log_activity(v_agency,v_user,'crm_task',p_task_id,'task.completed','Recruiter execution task completed',
    jsonb_build_object('job_id',v_job));
  return jsonb_build_object('ok',true,'id',p_task_id,'reused',false,'status','DONE');
end;$fn$;

-- New Step-3 RPCs are explicit session-aware API boundaries.
revoke all on function public.xzrecruiter_assign_requirement(text,uuid,uuid,integer,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.xzrecruiter_recruiter_command_center(text) from public,anon,authenticated;
revoke all on function public.xzrecruiter_recruiter_requirement_workspace(text,uuid) from public,anon,authenticated;
revoke all on function public.xzrecruiter_execution_candidate_search(text,uuid,text,integer) from public,anon,authenticated;
revoke all on function public.xzrecruiter_source_candidate(text,uuid,jsonb,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.xzrecruiter_save_execution_task(text,jsonb) from public,anon,authenticated;
revoke all on function public.xzrecruiter_complete_execution_task(text,uuid) from public,anon,authenticated;

grant execute on function public.xzrecruiter_assign_requirement(text,uuid,uuid,integer,text,text,text,text,uuid) to anon,authenticated;
grant execute on function public.xzrecruiter_recruiter_command_center(text) to anon,authenticated;
grant execute on function public.xzrecruiter_recruiter_requirement_workspace(text,uuid) to anon,authenticated;
grant execute on function public.xzrecruiter_execution_candidate_search(text,uuid,text,integer) to anon,authenticated;
grant execute on function public.xzrecruiter_source_candidate(text,uuid,jsonb,uuid,text,text,text) to anon,authenticated;
grant execute on function public.xzrecruiter_save_execution_task(text,jsonb) to anon,authenticated;
grant execute on function public.xzrecruiter_complete_execution_task(text,uuid) to anon,authenticated;


-- Canonical Step-3 assignment mutation: supports requirement + recruiter daily/total targets and blockers.
create or replace function public.xzrecruiter_save_requirement_assignment(
  p_token text,p_job_id uuid,p_recruiter_user_id uuid,p_assignment jsonb
) returns jsonb
language plpgsql security definer
set search_path='public','private','extensions','pg_temp'
as $fn$
declare
  v_agency uuid;v_user uuid;v_membership_role text;v_business_role text;v_recruiter_role text;v_id uuid;
  v_status text:=upper(coalesce(nullif(p_assignment->>'status',''),'ACTIVE'));
  v_priority text:=upper(coalesce(nullif(p_assignment->>'priority',''),'NORMAL'));
  v_daily integer:=greatest(coalesce(nullif(p_assignment->>'dailyTarget','')::integer,0),0);
  v_total integer:=greatest(coalesce(nullif(p_assignment->>'totalTarget','')::integer,0),0);
  v_req_daily integer:=greatest(coalesce(nullif(p_assignment->>'requirementDailyTarget','')::integer,0),0);
  v_req_total integer:=greatest(coalesce(nullif(p_assignment->>'requirementTotalTarget','')::integer,0),0);
begin
  select agency_id,user_id,role into v_agency,v_user,v_membership_role
  from private.xzrecruiter_session_context(p_token);
  if v_agency is null then return jsonb_build_object('ok',false,'error','unauthorized'); end if;
  v_business_role:=private.xzrecruiter_step3_business_role(v_agency,v_user,v_membership_role);
  if v_business_role not in ('OWNER','ADMIN','ACCOUNT_MANAGER','RECRUITMENT_MANAGER') then
    return jsonb_build_object('ok',false,'error','assignment_forbidden');
  end if;
  if v_status not in ('ACTIVE','PAUSED','COMPLETED','REMOVED') then return jsonb_build_object('ok',false,'error','invalid_assignment_status'); end if;
  if v_priority not in ('LOW','NORMAL','HIGH','URGENT') then return jsonb_build_object('ok',false,'error','invalid_priority'); end if;
  if v_daily>1000 or v_total>10000 or v_req_daily>1000 or v_req_total>10000 then return jsonb_build_object('ok',false,'error','invalid_target'); end if;

  if not exists(select 1 from public.recruitment_jobs j where j.id=p_job_id and j.agency_id=v_agency and j.archived_at is null and j.recruiter_ready=true and j.requirement_state='OPEN')
    then return jsonb_build_object('ok',false,'error','requirement_not_recruiter_ready'); end if;

  select private.xzrecruiter_business_role(m.agency_id,m.user_id,m.role) into v_recruiter_role
  from public.agency_memberships m where m.agency_id=v_agency and m.user_id=p_recruiter_user_id limit 1;
  if coalesce(v_recruiter_role,'') not in ('RECRUITER','RECRUITMENT_MANAGER') then return jsonb_build_object('ok',false,'error','invalid_recruiter'); end if;

  if nullif(p_assignment->>'blockerOwnerUserId','') is not null and not exists(
    select 1 from public.agency_memberships m where m.agency_id=v_agency and m.user_id=(p_assignment->>'blockerOwnerUserId')::uuid
  ) then return jsonb_build_object('ok',false,'error','invalid_blocker_owner'); end if;

  update public.recruitment_jobs
  set submission_target_daily=v_req_daily,submission_target_total=v_req_total,updated_at=now()
  where id=p_job_id and agency_id=v_agency;

  insert into public.requirement_recruiter_assignments(
    agency_id,job_id,recruiter_user_id,assignment_status,daily_submission_target,total_submission_target,
    manager_priority,manager_instructions,blocker_type,blocker_reason,blocker_owner_user_id,assigned_by_user_id
  ) values(
    v_agency,p_job_id,p_recruiter_user_id,v_status,v_daily,v_total,v_priority,
    nullif(left(coalesce(p_assignment->>'managerInstructions',''),3000),''),
    nullif(left(coalesce(p_assignment->>'blockerType',''),120),''),
    nullif(left(coalesce(p_assignment->>'blockerReason',''),1500),''),
    nullif(p_assignment->>'blockerOwnerUserId','')::uuid,v_user
  )
  on conflict(agency_id,job_id,recruiter_user_id) do update set
    assignment_status=excluded.assignment_status,daily_submission_target=excluded.daily_submission_target,
    total_submission_target=excluded.total_submission_target,manager_priority=excluded.manager_priority,
    manager_instructions=excluded.manager_instructions,blocker_type=excluded.blocker_type,
    blocker_reason=excluded.blocker_reason,blocker_owner_user_id=excluded.blocker_owner_user_id,
    assigned_by_user_id=v_user,updated_at=now()
  returning id into v_id;

  perform private.xzrecruiter_log_activity(
    v_agency,v_user,'job',p_job_id,'requirement.assignment_updated','Recruiter assignment/targets updated',
    jsonb_build_object('assignment_id',v_id,'recruiter_user_id',p_recruiter_user_id,'daily_target',v_daily,'total_target',v_total,'requirement_daily_target',v_req_daily,'requirement_total_target',v_req_total,'priority',v_priority,'status',v_status)
  );
  return jsonb_build_object('ok',true,'id',v_id,'status',v_status);
exception when invalid_text_representation then
  return jsonb_build_object('ok',false,'error','invalid_assignment_payload');
end;
$fn$;

create or replace function public.xzrecruiter_execution_candidate_access(p_token text,p_candidate_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path='public','private','extensions','pg_temp'
as $fn$
declare v_agency uuid;v_user uuid;v_membership_role text;v_business_role text;v_allowed boolean:=false;
begin
  select agency_id,user_id,role into v_agency,v_user,v_membership_role from private.xzrecruiter_session_context(p_token);
  if v_agency is null then return jsonb_build_object('ok',false,'error','unauthorized'); end if;
  v_business_role:=private.xzrecruiter_step3_business_role(v_agency,v_user,v_membership_role);
  if v_business_role in ('OWNER','ADMIN','ACCOUNT_MANAGER','RECRUITMENT_MANAGER') then
    select exists(select 1 from public.candidates c where c.id=p_candidate_id and c.agency_id=v_agency and c.archived_at is null) into v_allowed;
  elsif v_business_role='RECRUITER' then
    select exists(
      select 1 from public.applications ap
      join public.requirement_recruiter_assignments ra on ra.agency_id=ap.agency_id and ra.job_id=ap.job_id
        and ra.recruiter_user_id=v_user and ra.assignment_status='ACTIVE'
      where ap.agency_id=v_agency and ap.candidate_id=p_candidate_id and ap.archived_at is null
    ) into v_allowed;
  end if;
  return jsonb_build_object('ok',v_allowed,'allowed',v_allowed,'error',case when v_allowed then null else 'candidate_access_denied' end);
end;
$fn$;

create or replace function public.xzrecruiter_candidate_document_access(p_token text,p_document_id uuid)
returns jsonb language plpgsql stable security definer
set search_path='public','private','extensions','pg_temp'
as $fn$
declare v_agency uuid;v_user uuid;v_membership_role text;v_business_role text;v_path text;v_name text;v_mime text;v_candidate uuid;v_allowed boolean:=false;
begin
  select agency_id,user_id,role into v_agency,v_user,v_membership_role from private.xzrecruiter_session_context(p_token);
  if v_agency is null then return jsonb_build_object('ok',false,'error','unauthorized'); end if;
  v_business_role:=private.xzrecruiter_step3_business_role(v_agency,v_user,v_membership_role);
  select storage_path,filename,mime_type,candidate_id into v_path,v_name,v_mime,v_candidate
  from public.candidate_documents where id=p_document_id and agency_id=v_agency and archived_at is null;
  if v_path is null then return jsonb_build_object('ok',false,'error','document_not_found'); end if;
  if v_business_role in ('OWNER','ADMIN','ACCOUNT_MANAGER','RECRUITMENT_MANAGER') then v_allowed:=true;
  elsif v_business_role='RECRUITER' then
    select exists(
      select 1 from public.applications ap
      join public.requirement_recruiter_assignments ra on ra.agency_id=ap.agency_id and ra.job_id=ap.job_id
        and ra.recruiter_user_id=v_user and ra.assignment_status='ACTIVE'
      where ap.agency_id=v_agency and ap.candidate_id=v_candidate and ap.archived_at is null
    ) into v_allowed;
  end if;
  if not v_allowed then return jsonb_build_object('ok',false,'error','document_access_denied'); end if;
  return jsonb_build_object('ok',true,'storage_path',v_path,'filename',v_name,'mime_type',v_mime,'candidate_id',v_candidate);
end;
$fn$;

revoke all on function public.xzrecruiter_save_requirement_assignment(text,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.xzrecruiter_execution_candidate_access(text,uuid) from public,anon,authenticated;
revoke all on function public.xzrecruiter_candidate_document_access(text,uuid) from public,anon,authenticated;
grant execute on function public.xzrecruiter_save_requirement_assignment(text,uuid,uuid,jsonb) to anon,authenticated;
grant execute on function public.xzrecruiter_execution_candidate_access(text,uuid) to anon,authenticated;
grant execute on function public.xzrecruiter_candidate_document_access(text,uuid) to anon,authenticated;

-- The earlier positional assignment mutation is retained only for migration compatibility, not as a browser API.
revoke execute on function public.xzrecruiter_assign_requirement(text,uuid,uuid,integer,text,text,text,text,uuid) from anon,authenticated;


create or replace function public.xzrecruiter_set_requirement_targets(
  p_token text,p_job_id uuid,p_daily_target integer,p_total_target integer
) returns jsonb
language plpgsql security definer
set search_path='public','private','extensions','pg_temp'
as $fn$
declare v_agency uuid;v_user uuid;v_membership_role text;v_business_role text;
begin
  select agency_id,user_id,role into v_agency,v_user,v_membership_role from private.xzrecruiter_session_context(p_token);
  if v_agency is null then return jsonb_build_object('ok',false,'error','unauthorized'); end if;
  v_business_role:=private.xzrecruiter_step3_business_role(v_agency,v_user,v_membership_role);
  if v_business_role not in ('OWNER','ADMIN','ACCOUNT_MANAGER','RECRUITMENT_MANAGER') then return jsonb_build_object('ok',false,'error','target_update_forbidden'); end if;
  if coalesce(p_daily_target,0)<0 or coalesce(p_daily_target,0)>1000 or coalesce(p_total_target,0)<0 or coalesce(p_total_target,0)>10000 then return jsonb_build_object('ok',false,'error','invalid_target'); end if;
  update public.recruitment_jobs
  set submission_target_daily=coalesce(p_daily_target,0),submission_target_total=coalesce(p_total_target,0),updated_at=now()
  where id=p_job_id and agency_id=v_agency and archived_at is null and recruiter_ready=true and requirement_state='OPEN';
  if not found then return jsonb_build_object('ok',false,'error','requirement_not_recruiter_ready'); end if;
  perform private.xzrecruiter_log_activity(v_agency,v_user,'job',p_job_id,'requirement.target_updated','Requirement submission targets updated',
    jsonb_build_object('daily_target',coalesce(p_daily_target,0),'total_target',coalesce(p_total_target,0)));
  return jsonb_build_object('ok',true,'daily_target',coalesce(p_daily_target,0),'total_target',coalesce(p_total_target,0));
end;
$fn$;

create or replace function public.xzrecruiter_recruiter_intake_candidate(
  p_token text,p_job_id uuid,p_candidate jsonb,p_source_type text,p_source_reference text,
  p_sourcing_notes text,p_idempotency_key text
) returns jsonb
language plpgsql security definer
set search_path='public','private','extensions','pg_temp'
as $fn$
declare v_agency uuid;v_user uuid;v_role text;v_key text:=nullif(left(btrim(coalesce(p_idempotency_key,'')),160),'');v_existing_app uuid;v_candidate_id uuid;v_result jsonb;v_existing_candidate uuid;
begin
  select agency_id,user_id,role into v_agency,v_user,v_role from private.xzrecruiter_session_context(p_token);
  if v_agency is null then return jsonb_build_object('ok',false,'error','unauthorized'); end if;
  if v_key is not null then
    perform pg_advisory_xact_lock(hashtext(v_agency::text||'|'||v_key));
    select id,candidate_id into v_existing_app,v_candidate_id
    from public.applications where agency_id=v_agency and intake_idempotency_key=v_key and archived_at is null limit 1;
    if v_existing_app is not null then
      return jsonb_build_object('ok',true,'candidate_id',v_candidate_id,'application_id',v_existing_app,'reused',true,'idempotent_replay',true);
    end if;
  end if;
  begin v_existing_candidate:=nullif(p_candidate->>'id','')::uuid; exception when others then v_existing_candidate:=null; end;
  v_result:=public.xzrecruiter_source_candidate(
    p_token,p_job_id,p_candidate,v_existing_candidate,p_source_type,p_source_reference,p_sourcing_notes
  );
  if coalesce((v_result->>'ok')::boolean,false)=false then return v_result; end if;
  if v_key is not null then
    update public.applications set intake_idempotency_key=v_key
    where id=(v_result->>'application_id')::uuid and agency_id=v_agency and intake_idempotency_key is null;
  end if;
  return v_result||jsonb_build_object('idempotent_replay',false);
exception when unique_violation then
  if v_key is not null then
    select id,candidate_id into v_existing_app,v_candidate_id
    from public.applications where agency_id=v_agency and intake_idempotency_key=v_key and archived_at is null limit 1;
    if v_existing_app is not null then return jsonb_build_object('ok',true,'candidate_id',v_candidate_id,'application_id',v_existing_app,'reused',true,'idempotent_replay',true); end if;
  end if;
  return jsonb_build_object('ok',false,'error','candidate_intake_conflict');
end;
$fn$;

revoke all on function public.xzrecruiter_set_requirement_targets(text,uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.xzrecruiter_recruiter_intake_candidate(text,uuid,jsonb,text,text,text,text) from public,anon,authenticated;
grant execute on function public.xzrecruiter_set_requirement_targets(text,uuid,integer,integer) to anon,authenticated;
grant execute on function public.xzrecruiter_recruiter_intake_candidate(text,uuid,jsonb,text,text,text,text) to anon,authenticated;
