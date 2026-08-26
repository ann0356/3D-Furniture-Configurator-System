import { _supabase } from '../../SUPABASE/supabase_customer_conn.js';
import { initProductList } from './components/product_list.js';
import { initProductDetails } from './components/product_details.js';
import { initCart } from './components/cart.js';
import { initOrder } from './components/order.js';
import { initProfile } from './components/profile.js';
import { initRoom } from './components/room.js';
import { initHome } from './components/home.js'; 
import { initContactUs } from './components/contactUs.js'; 
import { escapeHTML, safeAssetUrl, safeNumber } from './utils/dom.js';

const mainContent = document.getElementById('main-content');

window.addEventListener('DOMContentLoaded', async () => {
    console.log("Customer SPA engine started.");

    initAccessibilityTools();

    initSearchControls();
    initAccountMenu();
    checkLoginStatus();
    document.addEventListener('cart-updated', updateCartBadge);
    setupStaticNavBindings();
    await loadNavbarCategories();

    const urlParams = new URLSearchParams(window.location.search);
    const pageToLoad = urlParams.get('page') || 'home'; 

    const extraParams = {};
    for (const [key, value] of urlParams.entries()) {
        if (key !== 'page') extraParams[key] = value;
    }

    await loadCustomerContent(pageToLoad, Object.keys(extraParams).length > 0 ? extraParams : null, true);
});

function initAccessibilityTools() {
    const triggerBtn = document.getElementById('a11y-trigger');
    const panel = document.getElementById('a11y-panel');
    const btnIncrease = document.getElementById('a11y-font-increase');
    const btnDecrease = document.getElementById('a11y-font-decrease');
    const btnReset = document.getElementById('a11y-font-reset');
    const btnContrast = document.getElementById('a11y-contrast-toggle');

    if (!triggerBtn || !panel) return; 

    triggerBtn.addEventListener('click', () => {
        const isOpening = panel.style.display === 'none';
        panel.style.display = isOpening ? 'block' : 'none';
        triggerBtn.setAttribute('aria-expanded', String(isOpening));
    });

    let currentFontScale = parseFloat(localStorage.getItem('a11y-font-scale')) || 1.0;
    let isHighContrast = localStorage.getItem('a11y-high-contrast') === 'true';

    applyFontScale(currentFontScale);
    applyContrast(isHighContrast);

    function applyFontScale(scale) {
        if (scale < 0.8) scale = 0.8;
        if (scale > 1.5) scale = 1.5;
        
        currentFontScale = scale;
        document.documentElement.style.setProperty('--font-scale', currentFontScale);
        localStorage.setItem('a11y-font-scale', currentFontScale);
    }

    btnIncrease?.addEventListener('click', () => applyFontScale(currentFontScale + 0.1));
    btnDecrease?.addEventListener('click', () => applyFontScale(currentFontScale - 0.1));
    btnReset?.addEventListener('click', () => applyFontScale(1.0));

    function applyContrast(enable) {
        isHighContrast = enable;

        const logoImg = document.querySelector('#brand-logo img');

        document.body.classList.toggle('high-contrast-mode', enable);
        document.documentElement.classList.toggle('high-contrast-mode', enable);

        if (btnContrast) {
            btnContrast.setAttribute('aria-pressed', String(enable));
            btnContrast.textContent = enable ? 'Disable High Contrast' : 'Enable High Contrast';
        }

        if (enable) {
            if (logoImg) {
                logoImg.src = "https://dzgtfwdqfqecetnfhcdi.supabase.co/storage/v1/object/public/furniture-images/Ruma_white_logo.png";
            }
        } else {
            if (logoImg) {
                logoImg.src = "https://dzgtfwdqfqecetnfhcdi.supabase.co/storage/v1/object/public/furniture-images/Ruma_Logo_black.png";
            }
        }

        localStorage.setItem('a11y-high-contrast', enable);
        document.dispatchEvent(new CustomEvent('a11y-contrast-change', { detail: { enabled: enable } }));
    }

    btnContrast?.addEventListener('click', () => applyContrast(!isHighContrast));

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && panel.style.display !== 'none') {
            panel.style.display = 'none';
            triggerBtn.setAttribute('aria-expanded', 'false');
            triggerBtn.focus();
        }
    });

    document.addEventListener('click', (event) => {
        if (!panel.contains(event.target) && !triggerBtn.contains(event.target) && panel.style.display !== 'none') {
            panel.style.display = 'none';
            triggerBtn.setAttribute('aria-expanded', 'false');
        }
    });
}

