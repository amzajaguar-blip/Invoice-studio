import { getAuthForAccountDeletion } from '@/lib/supabase/auth-helper';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Since we need admin privileges to delete the user from auth.users,
// we create a service role client. The service role also bypasses RLS,
// which is required: deleting via the user's own (RLS-scoped) client
// silently removes 0 rows when no DELETE policy exists, leaving FK
// references in place and making auth.users deletion fail.
const getAdminClient = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

export async function DELETE(req: NextRequest) {
  // Supporta sia web (cookie) che mobile (Bearer token)
  const auth = await getAuthForAccountDeletion(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = auth.user.id;
  const admin = getAdminClient();

  try {
    // 1. Elimina dati utente (in ordine per rispettare FK)
    // All deletions go through the service-role client so RLS cannot block
    // them and every referencing row is actually removed.

    // Organizations owned by the user. Only delete an org if the user is the
    // SOLE remaining member — otherwise other members would lose their shared
    // data (clients, quotes, invoices). CASCADE handles child tables.
    const { data: ownedOrgs } = await admin
      .from('organizations')
      .select('id')
      .eq('owner_id', userId);
    const ownedOrgIds = ownedOrgs?.map((o) => o.id) ?? [];

    for (const orgId of ownedOrgIds) {
      const { count } = await admin
        .from('org_members')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId);

      if ((count ?? 0) <= 1) {
        // Sole member — safe to delete the org (CASCADE removes all data)
        await admin.from('organizations').delete().eq('id', orgId);
      }
      // If other members exist, do NOT delete the org — only remove membership.
    }

    // Membership in any org the user does not own (cleaned separately so we
    // don't delete orgs that still belong to other users).
    await admin.from('org_members').delete().eq('user_id', userId);

    // Tables that reference auth.users with a NON-cascading FK. These MUST be
    // deleted explicitly or `auth.users` deletion fails with a FK violation.
    await admin.from('user_plan').delete().eq('user_id', userId);
    await admin.from('user_engagement').delete().eq('user_id', userId);
    await admin.from('profiles').delete().eq('id', userId);

    // 2. Elimina auth user (richiede service role key — fare lato server)
    const { error: adminError } = await admin.auth.admin.deleteUser(userId);

    if (adminError) {
      console.error('Delete user admin error:', adminError);
      return NextResponse.json({ error: 'Failed to delete auth user' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete account error:', err);
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 });
  }
}
