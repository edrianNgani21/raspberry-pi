import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { env } from '$env/dynamic/private';

function checkAuth(request: Request): boolean {
    return request.headers.get('X-Gate-Key') === env.PRIVATE_GATE_API_KEY;
}

export const GET: RequestHandler = async ({ request, url }) => {
    if (!checkAuth(request)) {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    const plate = url.searchParams.get('plate');
    if (!plate) {
        return json({ error: 'Missing plate parameter' }, { status: 400 });
    }

    try {
        // Lookup visitor by plate number in guestlog table
        const { data: guestData } = await supabase
            .from('guestlog')
            .select('*')
            .eq('plate', plate)
            .is('out', null)  // Only find visitors currently inside
            .order('in', { ascending: false })
            .limit(1)
            .single();

        if (guestData) {
            return json({
                found: true,
                visitor: {
                    guest_id: guestData.guest_id,
                    ticket_no: guestData.ticket_no,
                    name: guestData.name,
                    mobile: guestData.mobile,
                    make_model: guestData.make_model,
                    plate: guestData.plate,
                    purpose: guestData.purpose,
                    reason: guestData.reason,
                    in_time: guestData.in,
                    logged_status: guestData.logged_status
                }
            });
        } else {
            return json({
                found: false,
                message: 'No active visitor found with this plate number'
            });
        }
    } catch (error) {
        console.error('[Gate] Plate lookup error:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};