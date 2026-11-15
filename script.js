const canvas = document.getElementById('editorCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');
const resInput = document.getElementById('resistorInput');

let width, height;
let camera = { x: 0, y: 0, zoom: 1 };
let interactionMode = 'move'; 

function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    width = rect.width;
    height = rect.height;const canvas = document.getElementById('editorCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');
const resInput = document.getElementById('resistorInput');

let width, height;
let camera = { x: 0, y: 0, zoom: 1 };
let interactionMode = 'move'; 

function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    draw();
}
window.addEventListener('resize', resizeCanvas);

const resizeObserver = new ResizeObserver(() => { resizeCanvas(); });
resizeObserver.observe(container);

document.getElementById('toggleSidebar').onclick = () => {
    document.body.classList.toggle('sidebar-collapsed');
    document.getElementById('toggleSidebar').textContent = document.body.classList.contains('sidebar-collapsed') ? '▶' : '◀';
    setTimeout(resizeCanvas, 310);
};

const btnMove = document.getElementById('modeMove');
const btnDraw = document.getElementById('modeDraw');
const btnDelete = document.getElementById('modeDelete');

function updateModeButtons() {
    btnMove.classList.remove('active');
    btnDraw.classList.remove('active');
    btnDelete.classList.remove('active');

    if (interactionMode === 'move') btnMove.classList.add('active');
    else if (interactionMode === 'draw') btnDraw.classList.add('active');
    else if (interactionMode === 'delete') btnDelete.classList.add('active');
}

btnMove.onclick = () => { interactionMode = 'move'; updateModeButtons(); };
btnDraw.onclick = () => { interactionMode = 'draw'; updateModeButtons(); };
btnDelete.onclick = () => { interactionMode = 'delete'; updateModeButtons(); };

document.querySelectorAll('.section-title').forEach(title => {
    title.onclick = () => {
        const content = title.nextElementSibling;
        const icon = title.querySelector('.toggle-icon');
        if(!content || !icon) return;
        content.classList.toggle('collapsed');
        icon.style.transform = content.classList.contains('collapsed') ? 'rotate(-90deg)' : 'rotate(0)';
    };
});

let components = [], wires = [], nextId = 1;
let selectedPin = null, currentWirePoints = [], mouseX = 0, mouseY = 0;
let editingComp = null, draggedBend = null;
let selectedComponents = [], isDraggingSelection = false;
let dragStartX = 0, dragStartY = 0, compStartPositions = [];
let isPanning = false, panStartX = 0, panStartY = 0;
let currentWireColor = '#4a7c59'; 
let editingNote = null;
let cursorBlink = true;

let historyStack = [];
let clipboard = null;

function saveHistory() {
    historyStack.push(JSON.stringify({ components, wires, nextId }));
    if (historyStack.length > 50) historyStack.shift();
}

setInterval(() => { if(editingNote) { cursorBlink = !cursorBlink; draw(); } }, 500);

const WIRE_COLORS = ['#4a7c59', '#b33a3a', '#3a5ba0', '#c9a227', '#b86b25', '#d1d1d1', '#333333', '#777777'];
const paletteContainer = document.getElementById('colorPalette');
paletteContainer.innerHTML = '';
paletteContainer.style.pointerEvents = 'auto';

WIRE_COLORS.forEach((hex, index) => {
    const dot = document.createElement('div');
    dot.className = 'color-dot' + (index === 0 ? ' active' : '');
    dot.style.backgroundColor = hex;
    
    dot.onmousedown = (e) => { e.stopPropagation(); e.preventDefault(); };
    dot.onclick = function(e) {
        e.stopPropagation(); e.preventDefault();
        currentWireColor = hex;
        const dots = paletteContainer.children;
        for (let i = 0; i < dots.length; i++) dots[i].classList.remove('active');
        dot.classList.add('active');
    };
    paletteContainer.appendChild(dot);
});

document.getElementById('sidebar').onmousedown = (e) => { e.stopPropagation(); };
document.getElementById('sidebar').onclick = (e) => { e.stopPropagation(); };

const getCompById = (id) => components.find(c => c.id === id);
const screenToWorld = (x, y) => ({ x: (x - camera.x) / camera.zoom, y: (y - camera.y) / camera.zoom });

const getMousePos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const offsetX = document.body.classList.contains('sidebar-collapsed') ? 0 : 260;
    return { x: e.clientX - offsetX, y: e.clientY };
};

function getPinPos(id, pi) {
    const comp = getCompById(id);
    if (!comp) return { x: 0, y: 0 };
    return { x: comp.x + comp.pins[pi].x, y: comp.y + comp.pins[pi].y };
}

function drawWirePath(points, color, isDashed = false) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = color; ctx.shadowBlur = 4;
    if (isDashed) ctx.setLineDash([5, 5]); else ctx.setLineDash([]);
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    ctx.setLineDash([]); ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    points.forEach((p, i) => { if (i > 0 && i < points.length - 1) { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill(); } });
}

