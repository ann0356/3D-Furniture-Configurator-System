import { _supabase } from '../../../SUPABASE/supabase_customer_conn.js';
import { loadCustomerContent } from '../script.js';

export async function initProductList(params) {
    console.log("Loading shelf data for params: ", params);
    
    const titleElem = document.getElementById('catalog-title');
    const gridElem = document.getElementById('catalog-grid');
    
    if (titleElem) titleElem.innerText = `${params.name} Collection`;
    if (!gridElem) return;

    gridElem.innerHTML = "<p style='grid-column: 1/-1; text-align:center; color:#7f8c8d;'>Gathering exquisite furniture items...</p>";

    try {
        let query = _supabase.from('furniture').select(`
            furniture_id,
            furniture_name,
            description,
            type!inner (
                type_id,
                type_name,
                category_id
            ),
            structure (
                structure_id,
                structure_name,
                price,
                image_url,
                colour
            )
        `);

        if (params.level === 'category') {
            query = query.eq('type.category_id', params.id);
        } else if (params.level === 'type') {
            query = query.eq('type_id', params.id);
        }

        const { data: furnitureList, error } = await query.order('furniture_name');
        if (error) throw error;

        gridElem.innerHTML = "";

        if (!furnitureList || furnitureList.length === 0) {
            gridElem.innerHTML = "<p style='grid-column: 1/-1; text-align:center; color:#95a5a6; padding:20px;'>No products found in this collection currently.</p>";
            return;
        }

        furnitureList.forEach(fur => {
            const defaultSpec = (fur.structure && fur.structure.length > 0) ? fur.structure[0] : null;
            const imgUrl = defaultSpec?.image_url ? defaultSpec.image_url : 'https://dzgtfwdqfqecetnfhcdi.supabase.co/storage/v1/object/public/furniture-images/ERROR%20PICTURE.png';
            const priceText = defaultSpec ? `RM ${Number(defaultSpec.price).toFixed(2)}` : "Price TBD";

            const productCard = document.createElement('div');
            productCard.style.cssText = `
                background: white; border-radius: 8px; overflow: hidden;
                box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #edf2f7;
                transition: transform 0.2s, box-shadow 0.2s; cursor: pointer;
                display: flex; flex-direction: column;
            `;
            
            productCard.innerHTML = `
                <div style="width:100%; height:240px; background:#f7fafc; overflow:hidden; position:relative;">
                    <img src="${imgUrl}" alt="${fur.furniture_name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='https://dzgtfwdqfqecetnfhcdi.supabase.co/storage/v1/object/public/furniture-images/ERROR%20PICTURE.png'">
                    ${fur.structure && fur.structure.length > 1 ? `<span style="position:absolute; bottom:10px; right:10px; background:rgba(0,0,0,0.6); color:white; font-size:11px; padding:3px 8px; border-radius:20px;">${fur.structure.length} Variants</span>` : ''}
                </div>
                <div style="padding: 20px; flex:1; display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
                    <div>
                        <h3 style="font-size: 16px; margin:0 0 4px 0; color:#2d3748;">${fur.furniture_name}</h3>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed #edf2f7; padding-top:10px;">
                        <span style="font-weight:bold; color:#e67e22; font-size:16px;">${priceText}</span>
                        <button style="background:#1e2937; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:12px; cursor:pointer;">View Details</button>
                    </div>
                </div>
            `;

            productCard.onmouseenter = () => { productCard.style.transform = "translateY(-4px)"; productCard.style.boxShadow = "0 10px 15px rgba(0,0,0,0.1)"; };
            productCard.onmouseleave = () => { productCard.style.transform = "none"; productCard.style.boxShadow = "0 4px 6px rgba(0,0,0,0.05)"; };

            productCard.onclick = () => {
                console.log(`Navigating to product details: ${fur.furniture_id}`);
                loadCustomerContent('product_details', { id: fur.furniture_id });
            };

            gridElem.appendChild(productCard);
        });

    } catch (err) {
        console.error("Error drawing shopping grid items: ", err);
        gridElem.innerHTML = "<p style='grid-column: 1/-1; text-align:center; color:#e74c3c;'>Database error occurred.</p>";
    }
}