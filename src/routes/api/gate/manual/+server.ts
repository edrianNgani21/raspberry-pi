import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { env } from '$env/dynamic/private';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function checkAuth(request: Request): boolean {
    return request.headers.get('X-Gate-Key') === env.PRIVATE_GATE_API_KEY;
}

function generateTicketNo() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `GUEST-${result}`;
}

async function saveImage(pic_base64: string, type: string): Promise<string | null> {
    try {
        const uploadDir = path.join(process.cwd(), 'static', 'uploads', 'gate');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const base64Data = pic_base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `guest_${type}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.jpg`;
        fs.writeFileSync(path.join(uploadDir, filename), buffer);
        return `/uploads/gate/${filename}`;
    } catch (err) {
        console.error('[Gate] Error saving guest image:', err);
        return null;
    }
}

export const POST: RequestHandler = async ({ request }) => {
    if (!checkAuth(request)) {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { type, ticket_no, make_model, plate, reason, pic_base64, logged_status } = await request.json();

        if (!type || (type !== 'in' && type !== 'out')) {
            return json({ error: 'Invalid type (must be in or out)' }, { status: 400 });
        }

        const picUrl = pic_base64 ? await saveImage(pic_base64, type) : null;

        if (type === 'in') {
            if (!make_model || !plate) {
                return json({ error: 'make_model and plate are required for in' }, { status: 400 });
            }

            // Generate unique ticket number
            let newTicketNo = ticket_no;
            if (!newTicketNo) {
                let isUnique = false;
                while (!isUnique) {
                    newTicketNo = generateTicketNo();
                    const { data: rows } = await supabase
                        .from('guestlog')
                        .select('guest_id')
                        .eq('ticket_no', newTicketNo)
                        .single();
                    
                    if (!rows) isUnique = true;
                }
            }

            // Insert new IN row — out/pic_out are NULL until they leave
            const { error: insertError } = await supabase
                .from('guestlog')
                .insert({
                    ticket_no: newTicketNo,
                    make_model,
                    plate,
                    reason: reason || null,
                    in: new Date().toISOString(),
                    pic_in: picUrl
                });

            if (insertError) throw insertError;

            return json({ success: true, ticket_no: newTicketNo, message: 'Guest entry recorded' });

        } else {
            // type === 'out'
            if (!ticket_no) {
                return json({ error: 'ticket_no is required for out' }, { status: 400 });
            }

            // Find the most recent open IN record for this ticket (no out yet)
            const { data: rows } = await supabase
                .from('guestlog')
                .select('guest_id')
                .eq('ticket_no', ticket_no)
                .is('out', null)
                .order('in', { ascending: false })
                .limit(1)
                .single();

            if (rows) {
                // Update the existing IN row with OUT timestamp and photo
                const { error: updateError } = await supabase
                    .from('guestlog')
                    .update({
                        out: new Date().toISOString(),
                        pic_out: picUrl,
                        logged_status_out: logged_status || null
                    })
                    .eq('guest_id', rows.guest_id);

                if (updateError) throw updateError;
            } else {
                // No open IN found — insert a standalone OUT row
                const { data: inRows } = await supabase
                    .from('guestlog')
                    .select('make_model, plate')
                    .eq('ticket_no', ticket_no)
                    .order('in', { ascending: false })
                    .limit(1)
                    .single();

                const mm = inRows?.make_model || 'Unknown';
                const pl = inRows?.plate || 'Unknown';

                const { error: insertError } = await supabase
                    .from('guestlog')
                    .insert({
                        ticket_no,
                        make_model: mm,
                        plate: pl,
                        in: new Date().toISOString(),
                        out: new Date().toISOString(),
                        pic_out: picUrl,
                        logged_status_out: logged_status || null
                    });

                if (insertError) throw insertError;
            }

            return json({ success: true, message: 'Guest exit recorded' });
        }
    } catch (error) {
        console.error('[Gate] Manual entry error:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
