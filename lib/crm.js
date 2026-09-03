import { sessionToken } from '@/lib/auth';
import { rpc } from '@/lib/supabase-api';

export async function getCrmReferenceContext(){
  const token=await sessionToken(); if(!token) return null;
  const result=await rpc('xzrecruiter_crm_reference_context',{p_token:token});
  return result?.ok?result:null;
}

export async function getCrmSearch(module,query='',filters={},limit=50,offset=0){
  const token=await sessionToken(); if(!token) return null;
  const result=await rpc('xzrecruiter_crm_search',{p_token:token,p_module:module,p_query:query,p_filters:filters||{},p_limit:limit,p_offset:offset});
  return result?.ok?result:null;
}

export async function crmAction(name,args={}){
  const token=await sessionToken(); if(!token) return {ok:false,error:'unauthorized'};
  const map={
    saveClient:['xzrecruiter_save_client',{p_token:token,p_client:args}],
    saveContact:['xzrecruiter_save_contact',{p_token:token,p_contact:args}],
    saveOpportunity:['xzrecruiter_save_opportunity',{p_token:token,p_opportunity:args}],
    moveOpportunity:['xzrecruiter_move_opportunity_stage',{p_token:token,p_opportunity_id:args.opportunityId,p_stage_id:args.stageId,p_reason:args.reason||null}],
    saveActivity:['xzrecruiter_save_crm_activity',{p_token:token,p_activity:args}],
    saveTask:['xzrecruiter_save_crm_task',{p_token:token,p_task:args}],
    setTaskStatus:['xzrecruiter_set_crm_task_status',{p_token:token,p_task_id:args.taskId,p_status:args.status}],
    saveContract:['xzrecruiter_save_client_contract',{p_token:token,p_contract:args}],
    saveCustomValues:['xzrecruiter_save_crm_custom_values',{p_token:token,p_entity_type:args.entityType,p_entity_id:args.entityId,p_values:args.values||[]}],
    client360:['xzrecruiter_client_360',{p_token:token,p_client_id:args.clientId}],
    contact360:['xzrecruiter_contact_360',{p_token:token,p_contact_id:args.contactId}],
    opportunity360:['xzrecruiter_opportunity_360',{p_token:token,p_opportunity_id:args.opportunityId}],
    archiveEntity:['xzrecruiter_archive_crm_entity',{p_token:token,p_entity_type:args.entityType,p_entity_id:args.entityId}],
    saveSavedView:['xzrecruiter_save_saved_view',{p_token:token,p_view:args}],
    savedViewContext:['xzrecruiter_saved_view_context',{p_token:token,p_module:args.module}]
  };
  const entry=map[name]; if(!entry) return {ok:false,error:'unsupported_action'};
  return rpc(entry[0],entry[1]);
}

export async function getCrmSavedViews(module){
  const result=await crmAction('savedViewContext',{module});
  return result?.ok?(result.views||[]):[];
}
