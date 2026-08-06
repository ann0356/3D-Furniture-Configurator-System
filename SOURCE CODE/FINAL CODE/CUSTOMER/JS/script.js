import { _supabase } from '../../SUPABASE/supabase_customer_conn.js';
import { initProductList } from './components/product_list.js';
import { initProductDetails } from './components/product_details.js';
import { initCart } from './components/cart.js';
import { initOrder } from './components/order.js';
import { initProfile } from './components/profile.js';
import { initRoom } from './components/room.js';
import { initHome } from './components/home.js'; 
import { initContactUs } from './components/contactUs.js'; 

const mainContent = document.getElementById('main-content');

window.addEventListener('DOMContentLoaded', async () => {
    console.log("Customer SPA engine started.");

    initAccessibilityTools();

    initSearchControls();
    checkLoginStatus();
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
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
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

    btnIncrease.addEventListener('click', () => applyFontScale(currentFontScale + 0.1));
    btnDecrease.addEventListener('click', () => applyFontScale(currentFontScale - 0.1));
    btnReset.addEventListener('click', () => applyFontScale(1.0));

    function applyContrast(enable) {
        isHighContrast = enable;

        const logoImg = document.querySelector('#brand-logo img');

        if (enable) {
            document.body.classList.add('high-contrast-mode');
            if (logoImg) {
                logoImg.src = "https://dzgtfwdqfqecetnfhcdi.supabase.co/storage/v1/object/public/furniture-images/Ruma_white_logo.png";
            }
        } else {
            document.body.classList.remove('high-contrast-mode');
            if (logoImg) {
                logoImg.src = "https://dzgtfwdqfqecetnfhcdi.supabase.co/storage/v1/object/public/furniture-images/Ruma_Logo_black.png";
            }
        }
        localStorage.setItem('a11y-high-contrast', enable);
    }

    btnContrast.addEventListener('click', () => applyContrast(!isHighContrast));
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
        mainContent.innerHTML = "<h2 style='padding: 40px; text-align: center; color: #e74c3c;'>Failed to load page.</h2>";
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
            if (searchPanel.style.display === 'block') {
                searchPanel.style.display = 'none';
                if (resultPanel) resultPanel.style.display = 'none';
            } else {
                searchPanel.style.display = 'block';
                if (searchInput) { searchInput.value = ''; searchInput.focus(); }
            }
        });
    }
    [searchPanel, resultPanel].forEach(panel => { if (panel) panel.onclick = (e) => e.stopPropagation(); });
    document.addEventListener('click', (event) => {
        if (searchContainer && !searchContainer.contains(event.target)) {
            if (searchPanel) searchPanel.style.display = 'none';
            if (resultPanel) resultPanel.style.display = 'none';
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
    // 👆 ========================================= 👆
}

async function checkLoginStatus() {
    const loggedOutLinks = document.querySelectorAll('.logged-out-only');
    const loggedInLinks = document.querySelectorAll('.logged-in-only');
    const navLogoutBtn = document.getElementById('nav-logout-btn');
    try {
        const { data: { session } } = await _supabase.auth.getSession();
        if (session && session.user) {
            loggedOutLinks.forEach(link => link.style.display = 'none');
            loggedInLinks.forEach(link => link.style.display = 'block');
        } else {
            loggedOutLinks.forEach(link => link.style.display = 'block');
            loggedInLinks.forEach(link => link.style.display = 'none');
        }
    } catch (err) { console.error(err); }

    if (navLogoutBtn) {
        navLogoutBtn.onclick = async (e) => {
            e.preventDefault();
            await _supabase.auth.signOut();
            alert("Logout successfully!");
            window.location.href = 'cus_index.html?page=home'; 
        };
    }
}

function renderSearchResults(structures) {
    const container = document.getElementById('products-container');
    const resultPanel = document.querySelector('.result-panel'); 
    const searchPanel = document.querySelector('.search-panel'); 
    
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
        const finalImageUrl = item.image_url ? item.image_url : 'https://dzgtfwdqfqecetnfhcdi.supabase.co/storage/v1/object/public/furniture-images/ruma_logo_white.png';
        const stock = Number(item.stock || 0);
        let stockHtml = '';

        if (stock >= 100) {
            stockHtml = `<span style="color: #2ecc71; font-size: calc(0.75rem * var(--font-scale)); font-weight: bold;"><i class="fa-solid fa-box-open"></i> In Stock</span>`;
        } else if (stock > 0) {
            stockHtml = `<span style="color: #e67e22; font-size: calc(0.75rem * var(--font-scale)); font-weight: bold;">Only ${stock} left</span>`;
        } else {
            stockHtml = `<span style="color: #e74c3c; font-size: calc(0.75rem * var(--font-scale)); font-weight: bold;">Out of stock</span>`;
        }

        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.style.cursor = 'pointer';
        productCard.style.transition = 'background-color 0.2s';
        
        productCard.onmouseover = () => productCard.style.backgroundColor = 'var(--bg-nav)';
        productCard.onmouseout = () => productCard.style.backgroundColor = 'transparent';
        
        productCard.innerHTML = `
            <div class="product-img-box">
                <img src="${finalImageUrl}" alt="${furniture.furniture_name || 'furniture'}" onerror="this.src='https://dzgtfwdqfqecetnfhcdi.supabase.co/storage/v1/object/public/furniture-images/ruma_logo_white.png'">
            </div>
            <div class="product-info">
                <span class="product-category" style="font-size:calc(0.8rem * var(--font-scale));">${category.category_name || 'N/A'} / ${type.type_name || 'N/A'}</span>
                <h3 style="color: var(--text-main);">${furniture.furniture_name || 'Item'} <span style="font-weight: normal; color: var(--text-hover); font-size: calc(0.85rem * var(--font-scale));">(${item.colour})</span></h3>
                <div style="margin: 4px 0;">${stockHtml}</div>
                <p class="product-material" style="font-size: calc(0.8rem * var(--font-scale)); color: var(--text-hover); margin: 2px 0;">${item.material}</p>
                <p class="product-price" style="font-weight: bold; color: #e67e22;">RM ${item.price}</p>
            </div>
        `;
        
        productCard.onclick = () => {
            if (furniture.furniture_id) {
                loadCustomerContent('product_details', { id: furniture.furniture_id });
                if (resultPanel) resultPanel.style.display = 'none';
                if (searchPanel) searchPanel.style.display = 'none';
            }
        };

        container.appendChild(productCard);
    });
}