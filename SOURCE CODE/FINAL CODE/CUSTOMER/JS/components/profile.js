import { _supabase } from '../../../SUPABASE/supabase_customer_conn.js';
import { loadCustomerContent } from '../script.js';

let currentUserInfo = null;
let allOrders = [];

export async function initProfile(params) {
    console.log("Initializing Profile Page...");

    try {
        const { data: { session } } = await _supabase.auth.getSession();
        if (!session) {
            alert("Please login to view your profile.");
            window.location.href = 'cus_login.html'; 
            return;
        }
        
        const userId = session.user.id;

        await fetchAndRenderProfile(userId);
        document.getElementById('btn-update-profile').onclick = () => updateProfile(userId);
        await fetchOrders(userId);
        bindOrderTabs();

    } catch (err) {
        console.error("Profile Load Error:", err);
        alert("Failed to load profile details.");
    }
}

async function fetchAndRenderProfile(userId) {
    const { data, error } = await _supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) throw error;
    currentUserInfo = data;

    document.getElementById('prof-email').value = data.email || '';
    document.getElementById('prof-fname').value = data.first_name || '';
    document.getElementById('prof-lname').value = data.last_name || '';
    document.getElementById('prof-phone').value = data.phone || '';
    document.getElementById('prof-address').value = data.address || '';
}

async function updateProfile(userId) {
    const btn = document.getElementById('btn-update-profile');
    const fName = document.getElementById('prof-fname').value.trim();
    const lName = document.getElementById('prof-lname').value.trim();
    const phone = document.getElementById('prof-phone').value.trim();
    const address = document.getElementById('prof-address').value.trim();

    if (!fName || !lName || !phone || !address) {
        alert("Please fill up all fields.");
        return;
    }

    btn.disabled = true;
    btn.innerText = "Updating...";

    const { error } = await _supabase
        .from('profiles')
        .update({
            first_name: fName,
            last_name: lName,
            phone: phone,
            address: address
        })
        .eq('id', userId);

    btn.disabled = false;

    if (error) {
        console.error("Update error:", error);
        alert("Failed to update profile.");
        btn.innerText = "Update Profile";
    } else {
        btn.style.background = "#2ecc71";
        btn.innerText = "Updated Successfully!";
        setTimeout(() => {
            btn.style.background = "#1e2937";
            btn.innerText = "Update Profile";
        }, 2000);
    }
}