function draw() {
    ctx.clearRect(0, 0, width, height);
    const isLight = document.body.classList.contains('light-theme');
    
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    ctx.strokeStyle = isLight ? '#e0e0e0' : '#222';
    ctx.lineWidth = 1 / camera.zoom; 
    const sx = Math.floor(-camera.x / camera.zoom / 20) * 20;
    const sy = Math.floor(-camera.y / camera.zoom / 20) * 20;
    const ex = sx + width / camera.zoom + 40;
    const ey = sy + height / camera.zoom + 40;
    for (let i = sx; i < ex; i += 20) { ctx.beginPath(); ctx.moveTo(i, sy); ctx.lineTo(i, ey); ctx.stroke(); }
    for (let i = sy; i < ey; i += 20) { ctx.beginPath(); ctx.moveTo(sx, i); ctx.lineTo(ex, i); ctx.stroke(); }

    wires.forEach(w => drawWirePath([getPinPos(w.c1, w.p1), ...w.bends, getPinPos(w.c2, w.p2)], w.color));

    components.forEach(comp => {
        ctx.shadowColor = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;

        let compColor = comp.color;
        if (isLight && comp.type === 'arduino') compColor = '#2d7bb5';

        if (editingNote === comp) {
            ctx.strokeStyle = '#00BCD4';
            ctx.lineWidth = 3;
        } else if (selectedComponents.includes(comp.id)) {
            ctx.strokeStyle = '#00BCD4';
            ctx.lineWidth = 3;
        } else {
            ctx.strokeStyle = comp.border;
            ctx.lineWidth = 1.5;
        }

        ctx.fillStyle = compColor;
        ctx.beginPath();
        
        if (comp.type === 'junction') {
            ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4);
            ctx.fill(); ctx.stroke();
        }
        else if (comp.type === 'powerBus') {
            ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4); ctx.fill(); ctx.stroke();
            ctx.fillStyle = comp.isVcc ? '#ff8a80' : '#8bc34a'; 
            ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
            ctx.fillText(comp.voltage, comp.x + comp.w/2, comp.y + comp.h/2 + 4);
        } 
        else if (comp.type === 'transistor_pnp' || comp.type === 'transistor_npn') {
            ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4); ctx.fill(); ctx.stroke();
            ctx.fillStyle = comp.type === 'transistor_pnp' ? '#ff8a80' : '#8ab4f8'; 
            ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(comp.label, comp.x + comp.w/2, comp.y + comp.h/2 + 5);
        } 
        else if (comp.type === 'cap_ceramic') {
            ctx.fillStyle = '#d6a25b'; ctx.fillRect(comp.x, comp.y, comp.w, comp.h);
            ctx.strokeStyle = '#fff'; ctx.strokeRect(comp.x, comp.y, comp.w, comp.h);
            ctx.fillStyle = '#000'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
            ctx.fillText(comp.value, comp.x + comp.w/2, comp.y + comp.h/2 + 4);
        }
        else if (comp.type === 'cap_electrolytic') {
            ctx.fillStyle = '#2c3e50'; ctx.fillRect(comp.x, comp.y, comp.w, comp.h);
            ctx.fillStyle = '#fff'; ctx.fillRect(comp.x + comp.w - 10, comp.y, 10, comp.h);
            ctx.fillStyle = '#000'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
            ctx.fillText(comp.value, comp.x + comp.w/2 - 5, comp.y + comp.h/2 + 4);
            ctx.fillStyle = '#ff4d4d'; ctx.fillText('+', comp.x + 5, comp.y + 10);
        }
        else if (comp.type === 'button_4pin') {
            ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2;
            ctx.moveTo(comp.x + 15, comp.y + 10); ctx.lineTo(comp.x + comp.w - 15, comp.y + comp.h - 10);
            ctx.moveTo(comp.x + comp.w - 15, comp.y + 10); ctx.lineTo(comp.x + 15, comp.y + comp.h - 10);
            ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(comp.label || 'BTN', comp.x + comp.w/2, comp.y + comp.h/2 + 3);
        }
        else if (comp.type === 'button') {
            ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(comp.label || 'BTN', comp.x + comp.w/2, comp.y + comp.h/2 + 3);
        }
        else if (comp.type === 'speaker') {
            ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('SPEAKER', comp.x + comp.w/2, comp.y + comp.h/2 + 4);
        }
        else if (comp.type === 'note') {
            ctx.fillStyle = comp.color; ctx.fillRect(comp.x, comp.y, comp.w, comp.h);
            ctx.strokeStyle = comp.border; ctx.stroke();
            
            ctx.fillStyle = '#000'; 
            ctx.font = `${comp.fontSize}px sans-serif`; 
            ctx.textAlign = 'left';
            const lines = comp.text.split('\n');
            lines.forEach((line, i) => {
                ctx.fillText(line, comp.x + 10, comp.y + 10 + comp.fontSize + i * (comp.fontSize + 4));
            });

            if (editingNote === comp && cursorBlink) {
                let lastLine = lines[lines.length - 1];
                let lastY = comp.y + 10 + comp.fontSize + (lines.length - 1) * (comp.fontSize + 4);
                let textWidth = ctx.measureText(lastLine).width;
                ctx.fillStyle = '#000';
                ctx.fillRect(comp.x + 10 + textWidth + 2, lastY - comp.fontSize + 2, 2, comp.fontSize);
            }

            // Маркер изменения размера
            ctx.fillStyle = '#fbc02d'; ctx.beginPath();
            ctx.moveTo(comp.x + comp.w, comp.y + comp.h); ctx.lineTo(comp.x + comp.w - 12, comp.y + comp.h); ctx.lineTo(comp.x + comp.w, comp.y + comp.h - 12); ctx.fill();
        } 
        else if (comp.type === 'led') {
            ctx.arc(comp.x + comp.w/2, comp.y + comp.h/2, comp.w/2, 0, Math.PI*2);
            ctx.shadowColor = comp.ledColor; ctx.shadowBlur = 15;
            ctx.fillStyle = comp.ledColor; ctx.fill(); ctx.fillStyle = compColor; ctx.stroke();
        } 
        else if (comp.type === 'jumper') {
            ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.strokeStyle = comp.color;
            ctx.moveTo(comp.x, comp.y + 5); ctx.lineTo(comp.x + comp.w, comp.y + 5); ctx.stroke();
            ctx.fillStyle = '#e6c229';
            ctx.beginPath(); ctx.arc(comp.x, comp.y + 5, 6, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(comp.x + comp.w, comp.y + 5, 6, 0, Math.PI*2); ctx.fill();
        } 
        else {
            ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 6); ctx.fill(); ctx.stroke();
        }
        
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

        if (comp.type === 'arduino') {
            ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(comp.label, comp.x + comp.w/2, comp.y + 25);
        } else if (comp.type === 'display') {
            drawDisplaySegments(comp, ctx);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(comp.label, comp.x + comp.w/2, comp.y + 20);
        } else if (comp.type === 'resistor') {
            ctx.fillStyle = '#000'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
            ctx.fillText(comp.value, comp.x + comp.w/2, comp.y + 21);
        }

        comp.pins.forEach((pin, pi) => {
            let px = comp.x + pin.x, py = comp.y + pin.y;
            if (comp.type !== 'jumper' && comp.type !== 'led') {
                ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI*2);
                if (selectedPin && selectedPin.id === comp.id && selectedPin.pi === pi) ctx.fillStyle = '#ffeb3b';
                else if (comp.type === 'powerBus') ctx.fillStyle = comp.isVcc ? '#ff4d4d' : '#4CAF50';
                else if (comp.type === 'junction') ctx.fillStyle = '#ffd700';
                else ctx.fillStyle = '#e6c229';
                ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
            }
            
            if (pin.name && comp.type !== 'powerBus') {
                ctx.fillStyle = isLight ? '#333' : '#ddd'; ctx.font = 'bold 11px monospace';
                let tx = px, ty = py - 8;
                
                if (comp.type === 'arduino') {
                    if (pin.side === 'left') { tx = px + 15; ty = py + 3; } 
                    if (pin.side === 'right') { tx = px - 15; ty = py + 3; }
                    ctx.textAlign = pin.side === 'left' ? 'left' : 'right';
                } else {
                    if (pin.side === 'right') { tx = px + 12; ty = py + 3; ctx.textAlign = 'left'; }
                    if (pin.side === 'left') { tx = px - 12; ty = py + 3; ctx.textAlign = 'right'; }
                    if (pin.side === 'top') { tx = px; ty = py - 8; ctx.textAlign = 'center'; }
                    if (pin.side === 'bottom') { tx = px; ty = py + 14; ctx.textAlign = 'center'; }
                }
                ctx.fillText(pin.name, tx, ty);
            }
        });
    });
    
    if (selectedPin) {
        drawWirePath([getPinPos(selectedPin.id, selectedPin.pi), ...currentWirePoints, screenToWorld(mouseX, mouseY)], '#ffeb3b', true);
    }
    ctx.restore(); 
}

