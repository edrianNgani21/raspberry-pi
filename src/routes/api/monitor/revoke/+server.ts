import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ request, locals }) => {
    // Only Security can revoke
    if (!locals.user || locals.user.role !== 'security') {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { vehicle_id } = await request.json();
        if (!vehicle_id) return json({ error: 'Missing vehicle_id' }, { status: 400 });

        const { error: updateError } = await supabase
            .from('registration')
            .update({ 
                status: 'revoked', 
                revoked_at: new Date().toISOString() 
            })
            .eq('vehicle_id', vehicle_id);

        if (updateError) throw updateError;

        return json({ success: true });
    } catch (error) {
        console.error('[Monitor] Revoke error:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
    // Only Security can unrevoke
    if (!locals.user || locals.user.role !== 'security') {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { vehicle_id } = await request.json();
        if (!vehicle_id) return json({ error: 'Missing vehicle_id' }, { status: 400 });

        // Restore to distributed (fully approved) and clear the revoked timestamp
        const { error: updateError } = await supabase
            .from('registration')
            .update({
                status: 'distributed',
                revoked_at: null
            })
            .eq('vehicle_id', vehicle_id)
            .eq('status', 'revoked');

        if (updateError) throw updateError;

        return json({ success: true });
    } catch (error) {
        console.error('[Monitor] Unrevoke error:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};