window.addEventListener('popstate', async (event) => {
    if (event.state && event.state.pageName) {
        await loadCustomerContent(event.state.pageName, event.state.extraParams, true);
    } else {
        await loadCustomerContent('home', null, true);
    }
});

export async function loadCustomerContent(pageName, extraParams = null, isHistoryPop = false) {
    try {
        mainContent.innerHTML = "<p style='padding: 40px; text-align: center; color: var(--text-main);'>Loading content...</p>";
        
        if (!isHistoryPop) {
            const url = new URL(window.location);
            url.searchParams.set('page', pageName);
            
            Array.from(url.searchParams.keys()).forEach(key => {
                if (key !== 'page') url.searchParams.delete(key);
            });

            if (extraParams) {
                Object.entries(extraParams).forEach(([k, v]) => {
                    url.searchParams.set(k, v);
                });
            }
            window.history.pushState({ pageName, extraParams }, '', url);
        }

        const response = await fetch(`../HTML/components/cus_${pageName}.html`);
        if (!response.ok) throw new Error("Component view failed to fetch.");
        
        const html = await response.text();
        mainContent.innerHTML = html;
        updateNavigationState(pageName);

        if (pageName === 'product_list' && extraParams) {
            await initProductList(extraParams);
        } else if (pageName === 'product_details' && extraParams) {
            await initProductDetails(extraParams);
        }else if (pageName === 'cart') {
            await initCart();
        }else if (pageName === 'order' && extraParams) {
            await initOrder(extraParams); 
        }else if (pageName === 'profile') {
            await initProfile(); 
        } else if (pageName === 'room') {
            await initRoom();
        }if (pageName === 'home') {
            initHome(loadCustomerContent); 
        } else if (pageName === 'contactUs') {
            initContactUs(); 
        }

    } catch (error) {
        console.error("Routing Error: ", error);
        mainContent.innerHTML = "<h2 style='padding: 40px; text-align: center; color: var(--danger);'>Failed to load page.</h2>";
    }
}

async function loadNavbarCategories() {
    const navBar = document.getElementById('product-categories');
    if (!navBar) return;
    try {
        const { data: categories, error: catErr } = await _supabase.from('category').select('*').order('category_id');
        const { data: types, error: typeErr } = await _supabase.from('type').select('*').order('type_id');
        if (catErr || typeErr) throw catErr || typeErr;

        navBar.innerHTML = "";
        categories.forEach(cat => {
            const li = document.createElement('li');
            li.className = "category";
            const catLink = document.createElement('a');
            catLink.href = "#";
            catLink.innerText = cat.category_name;
            catLink.onclick = (e) => {
                e.preventDefault();
                loadCustomerContent('product_list', { level: 'category', id: cat.category_id, name: cat.category_name });
            };
            li.appendChild(catLink);
            
            const dropdownDiv = document.createElement('div');
            dropdownDiv.className = "dropdown-content";
            const subTypes = types.filter(t => t.category_id === cat.category_id);
            if (subTypes.length > 0) {
                subTypes.forEach(type => {
                    const typeLink = document.createElement('a');
                    typeLink.href = "#";
                    typeLink.innerText = type.type_name;
                    typeLink.onclick = (e) => {
                        e.preventDefault();
                        loadCustomerContent('product_list', { level: 'type', id: type.type_id, name: type.type_name });
                    };
                    dropdownDiv.appendChild(typeLink);
                });
                li.appendChild(dropdownDiv);
            }
            navBar.appendChild(li);
        });
    } catch (err) { console.error(err); }
}

