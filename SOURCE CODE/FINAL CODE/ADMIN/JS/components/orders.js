import { _supabase } from '../../../SUPABASE/supabase_admin_conn.js'; 

const TABLE_ORDER = 'orders';         
const COL_ORDER_ID = 'order_id';      
const COL_CREATED_AT = 'created_at';  
const COL_STATUS = 'status';          
const COL_TOTAL = 'total_amount';     

let allOrders = [];
let isOverlayCloseBound = false;

function escapeHTML(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function safeAssetUrl(value, fallback) {
    try {
        const url = new URL(String(value || ''), window.location.origin);
        return url.protocol === 'https:' ? url.href : fallback;
    } catch {
        return fallback;
    }
}

export async function initAdminOrder() {
    console.log("Initializing Admin Order Management...");
    
    initYearDropdown();
    bindEvents();
    
    await fetchAllOrders();
}

function initYearDropdown() {
    const yearSelect = document.getElementById('ao-year');
    if (!yearSelect) return;
    yearSelect.innerHTML = '<option value="">All Years</option>';
    const currentYear = new Date().getFullYear(); 
    for (let i = 0; i < 5; i++) {
        const year = currentYear - i;
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    }
}

function bindEvents() {
    document.getElementById('ao-btn-search')?.addEventListener('click', filterAndRenderOrders);
    document.getElementById('ao-btn-reset')?.addEventListener('click', () => {
        document.getElementById('ao-search').value = '';
        document.getElementById('ao-year').value = '';
        document.getElementById('ao-month').value = '';
        filterAndRenderOrders();
    });

    // close panel with click any area except the panel area
    document.getElementById('ao-modal-close')?.addEventListener('click', () => {
        document.getElementById('ao-modal-overlay').style.display = 'none';
    });
    if (!isOverlayCloseBound) {
        window.addEventListener('click', (e) => {
            const overlay = document.getElementById('ao-modal-overlay');
            if (overlay && e.target === overlay) overlay.style.display = 'none';
        });
        isOverlayCloseBound = true;
    }
}

async function fetchAllOrders() {
    try {
        const { data, error } = await _supabase
            .from(TABLE_ORDER)
            .select(`*, profiles (*)`)
            .order(COL_CREATED_AT, { ascending: false });

        if (error) throw error;
        allOrders = data || [];
        filterAndRenderOrders(); 
    } catch (error) {
        console.error("Fetch Error:", error);
        document.getElementById('ao-tbody').innerHTML = `<tr><td colspan="6" class="ao-empty">Error loading data.</td></tr>`;
    }
}

function filterAndRenderOrders() {
    const searchKeyword = (document.getElementById('ao-search')?.value || '').toLowerCase().trim();
    const filterYear = document.getElementById('ao-year')?.value;
    const filterMonth = document.getElementById('ao-month')?.value;

    const filtered = allOrders.filter(order => {
        const orderDate = new Date(order[COL_CREATED_AT]);
        if (filterYear && filterYear !== orderDate.getFullYear().toString()) return false;
        if (filterMonth && filterMonth !== (orderDate.getMonth() + 1).toString()) return false;

        if (searchKeyword) {
            const oId = (order[COL_ORDER_ID] || '').toLowerCase();
            const profile = order.profiles || {};
            const cName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim().toLowerCase();
            if (!oId.includes(searchKeyword) && !cName.includes(searchKeyword)) return false;
        }
        return true;
    });
    renderTable(filtered);
}

function renderTable(dataArray) {
    const tbody = document.getElementById('ao-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (dataArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="ao-empty">No orders found.</td></tr>`;
        return;
    }

    dataArray.forEach(order => {
        const orderId = order[COL_ORDER_ID];
        const dateObj = new Date(order[COL_CREATED_AT]);
        const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
        
        const profile = order.profiles || {};
        const customerName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Guest';
        const currentStatus = (order[COL_STATUS] || 'order placed').toLowerCase();

        // check lock the selection or not
        const isLocked = currentStatus === 'delivered' || currentStatus === 'cancelled';
        const disabledAttr = isLocked ? 'disabled' : '';
        const cursorStyle = isLocked ? 'cursor: not-allowed; opacity: 0.8;' : 'cursor: pointer;';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHTML(orderId)}</strong></td>
            <td style="color:#64748b; font-size: 13px;">${dateStr}</td>
            <td>${escapeHTML(customerName)}</td>
            <td style="font-weight: bold;">RM ${Number(order[COL_TOTAL]).toFixed(2)}</td>
            <td>
                <select class="status-select" data-id="${escapeHTML(orderId)}" style="${getStatusStyle(currentStatus)} ${cursorStyle}" ${disabledAttr}>
                    <option value="order placed" ${currentStatus === 'order placed' ? 'selected' : ''}>Order Placed</option>
                    <option value="delivered" ${currentStatus === 'delivered' ? 'selected' : ''}>Delivered</option>
                    <option value="cancelled" ${currentStatus === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </td>
            <td>
                <button class="view-detail-btn ao-btn" style="padding: 5px 12px; font-size: 12px; background: #6366f1; color: white;">View Detail</button>
            </td>
        `;

        // only no locked can be change
        if (!isLocked) {
            tr.querySelector('.status-select').addEventListener('change', (e) => handleStatusChange(e, orderId));
        }
        
        // 🌟 核心：绑定详情弹窗
        tr.querySelector('.view-detail-btn').addEventListener('click', () => openOrderDetail(order));

        tbody.appendChild(tr);
    });
}

// detail panel funciton
async function openOrderDetail(order) {
    const overlay = document.getElementById('ao-modal-overlay');
    const itemsBody = document.getElementById('modal-items-body');
    
    // get data of user
    document.getElementById('modal-order-id').innerText = `Details for Order: ${order.order_id}`;
    const p = order.profiles || {};
    document.getElementById('modal-cust-name').innerText = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Guest Customer';
    document.getElementById('modal-cust-email').innerText = p.email || 'No email provided';
    document.getElementById('modal-cust-phone').innerText = p.phone || 'No phone provided';
    document.getElementById('modal-cust-address').innerText = p.address || 'No shipping address provided';
    document.getElementById('modal-grand-total').innerText = `RM ${Number(order.total_amount).toFixed(2)}`;

    // loading....
    itemsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:#94a3b8;">Loading items...</td></tr>`;
    overlay.style.display = 'flex';

    try {
        // check order item
        const { data: items, error } = await _supabase
            .from('order_item')
            .select(`
                *,
                structure:structure_id (
                    structure_name, colour, image_url,
                    furniture:furniture_id ( furniture_name )
                )
            `)
            .eq('order_id', order.order_id);

        if (error) throw error;

        // render 
        itemsBody.innerHTML = '';
        if (!items || items.length === 0) {
            itemsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px;">No items found.</td></tr>`;
        } else {
            items.forEach(item => {
                const s = item.structure || {};
                const f = s.furniture || {};
                const imageUrl = safeAssetUrl(s.image_url, 'https://dzgtfwdqfqecetnfhcdi.supabase.co/storage/v1/object/public/furniture-images/ERROR%20PICTURE.png');
                const row = document.createElement('tr');
                row.style.borderBottom = "1px solid #f1f5f9";
                row.innerHTML = `
                    <td style="padding: 12px 5px; display: flex; align-items: center; gap: 10px;">
                        <img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(f.furniture_name || 'Product')}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; background: #f8fafc;">
                        <div>
                            <div style="font-weight: 600; color: #1e293b;">${escapeHTML(f.furniture_name || 'Product')}</div>
                            <div style="font-size: 11px; color: #64748b;">${escapeHTML(s.structure_name || '')} - ${escapeHTML(s.colour || '')}</div>
                        </div>
                    </td>
                    <td style="padding: 12px 5px;">RM ${Number(item.unit_price || 0).toFixed(2)}</td>
                    <td style="padding: 12px 5px; text-align: center;">x${item.quantity}</td>
                    <td style="padding: 12px 5px; text-align: right; font-weight: 600;">RM ${Number(item.subtotal || 0).toFixed(2)}</td>
                `;
                itemsBody.appendChild(row);
            });
        }
    } catch (err) {
        console.error("Error loading order items:", err);
        itemsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#ef4444;">Failed to load items.</td></tr>`;
    }
}

async function handleStatusChange(event, orderId) {
    const newStatus = event.target.value.toLowerCase();
    const order = allOrders.find(o => o.order_id === orderId);
    const oldStatus = (order.status || 'order placed').toLowerCase();

    const confirmUpdate = confirm(`Change status to "${newStatus.toUpperCase()}"?`);
    if (!confirmUpdate) {
        event.target.value = oldStatus;
        return;
    }

    event.target.disabled = true;

    try {
        // status update: cancelled order, restore stock
        if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
            console.log(`[Admin] Cancelling order ${orderId}, initiating stock restoration...`);
            
            // check item
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
                        
                        console.log(`[Admin] Restored ${item.quantity} stock for ${item.structure_id}. New stock: ${newStock}`);
                    }
                }
            }
        }

        // update status
        const { error } = await _supabase.from(TABLE_ORDER).update({ status: newStatus }).eq(COL_ORDER_ID, orderId);
        if (error) throw error;
        
        // update data and UI
        if (order) order.status = newStatus;
        event.target.style.cssText = getStatusStyle(newStatus) + ' cursor: not-allowed; opacity: 0.8;';
        
        if (newStatus === 'cancelled') {
            alert("Order cancelled successfully. Stock has been restored and status is now locked.");
        } else if (newStatus === 'delivered') {
            alert("Order marked as delivered successfully. Status is now locked.");
        }

    } catch (err) {
        console.error("Status Update Error:", err);
        alert("Update failed. Please check the console for details.");
        event.target.value = oldStatus;
    } finally {
        // if status == cancel || delivered, lock the selection
        const finalStatus = event.target.value.toLowerCase();
        if (finalStatus !== 'delivered' && finalStatus !== 'cancelled') {
            event.target.disabled = false;
        }
    }
}

function getStatusStyle(status) {
    switch (status.toLowerCase()) {
        case 'order placed': return 'background: #fef9c3; color: #a16207; border-color: #fde047;';
        case 'delivered': return 'background: #dcfce7; color: #15803d; border-color: #86efac;';
        case 'cancelled': return 'background: #fee2e2; color: #b91c1c; border-color: #fca5a5;';
        default: return 'background: #f1f5f9; color: #475569; border-color: #cbd5e1;';
    }
}
