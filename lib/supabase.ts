import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Project } from './types';
import { STATIC_DEMO } from './deployment';

let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (STATIC_DEMO) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}
export async function cloudList(): Promise<Project[]> {
  const db = getSupabase();
  if (!db) throw new Error('Cloud storage has not been configured.');
  const { data, error } = await db
    .from('projects')
    .select('payload')
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error)
    throw new Error('Could not load cloud projects. Check your connection and database setup.');
  return (data || []).map((row) => row.payload as Project);
}
export async function cloudSave(project: Project) {
  const db = getSupabase();
  if (!db) throw new Error('Cloud storage has not been configured.');
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error('Sign in before saving to the cloud.');
  const { error } = await db.from('projects').upsert({
    id: project.id,
    user_id: user.id,
    name: project.product.name,
    payload: project,
    updated_at: project.updatedAt,
  });
  if (error) throw new Error('Cloud save failed. Your local copy is still available.');
}
export async function cloudDelete(id: string) {
  const db = getSupabase();
  if (!db) throw new Error('Cloud storage has not been configured.');
  const { error } = await db.from('projects').delete().eq('id', id);
  if (error) throw new Error('Could not delete this cloud project.');
}
