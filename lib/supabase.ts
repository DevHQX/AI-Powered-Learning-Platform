import {createClient} from "@supabase/supabase-js";
import {auth} from "@clerk/nextjs/server";

export const createSupabaseClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            async accessToken() {
                // Use the Clerk JWT template configured for Supabase
                // See: https://clerk.com/docs/integrations/supabase
                const { getToken } = await auth();
                const token = await getToken({ template: 'supabase' }).catch(() => null);
                return token || undefined;
            }
        }
    )
}