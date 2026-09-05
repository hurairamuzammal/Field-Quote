import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const MAX_MESSAGE_CHARS = 2000
export const MAX_HISTORY_MESSAGES = 20

/**
 * Ceiling for one thread. Reached => refuse before calling the model, so a
 * runaway conversation cannot keep spending. The admin starts a new chat.
 */
export const MAX_SESSION_TOKENS = 60_000
/** Warn the UI from here so "start a new chat" is not a surprise. */
export const SESSION_TOKEN_WARN_AT = Math.floor(MAX_SESSION_TOKENS * 0.8)

export const SESSION_FULL_REPLY =
  'This conversation has reached its length limit. Start a new chat and I will pick up from there.'

export type ChatHistoryRow = {
  role: string
  content: string
}

export async function resolveSession(
  admin: SupabaseClient,
  companyId: string,
  ownerId: string,
  sessionId: string | undefined,
  firstMessageTitle: string,
): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  if (sessionId) {
    const { data: session, error } = await admin
      .from('chat_sessions')
      .select('id, owner_id, company_id')
      .eq('id', sessionId)
      .maybeSingle()

    if (error) return { ok: false, error: error.message }
    if (!session || session.owner_id !== ownerId || session.company_id !== companyId) {
      return { ok: false, error: 'Invalid session_id' }
    }
    return { ok: true, sessionId: session.id as string }
  }

  const { data: created, error: insertError } = await admin
    .from('chat_sessions')
    .insert({
      company_id: companyId,
      owner_id: ownerId,
      title: firstMessageTitle.slice(0, 40) || null,
    })
    .select('id')
    .single()

  if (insertError || !created) {
    return { ok: false, error: insertError?.message ?? 'Failed to create session' }
  }
  return { ok: true, sessionId: created.id as string }
}

export async function insertChatMessage(
  admin: SupabaseClient,
  companyId: string,
  sessionId: string,
  role: 'user' | 'assistant' | 'tool',
  content: string,
): Promise<void> {
  const { error } = await admin.from('chat_messages').insert({
    company_id: companyId,
    session_id: sessionId,
    role,
    content,
  })
  if (error) throw new Error(error.message)
}

/** Same insert, but returns the new row id so proposals can be linked to it. */
export async function insertChatMessageReturningId(
  admin: SupabaseClient,
  companyId: string,
  sessionId: string,
  role: 'user' | 'assistant' | 'tool',
  content: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('chat_messages')
    .insert({ company_id: companyId, session_id: sessionId, role, content })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data?.id as string) ?? null
}

export async function linkActionsToMessage(
  admin: SupabaseClient,
  actionIds: string[],
  messageId: string,
): Promise<void> {
  if (!actionIds.length) return
  await admin
    .from('assistant_actions')
    .update({ message_id: messageId })
    .in('id', actionIds)
}

export async function loadChatHistory(
  admin: SupabaseClient,
  sessionId: string,
  limit = MAX_HISTORY_MESSAGES,
): Promise<ChatHistoryRow[]> {
  const { data, error } = await admin
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as ChatHistoryRow[]
}

export async function getSessionTokenCount(
  admin: SupabaseClient,
  sessionId: string,
): Promise<number> {
  const { data } = await admin
    .from('chat_sessions')
    .select('token_count')
    .eq('id', sessionId)
    .maybeSingle()
  return typeof data?.token_count === 'number' ? data.token_count : 0
}

export async function touchSessionTokenCount(
  admin: SupabaseClient,
  sessionId: string,
  addTokens: number,
): Promise<number> {
  const { data: row } = await admin
    .from('chat_sessions')
    .select('token_count')
    .eq('id', sessionId)
    .maybeSingle()

  const prev = typeof row?.token_count === 'number' ? row.token_count : 0
  const next = prev + addTokens

  await admin.from('chat_sessions').update({ token_count: next }).eq('id', sessionId)
  return next
}
