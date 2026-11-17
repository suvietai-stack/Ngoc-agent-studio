export type Row={
 id:string;owner_id?:string;name?:string;title?:string;purpose?:string;instructions?:string;model?:string;
 enabled?:boolean;project_id?:string|null;agent_id?:string|null;task_id?:string|null;
 category?:string;description?:string|null;website_url?:string|null;
 status?:string;brief?:string|null;content?:string;body?:string;channel?:string;
 created_at?:string;updated_at?:string;connection_status?:string;display_name?:string;provider?:string;auto_run_enabled?:boolean;state?:string;
 capabilities?:string[];source?:string;summary?:string;output?:string;error_message?:string;
 frequency?:string;next_run_at?:string;last_run_at?:string;last_sign_in_at?:string;
 role?:string;workflow_id?:string|null;workflow_step?:number|null;depends_on_task_id?:string|null;
 role_key?:string|null;template_key?:string;template_version?:string;step_key?:string;step_order?:number;
 run_id?:string;definition_id?:string;label?:string;gate?:string;
 source_asset_id?:string|null;root_url?:string;code?:string;severity?:string;affected_count?:number;last_seen_at?:string;requires?:string[];steps?:{key:string;label:string;gate:string;requires:string[]}[];
};
export type WorkspaceData={
 projects:Row[];agents:Row[];tasks:Row[];knowledge:Row[];integrations:Row[];runs:Row[];
 automations:Row[];content:Row[];messages:Row[];
 workflowDefinitions:Row[];workflowRuns:Row[];workflowSteps:Row[];
 seoCrawls:Row[];seoUrls:Row[];seoFindings:Row[];
};
