import { _supabase } from '../../../SUPABASE/supabase_admin_conn.js';

// --- State Management ---
let currentCategoryId = null;
let currentCategoryName = null;
let currentTypeId = null;
let currentTypeName = null;
let currentFurnitureId = null; 

// --- Editing Temp State ---
let editTargetTable = ''; 
let editTargetId = '';
let activeEditStrObj = null; 

export async function initProducts() {
    console.log("Furniture Management initialized with full CRUD & separated workflows.");
    
    document.getElementById('nav-categories').addEventListener('click', loadCategories);
    document.getElementById('btn-save-category').addEventListener('click', saveCategory);
    document.getElementById('btn-save-type').addEventListener('click', saveType);
    document.getElementById('btn-save-furniture').addEventListener('click', saveFurniture);
    document.getElementById('btn-save-structure').addEventListener('click', saveStructure);

    document.getElementById('btn-submit-edit-generic').addEventListener('click', submitEditGeneric);
    document.getElementById('btn-submit-edit-structure').addEventListener('click', submitEditStructure);

    await loadCategories();
}

// data rendering
async function loadCategories() {
    document.getElementById('nav-type-separator').style.display = 'none';
    document.getElementById('nav-furniture-separator').style.display = 'none';
    currentCategoryId = null; currentTypeId = null;

    const container = document.getElementById('list-container');
    container.innerHTML = "<p>Loading Categories...</p>";
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
    container.style.flexDirection = 'initial';

    const { data, error } = await _supabase.from('category').select('*').order('category_id');
    if (error) return alert("Error loading categories.");

    container.innerHTML = "";
    data.forEach(cat => {
        const card = createCard(
            cat.category_name, 
            `ID: ${cat.category_id}`, 
            () => { currentCategoryId = cat.category_id; currentCategoryName = cat.category_name; loadTypes(); }, 
            async (e) => {
                e.stopPropagation();
                if (confirm(`🚨 DANGER: Delete category "${cat.category_name}"? This cascades to all sub-items!`)) {
                    const { error: delErr } = await _supabase.from('category').delete().eq('category_id', cat.category_id);
                    if (delErr) alert(delErr.message); else loadCategories();
                }
            },
            (e) => { 
                e.stopPropagation(); 
                openEditModal('category', cat.category_id, cat.category_name); 
            }
        );
        container.appendChild(card);
    });
    container.appendChild(createAddButton("➕ Add New Category", () => document.getElementById('modal-category').style.display = 'flex'));
}

async function loadTypes() {
    document.getElementById('nav-type-separator').style.display = 'inline';
    document.getElementById('nav-type').innerText = currentCategoryName;
    document.getElementById('nav-type').style.cursor = 'pointer';
    document.getElementById('nav-type').onclick = loadTypes;
    document.getElementById('nav-furniture-separator').style.display = 'none';
    currentTypeId = null;

    const container = document.getElementById('list-container');
    container.innerHTML = "<p>Loading Types...</p>";
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
    container.style.flexDirection = 'initial';

    const { data, error } = await _supabase.from('type').select('*').eq('category_id', currentCategoryId).order('type_id');
    if (error) return alert("Error loading types.");

    container.innerHTML = "";
    data.forEach(type => {
        const card = createCard(
            type.type_name, 
            `ID: ${type.type_id}`, 
            () => { currentTypeId = type.type_id; currentTypeName = type.type_name; loadFurniture(); }, 
            async (e) => {
                e.stopPropagation();
                if (confirm(`Delete type "${type.type_name}"?`)) {
                    const { error: delErr } = await _supabase.from('type').delete().eq('type_id', type.type_id);
                    if (delErr) alert(delErr.message); else loadTypes();
                }
            },
            (e) => { 
                e.stopPropagation(); 
                openEditModal('type', type.type_id, type.type_name); 
            }
        );
        container.appendChild(card);
    });
    container.appendChild(createAddButton("➕ Add New Type", () => document.getElementById('modal-type').style.display = 'flex'));
}

