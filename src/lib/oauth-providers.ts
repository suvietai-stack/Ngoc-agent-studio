/** Declared official read-only providers. No credentials in client code. */
export const OAUTH_PROVIDERS={
 gsc:{name:"Google Search Console",kind:"google",scope:"https://www.googleapis.com/auth/webmasters.readonly",description:"Đọc website Search Console được cấp quyền."},
 ga4:{name:"Google Analytics 4",kind:"google",scope:"https://www.googleapis.com/auth/analytics.readonly",description:"Đọc tài khoản và thuộc tính Google Analytics 4."},
 drive:{name:"Google Drive",kind:"google",scope:"https://www.googleapis.com/auth/drive.metadata.readonly",description:"Đọc danh sách tệp, chưa tự tải hoặc chỉnh sửa."},
 google_ads:{name:"Google Ads",kind:"google",scope:"https://www.googleapis.com/auth/adwords",description:"Xác minh tài khoản Google Ads, chưa quản lý chiến dịch."},
 facebook:{name:"Facebook Pages",kind:"meta",scope:"pages_show_list,pages_read_engagement",description:"Đọc danh sách Facebook Page được cấp quyền."},
 instagram:{name:"Instagram",kind:"meta",scope:"pages_show_list,pages_read_engagement,instagram_basic",description:"Xác minh Instagram Professional liên kết Facebook Page."}
} as const;
export type OAuthProvider=keyof typeof OAUTH_PROVIDERS;
export function isOAuthProvider(value:string):value is OAuthProvider{
 return Object.prototype.hasOwnProperty.call(OAUTH_PROVIDERS,value);
}
export function oauthReadyFlags():{google:boolean;meta:boolean;ads:boolean}{
 const google=Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID&&process.env.GOOGLE_OAUTH_CLIENT_SECRET);
 return {google,meta:Boolean(process.env.META_APP_ID&&process.env.META_APP_SECRET),
  ads:Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN)};
}
