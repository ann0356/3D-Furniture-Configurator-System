import { _supabase } from '../../../SUPABASE/supabase_customer_conn.js';
import { loadCustomerContent } from '../script.js';
import { escapeHTML, safeAssetUrl, safeNumber } from '../utils/dom.js';

let rawVariants = [];
let uniqueStructureNames = [];
let uniqueColours = [];

let activeStructureName = '';
let activeColour = '';
let displayMode = '2d';

export async function initProductDetails(params) {
    console.log("Loading Product Details for Furniture ID:", params.id);
    
    displayMode = '2d'; 

    const backBtn = document.getElementById('btn-back-catalog');
    if (backBtn) {
        backBtn.onclick = () => loadCustomerContent('home');
    }

    try {
        const { data: fur, error } = await _supabase
            .from('furniture')
            .select(`
                furniture_name, description,
                type!inner ( type_id, type_name, category!inner(category_name) ),
                structure ( structure_id, structure_name, colour, price, material, length, width, height, image_url, model_url, stock )
            `)
            .eq('furniture_id', params.id)
            .maybeSingle();

        if (error) throw error;

        if (backBtn && fur.type) {
            backBtn.innerText = `← Back to ${fur.type.type_name}`;
            backBtn.onclick = () => {
                loadCustomerContent('product_list', { 
                    level: 'type', 
                    id: fur.type.type_id, 
                    name: fur.type.type_name 
                });
            };
        }

        document.getElementById('pd-category-path').innerText = `${fur.type.category.category_name} / ${fur.type.type_name}`;
        document.getElementById('pd-title').innerText = fur.furniture_name;
        document.getElementById('pd-desc').innerText = fur.description || 'Premium craftsmanship design.';

        rawVariants = fur.structure || [];
        uniqueStructureNames = [...new Set(rawVariants.map(v => (v.structure_name || '').trim()))].filter(Boolean);
        uniqueColours = [...new Set(rawVariants.map(v => (v.colour || '').trim()))].filter(Boolean);

        uniqueStructureNames.sort();
        uniqueColours.sort();

        activeStructureName = uniqueStructureNames[0];
        const defaultMatch = rawVariants.find(v => (v.structure_name || '').trim() === activeStructureName);
        activeColour = defaultMatch ? (defaultMatch.colour || '').trim() : uniqueColours[0];

        bindViewModeToggles();
        bind3DAngleControls();

        bindQuantityControls();
        bindLightboxControls();

        refreshSelectionPanels();

        const btnAddCart = document.getElementById('btn-add-to-cart');
        if (btnAddCart) {
            const newBtn = btnAddCart.cloneNode(true);
            btnAddCart.parentNode.replaceChild(newBtn, btnAddCart);
            newBtn.addEventListener('click', handleAddToCart);
        }

    } catch (err) {
        console.error("Product details engine crashed:", err);
        alert("Failed to load product details.");
    }
}

function refreshSelectionPanels() { 
    renderStructureButtons();
    renderColourButtons();
    updateMediaAndPricing();

    const qtyInput = document.getElementById('pd-quantity');
    if(qtyInput) qtyInput.value = 1;
}

function renderStructureButtons() {
    const container = document.getElementById('container-structures');
    if (!container) return;
    container.innerHTML = '';

    uniqueStructureNames.forEach(sName => {
        const btn = document.createElement('button');
        const isActive = sName === activeStructureName;
        btn.type = 'button';
        btn.className = 'pd-option pd-structure-option';
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
        btn.innerText = sName;
        btn.style.cssText = `
            padding: 8px 16px; border-radius: 4px; cursor: pointer; border: 1px solid #cbd5e1; font-weight: 500; transition: all 0.2s;
            ${isActive ? 'background: #1d4ed8; color: white; border-color: #1d4ed8;' : 'background: white; color: #475569;'}
        `;
        
        btn.onclick = () => {
            activeStructureName = sName;
            const hasSameColorInNewStruct = rawVariants.some(v => 
                (v.structure_name || '').trim() === activeStructureName && 
                (v.colour || '').trim() === activeColour
            );
            
            if (!hasSameColorInNewStruct) {
                const fallback = rawVariants.find(v => (v.structure_name || '').trim() === activeStructureName);
                if (fallback) activeColour = (fallback.colour || '').trim();
            }
            refreshSelectionPanels();
        };
        container.appendChild(btn);
    });
}

