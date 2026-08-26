import { _supabase } from '../../../SUPABASE/supabase_customer_conn.js';
import { loadCustomerContent } from '../script.js';
import { escapeHTML, safeAssetUrl, safeNumber } from '../utils/dom.js';

let cartItemsData = [];

export async function initCart() {
    console.log("Initializing Cart Page...");

    try {
        // get current user's data
        const { data: { session } } = await _supabase.auth.getSession();
        if (!session) {
            alert("Please login to view your cart.");
            loadCustomerContent('home');
            return;
        }
        const userId = session.user.id;

        let { data: cartData, error: cartError } = await _supabase
            .from('cart')
            .select('cart_id')
            .eq('user_id', userId)
            .single();

        if (cartError && cartError.code !== 'PGRST116') {
            throw cartError;
        }

        if (!cartData) {
            renderEmptyCart();
            return;
        }

        const cartId = cartData.cart_id;

        // 
        const { data: items, error: itemsError } = await _supabase
            .from('cart_item')
            .select(`
                cart_item_id,
                quantity,
                structure_id,
                structure:structure_id (
                    structure_name,
                    colour,
                    price,
                    image_url,
                    stock,
                    furniture:furniture_id ( furniture_name )
                )
            `)
            .eq('cart_id', cartId)
            .is('room_item_id', null);

        if (itemsError) throw itemsError;
        console.log("🔍 Cart Items from DB:", items);

        cartItemsData = items || [];

        if (cartItemsData.length === 0) {
            renderEmptyCart();
        } else {
            renderCartItems();
        }

        document.getElementById('btn-checkout').onclick = handleCheckout;

    } catch (err) {
        console.error("Failed to load cart:", err);
        alert("Failed to load shopping cart.");
    }
}

function renderEmptyCart() {
    const container = document.getElementById('cart-items-container');
    if (container) {
        container.innerHTML = `<p id="empty-cart-msg" style="text-align: center; color: #94a3b8; font-size: 18px; padding: 40px; margin: 0;">Your cart is empty. Let's go shopping!</p>`;
    }
    
    document.getElementById('cart-item-count').innerText = "0 items";
    document.getElementById('summary-count').innerText = "0";
    document.getElementById('summary-total').innerText = "RM 0.00";
    
    const btnCheckout = document.getElementById('btn-checkout');
    if (btnCheckout) {
        btnCheckout.disabled = true;
        btnCheckout.style.background = "#cbd5e1";
        btnCheckout.style.cursor = "not-allowed";
    }
}