function openEditor(comp) {
    editingComp = comp;
    let sx = comp.x * camera.zoom + camera.x;
    let sy = comp.y * camera.zoom + camera.y;
    
    resInput.style.display = 'block';
    resInput.style.left = (sx + (comp.w * camera.zoom)/2 - 35) + 'px';
    resInput.style.top = (sy - 40) + 'px';
    
    if (comp.value !== undefined) resInput.value = comp.value;
    else if (comp.voltage !== undefined) resInput.value = comp.voltage;
    else if (comp.label !== undefined) resInput.value = comp.label;
    
    resInput.focus(); resInput.select();
}
function closeEditor() {
    if (editingComp) {
        if (editingComp.type === 'resistor' || editingComp.type === 'cap_ceramic' || editingComp.type === 'cap_electrolytic') editingComp.value = resInput.value || '220';
        if (editingComp.type === 'powerBus') editingComp.voltage = resInput.value || (editingComp.isVcc ? '+5V' : 'GND'); 
        if (editingComp.type === 'button' || editingComp.type === 'button_4pin') editingComp.label = resInput.value || 'BTN';
        editingComp = null;
    }
    resInput.style.display = 'none'; draw();
}
resInput.addEventListener('blur', closeEditor);
resInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') closeEditor();
    if (e.key === 'Escape') { resInput.style.display = 'none'; editingComp = null; draw(); }
});

document.addEventListener('keydown', (e) => {
    if (resInput.style.display === 'block') return; 

    if (editingNote) {
        if (e.key === 'Escape') {
            editingNote = null; cursorBlink = false; draw(); return;
        }
        if (e.key === 'Backspace') {
            editingNote.text = editingNote.text.slice(0, -1);
            draw(); e.preventDefault(); return;
        }
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                editingNote.text += '\n';
                draw(); e.preventDefault(); return;
            } else {
                editingNote = null; cursorBlink = false; draw(); return;
            }
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            editingNote.text += e.key;
            draw(); e.preventDefault();
        }
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (historyStack.length > 0) {
            const prevState = JSON.parse(historyStack.pop());
            components = prevState.components; wires = prevState.wires; nextId = prevState.nextId;
            selectedComponents = []; draw();
        }
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC' && selectedComponents.length > 0) {
        e.preventDefault();
        const compsToCopy = components.filter(c => selectedComponents.includes(c.id));
        const ids = compsToCopy.map(c => c.id);
        const wiresToCopy = wires.filter(w => ids.includes(w.c1) && ids.includes(w.c2));
        clipboard = { comps: JSON.parse(JSON.stringify(compsToCopy)), wires: JSON.parse(JSON.stringify(wiresToCopy)) };
    }

    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV' && clipboard) {
        e.preventDefault();
        saveHistory();
        const newIdMap = {}; let offset = 20;

        clipboard.comps.forEach(c => {
            const oldId = c.id;
            const newComp = JSON.parse(JSON.stringify(c));
            newComp.id = nextId++;
            newComp.x += offset; newComp.y += offset;
            components.push(newComp);
            newIdMap[oldId] = newComp.id;
        });

        clipboard.wires.forEach(w => {
            wires.push({
                c1: newIdMap[w.c1], p1: w.p1, c2: newIdMap[w.c2], p2: w.p2,
                bends: w.bends.map(b => ({ x: b.x + offset, y: b.y + offset })),
                color: w.color
            });
        });

        selectedComponents = Object.values(newIdMap);
        draw();
    }

    if (e.key === 'Escape') { selectedPin = null; currentWirePoints = []; draw(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedComponents.length > 0) {
        saveHistory();
        components = components.filter(c => !selectedComponents.includes(c.id));
        wires = wires.filter(w => !selectedComponents.includes(w.c1) && !selectedComponents.includes(w.c2));
        selectedComponents = []; draw();
    }
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    let ms = getMousePos(e); let mw = screenToWorld(ms.x, ms.y);
    camera.zoom = Math.max(0.1, Math.min(camera.zoom * (1 + delta), 5)); 
    let nmw = screenToWorld(ms.x, ms.y);
    camera.x += (nmw.x - mw.x) * camera.zoom; camera.y += (nmw.y - mw.y) * camera.zoom;
    draw();
}, { passive: false });

canvas.addEventListener('mousedown', (e) => {
    let sp = getMousePos(e); let wp = screenToWorld(sp.x, sp.y);
    if (resInput.style.display === 'block') { closeEditor(); return; }
    if (editingNote) { editingNote = null; cursorBlink = false; draw(); return; }

    if (e.button === 1 || e.button === 2) { isPanning = true; panStartX = sp.x - camera.x; panStartY = sp.y - camera.y; return; }
    if (e.button !== 0) return; 

    // РЕЖИМ УДАЛЕНИЯ
    if (interactionMode === 'delete') {
        for (let wi = wires.length - 1; wi >= 0; wi--) {
            let w = wires[wi];
            let fullPath = [getPinPos(w.c1, w.p1), ...w.bends, getPinPos(w.c2, w.p2)];
            for (let j = 0; j < fullPath.length - 1; j++) {
                let p1 = fullPath[j], p2 = fullPath[j+1];
                let A = wp.x - p1.x, B = wp.y - p1.y, C = p2.x - p1.x, D = p2.y - p1.y;
                let param = (A*C + B*D) / (C*C + D*D || 1);
                let xx = param < 0 ? p1.x : (param > 1 ? p2.x : p1.x + param * C);
                let yy = param < 0 ? p1.y : (param > 1 ? p2.y : p1.y + param * D);
                if (Math.hypot(wp.x - xx, wp.y - yy) < 10) { 
                    saveHistory(); wires.splice(wi, 1); draw(); return; 
                }
            }
        }
        for (let ci = components.length - 1; ci >= 0; ci--) {
            let comp = components[ci];
            if (wp.x > comp.x && wp.x < comp.x + comp.w && wp.y > comp.y && wp.y < comp.y + comp.h) {
                saveHistory();
                components.splice(ci, 1);
                wires = wires.filter(w => w.c1 !== comp.id && w.c2 !== comp.id);
                selectedComponents = [];
                draw(); return;
            }
        }
        return;
    }

    // РЕЖИМ ТРАССИРОВКИ
    if (interactionMode === 'draw') {
        if (e.detail === 2) {
            for (let ci = components.length - 1; ci >= 0; ci--) {
                let comp = components[ci];
                if (comp.type === 'note' && wp.x > comp.x && wp.x < comp.x + comp.w && wp.y > comp.y && wp.y < comp.y + comp.h) {
                    editingNote = comp; cursorBlink = true; draw(); return;
                }
            }
        }

        for (let wi = 0; wi < wires.length; wi++) {
            let w = wires[wi];
            for (let bi = 0; bi < w.bends.length; bi++) {
                if (Math.hypot(w.bends[bi].x - wp.x, w.bends[bi].y - wp.y) < 10 / camera.zoom) { 
                    draggedBend = { wi, bi }; 
                    return; 
                }
            }
        }
        for (let ci = 0; ci < components.length; ci++) {
            let comp = components[ci];
            for (let pi = 0; pi < comp.pins.length; pi++) {
                let pin = comp.pins[pi];
                if (Math.hypot((comp.x + pin.x) - wp.x, (comp.y + pin.y) - wp.y) < 12) {
                    if (selectedPin) {
                        if (selectedPin.id !== comp.id || selectedPin.pi !== pi) {
                            let finalColor = currentWireColor;
                            saveHistory();
                            wires.push({ c1: selectedPin.id, p1: selectedPin.pi, c2: comp.id, p2: pi, bends: [...currentWirePoints], color: finalColor });
                        }
                        selectedPin = null; currentWirePoints = [];
                    } else { selectedPin = { id: comp.id, pi: pi }; currentWirePoints = []; }
                    draw(); return;
                }
            }
        }
        if (selectedPin) { currentWirePoints.push(wp); draw(); return; }
    }

    // РЕЖИМ РЕДАКТОРА
    let clickedComp = null;
    for (let ci = components.length - 1; ci >= 0; ci--) {
        let comp = components[ci];
        if (wp.x > comp.x && wp.x < comp.x + comp.w && wp.y > comp.y && wp.y < comp.y + comp.h) { clickedComp = comp; break; }
    }
    if (clickedComp) {
        // Если это записка и кликнули в правый нижний угол - начинаем ресайз
        if (clickedComp.type === 'note' && wp.x > clickedComp.x + clickedComp.w - 15 && wp.x < clickedComp.x + clickedComp.w + 5 && wp.y > clickedComp.y + clickedComp.h - 15 && wp.y < clickedComp.y + clickedComp.h + 5) {
            isDraggingSelection = 'resize-note'; draggedBend = clickedComp; dragStartX = wp.x; dragStartY = wp.y; return;
        }

        if (e.shiftKey) {
            let idx = selectedComponents.indexOf(clickedComp.id);
            if (idx > -1) selectedComponents.splice(idx, 1); else selectedComponents.push(clickedComp.id);
            draw(); return;
        } 
        if (!selectedComponents.includes(clickedComp.id)) selectedComponents = [clickedComp.id]; 
        saveHistory();
        isDraggingSelection = true; dragStartX = wp.x; dragStartY = wp.y;
        compStartPositions = selectedComponents.map(id => { let c = getCompById(id); return { id: c.id, x: c.x, y: c.y }; });
        selectedComponents.forEach(id => { let c = getCompById(id); components.splice(components.indexOf(c), 1); components.push(c); });
        draw(); return;
    }

    if (!e.shiftKey) { selectedComponents = []; draw(); }
});