function setupStaticNavBindings() {
    const brandLogo = document.getElementById('brand-logo');
    if (brandLogo) brandLogo.onclick = (e) => { e.preventDefault(); loadCustomerContent('home'); };
    document.querySelectorAll('.nav-link').forEach(link => {
        link.onclick = function(e) { e.preventDefault(); loadCustomerContent(this.getAttribute('data-page')); };
    });
}

function initSearchControls() {
    const searchButton = document.querySelector('.search-icon');
    const searchPanel = document.querySelector('.search-panel');
    const searchContainer = document.querySelector('.search-container');
    const searchInput = document.getElementById('search-input');
    const resultPanel = document.querySelector('.result-panel'); 

    if (searchButton && searchPanel) {
        searchButton.addEventListener('click', (event) => {
            event.stopPropagation();
            const isOpen = searchPanel.style.display === 'block';
            if (isOpen) {
                searchPanel.style.display = 'none';
                if (resultPanel) resultPanel.style.display = 'none';
            } else {
                searchPanel.style.display = 'block';
                if (searchInput) { searchInput.value = ''; searchInput.focus(); }
            }
            searchButton.setAttribute('aria-expanded', String(!isOpen));
        });
    }
    [searchPanel, resultPanel].forEach(panel => { if (panel) panel.onclick = (e) => e.stopPropagation(); });
    document.addEventListener('click', (event) => {
        if (searchContainer && !searchContainer.contains(event.target)) {
            if (searchPanel) searchPanel.style.display = 'none';
            if (resultPanel) resultPanel.style.display = 'none';
            if (searchButton) searchButton.setAttribute('aria-expanded', 'false');
        }
    });

    if (searchInput) {
        let searchTimeout = null;

        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim();

            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }

            if (!query) { 
                if (resultPanel) resultPanel.style.display = 'none'; 
                return; 
            }

            searchTimeout = setTimeout(async () => {
                try {
                    const baseSelect = `
                        structure_id, structure_name, colour, price, material, image_url, stock,
                        furniture!inner (
                            furniture_id,
                            furniture_name, description,
                            type!inner ( type_name, category!inner ( category_name ) )
                        )
                    `;

                    const [res1, res2, res3, res4] = await Promise.all([
                        _supabase.from('structure').select(baseSelect).ilike('structure_name', `%${query}%`),
                        _supabase.from('structure').select(baseSelect).ilike('furniture.furniture_name', `%${query}%`),
                        _supabase.from('structure').select(baseSelect).ilike('furniture.type.type_name', `%${query}%`),
                        _supabase.from('structure').select(baseSelect).ilike('furniture.type.category.category_name', `%${query}%`)
                    ]);

                    if (res1.error) throw res1.error;
                    if (res2.error) throw res2.error;
                    if (res3.error) throw res3.error;
                    if (res4.error) throw res4.error;

                    const uniqueRecordsMap = new Map();
                    
                    [res1, res2, res3, res4].forEach(res => {
                        if (res.data) {
                            res.data.forEach(item => {
                                uniqueRecordsMap.set(item.structure_id, item);
                            });
                        }
                    });

                    const finalResults = Array.from(uniqueRecordsMap.values());

                    if (resultPanel) resultPanel.style.display = 'block';
                    renderSearchResults(finalResults);

                } catch (err) { 
                    console.error("Relational Instant Search Error: ", err); 
                }
            }, 400);
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && searchPanel?.style.display === 'block') {
            searchPanel.style.display = 'none';
            if (resultPanel) resultPanel.style.display = 'none';
            searchButton?.setAttribute('aria-expanded', 'false');
            searchButton?.focus();
        }
    });
}