function renderCartItems() {
    const container = document.getElementById('cart-items-container');
    if (!container) return;
    
    container.innerHTML = ''; 
    
    document.getElementById('cart-item-count').innerText = `${cartItemsData.length} item(s)`;

    cartItemsData.forEach(item => {
        const struct = item.structure || {};
        const furn = struct.furniture || {};

        const furName = furn.furniture_name || 'Furniture unavailable';
        const structName = struct.structure_name || 'Variant unavailable';
        
        const colour = struct.colour || 'Default';
        const price = safeNumber(struct.price);
        const qty = Math.max(1, safeNumber(item.quantity, 1));
        const subtotal = price * qty;
        const outOfStock = Number(struct.stock || 0) < qty;
        const imageUrl = safeAssetUrl(struct.image_url, 'https://dzgtfwdqfqecetnfhcdi.supabase.co/storage/v1/object/public/furniture-images/ERROR%20PICTURE.png');

        const card = document.createElement('div');
        card.className = 'cart-item-card';
        card.style.cssText = "display: flex; gap: 20px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: transform 0.2s;";
        
        card.innerHTML = `
            <input type="checkbox" class="cart-checkbox" aria-label="Select ${escapeHTML(furn.furniture_name || 'cart item')}" data-id="${escapeHTML(item.cart_item_id)}" data-price="${price}" data-qty="${qty}"
                    style="width: 20px; height: 20px; cursor: pointer;" ${outOfStock ? 'disabled' : ''}>
            
            <img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(furn.furniture_name || 'Furniture item')}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid #f1f5f9;">
            
            <div style="flex-grow: 1;">
                <h3 style="margin: 0 0 5px 0; font-size: 18px; color: #1e2937;">${escapeHTML(furName)}</h3>
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">${escapeHTML(structName)} • ${escapeHTML(colour)}</p>
                ${outOfStock ? `<span style="color:var(--danger); font-size:13px; font-weight:bold;">⚠️ Not enough stock</span>` : ''}
            </div>

            <div style="text-align: right; min-width: 120px; display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
                <div>
                    <div class="price-text" style="font-size: 18px; font-weight: bold; color: var(--price); margin-bottom: 5px;">RM ${subtotal.toFixed(2)}</div>
                    <div style="font-size: 13px; color: #64748b;">RM ${price.toFixed(2)} x ${qty}</div>
                </div>
                
                <button class="btn-delete-cart-item" type="button" aria-label="Remove ${escapeHTML(furn.furniture_name || 'item')} from cart" title="Remove item" style="background: none; border: none; color: var(--danger); font-size: 18px; cursor: pointer; padding: 5px; transition: opacity 0.2s;">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;

        const deleteBtn = card.querySelector('.btn-delete-cart-item');
        deleteBtn.addEventListener('click', () => handleDeleteItem(item.cart_item_id));
        deleteBtn.addEventListener('mouseenter', () => { deleteBtn.style.opacity = '0.7'; });
        deleteBtn.addEventListener('mouseleave', () => { deleteBtn.style.opacity = '1'; });

        container.appendChild(card);
    });

    const checkboxes = document.querySelectorAll('.cart-checkbox');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', calculateSummary);
    });

    calculateSummary();
}

async function handleDeleteItem(cartItemId) {
    const confirmDelete = confirm("Are you sure you want to remove this item from your cart?");
    if (!confirmDelete) return;

    try {
        // ask db to delete
        const { error } = await _supabase
            .from('cart_item')
            .delete()
            .eq('cart_item_id', cartItemId);

        if (error) throw error;

        cartItemsData = cartItemsData.filter(item => item.cart_item_id !== cartItemId);
        document.dispatchEvent(new Event('cart-updated'));

        if (cartItemsData.length === 0) {
            renderEmptyCart();
        } else {
            renderCartItems(); 
        }

    } catch (err) {
        console.error("Failed to delete cart item:", err);
        alert("Failed to remove item. Please try again.");
    }
}

function calculateSummary() {
    const checkboxes = document.querySelectorAll('.cart-checkbox:checked');
    let totalCount = 0;
    let totalPrice = 0;

    checkboxes.forEach(cb => {
        const price = parseFloat(cb.getAttribute('data-price'));
        const qty = parseInt(cb.getAttribute('data-qty'));
        totalCount += qty;
        totalPrice += (price * qty);
    });

    document.getElementById('summary-count').innerText = totalCount;
    document.getElementById('summary-total').innerText = `RM ${totalPrice.toFixed(2)}`;

    const btnCheckout = document.getElementById('btn-checkout');
    if (checkboxes.length > 0) {
        btnCheckout.disabled = false;
        btnCheckout.style.background = "#1e2937";
        btnCheckout.style.cursor = "pointer";
    } else {
        btnCheckout.disabled = true;
        btnCheckout.style.background = "#cbd5e1";
        btnCheckout.style.cursor = "not-allowed";
    }
}

function handleCheckout() {
    const checkboxes = document.querySelectorAll('.cart-checkbox:checked');
    const selectedCartItemIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));

    if (selectedCartItemIds.length === 0) return;

    console.log("Proceeding to checkout with Cart Item IDs:", selectedCartItemIds);
    loadCustomerContent('order', { selectedItems: selectedCartItemIds.join(',') });
}
