export type OAuthState={provider:string;projectId:string;nonce:string};
export function packOAuthState(value:OAuthState):string;
export function parseOAuthState(cookie:string|null|undefined,returned:string|null|undefined,allowed:string[]):OAuthState|null;
