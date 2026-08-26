import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'; 
import { _supabase } from '../../../SUPABASE/supabase_customer_conn.js'; 
import { escapeHTML, safeAssetUrl } from '../utils/dom.js';

let scene, camera, renderer, orbitControls, transformControls;
let floorMesh, gridHelper, wallLines = [];
let fullCatalogData = [];
let allCategories = [];
let allTypes = [];
const raycaster = new THREE.Raycaster();
const mouse     = new THREE.Vector2();
const gltfLoader = new GLTFLoader();

const placedItems = new Map();
let selectedItem = null;
let currentRoomId = null;
let currentUserId = null;
let isGlobalEventBound = false;
let isContrastEventBound = false;
let animationFrameId = null;
let roomResizeHandler = null;

const ROOM_THEME = {
    light: {
        scene: 0xf1f5f9,
        floor: 0xfefefe,
        grid: 0xe2e8f0,
        wall: 0x94a3b8
    },
    highContrast: {
        scene: 0x000000,
        floor: 0x111111,
        grid: 0xffffff,
        wall: 0xffff00
    }
};

export async function initRoom() {
    const container = document.getElementById('room-canvas');
    if (!container) return;

    _disposeThree();
    placedItems.clear();
    selectedItem = null;

    const { data: { session } } = await _supabase.auth.getSession();
    currentUserId = session?.user?.id ?? null;

    _initThree(container);
    _bindContrastEvents();
    _bindUIEvents();
    _updateFloor(10, 10);
    
    if (currentUserId) await _loadSavedRooms();
    await _loadFurnitureLibrary();
    _animate();
}

function _disposeThree() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    if (roomResizeHandler) {
        window.removeEventListener('resize', roomResizeHandler);
        roomResizeHandler = null;
    }

    transformControls?.dispose?.();
    orbitControls?.dispose?.();
    scene?.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material?.dispose?.());
    });
    renderer?.dispose?.();

    renderer = null;
    scene = null;
    camera = null;
    orbitControls = null;
    transformControls = null;
    floorMesh = null;
    gridHelper = null;
    wallLines = [];
}

function _initThree(container) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);

    const w = container.clientWidth;
    const h = container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; 
    renderer.toneMapping = THREE.ACESFilmicToneMapping; 
    renderer.toneMappingExposure = 1.0; // 基础曝光度

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(8, 15, 8);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    dir.shadow.bias = -0.0005;
    scene.add(dir);

    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.08;
    
    _resetCamera(); 

    transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode('translate');
    scene.add(transformControls);

    transformControls.addEventListener('dragging-changed', (e) => { orbitControls.enabled = !e.value; });
    transformControls.addEventListener('objectChange', () => {
        const obj = transformControls.object;
        if (obj && transformControls.getMode() === 'translate') obj.position.y = 0;
    });

    roomResizeHandler = () => {
        const c = document.getElementById('room-canvas');
        if (!c || !renderer) return;
        camera.aspect = c.clientWidth / c.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(c.clientWidth, c.clientHeight);
    };
    window.addEventListener('resize', roomResizeHandler);

    renderer.domElement.addEventListener('click', _onCanvasClick);

    const canvasEl = document.getElementById('room-canvas');
    canvasEl.addEventListener('dragover', (e) => { e.preventDefault(); canvasEl.classList.add('drag-over'); });
    canvasEl.addEventListener('dragleave', () => canvasEl.classList.remove('drag-over'));
    canvasEl.addEventListener('drop', (e) => { canvasEl.classList.remove('drag-over'); _onFurnitureDrop(e); });

    _applyRoomContrastTheme();
}

function _resetCamera() {
    camera.position.set(12, 12, 12);
    camera.lookAt(0, 0, 0);
    orbitControls.target.set(0, 0, 0);
    orbitControls.update();
}

function _updateFloor(w, d) {
    if (floorMesh)  scene.remove(floorMesh);
    if (gridHelper) scene.remove(gridHelper);

    const geo = new THREE.PlaneGeometry(w, d);
    const mat = new THREE.MeshStandardMaterial({ color: 0xfefefe, roughness: 0.9 });
    floorMesh = new THREE.Mesh(geo, mat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    gridHelper = new THREE.GridHelper(Math.max(w, d), Math.max(w, d), 0xcccccc, 0xe2e8f0);
    scene.add(gridHelper);
    
    wallLines.forEach(l => scene.remove(l));
    wallLines = [];
    const points = [[-w/2,0,-d/2], [w/2,0,-d/2], [w/2,0,d/2], [-w/2,0,d/2], [-w/2,0,-d/2]].map(([x,y,z]) => new THREE.Vector3(x,y,z));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x94a3b8 }));
    scene.add(line);
    wallLines.push(line);

    _applyRoomContrastTheme();
}

