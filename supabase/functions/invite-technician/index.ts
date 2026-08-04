// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

console.log("Hello from Functions!");

// This endpoint uses 'publishable' | 'secret' access, apiKey is required.
// Use publishable for Client-facing, key-validated endpoints
// Use secret for Server-to-server, internal calls
export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    // Called by another service with a secret key
    // ctx.supabaseAdmin bypasses RLS — use for privileged operations
    /*
    if (ctx.authMode === "secret") {
      const { user_id } = await req.json();
      const { data } = await ctx.supabaseAdmin.auth.admin.getUserById(user_id);

      return Response.json({
        email: data?.user?.email,
      });
    }
    */

    const { name } = await req.json();

    return Response.json({
      message: `Hello ${name}!`,
    });
  }),
};

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/invite-technician' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --data '{"name":"Functions"}'

*/
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    // Client scoped to the caller's own JWT — used only to verify who's asking
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    // Admin client — service_role, never leaves this function
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: corsHeaders,
      })
    }

    const { email, full_name } = await req.json()
    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Step 1 — create the auth user with role metadata (trigger creates the profiles row)
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: {
        role: 'technician',
        full_name: full_name ?? '',
      },
    })

    if (createError) {
      const isDuplicate = createError.message?.toLowerCase().includes('already') ||
                           createError.status === 422
      return new Response(
        JSON.stringify({ error: isDuplicate ? 'User already exists' : createError.message }),
        { status: isDuplicate ? 409 : 500, headers: corsHeaders }
      )
    }

    // Step 2 — generate an invite token (Supabase manages expiry/security, not us)
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email,
    })

    if (linkError) {
      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 500,
        headers: corsHeaders,
      })
    }

    const tokenHash = linkData.properties?.hashed_token
    const setPasswordUrl =
      `https://fieldquote-26446.bubbleapps.io/version-test/password_setup` +
      `?token_hash=${tokenHash}&type=invite`

    // Step 3 — send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'RaftWorks <dev@raftworks.co>',
        to: [email],
        subject: "You've been invited to FieldQuote",
        html: `<p>You've been invited to join as a technician on FieldQuote.</p>
               <p>Set up your account by <a href="${setPasswordUrl}">clicking here</a>.</p>
               <p>This link expires soon — set your password shortly after receiving this email.</p>`,
      }),
    })

    const resendData = await resendRes.json()

    // Step 4 — log it, no exceptions (§13 Rule 8)
    await adminClient.from('email_log').insert({
      to_email: email,
      template: 'technician_invite',
      related_id: created.user.id,
      resend_id: resendData?.id ?? null,
      token_hash: tokenHash,
      status: resendRes.ok ? 'sent' : 'failed',
    })

    return new Response(JSON.stringify({ success: true, user_id: created.user.id }), {
      status: 200,
      headers: corsHeaders,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