function renderColourButtons() {
    const container = document.getElementById('container-colours');
    if (!container) return;
    container.innerHTML = '';

    uniqueColours.forEach(cName => {
        const btn = document.createElement('button');
        const isActive = cName === activeColour;
        btn.type = 'button';
        btn.className = 'pd-option pd-colour-option';
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
        btn.innerText = cName;
        btn.style.cssText = `
            padding: 8px 16px; border-radius: 20px; cursor: pointer; border: 1px solid #cbd5e1; font-weight: 500; transition: all 0.2s;
            ${isActive ? 'background: #1d4ed8; color: white; border-color: #1d4ed8;' : 'background: white; color: #475569;'}
        `;

        btn.onclick = () => {
            activeColour = cName;
            const hasStructInNewColor = rawVariants.some(v => 
                (v.structure_name || '').trim() === activeStructureName && 
                (v.colour || '').trim() === activeColour
            );

            if (!hasStructInNewColor) {
                const fallback = rawVariants.find(v => (v.colour || '').trim() === activeColour);
                if (fallback) activeStructureName = (fallback.structure_name || '').trim();
            }
            refreshSelectionPanels();
        };
        container.appendChild(btn);
    });
}

function updateMediaAndPricing() {
    const exactSKU = rawVariants.find(v => 
        (v.structure_name || '').trim() === activeStructureName && 
        (v.colour || '').trim() === activeColour
    );
    
    if (!exactSKU) return;

    document.getElementById('pd-price').innerText = `RM ${safeNumber(exactSKU.price).toFixed(2)}`;
    
    const stock = Number(exactSKU.stock || 0);
    const stockBadge = document.getElementById('pd-stock-badge');
    if (stockBadge) {
        if (stock >= 100) stockBadge.innerHTML = `<span style="color:var(--success); font-weight:bold;"><i class="fa-solid fa-box-open"></i> In Stock</span>`;
        else if (stock > 0) stockBadge.innerHTML = `<span style="color:var(--price); font-weight:bold;">Only ${stock} left</span>`;
        else stockBadge.innerHTML = `<span style="color:var(--danger); font-weight:bold;">Out of stock</span>`;
    }

    const materialBox = document.getElementById('pd-material-content');
    const dimensionsBox = document.getElementById('pd-dimensions-content');

    if (materialBox) {
        materialBox.innerHTML = `<strong>Main Material:</strong> ${escapeHTML(exactSKU.material || 'Premium Fabric')}`;
    }

    if (dimensionsBox) {
        dimensionsBox.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <span><strong>Length:</strong> ${safeNumber(exactSKU.length)} cm</span>
                <span><strong>Width:</strong> ${safeNumber(exactSKU.width)} cm</span>
                <span><strong>Height:</strong> ${safeNumber(exactSKU.height)} cm</span>
            </div>
        `;
    }

    const imgElem = document.getElementById('display-image');
    const modelElem = document.getElementById('display-model');
    
    if (imgElem) imgElem.src = safeAssetUrl(exactSKU.image_url, 'https://dzgtfwdqfqecetnfhcdi.supabase.co/storage/v1/object/public/furniture-images/ERROR%20PICTURE.png');
    
    if (modelElem) {
        modelElem.src = safeAssetUrl(exactSKU.model_url);
        
        modelElem.removeAttribute('environment-image'); 

        modelElem.setAttribute('tone-mapping', 'aces'); 

        modelElem.setAttribute('exposure', '1.0'); 

        modelElem.setAttribute('shadow-intensity', '1'); 
        modelElem.setAttribute('shadow-softness', '0.8'); 
    }

    applyMediaViewMode(safeAssetUrl(exactSKU.model_url));
}

function bindQuantityControls() {
    const btnMinus = document.getElementById('btn-qty-minus');
    const btnPlus = document.getElementById('btn-qty-plus');
    const qtyInput = document.getElementById('pd-quantity');
    
    if (btnMinus && btnPlus && qtyInput) {
        btnMinus.onclick = () => {
            let val = parseInt(qtyInput.value) || 1;
            if(val > 1) qtyInput.value = val - 1;
        };
        btnPlus.onclick = () => {
            let val = parseInt(qtyInput.value) || 1;
            if(val < 99) qtyInput.value = val + 1;
        };
        // 防止用户手动输入非法数值
        qtyInput.onchange = () => {
            let val = parseInt(qtyInput.value) || 1;
            if(val < 1) val = 1;
            if(val > 99) val = 99;
            qtyInput.value = val;
        };
    }
}

function bindLightboxControls() {
    const mainImg = document.getElementById('display-image');
    const lightbox = document.getElementById('pd-lightbox');
    const lightboxImg = document.getElementById('pd-lightbox-img');
    const closeBtn = document.getElementById('pd-lightbox-close');

    if (mainImg && lightbox && lightboxImg) {
        lightboxImg.style.maxWidth = '90vw';
        lightboxImg.style.maxHeight = '90vh';
        lightboxImg.style.objectFit = 'contain';
        lightboxImg.style.borderRadius = '8px';

        mainImg.onclick = () => {
            if (displayMode === '2d') {
                lightboxImg.src = mainImg.src;
                lightbox.style.display = 'flex';
                lightbox.style.alignItems = 'center';
                lightbox.style.justifyContent = 'center';
            }
        };

        const closeLightbox = () => lightbox.style.display = 'none';

        if (closeBtn) closeBtn.onclick = closeLightbox;
        
        lightbox.onclick = (e) => {
            if (e.target === lightbox) closeLightbox(); 
        };
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && lightbox.style.display === 'flex') closeLightbox();
        });
    }
}

function bindViewModeToggles() {
    const btn2d = document.getElementById('btn-mode-2d');
    const btn3d = document.getElementById('btn-mode-3d');

    if (btn2d && btn3d) {
        btn2d.onclick = () => { displayMode = '2d'; updateMediaAndPricing(); };
        btn3d.onclick = () => { displayMode = '3d'; updateMediaAndPricing(); };
    }
}

function bind3DAngleControls() {
    const modelViewer = document.getElementById('display-model');
    const btnFront = document.getElementById('btn-angle-front');
    const btnSide = document.getElementById('btn-angle-side');
    const btnTop = document.getElementById('btn-angle-top');

    if (!modelViewer) return;

    const highlightAngleBtn = (activeBtn) => {
        [btnFront, btnSide, btnTop].forEach(btn => {
            if (!btn) return;
            const isActive = btn === activeBtn;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
            if (btn === activeBtn) {
                btn.style.background = "#1e2937"; btn.style.color = "white";
            } else {
                btn.style.background = "white"; btn.style.color = "#475569";
            }
        });
    };

    if (btnFront) btnFront.onclick = () => { modelViewer.cameraOrbit = "0deg 75deg auto"; highlightAngleBtn(btnFront); };
    if (btnSide) btnSide.onclick = () => { modelViewer.cameraOrbit = "90deg 75deg auto"; highlightAngleBtn(btnSide); };
    if (btnTop) btnTop.onclick = () => { modelViewer.cameraOrbit = "0deg 0deg auto"; highlightAngleBtn(btnTop); };
}

function applyMediaViewMode(currentModelUrl) {
    const btn2d = document.getElementById('btn-mode-2d');
    const btn3d = document.getElementById('btn-mode-3d');
    const imgElem = document.getElementById('display-image');
    const modelElem = document.getElementById('display-model');
    const warningElem = document.getElementById('media-warning');
    
    const anglesPanel = document.getElementById('pd-view-angles-panel');
    const instructionPanel = document.getElementById('pd-3d-instructions');

    const setModeButtonState = (button, isActive) => {
        if (!button) return;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    };

    setModeButtonState(btn2d, displayMode === '2d');
    setModeButtonState(btn3d, displayMode === '3d');

    if (warningElem) warningElem.style.display = 'none';

    if (displayMode === '2d') {
        if (btn2d) { btn2d.style.background = "white"; btn2d.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)"; btn2d.style.color = "#1e2937"; }
        if (btn3d) { btn3d.style.background = "transparent"; btn3d.style.boxShadow = "none"; btn3d.style.color = "#64748b"; }
        
        if (imgElem) imgElem.style.display = 'block';
        if (modelElem) modelElem.style.display = 'none';
        
        if (anglesPanel) anglesPanel.style.display = 'none';
        if (instructionPanel) instructionPanel.style.display = 'none';
        
    } else if (displayMode === '3d') {
        if (btn3d) { btn3d.style.background = "white"; btn3d.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)"; btn3d.style.color = "#1e2937"; }
        if (btn2d) { btn2d.style.background = "transparent"; btn2d.style.boxShadow = "none"; btn2d.style.color = "#64748b"; }
        
        if (imgElem) imgElem.style.display = 'none';
        
        if (!currentModelUrl) {
            if (modelElem) modelElem.style.display = 'none';
            if (anglesPanel) anglesPanel.style.display = 'none';
            if (instructionPanel) instructionPanel.style.display = 'none';
            
            if (warningElem) {
                warningElem.innerText = "⚠️ 3D Model not available for this variant.";
                warningElem.style.display = 'block';
            }
        } else {
            if (modelElem) modelElem.style.display = 'block';
            if (anglesPanel) anglesPanel.style.display = 'flex';
            if (instructionPanel) instructionPanel.style.display = 'block';
            
            const btnFront = document.getElementById('btn-angle-front');
            if (modelElem && btnFront) {
                modelElem.cameraOrbit = "0deg 75deg auto";
                [btnFront, document.getElementById('btn-angle-side'), document.getElementById('btn-angle-top')].forEach(b => {
                    if (!b) return;
                    const isActive = b === btnFront;
                    b.classList.toggle('is-active', isActive);
                    b.setAttribute('aria-pressed', String(isActive));
                    if (isActive) { b.style.background = "#1e2937"; b.style.color = "white"; }
                    else { b.style.background = "white"; b.style.color = "#475569"; }
                });
            }
        }
    }
}

async function handleAddToCart() {
    try {
        const { data: { session }, error: sessionError } = await _supabase.auth.getSession();
        
        if (sessionError || !session) {
            alert("Please login first to add items to your cart.");
            window.location.href = "cus_login.html"; 
            return;
        }

        const userId = session.user.id;

        const exactSKU = rawVariants.find(v => 
            (v.structure_name || '').trim() === activeStructureName && 
            (v.colour || '').trim() === activeColour
        );

        if (!exactSKU) {
            alert("Please select a valid product variation.");
            return;
        }

        const qtyInput = document.getElementById('pd-quantity');
        const qtyToAdd = parseInt(qtyInput ? qtyInput.value : 1) || 1;

        if (Number(exactSKU.stock) < qtyToAdd) {
            alert(`Sorry, we only have ${exactSKU.stock} in stock.`);
            return;
        }

        const btn = document.getElementById('btn-add-to-cart');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color:white; margin-right:8px;"></i> Adding...';
        btn.disabled = true;

        let cartId;
        let { data: cartData, error: cartError } = await _supabase
            .from('cart')
            .select('cart_id')
            .eq('user_id', userId)
            .maybeSingle();

        if (cartError) {
            throw cartError;
        }

        if (!cartData) {
            cartId = 'CART-' + Date.now(); 
            const { error: insertCartError } = await _supabase
                .from('cart')
                .insert([{ cart_id: cartId, user_id: userId }]);
            
            if (insertCartError) throw insertCartError;
            console.log("New cart created:", cartId);
        } else {
            cartId = cartData.cart_id;
            console.log("Using existing cart:", cartId);
        }

        const { data: existingItem, error: checkItemError } = await _supabase
            .from('cart_item')
            .select('cart_item_id, quantity')
            .eq('cart_id', cartId)
            .eq('structure_id', exactSKU.structure_id)
            .is('room_item_id', null) 
            .maybeSingle();

        if (checkItemError && checkItemError.code !== 'PGRST116') {
            throw checkItemError;
        }

        if (existingItem) {
            const newQty = Number(existingItem.quantity) + qtyToAdd;

            if (newQty > Number(exactSKU.stock)) {
                alert(`Sorry, you cannot add ${qtyToAdd} more. We only have ${exactSKU.stock} in stock, and you already have ${existingItem.quantity} in your cart.`);
                
                btn.style.background = "#1e2937";
                btn.innerHTML = '<i class="fa-solid fa-cart-plus" style="color:white; margin-right:8px;"></i> Add to Cart';
                btn.disabled = false;
                
                return;
            }

            const { error: updateError } = await _supabase
                .from('cart_item')
                .update({ quantity: newQty, updated_at: new Date().toISOString() })
                .eq('cart_item_id', existingItem.cart_item_id);
                
            if (updateError) throw updateError;
            
        } else {
            const cartItemId = 'CITEM-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            const { error: insertItemError } = await _supabase
                .from('cart_item')
                .insert([{ 
                    cart_item_id: cartItemId, 
                    cart_id: cartId, 
                    structure_id: exactSKU.structure_id,
                    quantity: qtyToAdd
                }]);
            if (insertItemError) throw insertItemError;
        }

        document.dispatchEvent(new Event('cart-updated'));
        btn.style.background = "#15803d";
        btn.innerHTML = `<i class="fa-solid fa-check" style="color:white; margin-right:8px;"></i> Added ${qtyToAdd} to Cart!`;
        
        setTimeout(() => {
            btn.style.background = "#1e2937";
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error("Add to cart error:", error);
        alert("Failed to add item to cart. Please try again.");
        const btn = document.getElementById('btn-add-to-cart');
        btn.innerHTML = '<i class="fa-solid fa-cart-plus" style="color:white; margin-right:8px;"></i> Add to Cart';
        btn.disabled = false;
    }
}
