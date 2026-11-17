export function projectRows(rows,projectId){if(!projectId)return [];return rows.filter(row=>row.project_id===projectId)}
export function verifiedProjectIds(rows){return new Set(rows.filter(x=>x.provider==="openai"&&x.connection_status==="connected"&&x.project_id).map(x=>x.project_id))}