async function fetchOrders(userId) {
    const { data: orders, error } = await _supabase
        .from('orders')
        .select(`
            order_id, created_at, total_amount, status,
            order_item ( order_item_id, unit_price, quantity, subtotal, snapshot_info )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Fetch orders error:", error);
        document.getElementById('orders-container').innerHTML = `<p style="color:red;">Failed to load orders.</p>`;
        return;
    }

    allOrders = orders || [];
    renderOrdersList('active');
}

function renderOrdersList(viewType) {
    const container = document.getElementById('orders-container');
    container.innerHTML = '';

    const filteredOrders = allOrders.filter(o => {
        const status = (o.status || '').toLowerCase();
        if (viewType === 'active') {
            return status === 'order placed';
        } else {
            return status === 'cancelled' || status === 'delivered';
        }
    });

    if (filteredOrders.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 40px; color: #94a3b8; background: white; border-radius: 12px; border: 1px dashed #cbd5e1;">
            <i class="fa-solid fa-box-open" style="font-size: 40px; margin-bottom: 10px; color: #cbd5e1;"></i>
            <p>No ${viewType} orders found.</p>
        </div>`;
        return;
    }

    filteredOrders.forEach(order => {
        let statusColor = "#3b82f6";
        if (order.status.toLowerCase() === 'delivered') statusColor = "#2ecc71"; // 绿
        if (order.status.toLowerCase() === 'cancelled') statusColor = "#e74c3c"; // 红

        const formattedDate = new Date(order.created_at).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        let itemsHtml = '';
        order.order_item.forEach(item => {
            const snap = item.snapshot_info || {};
            itemsHtml += `
                <div style="display: flex; gap: 15px; margin-top: 15px; align-items: center; background: #f8fafc; padding: 10px; border-radius: 8px;">
                    <img src="${snap.image || 'https://dzgtfwdqfqecetnfhcdi.supabase.co/storage/v1/object/public/furniture-images/ERROR%20PICTURE.png'}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0;">
                    <div style="flex-grow: 1;">
                        <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #1e2937;">${snap.name || 'Unknown Item'}</h4>
                        <p style="margin: 0; font-size: 12px; color: #64748b;">Variant: ${snap.variant} • ${snap.colour}</p>
                    </div>
                    <div style="text-align: right; font-size: 13px; color: #475569;">
                        RM ${Number(item.unit_price).toFixed(2)} x ${item.quantity}
                    </div>
                </div>
            `;
        });

        let actionBtnHtml = '';
        if (order.status.toLowerCase() === 'order placed') {
            actionBtnHtml = `
                <button class="btn-cancel-order" data-id="${order.order_id}" style="margin-top: 10px; padding: 6px 12px; background: transparent; color: #e74c3c; border: 1px solid #e74c3c; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#e74c3c'; this.style.color='white';" onmouseout="this.style.background='transparent'; this.style.color='#e74c3c';">
                    Cancel Order
                </button>
            `;
        }

        const orderCard = document.createElement('div');
        orderCard.style.cssText = "background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
        orderCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding-bottom: 10px;">
                <div>
                    <p style="margin: 0 0 5px 0; font-size: 12px; color: #64748b;">Order ID: ${order.order_id}</p>
                    <p style="margin: 0; font-size: 13px; color: #475569;"><i class="fa-regular fa-clock"></i> ${formattedDate}</p>
                </div>
                <div style="text-align: right;">
                    <span style="display: inline-block; padding: 4px 10px; background: ${statusColor}15; color: ${statusColor}; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase;">
                        ${order.status}
                    </span>
                    <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #1e2937;">Total: RM ${Number(order.total_amount).toFixed(2)}</p>
                    ${actionBtnHtml}
                </div>
            </div>
            <div>
                ${itemsHtml}
            </div>
        `;
        container.appendChild(orderCard);
    });

    const cancelBtns = document.querySelectorAll('.btn-cancel-order');
    cancelBtns.forEach(btn => {
        btn.addEventListener('click', handleCancelOrder);
    });
}

function bindOrderTabs() {
    const tabActive = document.getElementById('tab-active');
    const tabHistory = document.getElementById('tab-history');

    const setActiveStyle = (activeBtn, inactiveBtn) => {
        activeBtn.style.color = "#3b82f6";
        activeBtn.style.borderBottom = "3px solid #3b82f6";
        inactiveBtn.style.color = "#64748b";
        inactiveBtn.style.borderBottom = "3px solid transparent";
    };

    tabActive.onclick = () => {
        setActiveStyle(tabActive, tabHistory);
        renderOrdersList('active');
    };

    tabHistory.onclick = () => {
        setActiveStyle(tabHistory, tabActive);
        renderOrdersList('history');
    };
}

async function handleCancelOrder(event) {
    const btn = event.target;
    const orderId = btn.getAttribute('data-id');

    if (!confirm("Are you sure you want to cancel this order? This action cannot be undone.")) {
        return;
    }

    btn.disabled = true;
    btn.innerText = "Cancelling...";

    try {
        const { data: orderItems, error: itemsErr } = await _supabase
            .from('order_item')
            .select('structure_id, quantity')
            .eq('order_id', orderId);

        if (itemsErr) throw itemsErr;

        if (orderItems && orderItems.length > 0) {
            for (const item of orderItems) {
                const { data: liveStruct } = await _supabase
                    .from('structure')
                    .select('stock')
                    .eq('structure_id', item.structure_id)
                    .single();

                if (liveStruct) {
                    const newStock = Number(liveStruct.stock || 0) + Number(item.quantity);

                    await _supabase
                        .from('structure')
                        .update({ stock: newStock })
                        .eq('structure_id', item.structure_id);
                    
                    console.log(`Restored ${item.quantity} stock for ${item.structure_id}. New stock: ${newStock}`);
                }
            }
        }

        const { error: updateErr } = await _supabase
            .from('orders')
            .update({ status: 'cancelled' })
            .eq('order_id', orderId);

        if (updateErr) throw updateErr;
        alert("Order cancelled successfully, and stock has been restored.");

        const { data: { session } } = await _supabase.auth.getSession();
        if (session) {
            await fetchOrders(session.user.id);
        }

    } catch (err) {
        console.error("Failed to cancel order:", err);
        alert("An error occurred while cancelling your order. Please try again.");
        btn.disabled = false;
        btn.innerText = "Cancel Order";
    }
}