canvas.addEventListener('mousemove', (e) => {
    let sp = getMousePos(e); let wp = screenToWorld(sp.x, sp.y);
    mouseX = sp.x; mouseY = sp.y;

    if (isPanning) { camera.x = sp.x - panStartX; camera.y = sp.y - panStartY; draw(); return; }
    
    if (isDraggingSelection === 'resize-note') {
        let comp = draggedBend;
        comp.w = Math.max(100, wp.x - comp.x); comp.h = Math.max(50, wp.y - comp.y); draw(); return;
    }
    if (draggedBend) {
        wires[draggedBend.wi].bends[draggedBend.bi].x = wp.x; wires[draggedBend.wi].bends[draggedBend.bi].y = wp.y; draw(); return;
    }
    if (isDraggingSelection === true) {
        let dx = wp.x - dragStartX; let dy = wp.y - dragStartY;
        compStartPositions.forEach(start => { let comp = getCompById(start.id); if (comp) { comp.x = start.x + dx; comp.y = start.y + dy; } });
        draw();
    } else if (selectedPin) draw(); 
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 1 || e.button === 2) { isPanning = false; return; }
    if (e.button !== 0) return;
    
    if (isDraggingSelection === 'resize-note') { isDraggingSelection = false; draggedBend = null; draw(); return; }
    if (draggedBend) { draggedBend = null; draw(); return; }
    
    if (isDraggingSelection === true && compStartPositions.length === 1) {
        let comp = getCompById(compStartPositions[0].id);
        let wp = screenToWorld(...Object.values(getMousePos(e)));
        let dist = Math.hypot(wp.x - dragStartX, wp.y - dragStartY);
        if (dist < 5 && (comp.type === 'resistor' || comp.type === 'cap_ceramic' || comp.type === 'cap_electrolytic' || comp.type === 'powerBus' || comp.type === 'button' || comp.type === 'button_4pin')) openEditor(comp);
    }
    isDraggingSelection = false; compStartPositions = []; draw();
});

document.querySelectorAll('.btn-add').forEach(btn => {
    btn.onclick = () => {
        const type = btn.getAttribute('data-type');
        let center = screenToWorld(width/2, height/2);
        saveHistory();
        const newComp = COMPONENTS_FACTORY[type](center.x, center.y);
        components.push(newComp); selectedComponents = [newComp.id]; draw();
    };
});

document.getElementById('btnAddVcc').onclick = () => {
    let center = screenToWorld(width/2, height/2);
    saveHistory();
    const newComp = COMPONENTS_FACTORY.powerBus(center.x, center.y, 'vcc');
    components.push(newComp); selectedComponents = [newComp.id]; draw();
};
document.getElementById('btnAddGnd').onclick = () => {
    let center = screenToWorld(width/2, height/2);
    saveHistory();
    const newComp = COMPONENTS_FACTORY.powerBus(center.x, center.y, 'gnd');
    components.push(newComp); selectedComponents = [newComp.id]; draw();
};
document.getElementById('btnAddJunction').onclick = () => {
    let center = screenToWorld(width/2, height/2);
    saveHistory();
    const newComp = COMPONENTS_FACTORY.junction(center.x, center.y);
    components.push(newComp); selectedComponents = [newComp.id]; draw();
};

document.getElementById('btnExport').onclick = () => {
    const blob = new Blob([JSON.stringify({ components, wires, nextId }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = '67cad.json'; a.click(); URL.revokeObjectURL(url);
};
document.getElementById('btnImport').onclick = () => document.getElementById('fileInput').click();
document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (data.components && data.wires) {
                saveHistory();
                components = data.components.map(c => {
                    if (c.type === 'arduino') { c.color = '#1e5a8a'; c.border = '#2d7bb5'; }
                    if (c.type === 'powerBus' && !c.isVcc) { c.color = '#1a3a1a'; c.border = '#4CAF50'; }
                    return c;
                });
                wires = data.wires; 
                nextId = data.nextId || components.length + 1;
                selectedComponents = []; draw(); alert('Схема загружена!');
            }
        } catch (err) { alert('Ошибка файла.'); }
    };
    reader.readAsText(file); e.target.value = '';
});
document.getElementById('btnSave').onclick = () => {
    const isLight = document.body.classList.contains('light-theme');
    const scale = 2; 
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width * scale; tempCanvas.height = canvas.height * scale;
    const tCtx = tempCanvas.getContext('2d');
    tCtx.scale(scale, scale);
    tCtx.fillStyle = isLight ? '#fafafa' : '#121212';
    tCtx.fillRect(0, 0, width, height);
    tCtx.drawImage(canvas, 0, 0, width, height);
    const link = document.createElement('a'); link.download = '67cad.png'; link.href = tempCanvas.toDataURL('image/png'); link.click();
};
document.getElementById('btnTheme').onclick = () => { document.body.classList.toggle('light-theme'); draw(); };
document.getElementById('btnClear').onclick = () => {
    if(confirm('Очистить всю схему?')) {
        saveHistory();
        components = []; wires = []; selectedPin = null; currentWirePoints = []; nextId = 1; selectedComponents = []; draw();
    }
};