async function loadFurniture() {
    document.getElementById('nav-furniture-separator').style.display = 'inline';
    document.getElementById('nav-furniture').innerText = currentTypeName;

    const container = document.getElementById('list-container');
    container.innerHTML = "<p>Loading Furniture...</p>";
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    const { data, error } = await _supabase.from('furniture').select(`*, structure(*)`).eq('type_id', currentTypeId).order('furniture_id');
    if (error) return alert("Error loading furniture.");

    container.innerHTML = "";

    data.forEach(fur => {
        const furDiv = document.createElement('div');
        furDiv.style.border = "1px solid #ccc";
        furDiv.style.borderRadius = "8px";
        furDiv.style.padding = "15px";
        furDiv.style.background = "white";
        furDiv.style.marginBottom = "15px";

        const header = document.createElement('div');
        header.style.display = "flex";
        header.style.justifyContent = "space-between";
        header.style.alignItems = "center";
        header.style.cursor = "pointer";
        header.style.fontWeight = "bold";
        
        header.innerHTML = `
            <span>Sub-items (SKUs): ▼</span>
            <div style="display:flex; align-items:center; gap:10px; margin-left:auto; margin-right: 15px;">
                <button class="btn-add-str" style="background:#2ecc71; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">➕ Add Structure</button>
                <button class="btn-edit-fur" style="background:#3498db; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">✏️ Edit</button>
                <button class="btn-delete-fur" style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">🗑️ Delete</button>
            </div>
        `;
        
        const titleSpan = document.createElement('span');
        titleSpan.innerText = `🛋️ ${fur.furniture_name} (ID: ${fur.furniture_id})`;
        header.insertBefore(titleSpan, header.firstChild);

        const details = document.createElement('div');
        details.style.display = "none";
        details.style.marginTop = "15px";
        details.style.borderTop = "1px solid #eee";
        details.style.paddingTop = "15px";

        if (fur.structure && fur.structure.length > 0) {
            let tableHTML = `<table style="width: 100%; font-size: 14px; text-align: left; border-collapse:collapse;">
                <tr style="background: #f8f9fa; border-bottom:1px solid #ddd;">
                    <th style="padding:8px;">ID</th><th style="padding:8px;">Name</th><th style="padding:8px;">Price</th>
                    <th style="padding:8px;">Stock</th><th style="padding:8px;">Spec & Dimensions</th><th style="padding:8px;">Image</th>
                    <th style="padding:8px;">3D Model</th><th style="padding:8px; text-align:center;">Actions</th>
                </tr>`;
            
            fur.structure.forEach(s => {
                const imgLink = s.image_url ? `<a href="${s.image_url}" target="_blank" style="color:#3498db; text-decoration:underline;">View</a>` : 'N/A';
                const modelLink = s.model_url ? `<span class="btn-preview-3d" data-url="${s.model_url}" style="color:#e67e22; cursor:pointer; text-decoration:underline; font-weight:bold;">Preview</span>` : 'N/A';
                
                tableHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding:8px;">${s.structure_id}</td>
                    <td style="padding:8px;">${s.structure_name}</td>
                    <td style="padding:8px;">RM ${s.price}</td>
                    <td style="padding:8px;">${s.stock}</td>
                    <td style="padding:8px; font-size:12px; color:#555;">
                        Col: ${s.colour || '-'}<br>
                        Mat: ${s.material || '-'}<br>
                        Dim: ${s.length || 0}x${s.width || 0}x${s.height || 0} cm
                    </td>
                    <td style="padding:8px;">${imgLink}</td>
                    <td style="padding:8px;">${modelLink}</td>
                    <td style="padding:8px; text-align:center;">
                        <button class="btn-row-edit" data-id="${s.structure_id}" style="background:#3498db; color:white; border:none; padding:3px 8px; border-radius:3px; cursor:pointer; font-size:12px; margin-right:5px;">✏️ Edit</button>
                        <button class="btn-row-delete" data-id="${s.structure_id}" style="background:#e74c3c; color:white; border:none; padding:3px 8px; border-radius:3px; cursor:pointer; font-size:12px;">🗑️ Delete</button>
                    </td>
                </tr>`;
            });
            tableHTML += `</table>`;
            details.innerHTML = tableHTML;

            details.querySelectorAll('.btn-preview-3d').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); open3DPreview(btn.getAttribute('data-url')); });
            
            details.querySelectorAll('.btn-row-edit').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const sId = btn.getAttribute('data-id');
                    const selectedStr = fur.structure.find(s => s.structure_id === sId);
                    openEditStructureModal(selectedStr);
                };
            });

            details.querySelectorAll('.btn-row-delete').forEach(btn => {
                btn.onclick = async (e) => {
                    e.stopPropagation();
                    const sId = btn.getAttribute('data-id');
                    if (confirm(`Are you sure you want to delete structure "${sId}"?`)) {
                        const { error: strDelErr } = await _supabase.from('structure').delete().eq('structure_id', sId);
                        if (strDelErr) alert(strDelErr.message); else loadFurniture();
                    }
                };
            });

        } else {
            details.innerHTML = "<p style='color: #95a5a6; font-size: 14px; margin:0;'>No structural configurations yet. Click 'Add Structure' to create configurations.</p>";
        }

        header.querySelector('.btn-add-str').onclick = (e) => {
            e.stopPropagation();
            currentFurnitureId = fur.furniture_id;
            document.getElementById('modal-structure').style.display = 'flex';
        };

        header.querySelector('.btn-edit-fur').onclick = (e) => {
            e.stopPropagation();
            openEditModal('furniture', fur.furniture_id, fur.furniture_name, fur.description);
        };

        header.querySelector('.btn-delete-fur').onclick = async (e) => {
            e.stopPropagation();
            if (confirm(`Permanently delete whole product line "${fur.furniture_name}"?`)) {
                const { error: delErr } = await _supabase.from('furniture').delete().eq('furniture_id', fur.furniture_id);
                if (delErr) alert(delErr.message); else loadFurniture();
            }
        };

        header.onclick = (e) => {
            if (!e.target.closest('button') && !e.target.classList.contains('btn-preview-3d')) {
                details.style.display = details.style.display === "none" ? "block" : "none";
            }
        };
        
        furDiv.appendChild(header);
        furDiv.appendChild(details);
        container.appendChild(furDiv);
    });

    container.appendChild(createAddButton("➕ Add New Furniture", () => document.getElementById('modal-furniture').style.display = 'flex'));
}

async function checkIdExists(table, column, value) {
    const { data } = await _supabase.from(table).select(column).eq(column, value);
    return data && data.length > 0;
}

async function saveCategory() {
    const name = document.getElementById('input-cat-name').value.trim();
    if (!name) return alert("Please type Category Name.");
    const { error } = await _supabase.from('category').insert([{ category_name: name }]);
    if (error) alert(error.message); else { document.getElementById('modal-category').style.display = 'none'; document.getElementById('input-cat-name').value = ''; loadCategories(); }
}

async function saveType() {
    const name = document.getElementById('input-type-name').value.trim();
    if (!name) return alert("Please type Type Name.");
    const { error } = await _supabase.from('type').insert([{ type_name: name, category_id: currentCategoryId }]);
    if (error) alert(error.message); else { document.getElementById('modal-type').style.display = 'none'; document.getElementById('input-type-name').value = ''; loadTypes(); }
}

async function saveFurniture() {
    const fId = document.getElementById('input-fur-id').value.trim();
    const fName = document.getElementById('input-fur-name').value.trim();
    const fDesc = document.getElementById('input-fur-desc').value.trim();

    if (!fId || !fName) return alert("Furniture ID and Name are strictly required.");
    if (await checkIdExists('furniture', 'furniture_id', fId)) return alert("This Furniture ID already exists!");

    const { error } = await _supabase.from('furniture').insert([{ furniture_id: fId, furniture_name: fName, description: fDesc, type_id: currentTypeId }]);
    if (error) return alert(error.message);

    alert("Furniture record base initialized!");
    document.getElementById('modal-furniture').style.display = 'none';
    document.getElementById('input-fur-id').value = '';
    document.getElementById('input-fur-name').value = '';
    document.getElementById('input-fur-desc').value = '';
    loadFurniture();
}

async function saveStructure() {
    const saveBtn = document.getElementById('btn-save-structure');
    saveBtn.innerText = "Processing Files & Uploading...";
    saveBtn.disabled = true;

    try {
        const sId = document.getElementById('input-str-id').value.trim();
        const sName = document.getElementById('input-str-name').value.trim();
        const sPrice = document.getElementById('input-str-price').value || 0;
        const sStock = document.getElementById('input-str-stock').value || 0;
        const sColour = document.getElementById('input-str-colour').value.trim();
        const sMaterial = document.getElementById('input-str-material').value.trim();
        
        const sLength = document.getElementById('input-str-length').value || 0;
        const sWidth = document.getElementById('input-str-width').value || 0;
        const sHeight = document.getElementById('input-str-height').value || 0;

        const imgFile = document.getElementById('input-str-image').files[0];
        const modelFile = document.getElementById('input-str-model').files[0];

        if (!sId || !sName) throw new Error("Structure ID and Name fields are mandatory.");
        if (await checkIdExists('structure', 'structure_id', sId)) throw new Error("This Structure ID already exists!");

        let publicImgUrl = null, publicModelUrl = null;

        if (imgFile) {
            const fileExt = imgFile.name.split('.').pop();
            const fileName = `${sId}_img_${Date.now()}.${fileExt}`;
            const { error: imgErr } = await _supabase.storage.from('furniture-images').upload(fileName, imgFile);
            if (imgErr) throw imgErr;
            publicImgUrl = _supabase.storage.from('furniture-images').getPublicUrl(fileName).data.publicUrl;
        }

        if (modelFile) {
            const fileExt = modelFile.name.split('.').pop().toLowerCase();
            if (fileExt !== 'glb') throw new Error("Invalid model file type! Only .glb asset items are allowed.");
            const fileName = `${sId}_model_${Date.now()}.${fileExt}`;
            const { error: modErr } = await _supabase.storage.from('furniture-models').upload(fileName, modelFile);
            if (modErr) throw modErr;
            publicModelUrl = _supabase.storage.from('furniture-models').getPublicUrl(fileName).data.publicUrl;
        }

        const { error: insErr } = await _supabase.from('structure').insert([{
            structure_id: sId, furniture_id: currentFurnitureId, structure_name: sName,
            price: sPrice, stock: sStock, colour: sColour, material: sMaterial,
            length: sLength, width: sWidth, height: sHeight, // Dimension mapping
            image_url: publicImgUrl, model_url: publicModelUrl
        }]);
        if (insErr) throw insErr;

        alert("New configuration variant injected successfully!");
        document.getElementById('modal-structure').style.display = 'none';
        
        // Clear Inputs
        document.getElementById('input-str-id').value = '';
        document.getElementById('input-str-name').value = '';
        document.getElementById('input-str-price').value = '';
        document.getElementById('input-str-stock').value = '';
        document.getElementById('input-str-colour').value = '';
        document.getElementById('input-str-material').value = '';
        
        document.getElementById('input-str-length').value = '';
        document.getElementById('input-str-width').value = '';
        document.getElementById('input-str-height').value = '';
        
        document.getElementById('input-str-image').value = '';
        document.getElementById('input-str-model').value = '';
        
        loadFurniture();
    } catch(err) {
        alert(err.message);
    } finally {
        saveBtn.innerText = "Upload & Save";
        saveBtn.disabled = false;
    }
}

// edit function
function openEditModal(table, id, currentName, currentDesc = '') {
    editTargetTable = table;
    editTargetId = id;
    
    document.getElementById('edit-generic-title').innerText = `Edit ${table.toUpperCase()} Details`;
    document.getElementById('input-edit-name-val').value = currentName;
    
    const descContainer = document.getElementById('edit-desc-container');
    const descInput = document.getElementById('input-edit-desc-val');

    if (table === 'furniture') {
        descContainer.style.display = 'flex';
        descInput.value = currentDesc || '';
    } else {
        descContainer.style.display = 'none';
        descInput.value = '';
    }
    
    document.getElementById('modal-edit-generic').style.display = 'flex';
}

async function submitEditGeneric() {
    const newName = document.getElementById('input-edit-name-val').value.trim();
    if (!newName) return alert("Name field cannot be left blank.");

    const pkTarget = `${editTargetTable}_id`;
    
    const updatePayload = {
        [`${editTargetTable}_name`]: newName
    };

    if (editTargetTable === 'furniture') {
        const newDesc = document.getElementById('input-edit-desc-val').value.trim();
        updatePayload['description'] = newDesc;
    }

    const { error } = await _supabase.from(editTargetTable).update(updatePayload).eq(pkTarget, editTargetId);
    if (error) return alert(error.message);

    document.getElementById('modal-edit-generic').style.display = 'none';
    
    if (editTargetTable === 'category') loadCategories();
    else if (editTargetTable === 'type') loadTypes();
    else if (editTargetTable === 'furniture') loadFurniture();
}

function openEditStructureModal(strObj) {
    activeEditStrObj = strObj; 
    document.getElementById('label-edit-str-id').innerText = strObj.structure_id;
    document.getElementById('input-edit-str-name').value = strObj.structure_name || '';
    document.getElementById('input-edit-str-price').value = strObj.price || 0;
    document.getElementById('input-edit-str-stock').value = strObj.stock || 0;
    document.getElementById('input-edit-str-colour').value = strObj.colour || '';
    document.getElementById('input-edit-str-material').value = strObj.material || '';
    
    document.getElementById('input-edit-str-length').value = strObj.length || 0;
    document.getElementById('input-edit-str-width').value = strObj.width || 0;
    document.getElementById('input-edit-str-height').value = strObj.height || 0;
    
    document.getElementById('input-edit-str-image').value = '';
    document.getElementById('input-edit-str-model').value = '';

    document.getElementById('modal-edit-structure').style.display = 'flex';
}

async function submitEditStructure() {
    const applyBtn = document.getElementById('btn-submit-edit-structure');
    applyBtn.innerText = "Re-processing files & Saving updates...";
    applyBtn.disabled = true;

    try {
        const name = document.getElementById('input-edit-str-name').value.trim();
        const price = document.getElementById('input-edit-str-price').value || 0;
        const stock = document.getElementById('input-edit-str-stock').value || 0;
        const colour = document.getElementById('input-edit-str-colour').value.trim();
        const material = document.getElementById('input-edit-str-material').value.trim();
        
        const length = document.getElementById('input-edit-str-length').value || 0;
        const width = document.getElementById('input-edit-str-width').value || 0;
        const height = document.getElementById('input-edit-str-height').value || 0;
        
        const imgFile = document.getElementById('input-edit-str-image').files[0];
        const modelFile = document.getElementById('input-edit-str-model').files[0];

        if (!name) throw new Error("Structure identity name cannot be null.");

        let updatedImgUrl = activeEditStrObj.image_url;
        let updatedModelUrl = activeEditStrObj.model_url;

        if (imgFile) {
            const fileExt = imgFile.name.split('.').pop();
            const fileName = `${activeEditStrObj.structure_id}_img_${Date.now()}.${fileExt}`;
            const { error: imgErr } = await _supabase.storage.from('furniture-images').upload(fileName, imgFile);
            if (imgErr) throw imgErr;
            updatedImgUrl = _supabase.storage.from('furniture-images').getPublicUrl(fileName).data.publicUrl;
        }

        if (modelFile) {
            const fileExt = modelFile.name.split('.').pop().toLowerCase();
            if (fileExt !== 'glb') throw new Error("Asset structural update must strictly match .glb formatting extension rules.");
            const fileName = `${activeEditStrObj.structure_id}_model_${Date.now()}.${fileExt}`;
            const { error: modErr } = await _supabase.storage.from('furniture-models').upload(fileName, modelFile);
            if (modErr) throw modErr;
            updatedModelUrl = _supabase.storage.from('furniture-models').getPublicUrl(fileName).data.publicUrl;
        }

        const { error: upErr } = await _supabase.from('structure').update({
            structure_name: name, price: price, stock: stock, colour: colour, material: material,
            length: length, width: width, height: height, // Update payload
            image_url: updatedImgUrl, model_url: updatedModelUrl
        }).eq('structure_id', activeEditStrObj.structure_id);

        if (upErr) throw upErr;

        alert("Variant properties updated seamlessly.");
        document.getElementById('modal-edit-structure').style.display = 'none';
        loadFurniture();

    } catch(err) {
        alert(err.message);
    } finally {
        applyBtn.innerText = "Apply Changes";
        applyBtn.disabled = false;
    }
}

function createCard(title, subtitle, onClick, onDelete, onEdit) {
    const card = document.createElement('div');
    card.style.background = "white"; card.style.padding = "20px"; card.style.borderRadius = "8px";
    card.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)"; card.style.cursor = "pointer";
    card.style.border = "1px solid transparent"; card.style.position = "relative"; card.style.transition = "all 0.2s";
    
    card.innerHTML = `
        <h3 style="margin-bottom: 5px; color:#1e2937; padding-right:50px;">${title}</h3>
        <p style="color: #7f8c8d; font-size: 14px; margin:0;">${subtitle}</p>
        <div class="card-actions" style="position:absolute; top:15px; right:15px; display:none; gap:10px;">
            <span class="btn-edit-card" style="color:#3498db; font-size:16px; cursor:pointer;">✏️</span>
            <span class="btn-delete-card" style="color:#e74c3c; font-size:16px; cursor:pointer;">🗑️</span>
        </div>
    `;
    
    card.onmouseover = () => { card.style.border = "1px solid #3498db"; card.querySelector('.card-actions').style.display = 'flex'; };
    card.onmouseout = () => { card.style.border = "1px solid transparent"; card.querySelector('.card-actions').style.display = 'none'; };
    
    card.onclick = onClick;
    card.querySelector('.btn-edit-card').onclick = onEdit; 
    card.querySelector('.btn-delete-card').onclick = onDelete;
    return card;
}

function createAddButton(text, onClick) {
    const btn = document.createElement('div');
    btn.style.display = "flex"; btn.style.alignItems = "center"; btn.style.justifyContent = "center";
    btn.style.padding = "20px"; btn.style.borderRadius = "8px"; btn.style.border = "2px dashed #bdc3c7";
    btn.style.color = "#7f8c8d"; btn.style.cursor = "pointer"; btn.style.fontWeight = "bold"; btn.style.transition = "all 0.2s";
    btn.innerText = text;
    
    btn.onmouseover = () => { btn.style.border = "2px dashed #3498db"; btn.style.color = "#3498db"; };
    btn.onmouseout = () => { btn.style.border = "2px dashed #bdc3c7"; btn.style.color = "#7f8c8d"; };
    btn.onclick = onClick;
    return btn;
}

function open3DPreview(url) {
    const container = document.getElementById('model-viewer-container');
    container.innerHTML = `
        <model-viewer src="${url}" ar camera-controls touch-action="pan-y" 
            style="width: 100%; height: 100%; background-color: #f8fafc;" shadow-intensity="1.5" auto-rotate>
        </model-viewer>
    `;
    document.getElementById('modal-3d-preview').style.display = 'flex';
}