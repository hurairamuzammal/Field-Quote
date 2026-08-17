import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type CompanyBrand = {
  company_id: string
  name: string
  logo_key: string | null
}

/**
 * v1 is single-tenant: resolve company_id from company_settings (not a hardcoded UUID).
 * Prefer this for public paths (submit-request) with no caller profile.
 */
export async function fetchSoleCompanyId(
  admin: SupabaseClient,
): Promise<{ company_id: string } | { error: string }> {
  const { data, error } = await admin
    .from('company_settings')
    .select('company_id')
    .limit(2)

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'company_settings missing — seed a company row' }
  if (data.length > 1) {
    return {
      error:
        'Multiple company_settings rows — pass an explicit company or collapse to one for v1',
    }
  }
  return { company_id: data[0].company_id as string }
}

/** Load display name (+ logo_key) for emails / public payloads. */
export async function fetchCompanyBrand(
  admin: SupabaseClient,
  companyId: string,
): Promise<{ brand: CompanyBrand } | { error: string }> {
  const { data, error } = await admin
    .from('company_settings')
    .select('company_id, name, logo_key')
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data?.company_id) return { error: 'company_settings not found for company_id' }

  const name = (data.name && String(data.name).trim()) || 'Your company'
  return {
    brand: {
      company_id: data.company_id as string,
      name,
      logo_key: (data.logo_key as string | null) ?? null,
    },
  }
}

/** Resend `from` header: display name from DB, address from env (verified domain). */
export function resendFromHeader(companyName: string): string {
  const email = (Deno.env.get('RESEND_FROM_EMAIL') ?? 'dev@raftworks.co').trim()
  const safeName = companyName.replace(/[<>\r\n]/g, '').trim() || 'Company'
  return `${safeName} <${email}>`
}