function _bindContrastEvents() {
    if (isContrastEventBound) return;

    document.addEventListener('a11y-contrast-change', (event) => {
        _applyRoomContrastTheme(Boolean(event.detail?.enabled));
    });

    isContrastEventBound = true;
}

function _isHighContrastEnabled() {
    return document.body.classList.contains('high-contrast-mode') || document.documentElement.classList.contains('high-contrast-mode');
}

function _applyRoomContrastTheme(enabled = _isHighContrastEnabled()) {
    if (!scene) return;

    const theme = enabled ? ROOM_THEME.highContrast : ROOM_THEME.light;
    scene.background = new THREE.Color(theme.scene);

    if (renderer) {
        renderer.setClearColor(theme.scene, 1);
    }

    if (floorMesh?.material?.color) {
        floorMesh.material.color.set(theme.floor);
        floorMesh.material.needsUpdate = true;
    }

    if (gridHelper) {
        const materials = Array.isArray(gridHelper.material) ? gridHelper.material : [gridHelper.material];
        materials.forEach((material) => {
            if (material?.color) {
                material.color.set(theme.grid);
                material.needsUpdate = true;
            }
        });
    }

    wallLines.forEach((line) => {
        if (line.material?.color) {
            line.material.color.set(theme.wall);
            line.material.needsUpdate = true;
        }
    });
}

function _bindUIEvents() {
    document.getElementById('btn-update-room')?.addEventListener('click', () => {
        const w = parseFloat(document.getElementById('room-width')?.value) || 10;
        const d = parseFloat(document.getElementById('room-depth')?.value) || 10;
        _updateFloor(w, d);
    });

    document.getElementById('btn-mode')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        if (transformControls.getMode() === 'translate') {
            transformControls.setMode('rotate');
            transformControls.showX = false; transformControls.showZ = false;
            btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Rotate Mode';
            btn.style.background = '#b45309';
        } else {
            transformControls.setMode('translate');
            transformControls.showX = true; transformControls.showZ = true;
            btn.innerHTML = '<i class="fa-solid fa-arrows-up-down-left-right"></i> Move Mode';
            btn.style.background = '#15803d';
        }
    });

    document.getElementById('btn-view-top')?.addEventListener('click', () => {
        camera.position.set(0, 15, 0.1); orbitControls.target.set(0,0,0); orbitControls.update();
    });
    document.getElementById('btn-view-front')?.addEventListener('click', () => {
        camera.position.set(0, 5, 15); orbitControls.target.set(0,0,0); orbitControls.update();
    });
    document.getElementById('btn-view-side')?.addEventListener('click', () => {
        camera.position.set(15, 5, 0); orbitControls.target.set(0,0,0); orbitControls.update();
    });

    document.getElementById('btn-delete-item')?.addEventListener('click', _deleteSelected);
    if (!isGlobalEventBound) {
        document.addEventListener('keydown', (e) => {
            if (document.getElementById('room-canvas') && (e.key === 'Delete' || e.key === 'Backspace') && selectedItem) {
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') _deleteSelected();
            }
        });
        isGlobalEventBound = true;
    }

    document.getElementById('btn-save-room')?.addEventListener('click', _saveRoom);
    document.getElementById('btn-new-room')?.addEventListener('click', () => {
        _clearScene();
        currentRoomId = null;
        document.getElementById('room-name').value = 'New Room';
        _resetCamera(); 
        _showStatus('New room created.', 'info');
    });

    document.getElementById('btn-add-to-cart')?.addEventListener('click', _handleAddToCart);
    document.getElementById('room-select')?.addEventListener('change', async (e) => {
        if (e.target.value) await _loadRoom(e.target.value);
    });
}