function updateNavigationState(pageName) {
    const informationPages = new Set(['aboutUs', 'storeLocation', 'contactUs']);
    const brandLogo = document.getElementById('brand-logo');

    document.querySelectorAll('header .menu .nav-link').forEach(link => {
        const isActive = link.dataset.page === pageName;
        link.classList.toggle('is-active', isActive);
        if (isActive) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });

    if (brandLogo) {
        const isBrandSection = !informationPages.has(pageName);
        brandLogo.classList.toggle('is-active', isBrandSection);
        if (isBrandSection) brandLogo.setAttribute('aria-current', 'page');
        else brandLogo.removeAttribute('aria-current');
    }
}

function initAccountMenu() {
    const account = document.querySelector('.user-account');
    const trigger = document.querySelector('.account-trigger');
    if (!account || !trigger) return;

    const closeMenu = (returnFocus = false) => {
        account.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        if (returnFocus) trigger.focus();
    };

    trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpening = !account.classList.contains('is-open');
        account.classList.toggle('is-open', isOpening);
        trigger.setAttribute('aria-expanded', String(isOpening));
    });

    document.addEventListener('click', (event) => {
        if (!account.contains(event.target)) closeMenu();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && account.classList.contains('is-open')) closeMenu(true);
    });
}

async function checkLoginStatus() {
    const loggedOutLinks = document.querySelectorAll('.logged-out-only');
    const loggedInLinks = document.querySelectorAll('.logged-in-only');
    const navLogoutBtn = document.getElementById('nav-logout-btn');
    const accountTrigger = document.querySelector('.account-trigger');
    const accountIcon = accountTrigger?.querySelector('.account-state-icon');

    const setAccountMenuState = (isLoggedIn) => {
        loggedOutLinks.forEach(link => { link.hidden = isLoggedIn; });
        loggedInLinks.forEach(link => { link.hidden = !isLoggedIn; });

        if (accountTrigger) {
            accountTrigger.setAttribute('aria-label', isLoggedIn ? 'Open account menu, signed in' : 'Open account menu, signed out');
        }
        if (accountIcon) {
            accountIcon.className = isLoggedIn
                ? 'account-state-icon fa-solid fa-user-check'
                : 'account-state-icon fa-regular fa-user';
        }
    };

    try {
        const { data: { session } } = await _supabase.auth.getSession();
        setAccountMenuState(Boolean(session?.user));
    } catch (err) {
        console.error(err);
        setAccountMenuState(false);
    }

    await updateCartBadge();

    if (navLogoutBtn) {
        navLogoutBtn.onclick = async (e) => {
            e.preventDefault();
            await _supabase.auth.signOut();
            updateCartBadge();
            alert("Logout successfully!");
            window.location.href = 'cus_index.html?page=home'; 
        };
    }
}