resizeCanvas();
interactionMode = 'move';
updateModeButtons();
draw();
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    draw();
}
window.addEventListener('resize', resizeCanvas);

const resizeObserver = new ResizeObserver(() => { resizeCanvas(); });
resizeObserver.observe(container);

document.getElementById('toggleSidebar').onclick = () => {
    document.body.classList.toggle('sidebar-collapsed');
    document.getElementById('toggleSidebar').textContent = document.body.classList.contains('sidebar-collapsed') ? '▶' : '◀';
    setTimeout(resizeCanvas, 310);
};

const btnMove = document.getElementById('modeMove');
const btnDraw = document.getElementById('modeDraw');
const btnDelete = document.getElementById('modeDelete');

function updateModeButtons() {
    btnMove.classList.remove('active');
    btnDraw.classList.remove('active');
    btnDelete.classList.remove('active');

    if (interactionMode === 'move') btnMove.classList.add('active');
    else if (interactionMode === 'draw') btnDraw.classList.add('active');
    else if (interactionMode === 'delete') btnDelete.classList.add('active');
}

btnMove.onclick = () => { interactionMode = 'move'; updateModeButtons(); };
btnDraw.onclick = () => { interactionMode = 'draw'; updateModeButtons(); };
btnDelete.onclick = () => { interactionMode = 'delete'; updateModeButtons(); };

document.querySelectorAll('.section-title').forEach(title => {
    title.onclick = () => {
        const content = title.nextElementSibling;
        const icon = title.querySelector('.toggle-icon');
        if(!content || !icon) return;
        content.classList.toggle('collapsed');
        icon.style.transform = content.classList.contains('collapsed') ? 'rotate(-90deg)' : 'rotate(0)';
    };
});

let components = [], wires = [], nextId = 1;
let selectedPin = null, currentWirePoints = [], mouseX = 0, mouseY = 0;
let editingComp = null, draggedBend = null;
let selectedComponents = [], isDraggingSelection = false;
let dragStartX = 0, dragStartY = 0, compStartPositions = [];
let isPanning = false, panStartX = 0, panStartY = 0;
let currentWireColor = '#4a7c59'; 
let editingNote = null;
let cursorBlink = true;

let historyStack = [];
let clipboard = null;

function saveHistory() {
    historyStack.push(JSON.stringify({ components, wires, nextId }));
    if (historyStack.length > 50) historyStack.shift();
}

setInterval(() => { if(editingNote) { cursorBlink = !cursorBlink; draw(); } }, 500);

const WIRE_COLORS = ['#4a7c59', '#b33a3a', '#3a5ba0', '#c9a227', '#b86b25', '#d1d1d1', '#333333', '#777777'];
const paletteContainer = document.getElementById('colorPalette');
paletteContainer.innerHTML = '';
paletteContainer.style.pointerEvents = 'auto';

WIRE_COLORS.forEach((hex, index) => {
    const dot = document.createElement('div');
    dot.className = 'color-dot' + (index === 0 ? ' active' : '');
    dot.style.backgroundColor = hex;
    
    dot.onmousedown = (e) => { e.stopPropagation(); e.preventDefault(); };
    dot.onclick = function(e) {
        e.stopPropagation(); e.preventDefault();
        currentWireColor = hex;
        const dots = paletteContainer.children;
        for (let i = 0; i < dots.length; i++) dots[i].classList.remove('active');
        dot.classList.add('active');
    };
    paletteContainer.appendChild(dot);
});

document.getElementById('sidebar').onmousedown = (e) => { e.stopPropagation(); };
document.getElementById('sidebar').onclick = (e) => { e.stopPropagation(); };

const getCompById = (id) => components.find(c => c.id === id);
const screenToWorld = (x, y) => ({ x: (x - camera.x) / camera.zoom, y: (y - camera.y) / camera.zoom });

const getMousePos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const offsetX = document.body.classList.contains('sidebar-collapsed') ? 0 : 260;
    return { x: e.clientX - offsetX, y: e.clientY };
};

function getPinPos(id, pi) {
    const comp = getCompById(id);
    if (!comp) return { x: 0, y: 0 };
    return { x: comp.x + comp.pins[pi].x, y: comp.y + comp.pins[pi].y };
}

function drawWirePath(points, color, isDashed = false) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = color; ctx.shadowBlur = 4;
    if (isDashed) ctx.setLineDash([5, 5]); else ctx.setLineDash([]);
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    ctx.setLineDash([]); ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    points.forEach((p, i) => { if (i > 0 && i < points.length - 1) { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill(); } });
}

