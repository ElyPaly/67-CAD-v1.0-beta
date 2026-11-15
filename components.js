const COMPONENTS_FACTORY = {
    arduino: (x, y) => {
        let pins = [];
        ["", "5V", "RESET", "3.3V", "5V", "GND", "GND", "VIN", "", "A0", "A1", "A2", "A3", "A4", "A5"].forEach((n, i) => { if(n) pins.push({name: n, x: 0, y: 35 + i*24, side: 'left'}); });
        ["", "", "AREF", "GND", "D13", "D12", "D11", "D10", "D9", "D8", "D7", "D6", "D5", "D4", "D3", "D2", "D1", "D0"].forEach((n, i) => { if(n) pins.push({name: n, x: 200, y: 35 + i*24, side: 'right'}); });
        return { id: nextId++, type: 'arduino', x, y, w: 200, h: 520, pins, color: '#1e5a8a', border: '#2d7bb5', label: 'Arduino Uno R3' };
    },
    display: (x, y) => {
        let pins = [];
        ["D1","A","F","D2","D3","B"].forEach((n, i) => pins.push({name: n, x: 30 + i*30, y: 0, side: 'top'}));
        ["E","D","DP","C","G","D4"].forEach((n, i) => pins.push({name: n, x: 30 + i*30, y: 120, side: 'bottom'}));
        return { id: nextId++, type: 'display', x, y, w: 220, h: 120, pins, color: '#1a1a1a', border: '#555', label: '3461BS' };
    },
    resistor: (x, y) => ({ id: nextId++, type: 'resistor', x, y, w: 60, h: 30, pins: [{name: '1', x: -20, y: 15, side: 'left'}, {name: '2', x: 80, y: 15, side: 'right'}], color: '#e6c229', border: '#fff', value: '220' }),
    capacitor_ceramic: (x, y) => ({ id: nextId++, type: 'cap_ceramic', x, y, w: 40, h: 30, pins: [{name: '1', x: -15, y: 15, side: 'left'}, {name: '2', x: 55, y: 15, side: 'right'}], color: '#b86b25', border: '#fff', value: '100nF' }),
    capacitor_electrolytic: (x, y) => ({ id: nextId++, type: 'cap_electrolytic', x, y, w: 40, h: 50, pins: [{name: '+', x: -15, y: 10, side: 'left'}, {name: '-', x: 55, y: 40, side: 'right'}], color: '#3a5ba0', border: '#fff', value: '10uF' }),
    transistor_pnp: (x, y) => ({ id: nextId++, type: 'transistor_pnp', x, y, w: 50, h: 40, pins: [{name: 'E', x: 0, y: 40, side: 'bottom'}, {name: 'B', x: 25, y: 40, side: 'bottom'}, {name: 'C', x: 50, y: 40, side: 'bottom'}], color: '#2a2a2a', border: '#ff4d4d', label: 'PNP' }),
    transistor_npn: (x, y) => ({ id: nextId++, type: 'transistor_npn', x, y, w: 50, h: 40, pins: [{name: 'E', x: 0, y: 40, side: 'bottom'}, {name: 'B', x: 25, y: 40, side: 'bottom'}, {name: 'C', x: 50, y: 40, side: 'bottom'}], color: '#2a2a2a', border: '#4d79ff', label: 'NPN' }),
    
    // КНОПКИ С ИМЕНЕМ
    button: (x, y) => ({ id: nextId++, type: 'button', x, y, w: 50, h: 40, pins: [{name: '1', x: 25, y: 0, side: 'top'}, {name: '2', x: 25, y: 40, side: 'bottom'}], color: '#555', border: '#aaa', label: 'BTN' }),
    button_4pin: (x, y) => ({
        id: nextId++, type: 'button_4pin', x, y, w: 60, h: 40,
        pins: [{name: '1', x: 10, y: 0, side: 'top'}, {name: '2', x: 50, y: 0, side: 'top'}, {name: '3', x: 10, y: 40, side: 'bottom'}, {name: '4', x: 50, y: 40, side: 'bottom'}],
        color: '#444', border: '#888', label: 'BTN4'
    }),

    led_red: (x, y) => ({ id: nextId++, type: 'led', x, y, w: 30, h: 30, pins: [{name: 'A', x: 15, y: 0, side: 'top'}, {name: 'K', x: 15, y: 30, side: 'bottom'}], color: '#222', border: '#f44336', ledColor: '#f44336' }),
    led_yellow: (x, y) => ({ id: nextId++, type: 'led', x, y, w: 30, h: 30, pins: [{name: 'A', x: 15, y: 0, side: 'top'}, {name: 'K', x: 15, y: 30, side: 'bottom'}], color: '#222', border: '#FFEB3B', ledColor: '#FFEB3B' }),
    led_green: (x, y) => ({ id: nextId++, type: 'led', x, y, w: 30, h: 30, pins: [{name: 'A', x: 15, y: 0, side: 'top'}, {name: 'K', x: 15, y: 30, side: 'bottom'}], color: '#222', border: '#4CAF50', ledColor: '#4CAF50' }),
    
    speaker: (x, y) => ({ id: nextId++, type: 'speaker', x, y, w: 50, h: 30, pins: [{name: '+', x: 15, y: 0, side: 'top'}, {name: '-', x: 35, y: 0, side: 'top'}], color: '#555', border: '#aaa', label: 'SPEAKER' }),
    jumper: (x, y) => ({ id: nextId++, type: 'jumper', x, y, w: 40, h: 10, pins: [{name: '1', x: 0, y: 5, side: 'left'}, {name: '2', x: 40, y: 5, side: 'right'}], color: '#888', border: '#ccc' }),
    note: (x, y) => ({ id: nextId++, type: 'note', x, y, w: 150, h: 80, pins: [], color: '#ffeb3b', border: '#fbc02d', text: 'Текст...', fontSize: 14 }),
    junction: (x, y) => ({ 
        id: nextId++, type: 'junction', x, y, w: 24, h: 24, 
        pins: [
            {name: '', x: 12, y: 0, side: 'top'}, 
            {name: '', x: 12, y: 24, side: 'bottom'},
            {name: '', x: 0, y: 12, side: 'left'},
            {name: '', x: 24, y: 12, side: 'right'}
        ], 
        color: '#ffd700', border: '#fff' 
    }),
    powerBus: (x, y, type) => {
        let pins = [], isVcc = type === 'vcc';
        for(let i=0; i<4; i++) {
            pins.push({name: isVcc ? 'VCC' : 'GND', x: 0, y: 10 + i*15, side: 'left'});
            pins.push({name: isVcc ? 'VCC' : 'GND', x: 60, y: 10 + i*15, side: 'right'});
        }
        return { id: nextId++, type: 'powerBus', x, y, w: 60, h: 70, pins, color: isVcc ? '#4a1a1a' : '#1a3a1a', border: isVcc ? '#ff4d4d' : '#4CAF50', isVcc: isVcc, voltage: isVcc ? '+5V' : 'GND' };
    }
};

