import { _supabase } from '../../../SUPABASE/supabase_customer_conn.js';
import { loadCustomerContent } from '../script.js';

let orderItemsData = [];
let currentUser = null;
let finalTotalAmount = 0;
let checkoutCartItemIds = [];

export async function initOrder(params) {
    console.log("Initializing Order Page with Params:", params);

    // 1. 检查是否有传过来的购物车商品参数
    if (!params || !params.selectedItems) {
        alert("No items selected for checkout.");
        loadCustomerContent('cart');
        return;
    }

    checkoutCartItemIds = params.selectedItems.split(',');

    try {
        const { data: { session } } = await _supabase.auth.getSession();
        if (!session) {
            alert("Session expired. Please login again.");
            window.location.href = 'cus_login.html'; 
            return;
        }
        
        const userId = session.user.id;
        
        const { data: profile } = await _supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        currentUser = profile;

        const shippingBox = document.getElementById('order-shipping-info');
        if (shippingBox && currentUser) {
            shippingBox.innerHTML = `
                <p style="margin:0 0 5px 0;"><strong>Name:</strong> ${currentUser.first_name} ${currentUser.last_name}</p>
                <p style="margin:0 0 5px 0;"><strong>Phone:</strong> ${currentUser.phone || 'N/A'}</p>
                <p style="margin:0;"><strong>Address:</strong> ${currentUser.address || 'N/A'}</p>
            `;
        }

        const { data: items, error: itemsError } = await _supabase
            .from('cart_item')
            .select(`
                cart_item_id,
                quantity,
                structure_id,
                structure:structure_id (
                    structure_name, colour, price, image_url, material, stock,
                    furniture:furniture_id ( furniture_name )
                )
            `)
            .in('cart_item_id', checkoutCartItemIds);

        if (itemsError) throw itemsError;
        
        orderItemsData = items || [];
        
        renderOrderItems();

        document.getElementById('btn-pay').onclick = processPayment;

    } catch (err) {
        console.error("Order Load Error:", err);
        alert("Failed to load checkout details.");
    }
}

function renderOrderItems() {
    const container = document.getElementById('order-items-container');
    container.innerHTML = '';
    finalTotalAmount = 0;

    orderItemsData.forEach(item => {
        const struct = item.structure || {};
        const furn = struct.furniture || {};
        
        const name = furn.furniture_name || 'Item';
        const price = Number(struct.price || 0);
        const qty = Number(item.quantity || 1);
        const subtotal = price * qty;
        
        finalTotalAmount += subtotal;

        const row = document.createElement('div');
        row.style.cssText = "display: flex; gap: 15px; align-items: center; border-bottom: 1px solid #f8fafc; padding-bottom: 15px;";
        
        row.innerHTML = `
            <img src="${struct.image_url || 'https://dzgtfwdqfqecetnfhcdi.supabase.co/storage/v1/object/public/furniture-images/ERROR%20PICTURE.png'}" style="width: 70px; height: 70px; object-fit: cover; border-radius: 6px; border: 1px solid #f1f5f9;">
            <div style="flex-grow: 1;">
                <h4 style="margin: 0 0 5px 0; font-size: 16px; color: #1e2937;">${name}</h4>
                <p style="margin: 0; font-size: 13px; color: #64748b;">${struct.structure_name || ''} • ${struct.colour || ''}</p>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: bold; color: #1e2937;">RM ${subtotal.toFixed(2)}</div>
                <div style="font-size: 12px; color: #64748b;">RM ${price.toFixed(2)} x ${qty}</div>
            </div>
        `;
        container.appendChild(row);
    });

    document.getElementById('order-subtotal').innerText = `RM ${finalTotalAmount.toFixed(2)}`;
    document.getElementById('order-total').innerText = `RM ${finalTotalAmount.toFixed(2)}`;
}

async function processPayment() {
    const btnPay = document.getElementById('btn-pay');
    btnPay.disabled = true;
    btnPay.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i> Processing...';

    try {
        const newOrderId = 'ORD-' + Date.now();

        const { error: orderError } = await _supabase
            .from('orders')
            .insert([{ 
                order_id: newOrderId, 
                user_id: currentUser.id, 
                total_amount: finalTotalAmount, 
                status: 'order placed'
            }]);
            
        if (orderError) throw orderError;

        const orderItemsToInsert = orderItemsData.map((item, index) => {
            const struct = item.structure || {};
            const furn = struct.furniture || {};
            
            const snapshot = {
                name: furn.furniture_name || 'Item',
                variant: struct.structure_name || 'Standard',
                colour: struct.colour || 'N/A',
                material: struct.material || 'N/A',
                image: struct.image_url || ''
            };

            const price = Number(struct.price || 0);
            const qty = Number(item.quantity || 1);

            return {
                order_item_id: `OITEM-${Date.now()}-${index}`,
                order_id: newOrderId,
                structure_id: item.structure_id,
                unit_price: price,
                quantity: qty,
                subtotal: price * qty,
                snapshot_info: snapshot
            };
        });

        const { error: itemsInsertError } = await _supabase
            .from('order_item')
            .insert(orderItemsToInsert);
            
        if (itemsInsertError) throw itemsInsertError;

        for (const item of orderItemsData) {
            const buyQty = Number(item.quantity || 1);

            const { data: liveStruct } = await _supabase
                .from('structure')
                .select('stock')
                .eq('structure_id', item.structure_id)
                .single();

            if (liveStruct) {
                const currentLiveStock = Number(liveStruct.stock || 0);
                const newStock = Math.max(0, currentLiveStock - buyQty);

                const { error: stockError } = await _supabase
                    .from('structure')
                    .update({ stock: newStock })
                    .eq('structure_id', item.structure_id);

                if (stockError) {
                    console.error(`Failed to deduct stock for ${item.structure_id}:`, stockError);
                } else {
                    console.log(`Stock for ${item.structure_id} updated: ${currentLiveStock} -> ${newStock}`);
                }
            }
        }

        const { error: cartDeleteError } = await _supabase
            .from('cart_item')
            .delete()
            .in('cart_item_id', checkoutCartItemIds);
            
        if (cartDeleteError) console.warn("Failed to clear cart items, but order was placed:", cartDeleteError);

        btnPay.style.background = "#2ecc71";
        btnPay.innerHTML = '<i class="fa-solid fa-check" style="margin-right: 8px;"></i> Payment Successful!';
        
        setTimeout(() => {
            alert("Order placed successfully! Thank you for shopping with Ruma.");
            loadCustomerContent('home');
        }, 1500);

    } catch (error) {
        console.error("Payment Error:", error);
        alert("Payment failed. Please try again.");
        btnPay.disabled = false;
        btnPay.innerHTML = '<i class="fa-solid fa-credit-card" style="margin-right: 8px;"></i> Pay Now';
    }
}