function draw() {
    ctx.clearRect(0, 0, width, height);
    const isLight = document.body.classList.contains('light-theme');
    
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    ctx.strokeStyle = isLight ? '#e0e0e0' : '#222';
    ctx.lineWidth = 1 / camera.zoom; 
    const sx = Math.floor(-camera.x / camera.zoom / 20) * 20;
    const sy = Math.floor(-camera.y / camera.zoom / 20) * 20;
    const ex = sx + width / camera.zoom + 40;
    const ey = sy + height / camera.zoom + 40;
    for (let i = sx; i < ex; i += 20) { ctx.beginPath(); ctx.moveTo(i, sy); ctx.lineTo(i, ey); ctx.stroke(); }
    for (let i = sy; i < ey; i += 20) { ctx.beginPath(); ctx.moveTo(sx, i); ctx.lineTo(ex, i); ctx.stroke(); }

    wires.forEach(w => drawWirePath([getPinPos(w.c1, w.p1), ...w.bends, getPinPos(w.c2, w.p2)], w.color));

    components.forEach(comp => {
        ctx.shadowColor = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;

        let compColor = comp.color;
        if (isLight && comp.type === 'arduino') compColor = '#2d7bb5';

        ctx.strokeStyle = selectedComponents.includes(comp.id) ? '#00BCD4' : comp.border;
        ctx.lineWidth = selectedComponents.includes(comp.id) ? 3 : 1.5;
        ctx.fillStyle = compColor;
        ctx.beginPath();
        
        if (comp.type === 'junction') {
            ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4);
            ctx.fill(); ctx.stroke();
        }
        else if (comp.type === 'powerBus') {
            ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4); ctx.fill(); ctx.stroke();
            ctx.fillStyle = comp.isVcc ? '#ff8a80' : '#8bc34a'; 
            ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
            ctx.fillText(comp.voltage, comp.x + comp.w/2, comp.y + comp.h/2 + 4);
        } 
        else if (comp.type === 'transistor_pnp' || comp.type === 'transistor_npn') {
            ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4); ctx.fill(); ctx.stroke();
            ctx.fillStyle = comp.type === 'transistor_pnp' ? '#ff8a80' : '#8ab4f8'; 
            ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(comp.label, comp.x + comp.w/2, comp.y + comp.h/2 + 5);
        } 
        else if (comp.type === 'cap_ceramic') {
            ctx.fillStyle = '#d6a25b'; ctx.fillRect(comp.x, comp.y, comp.w, comp.h);
            ctx.strokeStyle = '#fff'; ctx.strokeRect(comp.x, comp.y, comp.w, comp.h);
            ctx.fillStyle = '#000'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
            ctx.fillText(comp.value, comp.x + comp.w/2, comp.y + comp.h/2 + 4);
        }
        else if (comp.type === 'cap_electrolytic') {
            ctx.fillStyle = '#2c3e50'; ctx.fillRect(comp.x, comp.y, comp.w, comp.h);
            ctx.fillStyle = '#fff'; ctx.fillRect(comp.x + comp.w - 10, comp.y, 10, comp.h);
            ctx.fillStyle = '#000'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
            ctx.fillText(comp.value, comp.x + comp.w/2 - 5, comp.y + comp.h/2 + 4);
            ctx.fillStyle = '#ff4d4d'; ctx.fillText('+', comp.x + 5, comp.y + 10);
        }
        else if (comp.type === 'button_4pin') {
            ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2;
            ctx.moveTo(comp.x + 15, comp.y + 10); ctx.lineTo(comp.x + comp.w - 15, comp.y + comp.h - 10);
            ctx.moveTo(comp.x + comp.w - 15, comp.y + 10); ctx.lineTo(comp.x + 15, comp.y + comp.h - 10);
            ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(comp.label || 'BTN', comp.x + comp.w/2, comp.y + comp.h/2 + 3);
        }
        else if (comp.type === 'button') {
            ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(comp.label || 'BTN', comp.x + comp.w/2, comp.y + comp.h/2 + 3);
        }
        else if (comp.type === 'speaker') {
            ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('SPEAKER', comp.x + comp.w/2, comp.y + comp.h/2 + 4);
        }
        else if (comp.type === 'note') {
            ctx.fillStyle = comp.color; ctx.fillRect(comp.x, comp.y, comp.w, comp.h);
            ctx.strokeStyle = comp.border; ctx.stroke();
            
            ctx.fillStyle = '#000'; 
            ctx.font = `${comp.fontSize}px sans-serif`; 
            ctx.textAlign = 'left';
            const lines = comp.text.split('\n');
            lines.forEach((line, i) => {
                ctx.fillText(line, comp.x + 10, comp.y + 10 + comp.fontSize + i * (comp.fontSize + 4));
            });

            if (editingNote === comp && cursorBlink) {
                let lastLine = lines[lines.length - 1];
                let lastY = comp.y + 10 + comp.fontSize + (lines.length - 1) * (comp.fontSize + 4);
                let textWidth = ctx.measureText(lastLine).width;
                ctx.fillStyle = '#000';
                ctx.fillRect(comp.x + 10 + textWidth + 2, lastY - comp.fontSize + 2, 2, comp.fontSize);
            }

            ctx.fillStyle = '#fbc02d'; ctx.beginPath();
            ctx.moveTo(comp.x + comp.w, comp.y + comp.h); ctx.lineTo(comp.x + comp.w - 12, comp.y + comp.h); ctx.lineTo(comp.x + comp.w, comp.y + comp.h - 12); ctx.fill();
        } 
        else if (comp.type === 'led') {
            ctx.arc(comp.x + comp.w/2, comp.y + comp.h/2, comp.w/2, 0, Math.PI*2);
            ctx.shadowColor = comp.ledColor; ctx.shadowBlur = 15;
            ctx.fillStyle = comp.ledColor; ctx.fill(); ctx.fillStyle = compColor; ctx.stroke();
        } 
        else if (comp.type === 'jumper') {
            ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.strokeStyle = comp.color;
            ctx.moveTo(comp.x, comp.y + 5); ctx.lineTo(comp.x + comp.w, comp.y + 5); ctx.stroke();
            ctx.fillStyle = '#e6c229';
            ctx.beginPath(); ctx.arc(comp.x, comp.y + 5, 6, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(comp.x + comp.w, comp.y + 5, 6, 0, Math.PI*2); ctx.fill();
        } 
        else {
            ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 6); ctx.fill(); ctx.stroke();
        }
        
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

        if (comp.type === 'arduino') {
            ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(comp.label, comp.x + comp.w/2, comp.y + 25);
        } else if (comp.type === 'display') {
            drawDisplaySegments(comp, ctx);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(comp.label, comp.x + comp.w/2, comp.y + 20);
        } else if (comp.type === 'resistor') {
            ctx.fillStyle = '#000'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
            ctx.fillText(comp.value, comp.x + comp.w/2, comp.y + 21);
        }

        comp.pins.forEach((pin, pi) => {
            let px = comp.x + pin.x, py = comp.y + pin.y;
            if (comp.type !== 'jumper' && comp.type !== 'led') {
                ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI*2);
                if (selectedPin && selectedPin.id === comp.id && selectedPin.pi === pi) ctx.fillStyle = '#ffeb3b';
                else if (comp.type === 'powerBus') ctx.fillStyle = comp.isVcc ? '#ff4d4d' : '#4CAF50';
                else if (comp.type === 'junction') ctx.fillStyle = '#ffd700';
                else ctx.fillStyle = '#e6c229';
                ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
            }
            
            if (pin.name && comp.type !== 'powerBus') {
                ctx.fillStyle = isLight ? '#333' : '#ddd'; ctx.font = 'bold 11px monospace';
                let tx = px, ty = py - 8;
                
                if (comp.type === 'arduino') {
                    if (pin.side === 'left') { tx = px + 15; ty = py + 3; } 
                    if (pin.side === 'right') { tx = px - 15; ty = py + 3; }
                    ctx.textAlign = pin.side === 'left' ? 'left' : 'right';
                } else {
                    if (pin.side === 'right') { tx = px + 12; ty = py + 3; ctx.textAlign = 'left'; }
                    if (pin.side === 'left') { tx = px - 12; ty = py + 3; ctx.textAlign = 'right'; }
                    if (pin.side === 'top') { tx = px; ty = py - 8; ctx.textAlign = 'center'; }
                    if (pin.side === 'bottom') { tx = px; ty = py + 14; ctx.textAlign = 'center'; }
                }
                ctx.fillText(pin.name, tx, ty);
            }
        });
    });
    
    if (selectedPin) {
        drawWirePath([getPinPos(selectedPin.id, selectedPin.pi), ...currentWirePoints, screenToWorld(mouseX, mouseY)], '#ffeb3b', true);
    }
    ctx.restore(); 
}

