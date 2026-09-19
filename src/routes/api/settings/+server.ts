import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ locals }) => {
    // Both OSA and Security can view settings
    const isOsaOrSecurity = locals.user && (locals.user.role === 'osa' || locals.user.role === 'security');
    
    if (!isOsaOrSecurity) {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { data: rows } = await supabase
            .from('parking_availability')
            .select('max_capacity')
            .eq('id', 1)
            .single();

        const maxCapacity = rows?.max_capacity ?? -1;

        return json({ max_capacity: maxCapacity });
    } catch (error) {
        console.error('[Settings] GET error:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};

export const PUT: RequestHandler = async ({ request, locals }) => {
    const isOsaOrSecurity = locals.user && (locals.user.role === 'osa' || locals.user.role === 'security');
    
    if (!isOsaOrSecurity) {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { max_capacity } = await request.json();

        if (typeof max_capacity !== 'number') {
            return json({ error: 'max_capacity must be a number' }, { status: 400 });
        }

        const { error: upsertError } = await supabase
            .from('parking_availability')
            .upsert({ id: 1, max_capacity }, { onConflict: 'id' });

        if (upsertError) throw upsertError;

        return json({ success: true, max_capacity });
    } catch (error) {
        console.error('[Settings] PUT error:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
