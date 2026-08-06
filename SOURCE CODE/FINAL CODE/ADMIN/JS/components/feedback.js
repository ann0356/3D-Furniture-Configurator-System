import { _supabase } from '../../../SUPABASE/supabase_admin_conn.js';

export async function initFeedback() {
    const tbody = document.getElementById('feedback-tbody');
    let isInitialized = tbody.dataset.initialized;

    async function fetchMessages() {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#aaa;">Loading...</td></tr>`;

        const { data, error } = await _supabase
            .from('contact_messages')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            tbody.innerHTML = `<tr><td colspan="5" style="color:red;">Failed to load messages.</td></tr>`;
            return;
        }

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#aaa;">No messages yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(msg => `
            <tr data-id="${msg.id}">
                <td><span class="status-badge ${msg.status}">${msg.status.toUpperCase()}</span></td>
                <td>
                    <strong>${msg.name}</strong><br>
                    <small>${msg.email}</small><br>
                    <small>Tel: ${msg.phone}</small>
                </td>
                <td>${msg.order_number || '-'}</td>
                <td style="max-width:300px;">
                    <strong>${msg.subject}</strong><br>
                    ${msg.message}
                </td>
                <td>
                    ${msg.status === 'unread'
                        ? `<button class="btn-action mark-read-btn" data-id="${msg.id}">Mark Read</button>`
                        : `<span style="color:#ccc;font-size:12px;">Read</span>`}
                </td>
            </tr>
        `).join('');
    }

    if (!isInitialized) {
        tbody.dataset.initialized = 'true';

        tbody.addEventListener('click', async (e) => {
            const btn = e.target.closest('.mark-read-btn');
            if (!btn) return;

            const id = btn.dataset.id;
            btn.textContent = 'Updating...';
            btn.disabled = true;

            const { data, error } = await _supabase
                .from('contact_messages')
                .update({ status: 'read' })
                .eq('id', id)
                .select();

            console.log('id being used:', id, typeof id);
            console.log('updated rows:', data);
            console.log('error:', error);
            
            if (error) {
                console.error(error);
                btn.textContent = 'Error ✕';
                btn.disabled = false;
            } else {
                fetchMessages();
            }
        });
    }

    fetchMessages();
}