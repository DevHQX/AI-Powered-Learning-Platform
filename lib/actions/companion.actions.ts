'use server';

import {auth} from "@clerk/nextjs/server";
import {createSupabaseClient} from "@/lib/supabase";
import { revalidatePath } from "next/cache";

// Normalize Supabase companion rows (PascalCase columns) to app-wide camelCase
const normalizeCompanion = (row: any) => ({
    id: row.id,
    name: row.Name,
    subject: row.Subject,
    topic: row.Topic,
    voice: row.Voice,
    style: row.Style,
    duration: row.Duration,
    author: row.Author,
    bookmarked: Boolean(row.Bookmark),
});

export const createCompanion = async (formData: CreateCompanion) => {
    const { userId: author } = await auth();
    const supabase = createSupabaseClient();

    const { data, error } = await supabase
        .from('companions')
        .insert({
            // Map incoming camelCase to your Supabase PascalCase columns
            Name: formData.name,
            Subject: formData.subject,
            Topic: formData.topic,
            Voice: formData.voice,
            Style: formData.style,
            Duration: formData.duration,
            Author: author,
            Bookmark: false,
        })
        .select();

    if(error || !data) throw new Error(error?.message || 'Failed to create a companion');

    return normalizeCompanion(data[0]);
}

export const getAllCompanions = async ({ limit = 10, page = 1, subject, topic }: GetAllCompanions) => {
    const supabase = createSupabaseClient();

    let query = supabase.from('companions').select();

    if (subject && topic) {
        query = query.ilike('Subject', `%${subject}%`)
            .or(`Topic.ilike.%${topic}%,Name.ilike.%${topic}%`)
    } else if (subject) {
        query = query.ilike('Subject', `%${subject}%`)
    } else if (topic) {
        query = query.or(`Topic.ilike.%${topic}%,Name.ilike.%${topic}%`)
    }

    query = query.range((page - 1) * limit, page * limit - 1);

    const { data: companions, error } = await query;

    if(error) throw new Error(error.message);

    return (companions || []).map(normalizeCompanion);
}

export const getCompanion = async (id: string) => {
    const supabase = createSupabaseClient();

    const { data, error } = await supabase
        .from('companions')
        .select()
        .eq('id', id);

    if(error) return console.log(error);

    return data?.[0] ? normalizeCompanion(data[0]) : undefined;
}

export const addToSessionHistory = async (companionId: string) => {
    const { userId } = await auth();
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.from('session_history')
        .insert({
            companion_id: companionId,
            user_id: userId,
        })

    if(error) throw new Error(error.message);

    return data;
}

export const getRecentSessions = async (limit = 10) => {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
        .from('session_history')
        .select(`companions:companion_id (*)`)
        .order('created_at', { ascending: false })
        .limit(limit)

    if(error) throw new Error(error.message);

    return (data || []).map(({ companions }) => normalizeCompanion(companions));
}

export const getUserSessions = async (userId: string, limit = 10) => {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
        .from('session_history')
        .select(`companions:companion_id (*)`)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if(error) throw new Error(error.message);

    return (data || []).map(({ companions }) => normalizeCompanion(companions));
}

export const getUserCompanions = async (userId: string) => {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
        .from('companions')
        .select()
        .eq('Author', userId)

    if(error) throw new Error(error.message);

    return (data || []).map(normalizeCompanion);
}

export const newCompanionPermissions = async () => {
    const { userId, has } = await auth();
    const supabase = createSupabaseClient();

    let limit = 0;

    if(has({ plan: 'pro' })) {
        return true;
    } else if(has({ feature: "3_companion_limit" })) {
        limit = 3;
    } else if(has({ feature: "10_companion_limit" })) {
        limit = 10;
    }

    const { data, error } = await supabase
        .from('companions')
        .select('id', { count: 'exact' })
        .eq('Author', userId)

    if(error) throw new Error(error.message);

    const companionCount = data?.length;

    if(companionCount >= limit) {
        return false
    } else {
        return true;
    }
}

// Bookmarks
export const addBookmark = async (companionId: string, path: string) => {
  const { userId } = await auth();
  if (!userId) return;
  const supabase = createSupabaseClient();
  const { error } = await supabase
    .from("companions")
    .update({ Bookmark: true })
    .eq("id", companionId);
  if (error) {
    throw new Error(error.message);
  }
  // Revalidate the path to force a re-render of the page

  revalidatePath(path);
};

export const removeBookmark = async (companionId: string, path: string) => {
  const { userId } = await auth();
  if (!userId) return;
  const supabase = createSupabaseClient();
  const { error } = await supabase
    .from("companions")
    .update({ Bookmark: false })
    .eq("id", companionId);
  if (error) {
    throw new Error(error.message);
  }
  revalidatePath(path);
};

// It's almost the same as getUserCompanions, but it's for the bookmarked companions
export const getBookmarkedCompanions = async (userId: string) => {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("companions")
    .select()
    .eq("Bookmark", true);
  if (error) {
    throw new Error(error.message);
  }
  return (data || []).map(normalizeCompanion);
};