function openEditor(comp) {
    editingComp = comp;
    let sx = comp.x * camera.zoom + camera.x;
    let sy = comp.y * camera.zoom + camera.y;
    
    resInput.style.display = 'block';
    resInput.style.left = (sx + (comp.w * camera.zoom)/2 - 35) + 'px';
    resInput.style.top = (sy - 40) + 'px';
    
    if (comp.value !== undefined) resInput.value = comp.value;
    else if (comp.voltage !== undefined) resInput.value = comp.voltage;
    else if (comp.label !== undefined) resInput.value = comp.label;
    
    resInput.focus(); resInput.select();
}
function closeEditor() {
    if (editingComp) {
        if (editingComp.type === 'resistor' || editingComp.type === 'cap_ceramic' || editingComp.type === 'cap_electrolytic') editingComp.value = resInput.value || '220';
        if (editingComp.type === 'powerBus') editingComp.voltage = resInput.value || (editingComp.isVcc ? '+5V' : 'GND'); 
        if (editingComp.type === 'button' || editingComp.type === 'button_4pin') editingComp.label = resInput.value || 'BTN';
        editingComp = null;
    }
    resInput.style.display = 'none'; draw();
}
resInput.addEventListener('blur', closeEditor);
resInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') closeEditor();
    if (e.key === 'Escape') { resInput.style.display = 'none'; editingComp = null; draw(); }
});

document.addEventListener('keydown', (e) => {
    if (resInput.style.display === 'block' || editingNote) return; 

    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (historyStack.length > 0) {
            const prevState = JSON.parse(historyStack.pop());
            components = prevState.components; wires = prevState.wires; nextId = prevState.nextId;
            selectedComponents = []; draw();
        }
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC' && selectedComponents.length > 0) {
        e.preventDefault();
        const compsToCopy = components.filter(c => selectedComponents.includes(c.id));
        const ids = compsToCopy.map(c => c.id);
        const wiresToCopy = wires.filter(w => ids.includes(w.c1) && ids.includes(w.c2));
        clipboard = { comps: JSON.parse(JSON.stringify(compsToCopy)), wires: JSON.parse(JSON.stringify(wiresToCopy)) };
    }

    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV' && clipboard) {
        e.preventDefault();
        saveHistory();
        const newIdMap = {}; let offset = 20;

        clipboard.comps.forEach(c => {
            const oldId = c.id;
            const newComp = JSON.parse(JSON.stringify(c));
            newComp.id = nextId++;
            newComp.x += offset; newComp.y += offset;
            components.push(newComp);
            newIdMap[oldId] = newComp.id;
        });

        clipboard.wires.forEach(w => {
            wires.push({
                c1: newIdMap[w.c1], p1: w.p1, c2: newIdMap[w.c2], p2: w.p2,
                bends: w.bends.map(b => ({ x: b.x + offset, y: b.y + offset })),
                color: w.color
            });
        });

        selectedComponents = Object.values(newIdMap);
        draw();
    }

    if (e.key === 'Escape') { selectedPin = null; currentWirePoints = []; draw(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedComponents.length > 0) {
        saveHistory();
        components = components.filter(c => !selectedComponents.includes(c.id));
        wires = wires.filter(w => !selectedComponents.includes(w.c1) && !selectedComponents.includes(w.c2));
        selectedComponents = []; draw();
    }
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    let ms = getMousePos(e); let mw = screenToWorld(ms.x, ms.y);
    camera.zoom = Math.max(0.1, Math.min(camera.zoom * (1 + delta), 5)); 
    let nmw = screenToWorld(ms.x, ms.y);
    camera.x += (nmw.x - mw.x) * camera.zoom; camera.y += (nmw.y - mw.y) * camera.zoom;
    draw();
}, { passive: false });

canvas.addEventListener('mousedown', (e) => {
    let sp = getMousePos(e); let wp = screenToWorld(sp.x, sp.y);
    if (resInput.style.display === 'block') { closeEditor(); return; }
    if (editingNote) { editingNote = null; cursorBlink = false; draw(); return; }

    if (e.button === 1 || e.button === 2) { isPanning = true; panStartX = sp.x - camera.x; panStartY = sp.y - camera.y; return; }
    if (e.button !== 0) return; 

    if (interactionMode === 'delete') {
        for (let wi = wires.length - 1; wi >= 0; wi--) {
            let w = wires[wi];
            let fullPath = [getPinPos(w.c1, w.p1), ...w.bends, getPinPos(w.c2, w.p2)];
            for (let j = 0; j < fullPath.length - 1; j++) {
                let p1 = fullPath[j], p2 = fullPath[j+1];
                let A = wp.x - p1.x, B = wp.y - p1.y, C = p2.x - p1.x, D = p2.y - p1.y;
                let param = (A*C + B*D) / (C*C + D*D || 1);
                let xx = param < 0 ? p1.x : (param > 1 ? p2.x : p1.x + param * C);
                let yy = param < 0 ? p1.y : (param > 1 ? p2.y : p1.y + param * D);
                if (Math.hypot(wp.x - xx, wp.y - yy) < 10) { 
                    saveHistory(); wires.splice(wi, 1); draw(); return; 
                }
            }
        }
        for (let ci = components.length - 1; ci >= 0; ci--) {
            let comp = components[ci];
            if (wp.x > comp.x && wp.x < comp.x + comp.w && wp.y > comp.y && wp.y < comp.y + comp.h) {
                saveHistory();
                components.splice(ci, 1);
                wires = wires.filter(w => w.c1 !== comp.id && w.c2 !== comp.id);
                selectedComponents = [];
                draw(); return;
            }
        }
        return;
    }

    if (interactionMode === 'draw') {
        if (e.detail === 2) {
            for (let ci = components.length - 1; ci >= 0; ci--) {
                let comp = components[ci];
                if (comp.type === 'note' && wp.x > comp.x && wp.x < comp.x + comp.w && wp.y > comp.y && wp.y < comp.y + comp.h) {
                    editingNote = comp; cursorBlink = true; draw(); return;
                }
            }
        }

        for (let wi = 0; wi < wires.length; wi++) {
            let w = wires[wi];
            for (let bi = 0; bi < w.bends.length; bi++) {
                if (Math.hypot(w.bends[bi].x - wp.x, w.bends[bi].y - wp.y) < 10 / camera.zoom) { 
                    draggedBend = { wi, bi }; 
                    return; 
                }
            }
        }
        for (let ci = 0; ci < components.length; ci++) {
            let comp = components[ci];
            for (let pi = 0; pi < comp.pins.length; pi++) {
                let pin = comp.pins[pi];
                if (Math.hypot((comp.x + pin.x) - wp.x, (comp.y + pin.y) - wp.y) < 12) {
                    if (selectedPin) {
                        if (selectedPin.id !== comp.id || selectedPin.pi !== pi) {
                            let finalColor = currentWireColor;
                            saveHistory();
                            wires.push({ c1: selectedPin.id, p1: selectedPin.pi, c2: comp.id, p2: pi, bends: [...currentWirePoints], color: finalColor });
                        }
                        selectedPin = null; currentWirePoints = [];
                    } else { selectedPin = { id: comp.id, pi: pi }; currentWirePoints = []; }
                    draw(); return;
                }
            }
        }
        if (selectedPin) { currentWirePoints.push(wp); draw(); return; }
    }

    let clickedComp = null;
    for (let ci = components.length - 1; ci >= 0; ci--) {
        let comp = components[ci];
        if (wp.x > comp.x && wp.x < comp.x + comp.w && wp.y > comp.y && wp.y < comp.y + comp.h) { clickedComp = comp; break; }
    }
    if (clickedComp) {
        if (e.shiftKey) {
            let idx = selectedComponents.indexOf(clickedComp.id);
            if (idx > -1) selectedComponents.splice(idx, 1); else selectedComponents.push(clickedComp.id);
            draw(); return;
        } 
        if (!selectedComponents.includes(clickedComp.id)) selectedComponents = [clickedComp.id]; 
        saveHistory();
        isDraggingSelection = true; dragStartX = wp.x; dragStartY = wp.y;
        compStartPositions = selectedComponents.map(id => { let c = getCompById(id); return { id: c.id, x: c.x, y: c.y }; });
        selectedComponents.forEach(id => { let c = getCompById(id); components.splice(components.indexOf(c), 1); components.push(c); });
        draw(); return;
    }

    if (!e.shiftKey) { selectedComponents = []; draw(); }
});