async function _loadFurnitureLibrary() {
    const list = document.getElementById('room-furniture-list');
    if (!list) return;
    list.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8"><i class="fa-solid fa-spinner fa-spin"></i> Loading Data...</div>';

    try {
        const [strRes, furnRes, typeRes, catRes] = await Promise.all([
            _supabase.from('structure').select('structure_id, image_url, model_url, furniture_id'),
            _supabase.from('furniture').select('furniture_id, furniture_name, type_id'),
            _supabase.from('type').select('*'), 
            _supabase.from('category').select('*') 
        ]);

        if (strRes.error || furnRes.error || typeRes.error || catRes.error) {
            throw strRes.error || furnRes.error || typeRes.error || catRes.error;
        }

        allCategories = catRes.data || [];
        allTypes = typeRes.data || [];

        fullCatalogData = (strRes.data || []).map(struct => {
            const furn = furnRes.data?.find(f => f.furniture_id === struct.furniture_id);
            const type = allTypes.find(t => t.type_id === furn?.type_id);
            const cat = allCategories.find(c => c.category_id === type?.category_id);

            return {
                ...struct,
                furniture_name: furn?.furniture_name || 'Unknown',
                type_id: type?.type_id || null,
                type_name: type?.type_name || 'Uncategorized',
                category_id: cat?.category_id || null,
                category_name: cat?.category_name || 'Unknown'
            };
        }).filter(item => item.model_url); 

        _initFilterDropdowns();
        _renderFurnitureList();

    } catch (err) {
        console.error("Fail to load library:", err);
        list.innerHTML = `<div style="color:var(--danger); padding:20px; text-align:center;">Load Error: ${err.message}</div>`;
    }
}

function _initFilterDropdowns() {
    const catSelect = document.getElementById('filter-category');
    const typeSelect = document.getElementById('filter-type');
    if (!catSelect || !typeSelect) return;

    catSelect.replaceChildren(new Option('All Categories', ''));
    allCategories.forEach(c => {
        catSelect.add(new Option(c.category_name || 'Uncategorized', c.category_id));
    });

    catSelect.addEventListener('change', (e) => {
        const selectedCatId = e.target.value;
        typeSelect.replaceChildren(new Option('All Types', ''));
        
        if (selectedCatId) {
            typeSelect.disabled = false;
            const validTypes = allTypes.filter(t => t.category_id === selectedCatId);
            validTypes.forEach(t => {
                typeSelect.add(new Option(t.type_name || 'Uncategorized', t.type_id));
            });
        } else {
            typeSelect.disabled = true; 
        }
        _renderFurnitureList(); 
    });

    typeSelect.addEventListener('change', () => _renderFurnitureList());
}

function _renderFurnitureList() {
    const list = document.getElementById('room-furniture-list');
    const catId = document.getElementById('filter-category').value;
    const typeId = document.getElementById('filter-type').value;

    const filteredData = fullCatalogData.filter(item => {
        if (catId && item.category_id !== catId) return false;
        if (typeId && item.type_id !== typeId) return false;
        return true;
    });

    if (filteredData.length === 0) {
        list.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8">No items match your filter.</div>';
        return;
    }

    list.innerHTML = '';
    filteredData.forEach(item => {
        const card = document.createElement('div');
        card.className = 'furniture-card';
        card.draggable = true;
        card.dataset.modelUrl = item.model_url;
        card.dataset.structureId = item.structure_id;
        
        const imageUrl = safeAssetUrl(item.image_url);
        card.innerHTML = `
            <img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(item.furniture_name || item.structure_id || 'Furniture item')}">
            <div class="fc-info">
                <div class="fc-id" title="${escapeHTML(item.structure_id)}">${escapeHTML(item.structure_id)}</div>
                <div class="fc-type">${escapeHTML(item.type_name)}</div>
            </div>
            <button class="btn-add-furn" title="Add to center">＋</button>
        `;

        card.querySelector('img')?.addEventListener('error', (event) => {
            event.currentTarget.style.display = 'none';
        }, { once: true });

        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('modelUrl', item.model_url);
            e.dataTransfer.setData('structureId', item.structure_id);
        });

        card.querySelector('.btn-add-furn').addEventListener('click', () => {
            _addFurnitureToRoom(item.model_url, item.structure_id);
        });

        list.appendChild(card);
    });
}

function _onFurnitureDrop(event) {
    event.preventDefault();
    const modelUrl = event.dataTransfer.getData('modelUrl');
    const structureId = event.dataTransfer.getData('structureId');
    if (!modelUrl) return;

    const container = document.getElementById('room-canvas');
    const rect = container.getBoundingClientRect();
    raycaster.setFromCamera({ 
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1, 
        y: -((event.clientY - rect.top) / rect.height) * 2 + 1 
    }, camera);
    const hits = raycaster.intersectObject(floorMesh);
    _addFurnitureToRoom(modelUrl, structureId, hits.length ? hits[0].point : new THREE.Vector3(0,0,0));
}

