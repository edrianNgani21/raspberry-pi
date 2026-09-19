import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { sendEmail } from '$lib/server/email';

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user || locals.user.role !== 'dean') {
        return json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { registration_id, action, reason } = await request.json();

        // Get the department_id to use for authorization
        let departmentIdForAuth = locals.user.department_id;
        
        if (!departmentIdForAuth) {
            // Fallback: get department_id from department table by email
            const { data: deptByEmail } = await supabase
                .from('department')
                .select('department_id')
                .eq('email', locals.user.email)
                .maybeSingle();
            
            if (deptByEmail) {
                departmentIdForAuth = deptByEmail.department_id;
            }
        }

        // Check if registration belongs to dean's dept
        const { data: rows } = await supabase
            .from('registration')
            .select(`
                *,
                user:user_id(
                    email
                )
            `)
            .eq('registration_id', registration_id)
            .eq('department_id', departmentIdForAuth)
            .single();

        if (!rows) {
            return json({ error: 'Application not found or unauthorized' }, { status: 404 });
        }

        const reg = rows;

        if (action === 'accept' && reg.status === 'dept_val') {
            const { error: updateError } = await supabase
                .from('registration')
                .update({ status: 'osa_val', dept_val_at: new Date().toISOString() })
                .eq('registration_id', registration_id);

            if (updateError) throw updateError;

            await sendEmail(
                reg.user.email,
                'Application Approved by Dean - Liceo GateQR',
                'Your vehicle sticker application has been approved by your Dean and is now pending final validation by the Office of Student Affairs (OSA).',
                '<p>Your vehicle sticker application has been <strong>approved by your Dean</strong>.</p><p>It is now pending final validation by the Office of Student Affairs (OSA).</p>'
            );
        } 
        else if (action === 'reject' && reg.status === 'dept_val') {
            if (!reason) return json({ error: 'Reason required' }, { status: 400 });
            
            const { error: updateError } = await supabase
                .from('registration')
                .update({ 
                    status: 'rejected', 
                    rejected_at: new Date().toISOString(), 
                    invalid_reason: reason 
                })
                .eq('registration_id', registration_id);

            if (updateError) throw updateError;

            await sendEmail(
                reg.user.email,
                'Application Rejected by Dean - Liceo GateQR',
                `Your vehicle sticker application was rejected by your Dean. Reason: ${reason}`,
                `<p>Your vehicle sticker application was <strong>rejected by your Dean</strong>.</p><p>Reason: <em>${reason}</em></p>`
            );
        }
        else if (action === 'revoke' && reg.status === 'osa_val') {
            // Dean can revoke if OSA hasn't validated yet
            if (!reason) return json({ error: 'Reason required' }, { status: 400 });
            
            const { error: updateError } = await supabase
                .from('registration')
                .update({ 
                    status: 'revoked', 
                    revoked_at: new Date().toISOString(), 
                    invalid_reason: reason 
                })
                .eq('registration_id', registration_id);

            if (updateError) throw updateError;

            await sendEmail(
                reg.user.email,
                'Application Revoked by Dean - Liceo GateQR',
                `Your vehicle sticker application was revoked by your Dean before OSA validation. Reason: ${reason}`,
                `<p>Your vehicle sticker application was <strong>revoked by your Dean</strong>.</p><p>Reason: <em>${reason}</em></p>`
            );
        }
        else if (action === 'retract' && (reg.status === 'osa_val' || reg.status === 'rejected')) {
            const { error: updateError } = await supabase
                .from('registration')
                .update({ 
                    status: 'dept_val', 
                    dept_val_at: null, 
                    rejected_at: null, 
                    invalid_reason: null 
                })
                .eq('registration_id', registration_id);

            if (updateError) throw updateError;
        }
        else {
            return json({ error: 'Invalid action for current status' }, { status: 400 });
        }

        return json({ message: 'Application updated' });
    } catch (error) {
        console.error('Failed to update dean application:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