canvas.addEventListener('mousemove', (e) => {
    let sp = getMousePos(e); let wp = screenToWorld(sp.x, sp.y);
    mouseX = sp.x; mouseY = sp.y;

    if (isPanning) { camera.x = sp.x - panStartX; camera.y = sp.y - panStartY; draw(); return; }
    
    if (isDraggingSelection === 'resize-note') {
        let comp = draggedBend;
        comp.w = Math.max(100, wp.x - comp.x); comp.h = Math.max(50, wp.y - comp.y); draw(); return;
    }
    if (draggedBend) {
        wires[draggedBend.wi].bends[draggedBend.bi].x = wp.x; wires[draggedBend.wi].bends[draggedBend.bi].y = wp.y; draw(); return;
    }
    if (isDraggingSelection === true) {
        let dx = wp.x - dragStartX; let dy = wp.y - dragStartY;
        compStartPositions.forEach(start => { let comp = getCompById(start.id); if (comp) { comp.x = start.x + dx; comp.y = start.y + dy; } });
        draw();
    } else if (selectedPin) draw(); 
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 1 || e.button === 2) { isPanning = false; return; }
    if (e.button !== 0) return;
    
    if (isDraggingSelection === 'resize-note') { isDraggingSelection = false; draggedBend = null; draw(); return; }
    if (draggedBend) { draggedBend = null; draw(); return; }
    
    if (isDraggingSelection === true && compStartPositions.length === 1) {
        let comp = getCompById(compStartPositions[0].id);
        let wp = screenToWorld(...Object.values(getMousePos(e)));
        let dist = Math.hypot(wp.x - dragStartX, wp.y - dragStartY);
        if (dist < 5 && (comp.type === 'resistor' || comp.type === 'cap_ceramic' || comp.type === 'cap_electrolytic' || comp.type === 'powerBus' || comp.type === 'button' || comp.type === 'button_4pin')) openEditor(comp);
    }
    isDraggingSelection = false; compStartPositions = []; draw();
});

document.querySelectorAll('.btn-add').forEach(btn => {
    btn.onclick = () => {
        const type = btn.getAttribute('data-type');
        let center = screenToWorld(width/2, height/2);
        saveHistory();
        const newComp = COMPONENTS_FACTORY[type](center.x, center.y);
        components.push(newComp); selectedComponents = [newComp.id]; draw();
    };
});

document.getElementById('btnAddVcc').onclick = () => {
    let center = screenToWorld(width/2, height/2);
    saveHistory();
    const newComp = COMPONENTS_FACTORY.powerBus(center.x, center.y, 'vcc');
    components.push(newComp); selectedComponents = [newComp.id]; draw();
};
document.getElementById('btnAddGnd').onclick = () => {
    let center = screenToWorld(width/2, height/2);
    saveHistory();
    const newComp = COMPONENTS_FACTORY.powerBus(center.x, center.y, 'gnd');
    components.push(newComp); selectedComponents = [newComp.id]; draw();
};
document.getElementById('btnAddJunction').onclick = () => {
    let center = screenToWorld(width/2, height/2);
    saveHistory();
    const newComp = COMPONENTS_FACTORY.junction(center.x, center.y);
    components.push(newComp); selectedComponents = [newComp.id]; draw();
};

document.getElementById('btnExport').onclick = () => {
    const blob = new Blob([JSON.stringify({ components, wires, nextId }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = '67cad.json'; a.click(); URL.revokeObjectURL(url);
};
document.getElementById('btnImport').onclick = () => document.getElementById('fileInput').click();
document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (data.components && data.wires) {
                saveHistory();
                components = data.components.map(c => {
                    if (c.type === 'arduino') { c.color = '#1e5a8a'; c.border = '#2d7bb5'; }
                    if (c.type === 'powerBus' && !c.isVcc) { c.color = '#1a3a1a'; c.border = '#4CAF50'; }
                    return c;
                });
                wires = data.wires; 
                nextId = data.nextId || components.length + 1;
                selectedComponents = []; draw(); alert('Схема загружена!');
            }
        } catch (err) { alert('Ошибка файла.'); }
    };
    reader.readAsText(file); e.target.value = '';
});
document.getElementById('btnSave').onclick = () => {
    const isLight = document.body.classList.contains('light-theme');
    const scale = 2; 
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width * scale; tempCanvas.height = canvas.height * scale;
    const tCtx = tempCanvas.getContext('2d');
    tCtx.scale(scale, scale);
    tCtx.fillStyle = isLight ? '#fafafa' : '#121212';
    tCtx.fillRect(0, 0, width, height);
    tCtx.drawImage(canvas, 0, 0, width, height);
    const link = document.createElement('a'); link.download = '67cad.png'; link.href = tempCanvas.toDataURL('image/png'); link.click();
};
document.getElementById('btnTheme').onclick = () => { document.body.classList.toggle('light-theme'); draw(); };
document.getElementById('btnClear').onclick = () => {
    if(confirm('Очистить всю схему?')) {
        saveHistory();
        components = []; wires = []; selectedPin = null; currentWirePoints = []; nextId = 1; selectedComponents = []; draw();
    }
};

resizeCanvas();
interactionMode = 'move';
updateModeButtons();
draw();
