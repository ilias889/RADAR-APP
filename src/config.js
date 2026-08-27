export const SUPABASE_URL = "https://dthnmkmmmihiqujlrtpk.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_YBwf3byH4rHN5hysJ0J0Ng_E1XSNl_S";

export const IS_CONFIGURED = 
  !SUPABASE_URL.includes("YOUR-PROJECT-REF") && 
  !SUPABASE_ANON_KEY.includes("YOUR-ANON-PUBLIC-KEY");