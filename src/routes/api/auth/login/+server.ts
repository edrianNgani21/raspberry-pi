import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { sendEmail } from '$lib/server/email';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { email } = await request.json();

        if (!email) {
            return json({ error: 'Email is required' }, { status: 400 });
        }

        // Generate OTP first (fast operation)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Get or create user using Supabase with optimized query
        let { data: users, error: userError } = await supabase
            .from('user')
            .select('user_id, user_type')
            .eq('email', email)
            .maybeSingle();

        let userId = users?.user_id;
        let userType = users?.user_type || 'Applicants';

        if (!userId || userError) {
            // Only create user if doesn't exist (not on other errors)
            if (userError && userError.code !== 'PGRST116') {
                throw userError;
            }

            // Create user if doesn't exist
            const { data: newUser, error: createError } = await supabase
                .from('user')
                .insert({
                    email,
                    user_type: 'Applicants',
                    identification: 'Visitor'
                })
                .select('user_id')
                .single();

            if (createError) throw createError;
            userId = newUser.user_id;
        }

        // Clean up old OTPs for this email (faster than waiting for expiration)
        await supabase
            .from('otp_codes')
            .delete()
            .lt('expires_at', new Date().toISOString())
            .eq('email', email);

        // Store OTP in Supabase database
        const { error: otpError } = await supabase
            .from('otp_codes')
            .insert({
                user_id: userId,
                email,
                otp,
                expires_at: expiresAt.toISOString()
            });

        if (otpError) throw otpError;

        // Send email (this is the main bottleneck, but we can't skip it)
        // Fire and forget - don't wait for email completion for response
        sendEmail(
            email,
            'Your GateQR Login Code',
            `Your login code is: ${otp}. It will expire in 10 minutes.`,
            `<h3>Welcome to GateQR</h3><p>Your login code is: <strong>${otp}</strong></p><p>It will expire in 10 minutes.</p>`
        ).catch(err => console.error('Email send error:', err));

        // For testing/development, log the OTP immediately
        console.log(`[OTP] Generated for ${email}: ${otp}`);

        // Return success immediately without waiting for email
        return json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Login error:', error);
        return json({ error: 'Failed to process login request' }, { status: 500 });
    }
};
