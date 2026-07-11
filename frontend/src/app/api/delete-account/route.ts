import { getAuthForAccountDeletion } from '@/lib/supabase/auth-helper';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Since we need admin privileges to delete the user from auth.users,
// we create a service role client.
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

  const supabase = auth.supabase;
  const userId = auth.user.id;

  try {
    // 1. Elimina dati utente (in ordine per rispettare FK)
    
    // We need to fetch organizations first
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_id', userId);
      
    const orgIds = orgs?.map(o => o.id) ?? [];

    if (orgIds.length > 0) {
      await supabase.from('invoice_items').delete().in('organization_id', orgIds);
      await supabase.from('invoices').delete().in('organization_id', orgIds);
      await supabase.from('clients').delete().in('organization_id', orgIds);
      await supabase.from('quotes').delete().in('organization_id', orgIds);
      await supabase.from('organizations').delete().in('id', orgIds);
    }
    
    await supabase.from('user_plan').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('id', userId);

    // 2. Elimina auth user (richiede service role key — fare lato server)
    const adminClient = getAdminClient();
    const { error: adminError } = await adminClient.auth.admin.deleteUser(userId);
    
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