function _addFurnitureToRoom(modelUrl, structureId, position = new THREE.Vector3(0, 0, 0), rotation = null, scale = null) {
    _showStatus('Loading model…', 'info');
    gltfLoader.load(modelUrl, (gltf) => {
        const model = gltf.scene;

        if (scale) {
            model.scale.set(scale.x, scale.y, scale.z);
        } else {
            model.scale.setScalar(1.0); 

            const tempBox = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            tempBox.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            
            if (maxDim > 10) {
                console.warn(`Model ${structureId} is unusually large (${maxDim} units). Auto-scaling down by 100x to convert cm to meters.`);
                model.scale.setScalar(0.01); 
            }
        }

        const box = new THREE.Box3().setFromObject(model);
        model.position.y = -box.min.y; 

        const wrapper = new THREE.Group();
        const uid = `furn_${structureId}_${Date.now()}`;
        wrapper.name = uid;
        wrapper.add(model);

        wrapper.position.set(position.x, 0, position.z); 
        if (rotation) wrapper.rotation.set(rotation.x, rotation.y, rotation.z);

        wrapper.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }});
        
        scene.add(wrapper);
        placedItems.set(uid, { mesh: wrapper, structureId, roomItemId: null });
        _selectItem(uid);
        _showStatus(`Added ${structureId} to room.`, 'success');
    });
}

function _selectItem(uid) {
    const entry = placedItems.get(uid);
    if (!entry) return;
    selectedItem = uid;
    transformControls.attach(entry.mesh);
    const el = document.getElementById('selection-info');
    if (el) { el.textContent = `Selected: ${entry.structureId}`; el.style.display = 'block'; }
}

function _deselectAll() {
    selectedItem = null;
    transformControls.detach();
    const el = document.getElementById('selection-info');
    if (el) el.style.display = 'none';
}

function _deleteSelected() {
    if (!selectedItem) return;
    const entry = placedItems.get(selectedItem);
    if (!entry) return;
    transformControls.detach();
    scene.remove(entry.mesh);
    placedItems.delete(selectedItem);
    selectedItem = null;
    _deselectAll();
}

function _onCanvasClick(event) {
    const container = document.getElementById('room-canvas');
    if (!container || transformControls.dragging) return;

    const rect = container.getBoundingClientRect();
    raycaster.setFromCamera({ x: ((event.clientX - rect.left) / rect.width)*2-1, y: -((event.clientY - rect.top)/rect.height)*2+1 }, camera);
    const hits = raycaster.intersectObjects(scene.children, true);

    for (const hit of hits) {
        let obj = hit.object;
        while (obj) {
            if (obj.name && placedItems.has(obj.name)) { _selectItem(obj.name); return; }
            obj = obj.parent;
        }
    }
    _deselectAll();
}

function _clearScene() {
    for (const [, entry] of placedItems) scene.remove(entry.mesh);
    placedItems.clear();
    _deselectAll();
}

