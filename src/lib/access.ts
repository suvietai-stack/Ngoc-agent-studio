import "server-only";
/** Only the configured Supabase Auth user may operate this private workspace. */
export function isStudioOwner(userId:string):boolean{const configured=process.env.STUDIO_OWNER_UID;return Boolean(configured&&configured===userId)}