function renderSearchResults(structures) {
    const container = document.getElementById('products-container');
    const resultPanel = document.querySelector('.result-panel'); 
    const searchPanel = document.querySelector('.search-panel'); 
    const searchButton = document.querySelector('.search-icon');
    
    if (!container) return;
    container.innerHTML = '';

    if (!structures || structures.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-main); padding: 20px 0; font-size: calc(0.9rem * var(--font-scale));">No matches found.</p>`;
        return;
    }

    structures.forEach(item => {
        const furniture = item.furniture || {};
        const type = furniture.type || {};
        const category = type.category || {};
        const fallbackImage = 'https://dzgtfwdqfqecetnfhcdi.supabase.co/storage/v1/object/public/furniture-images/ruma_logo_white.png';
        const finalImageUrl = safeAssetUrl(item.image_url, fallbackImage);
        const stock = safeNumber(item.stock);
        let stockHtml = '';

        if (stock >= 100) {
            stockHtml = `<span style="color: var(--success); font-size: calc(0.75rem * var(--font-scale)); font-weight: bold;"><i class="fa-solid fa-box-open"></i> In Stock</span>`;
        } else if (stock > 0) {
            stockHtml = `<span style="color: var(--price); font-size: calc(0.75rem * var(--font-scale)); font-weight: bold;">Only ${stock} left</span>`;
        } else {
            stockHtml = `<span style="color: var(--danger); font-size: calc(0.75rem * var(--font-scale)); font-weight: bold;">Out of stock</span>`;
        }

        const productCard = document.createElement('button');
        productCard.type = 'button';
        productCard.className = 'product-card';
        productCard.setAttribute('aria-label', `View ${furniture.furniture_name || 'product'} details`);
        productCard.style.cursor = 'pointer';
        productCard.style.transition = 'background-color 0.2s';
        
        productCard.onmouseover = () => productCard.style.backgroundColor = 'var(--bg-nav)';
        productCard.onmouseout = () => productCard.style.backgroundColor = 'transparent';
        
        productCard.innerHTML = `
            <div class="product-img-box">
                <img src="${escapeHTML(finalImageUrl)}" alt="${escapeHTML(furniture.furniture_name || 'furniture')}">
            </div>
            <div class="product-info">
                <span class="product-category" style="font-size:calc(0.8rem * var(--font-scale));">${escapeHTML(category.category_name || 'N/A')} / ${escapeHTML(type.type_name || 'N/A')}</span>
                <h3 style="color: var(--text-main);">${escapeHTML(furniture.furniture_name || 'Item')} <span style="font-weight: normal; color: var(--text-hover); font-size: calc(0.85rem * var(--font-scale));">(${escapeHTML(item.colour || 'N/A')})</span></h3>
                <div style="margin: 4px 0;">${stockHtml}</div>
                <p class="product-material" style="font-size: calc(0.8rem * var(--font-scale)); color: var(--text-hover); margin: 2px 0;">${escapeHTML(item.material || 'N/A')}</p>
                <p class="product-price" style="font-weight: bold; color: var(--price);">RM ${safeNumber(item.price).toFixed(2)}</p>
            </div>
        `;

        const image = productCard.querySelector('img');
        image?.addEventListener('error', () => { image.src = fallbackImage; }, { once: true });
        
        productCard.onclick = () => {
            if (furniture.furniture_id) {
                loadCustomerContent('product_details', { id: furniture.furniture_id });
                if (resultPanel) resultPanel.style.display = 'none';
                if (searchPanel) searchPanel.style.display = 'none';
                searchButton?.setAttribute('aria-expanded', 'false');
            }
        };

        container.appendChild(productCard);
    });
}

async function updateCartBadge() {
    const badge = document.getElementById('cart-count-badge');
    if (!badge) return;

    const setCount = (count) => {
        const normalizedCount = Math.max(0, Number(count) || 0);
        const hasItems = normalizedCount > 0;
        badge.hidden = !hasItems;
        badge.textContent = normalizedCount > 99 ? '99+' : String(normalizedCount);
        badge.setAttribute('aria-label', `${normalizedCount} item${normalizedCount === 1 ? '' : 's'} in cart`);
    };

    try {
        const { data: { session } } = await _supabase.auth.getSession();
        if (!session?.user) {
            setCount(0);
            return;
        }

        const { data: cart, error: cartError } = await _supabase
            .from('cart')
            .select('cart_id')
            .eq('user_id', session.user.id)
            .maybeSingle();

        if (cartError) throw cartError;
        if (!cart) {
            setCount(0);
            return;
        }

        const { data: items, error: itemsError } = await _supabase
            .from('cart_item')
            .select('quantity')
            .eq('cart_id', cart.cart_id)
            .is('room_item_id', null);

        if (itemsError) throw itemsError;
        setCount((items || []).reduce((total, item) => total + safeNumber(item.quantity, 0), 0));
    } catch (error) {
        console.error('Unable to update cart badge:', error);
        setCount(0);
    }
}