async function _saveRoom() {
    if (!currentUserId) {
        const shouldLogin = window.confirm('You need to log in before saving a room template. Would you like to log in now?');
        if (shouldLogin) window.location.href = 'cus_login.html?redirect=room';
        else _showStatus('Log in to save this room template.', 'error');
        return;
    }
    const w = parseFloat(document.getElementById('room-width').value) || 10;
    const d = parseFloat(document.getElementById('room-depth').value) || 10;
    const roomName = document.getElementById('room-name').value.trim() || 'New Room';
    _showStatus('Saving…', 'info');

    try {
        let roomId = currentRoomId;
        if (roomId) {
            const { error } = await _supabase
                .from('room')
                .update({ room_name: roomName, width: w, depth: d })
                .eq('room_id', roomId);
            if (error) throw error;
        } else {
            roomId = `room_${Date.now()}`;
            const { error } = await _supabase
                .from('room')
                .insert({ room_id: roomId, user_id: currentUserId, room_name: roomName, width: w, depth: d });
            if (error) throw error;
            currentRoomId = roomId;
        }

        const { error: deleteError } = await _supabase.from('room_item').delete().eq('room_id', roomId);
        if (deleteError) throw deleteError;

        const inserts = [];
        for (const [, entry] of placedItems) {
            const ri_id = `ri_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            inserts.push({
                room_item_id: ri_id, room_id: roomId, structure_id: entry.structureId,
                position_x: entry.mesh.position.x, position_y: entry.mesh.position.y, position_z: entry.mesh.position.z,
                rotation_x: entry.mesh.rotation.x, rotation_y: entry.mesh.rotation.y, rotation_z: entry.mesh.rotation.z,
                scale_x: entry.mesh.scale.x, scale_y: entry.mesh.scale.y, scale_z: entry.mesh.scale.z
            });
            entry.roomItemId = ri_id;
        }

        if (inserts.length) {
            const { error: insertError } = await _supabase.from('room_item').insert(inserts);
            if (insertError) throw insertError;
        }

        _showStatus('Room saved!', 'success');
        await _loadSavedRooms();
    } catch (error) {
        console.error('Failed to save room:', error);
        _showStatus(`Unable to save room: ${error.message || 'please try again.'}`, 'error');
    }
}

async function _loadSavedRooms() {
    const sel = document.getElementById('room-select');
    if (!sel || !currentUserId) return;
    const { data, error } = await _supabase.from('room').select('room_id, room_name').eq('user_id', currentUserId).order('update_at', { ascending: false });
    if (error) {
        console.error('Failed to load saved rooms:', error);
        _showStatus('Unable to load saved rooms.', 'error');
        return;
    }
    while (sel.options.length > 1) sel.remove(1);
    (data ?? []).forEach(r => {
        const opt = document.createElement('option'); opt.value = r.room_id; opt.textContent = r.room_name; sel.appendChild(opt);
    });
}

async function _loadRoom(roomId) {
    _showStatus('Loading room…', 'info');
    _clearScene();
    const { data: room, error: roomError } = await _supabase.from('room').select('*').eq('room_id', roomId).single();
    if (roomError || !room) {
        console.error('Failed to load room:', roomError);
        _showStatus('Unable to load this room.', 'error');
        return;
    }

    currentRoomId = roomId;
    document.getElementById('room-name').value = room.room_name;
    document.getElementById('room-width').value = room.width;
    document.getElementById('room-depth').value = room.depth;
    _updateFloor(room.width, room.depth);
    _resetCamera(); 

    const { data: items, error: itemsError } = await _supabase.from('room_item').select('*, structure(structure_id, model_url)').eq('room_id', roomId);
    if (itemsError) {
        console.error('Failed to load room items:', itemsError);
        _showStatus('Room details could not be loaded.', 'error');
        return;
    }
    if (!items?.length) return _showStatus('Room loaded (empty).', 'success');

    for (const item of items) {
        if (item.structure?.model_url) {
            _addFurnitureToRoom(
                item.structure.model_url, item.structure_id, 
                new THREE.Vector3(item.position_x, item.position_y, item.position_z),
                new THREE.Euler(item.rotation_x, item.rotation_y, item.rotation_z),
                new THREE.Vector3(item.scale_x, item.scale_y, item.scale_z)
            );
        }
    }
}

async function _handleAddToCart() {
    if (!currentUserId) return _showStatus('Please Login First.', 'error');
    if (!placedItems.size) return _showStatus('No furniture in the room.', 'error');

    _showStatus('Checking Cart...', 'info');

    let { data: cartData, error: cartErr } = await _supabase
        .from('cart')
        .select('cart_id')
        .eq('user_id', currentUserId)
        .maybeSingle();

    let cartId = cartData?.cart_id;

    if (!cartId) {
        cartId = `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const { error: createErr } = await _supabase.from('cart').insert({ 
            cart_id: cartId, 
            user_id: currentUserId 
        });
        if (createErr) {
            console.error("Fail to create new cart:", createErr);
            return _showStatus('Failed to create new cart.', 'error');
        }
    }

    const inserts = [];
    for (const [, entry] of placedItems) {
        inserts.push({
            cart_item_id: `ci_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            cart_id: cartId,
            structure_id: entry.structureId,
            quantity: 1
        });
    }

    const { error: insertErr } = await _supabase.from('cart_item').insert(inserts);
    if (insertErr) {
        console.error("Fail to insert cart:", insertErr);
        return _showStatus('Cart Error: ' + insertErr.message, 'error');
    }

    document.dispatchEvent(new Event('cart-updated'));
    _showStatus(`✓ ${inserts.length} item(s) added to cart!`, 'success');
}

function _showStatus(msg, type = 'info') {
    const el = document.getElementById('room-status');
    if (!el) return;
    el.textContent = msg; el.style.color = { info: '#1d4ed8', success: '#15803d', error: '#b91c1c' }[type]; el.style.display = 'block';
    clearTimeout(el._timeout); el._timeout = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function _animate() {
    if (!renderer || !scene || !camera || !renderer.domElement.isConnected) {
        animationFrameId = null;
        return;
    }
    animationFrameId = requestAnimationFrame(_animate);
    orbitControls?.update();
    renderer.render(scene, camera);
}
