export type WorkflowGate="read"|"draft"|"approval"|"external";
export type WorkflowStep={key:string;label:string;gate:WorkflowGate;requires:readonly string[]};
export type WorkflowTemplate={key:string;title:string;trigger:string;steps:readonly WorkflowStep[]};
export const WORKFLOW_TEMPLATE_VERSION:string;
export const WORKFLOW_CATALOG:readonly WorkflowTemplate[];
export const AGENT_ROLE_KEYS:Readonly<Record<string,string>>;
export function validateWorkflow(workflow:unknown):boolean;
export function plannedSteps(workflow:WorkflowTemplate):{step_key:string;label:string;step_order:number;requires:string[];gate:WorkflowGate;status:string}[];