function drawDisplaySegments(comp, ctx) {
    const padding = 15, digitWidth = 30, gap = 12, digitHeight = 65;
    const startX = comp.x + padding, startY = comp.y + 38; 
    const onColor = '#ff3333', chamfer = 5, hThick = 6, vThick = 6;
    for (let i = 0; i < 4; i++) {
        let dx = startX + i * (digitWidth + gap);
        ctx.fillStyle = onColor;
        ctx.beginPath(); ctx.moveTo(dx + chamfer, startY); ctx.lineTo(dx + digitWidth - chamfer, startY); ctx.lineTo(dx + digitWidth - chamfer - 1, startY + hThick); ctx.lineTo(dx + chamfer + 1, startY + hThick); ctx.fill();
        ctx.beginPath(); ctx.moveTo(dx, startY + chamfer); ctx.lineTo(dx + vThick, startY + chamfer + 1); ctx.lineTo(dx + vThick, startY + (digitHeight/2) - chamfer - 1); ctx.lineTo(dx, startY + (digitHeight/2) - chamfer); ctx.fill();
        ctx.beginPath(); ctx.moveTo(dx + digitWidth, startY + chamfer); ctx.lineTo(dx + digitWidth - vThick, startY + chamfer + 1); ctx.lineTo(dx + digitWidth - vThick, startY + (digitHeight/2) - chamfer - 1); ctx.lineTo(dx + digitWidth, startY + (digitHeight/2) - chamfer); ctx.fill();
        ctx.beginPath(); ctx.moveTo(dx + vThick, startY + (digitHeight/2) - hThick/2); ctx.lineTo(dx + digitWidth - vThick, startY + (digitHeight/2) - hThick/2); ctx.lineTo(dx + digitWidth - chamfer, startY + (digitHeight/2) + hThick/2); ctx.lineTo(dx + chamfer, startY + (digitHeight/2) + hThick/2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(dx, startY + (digitHeight/2) + chamfer); ctx.lineTo(dx + vThick, startY + (digitHeight/2) + chamfer + 1); ctx.lineTo(dx + vThick, startY + digitHeight - chamfer - 1); ctx.lineTo(dx, startY + digitHeight - chamfer); ctx.fill();
        ctx.beginPath(); ctx.moveTo(dx + digitWidth, startY + (digitHeight/2) + chamfer); ctx.lineTo(dx + digitWidth - vThick, startY + (digitHeight/2) + chamfer + 1); ctx.lineTo(dx + digitWidth - vThick, startY + digitHeight - chamfer - 1); ctx.lineTo(dx + digitWidth, startY + digitHeight - chamfer); ctx.fill();
        ctx.beginPath(); ctx.moveTo(dx + chamfer, startY + digitHeight); ctx.lineTo(dx + digitWidth - chamfer, startY + digitHeight); ctx.lineTo(dx + digitWidth - chamfer - 1, startY + digitHeight - hThick); ctx.lineTo(dx + chamfer + 1, startY + digitHeight - hThick); ctx.fill();
        ctx.beginPath(); ctx.arc(dx + digitWidth + 4, startY + digitHeight - 2, 4, 0, Math.PI*2); ctx.fill();
    }
}