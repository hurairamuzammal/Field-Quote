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

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/request-password-reset' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --data '{"name":"Functions"}'

*/


import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { email } = await req.json()
    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Always respond success-looking, regardless of outcome — see security note below.
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
    })

    if (linkError || !linkData?.properties?.hashed_token) {
      // Log it for your own visibility, but don't leak "user not found" to the caller.
      await adminClient.from('email_log').insert({
        to_email: email,
        template: 'password_reset',
        status: 'failed',
      })
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
    }

    const tokenHash = linkData.properties.hashed_token
    const resetUrl =
      `https://fieldquote-26446.bubbleapps.io/version-test/password_setup` +
      `?token_hash=${tokenHash}&type=recovery`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'RaftWorks <dev@raftworks.co>',
        to: [email],
        subject: 'Reset your FieldQuote password',
        html: `<p>We received a request to reset your password.</p>
               <p><a href="${resetUrl}">Click here to set a new password</a>.</p>
               <p>If you didn't request this, you can safely ignore this email.</p>`,
      }),
    })
    const resendData = await resendRes.json()

    await adminClient.from('email_log').insert({
      to_email: email,
      template: 'password_reset',
      resend_id: resendData?.id ?? null,
      status: resendRes.ok ? 'sent' : 'failed',
      token_hash: tokenHash,
    })

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})