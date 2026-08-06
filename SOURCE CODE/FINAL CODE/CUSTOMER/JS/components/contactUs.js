import { _supabase } from '../../../SUPABASE/supabase_customer_conn.js';

export function initContactUs() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = document.getElementById('cf-submit-btn');
        const originalBtnText = btn.innerText;
        btn.innerText = 'Sending...';
        btn.disabled = true;

        const payload = {
            name: document.getElementById('cf-name').value,
            phone: document.getElementById('cf-phone').value,
            email: document.getElementById('cf-email').value,
            order_number: document.getElementById('cf-order').value || null,
            subject: document.getElementById('cf-subject').value || 'General Inquiry',
            message: document.getElementById('cf-message').value,
            status: 'unread'
        };

        try {
            const { error } = await _supabase
                .from('contact_messages')
                .insert([payload]);

            if (error) throw error;

            alert('Thank you! Your message has been sent successfully.');
            form.reset();
        } catch (error) {
            console.error('Error submitting contact form:', error);
            alert('Failed to send message: ' + error.message);
        } finally {
            btn.innerText = originalBtnText;
            btn.disabled = false;
        }
    });
}