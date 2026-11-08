const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const TILE_SIZE = 40;
const SIDEBAR_WIDTH = 200;

const ROWS = canvas.height / TILE_SIZE;
const COLS = (canvas.width - SIDEBAR_WIDTH) / TILE_SIZE;

const MAPS = {
    default: {
        name: "Default",
        waypoints: [
            { x: 0, y: 3 },
            { x: 5, y: 3 },
            { x: 5, y: 11 },
            { x: 12, y: 11 },
            { x: 12, y: 5 },
            { x: 18, y: 5 },
            { x: 18, y: 14 }
        ]
    },
    spiral: {
        name: "The Spiral",
        waypoints: [
            { x: 0, y: 8 },
            { x: 14, y: 8 },
            { x: 14, y: 2 },
            { x: 4, y: 2 },
            { x: 4, y: 12 },
            { x: 18, y: 12 }
        ]
    },
    insanity: {
        name: "Insanity",
        waypoints: [
            { x: 0, y: 0 },
            { x: 0, y: 14 },
            { x: 3, y: 14 },
            { x: 3, y: 0 },
            { x: 6, y: 0 },
            { x: 6, y: 14 },
            { x: 9, y: 14 },
            { x: 9, y: 0 },
            { x: 12, y: 0 },
            { x: 12, y: 14 },
            { x: 15, y: 14 },
            { x: 15, y: 0 },
            { x: 18, y: 0 },
            { x: 18, y: 14 },
        ]
    }
}

let gameState = 'MENU';
let currentMapKey = 'default';
let waypoints = MAPS[currentMapKey].waypoints;
let customWaypoints = [];
let customMapName = 'Custom Map';
let gamePaused = false;
let showMenuConfirmation = false;

let dodecahedrons = 150;
let coreLives = 20;
let score = 0;
let towers = [];
let enemies = [];
let projectiles = [];
let selectedTowerType = 'square';
let pendingTile = null;
let selectedTower = null;
let upgradeMessage = null;
let upgradeMessageTimer = null;

let wave = 1;
let waveInProgress = false;
let spawnTimer = 0;
let enemiesLeftToSpawn = 0;
let autoStartWaves = false;
let gameSpeed = 1;

const TOWER_TYPES = {
    square: { name: 'Square', cost: 50, range: 120, damage: 15, fireRate: 1.0, color: '#4489ff', shape: 'square', desc: 'Balanced single target tower' },
    triangle: { name: 'Triangle', cost: 75, range: 180, damage: 40, fireRate: 0.5, color: '#ffaa00', shape: 'triangle', desc: 'Long range sniper' },
    pentagon: { name: 'Pentagon', cost: 100, range: 90, damage: 8, fireRate: 3.0, color: '#aa00ff', shape: 'pentagon', desc: 'Close range shotgun' },
    farm: { name: 'Farm', cost: 200, range: 20, damage: 0, fireRate: 0, color: '#44ee44', shape: 'cross', income: 30, desc: 'Generates Dodecahedrons after each wave' }
}

const ENEMY_TYPES = [
    { name: 'circle', radius: 12, speed: 80, baseHp: 50, color: '#00ff88', reward: 5, shape: 'circle' },
    { name: 'triangle', radius: 11, speed: 120, baseHp: 35, color: '#00ccff', reward: 4, shape: 'triangle' },
    { name: 'hexagon', radius: 15, speed: 50, baseHp: 120, color: '#ff44aa', reward: 12, shape: 'hexagon' },
    { name: 'boss', radius: 24, speed: 40, baseHP: 800, color: '#ff2222', reward: 100, shape: 'octagon'}
]

window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && gameState === 'PLAYING') {
        if (selectedTower || pendingTile) {
            selectedTower = null;
            pendingTile = null;
            return;
        } else {
            gamePaused = !gamePaused;
            return;
        }
    }
    if (gamePaused) return;
    if (e.code === 'KeyM' && gameState === 'PLAYING') {
        showMenuConfirmation = !showMenuConfirmation
        return;
    }
    if (showMenuConfirmation) return;
    if (e.code === 'Space' || autoStartWaves) {
        startWave();
    }
    if (e.code === 'Tab' && gameState === 'PLAYING') {
        gameSpeed = gameSpeed === 1 ? 2 : 1;
        upgradeMessage = `Game Speed: ${gameSpeed}x`;
        upgradeMessagTimer = 2.0;
        e.preventDefault();
        return;
    }
    if (e.code.startsWith('Shift') && gameState === 'PLAYING') {
        autoStartWaves = !autoStartWaves;
        upgradeMessage = `Auto start waves: ${autoStartWaves ? 'ON' : 'Off'}`;
        upgradeMessageTimer = 2.0;
        e.preventDefault();
        return;
    }
    if (e.code === 'KeyQ') {
        selectedTowerType = 'square';
    }
    if (e.code === 'KeyW') {
        selectedTowerType = 'triangle';
    }
    if (e.code === 'KeyE') {
        selectedTowerType = 'pentagon';
    }
    if (e.code === 'KeyR') {
        selectedTowerType = 'farm';
    }
    if (e.code == 'Backspace' && selectedTower && !gamePaused) {
        const template = TOWER_TYPES[selectedTower.type];
        const refund = Math.floor(template.cost * 0.4 + (selectedTower.totalUpgradeSpent || 0) * 0.4);
        dodecahedrons += refund;
        towers = towers.filter(t => t !== selectedTower);
        upgradeMessage = `Sold tower for ${refund} Dodecahedrons`;
        upgradeMessageTimer = 2.0;
        selectedTower = null;
        e.preventDefault();
    }
    if (e.code === 'KeyU' && selectedTower && !gamePaused) {
        if (dodecahedrons >= selectedTower.upgradeCost) {
            dodecahedrons -= selectedTower.upgradeCost;
            selectedTower.totalUpgradeSpent += selectedTower.upgradeCost;
            selectedTower.level++;
            selectedTower.damage += 12;
            selectedTower.range += 20;
            selectedTower.upgradeCost = Math.floor(selectedTower.upgradeCost * 1.5);
            console.log(`Tower upgraded to level ${selectedTower.level}`);
        } else {
            upgradeMessage = "Not enough Dodecahedrons to upgrade.";
            upgradeMessageTimer = 2.0;
            console.log('Not enough Dodecahedrons to upgrade');
        }
    }
    if (e.code === 'KeyZ') {
        dodecahedrons += 100
    }
    if (e.code === 'KeyX') {
        wave += 1
    }
});

canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    if (gameState === 'GAMEOVER') {
        const btnWidth = 180;
        const btnHeight = 45;
        const btnX = (canvas.width - btnWidth) / 2;
        const btnY = canvas.height / 2 + 35;

        if (mouseX >= btnX && mouseX <= btnX + btnWidth && mouseY >= btnY && mouseY <= btnY + btnHeight) {
            gameState = 'MENU';
            selectedTower = null;
            pendingTile = null;
        }
        return;
    }
    // menu state
    if (gameState === 'MENU') {
        const mapKeys = Object.keys(MAPS);
        const cardWidth = 200;
        const cardHeight = 80;
        const startX = (canvas.width - (mapKeys.length * cardWidth + (mapKeys.length - 1) * 20)) / 2;
        const startY = 180;
        
        mapKeys.forEach((key, index) => {
            const x = startX + index * (cardWidth + 20);
            const y = startY;
            if (mouseX >= x && mouseX <= x + cardWidth && mouseY >= y && mouseY <= y + cardHeight) {
                initGame(key);
            }
        });
        return;
    }

    // modal stuff
    if (showMenuConfirmation) {
        const mapWidth = canvas.width - SIDEBAR_WIDTH;
        const modalWidth = 280;
        const modalHeight = 110;
        const modalX = (mapWidth - modalWidth) / 2;
        const modalY = (canvas.height - modalHeight) / 2;

        // yes button
        if (mouseX >= modalX + 20 && mouseX <= modalX + 110 && mouseY >= modalY + 65 && mouseY <= modalY + 95) {
            showMenuConfirmation = false;
            gamePaused = false;
            gameState = 'MENU';
            return;
        }

        // cancel button
        if (mouseX >= modalX + 170 && mouseX <= modalX + 260 && mouseY >= modalY + 65 && mouseY <= modalY + 95) {
            showMenuConfirmation = false;
            return;
        }
        return;
    }

    const sidebarX = canvas.width - SIDEBAR_WIDTH;
    const mapWidth = sidebarX;

    // top status bar buttons
    if (mouseY <= 40) {
        // pause button
        if (mouseX >= mapWidth - 155 && mouseX <= mapWidth - 90) {
            gamePaused = !gamePaused;
            return;
        }
        // menu button
        if (mouseX >= mapWidth - 80 && mouseX <= mapWidth - 10) {
            showMenuConfirmation = true;
            return;
        }

        // auto start wave
        if (mouseX >= mapWidth - 235 && mouseX <= mapWidth - 165) {
            autoStartWaves = !autoStartWaves;
            upgradeMessage = `Auto start waves: ${autoStartWaves ? 'ON' : 'OFF'}`;
            upgradeMessageTimer = 2.0;
            return;
        }

        // 2x speed button
        if (mouseX >= mapWidth - 310 && mouseX <= mapWidth - 245) {
            gameSpeed = gameSpeed === 1 ? 2 : 1;
            upgradeMessage = `Game Speed: ${gameSpeed}x`;
            upgradeMessageTimer = 2.0;
            return;
        }
    }
    
    if (gamePaused) return;

    // sidebar tower stuff
    if (mouseX >= sidebarX) {
        const cardYStart = 50;
        const cardHeight = 75;
        const mapKeys = Object.keys(TOWER_TYPES);

        mapKeys.forEach((key, index) => {
            const cardY = cardYStart + index * (cardHeight + 10);
            if (mouseY >= cardY && mouseY <= cardY + cardHeight) {
                selectedTowerType = key;
            }
        });
        return;
    }

    // grid placement
    const gridX = Math.floor(mouseX / TILE_SIZE);
    const gridY = Math.floor(mouseY / TILE_SIZE);

    // select/deselect placed tower
    const clickedTower = towers.find(t => t.gridX === gridX && t.gridY === gridY);
    if (clickedTower) {
        if (selectedTower === clickedTower) {
            selectedTower = null;
        } else {
            selectedTower = clickedTower;
            pendingTile = null;
        }
        return;
    }

    // place pending tower
    if (pendingTile && pendingTile.gridX === gridX && pendingTile.gridY === gridY) {
        const template = TOWER_TYPES[selectedTowerType];
        if (dodecahedrons >= template.cost) {
            dodecahedrons -= template.cost;
            towers.push({gridX: gridX, gridY: gridY, type: selectedTowerType, range: template.range, damage: template.damage, fireRate: template.fireRate, lastShotTime: 0, level: 1, upgradeCost: Math.floor(template.cost * 1.5), shape: template.shape, color: template.color, damageDealt: 0, totalUpgradeSpent: 0});
        } else {
            upgradeMessage = 'Not enough Dodecahedrons';
            upgradeMessageTimer = 2.0
        }
        pendingTile = null;
        return;
    }

    // path collision check
    if (isTileOnPath(gridX, gridY)) {
        pendingTile = null;
        return;
    }

    // deselection
    if (selectedTower || pendingTile) {
        selectedTower = null;
        pendingTile = null;
        return;
    }

    // empty tile preview
    pendingTile = { gridX, gridY };
});

function initGame(mapKey) {
    currentMapKey = mapKey;
    waypoints = MAPS[mapKey].waypoints;
    dodecahedrons = 150;
    coreLives = 20;
    score = 0;
    towers = [];
    enemies = [];
    projectiles = [];
    selectedTower = null;
    pendingTile = null;
    wave = 1;
    waveInProgress = false;
    gameState = 'PLAYING';
}

function drawMenu() {
    ctx.fillStyle = '#111116';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 32px Times New Roman';
    ctx.textAlign = 'center';
    ctx.fillText('SHAPE DEFENDERS', canvas.width / 2, 100);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '16px Times New Roman';
    ctx.fillText('Click on a map to play or create your own', canvas.width / 2, 120);

    const mapKeys = Object.keys(MAPS);
    const cardWidth = 200;
    const cardHeight = 80;
    const startX = (canvas.width - (mapKeys.length * cardWidth + (mapKeys.length - 1) * 20)) / 2;
    const startY = 160;

    mapKeys.forEach((key, index) => {
        const x = startX + index * (cardWidth + 20);
        const y = startY;

        ctx.fillStyle = 'rgba(40, 40, 50, 0.9';
        ctx.strokeStyle = '#4489ff';
        ctx.lineWidth = 2;
        ctx.fillRect(x, y, cardWidth, cardHeight);
        ctx.strokeRect(x, y, cardWidth, cardHeight);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Times New Roman';
        ctx.fillText(MAPS[key].name, x + cardWidth / 2, y + 45);
    });

    // custom map button
    const btnWidth = 260;
    const btnHeight = 45;
    const btnX = (canvas.width - btnWidth) / 2;
    const btnY = startY + cardHeight + 35;

    ctx.fillStyle = 'rgba(68, 137, 255, 0.3)';
    ctx.strokeStyle = '#4489ff';
    ctx.lineWidth = 2;
    ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
    ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Times New Roman';
    ctx.fillText('Create custom map', canvas.width / 2, btnY + 28);

    ctx.textAlign = 'left';
}

function drawMenuConfirmation() {
    const mapWidth = canvas.width - SIDEBAR_WIDTH;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, mapWidth, canvas.height);

    const modalWidth = 280;
    const modalHeight = 110;
    const modalX = (mapWidth - modalWidth) / 2;
    const modalY = (canvas.height - modalHeight) / 2;

    ctx.fillStyle = 'rgba(20, 20, 28, 0.95)';
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;
    ctx.fillRect(modalX, modalY, modalWidth, modalHeight);
    ctx.strokeRect(modalX, modalY, modalWidth, modalHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px Times New Roman';
    ctx.textAlign = 'center';
    ctx.fillText('Quit to Main Menu?', mapWidth / 2, modalY + 30);
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '12px Times New Roman';
    ctx.fillText('Current progress will be lost', mapWidth / 2, modalY + 48);

    ctx.fillStyle = 'rgba(220, 50, 50, 0.8)';
    ctx.strokeStyle = '#ff6666';
    ctx.lineWidth = 1;
    ctx.fillRect(modalX + 20, modalY + 65, 90, 30);
    ctx.strokeRect(modalX + 20, modalY + 65, 90, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Times New Roman';
    ctx.fillText('Yes', modalX + 65, modalY + 85);

    ctx.fillStyle = 'rgba(60, 60, 75, 0.8)';
    ctx.strokeStyle = '#8888aa';
    ctx.fillRect(modalX + 170, modalY + 65, 90, 30);
    ctx.strokeRect(modalX + 170, modalY + 65, 90, 30);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Cancel', modalX + 215, modalY + 85);

    ctx.textAlign = 'left';
}

function gridToPixel(gridX, gridY) {
    return {
        x: gridX * TILE_SIZE + TILE_SIZE / 2,
        y: gridY * TILE_SIZE + TILE_SIZE / 2
    };
}

function drawGrid() {
    ctx.strokeStyle = '#362828';
    ctx.lineWidth = 1;

    const mapWidth = canvas.width - SIDEBAR_WIDTH;

    for (let c = 0; c <= COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * TILE_SIZE, 0);
        ctx.lineTo(c * TILE_SIZE, canvas.height);
        ctx.stroke();
    }

    for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * TILE_SIZE);
        ctx.lineTo(mapWidth, r * TILE_SIZE);
        ctx.stroke();
    }
}

function drawPath() {
    if (waypoints.length < 2) return;

    ctx.strokeStyle = '#334455';
    ctx.lineWidth = TILE_SIZE * 0.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    const start = gridToPixel(waypoints[0].x, waypoints[0].y);
    ctx.moveTo(start.x, start.y);

    for (let i = 1; i < waypoints.length; i++) {
        const pt = gridToPixel(waypoints[i].x, waypoints[i].y);
        ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    const end = gridToPixel(waypoints[waypoints.length - 1].x, waypoints[waypoints.length - 1].y);
    ctx.fillStyle = '#a58e8e';
    ctx.beginPath();
    ctx.arc(end.x, end.y, TILE_SIZE * 0.4, 0, Math.PI * 2);
    ctx.fill();
}

// not yet implemented
function drawEditor() {
    ctx.fillStyle = '#111116';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();

    if (customWaypoints.length > 0) {
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = TILE_SIZE * 0.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        const start = gridToPixel(customWaypoints[0].x, customWaypoints[0].y);
        ctx.moveTo(start.x, start.y);

        for (let i = 1; i < customWaypoints.length; i++) {
            const pt = gridToPixel(customWaypoints[i].x, customWaypoints[i].y);
            ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();

        customWaypoints.forEach((wp, index) => {
            const pt = gridToPixel(wp.x, wp.y);
            ctx.fillStyle = index === 0 ? '#ff4444' : '#00ff88';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, TILE_SIZE * 0.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#000000';
            ctx.font = 'bold 12px Times New Roman';
            ctx.textAlign = 'center';
            ctx.fillText(index + 1, pt.x, pt.y + 4);
        });
        ctx.textALign = 'left';
    }

    ctx.fillStyle = 'rgba(15, 15, 22, 0.95)';
    ctx.fillRect(0, 0, canvas.width, 50);
    ctx.strokeStyle = '#333344';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px Times New Roman';
    ctx.fillText('MAP EDITOR: Click tiles to create enemy path sequence', 20, 30);

    const barY = canvas.height - 60;
    ctx.fillStyle = 'rgba(15, 15, 22, 0.95)';
    ctx.fillRect(0, barY, canvas.width, 60);
    ctx.strokeRect(0, barY, canvas.width, 60);

    ctx.fillStyle = 'rgba(80, 60, 60, 0.9)';
    ctx.fillRect(20, barY + 12, 110, 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Times New Roman';
    ctx.fillText('Undo Point', 32, barY + 35);

    ctx.fillStyle = customWaypoints.length >= 2 ? 'rgba(0, 200, 100, 0.9)' : 'rgba(80, 80, 80, 0.9)';
    ctx.fillRect(150, barY + 12, 130, 36);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Save and play', 165, barY + 35);

    ctx.fillStyle = 'rgba(60, 60, 80, 0.9)';
    ctx.fillRect(300, barY + 12, 110, 36);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Back', 332, barY + 35);
}

function startWave() {
    if (waveInProgress) return;
    waveInProgress = true;

    if (wave === 10) {
        enemiesLeftToSpawn = 1;
    } else {
        enemiesLeftToSpawn = 5 + wave * 3;
    }
    console.log(`Wave ${wave} in progress. Spawning ${enemiesLeftToSpawn} enemies.`);
}

function isTileOnPath(gx, gy) {
    for (let i = 0; i < waypoints.length - 1; i++) {
        let p1 = waypoints[i];
        let p2 = waypoints[i + 1];

        let minX = Math.min(p1.x, p2.x);
        let maxX = Math.max(p1.x, p2.x);
        let minY = Math.min(p1.y, p2.y);
        let maxY = Math.max(p1.y, p2.y);

        if (gx >= minX && gx <= maxX && gy >= minY && gy <= maxY) {
            return true;
        }
    }
    return false;
}

function updateGame(deltaTime) {
    if (upgradeMessageTimer > 0) {
        upgradeMessageTimer -= deltaTime;
    }
    if (waveInProgress && enemiesLeftToSpawn > 0) {
        spawnTimer += deltaTime;
        if (spawnTimer > 1.0) {
            const startPos = gridToPixel(waypoints[0].x, waypoints[0].y);
            let typeIndex = 0;
            const rand = Math.random()
            if (wave === 10) {
                typeIndex = 3;
            } else if (wave >= 3 && rand < 0.4) {
                typeIndex = 1; 
            } else if (wave >= 5 && rand < 0.25) {
                typeIndex = 2;
            }
            const template = ENEMY_TYPES[typeIndex];
            const scaledHp = template.baseHp * Math.pow(1.05, wave - 1);

            enemies.push({
                x: startPos.x,
                y: startPos.y,
                waypointIndex: 1,
                hp: scaledHp,
                maxHp: scaledHp,
                speed: template.speed,
                radius: template.radius,
                color: template.color,
                reward: template.reward,
                shape: template.shape
            });

            enemiesLeftToSpawn--;
            spawnTimer = 0;
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        let enemy = enemies[i];
        let targetPt = gridToPixel(waypoints[enemy.waypointIndex].x, waypoints[enemy.waypointIndex].y);

        let dx = targetPt.x - enemy.x;
        let dy = targetPt.y - enemy.y;
        let dist = Math.hypot(dx, dy);

        let step = enemy.speed * deltaTime;
        if (dist <= step) {
            enemy.x = targetPt.x;
            enemy.y = targetPt.y;
            enemy.waypointIndex++;

            if (enemy.waypointIndex >= waypoints.length) {
                coreLives--;
                enemies.splice(i, 1);
                if (coreLives <= 0) {
                    console.log("Game over");
                    gameState = 'GAMEOVER';
                }
                continue;
            } 
        } else {
            enemy.x += (dx / dist) * step;
            enemy.y += (dy / dist) * step;
        }
    }

    const now = Date.now() / 1000;
    towers.forEach(tower => {
        const towerPos = gridToPixel(tower.gridX, tower.gridY);
        if (now - tower.lastShotTime >= (1 / tower.fireRate)) {
            let target = enemies.find(e => Math.hypot(e.x - towerPos.x, e.y - towerPos.y) <= tower.range);
            if (target) {
                if (tower.type === 'pentagon') {
                    const baseAngle = Math.atan2(target.y - towerPos.y, target.x - towerPos.x);
                    const spread = 0.25;

                    for (let i = -1; i <= 1; i++) {
                        const angle = baseAngle + i * spread;
                        projectiles.push({
                            x: towerPos.x,
                            y: towerPos.y,
                            vx: Math.cos(angle) * 400,
                            vy: Math.sin(angle) * 400,
                            isVector: true,
                            damage: tower.damage,
                            tower: tower,
                            color: '#4c4a4a',
                            shape: 'dot'
                        });
                    }
                } else if (tower.type === 'triangle') {
                    projectiles.push({
                        x: towerPos.x,
                        y: towerPos.y,
                        target: target,
                        speed: 700,
                        damage: tower.damage,
                        tower: tower,
                        color: '#a6da08',
                        shape: 'laser'
                    });
                } else {
                    projectiles.push({
                        x: towerPos.x,
                        y: towerPos.y,
                        target: target,
                        speed: 350,
                        damage: tower.damage,
                        tower: tower,
                        color: tower.color,
                        shape: 'bullet'
                    });
                }
                tower.lastShotTime = now;
            }
        }
    });

    for (let i = projectiles.length - 1; i >= 0; i--) {
        let proj = projectiles[i];
        let step = proj.speed * deltaTime;

        if (proj.isVector) {
            proj.x += proj.vx * deltaTime;
            proj.y += proj.vy * deltaTime;

            for (let e = enemies.length - 1; e >= 0; e--) {
                let enemy = enemies[e];
                if (Math.hypot(enemy.x - proj.x, enemy.y - proj.y) <= enemy.radius + 4) {
                    enemy.hp -= proj.damage;
                    if (proj.tower) {
                        proj.tower.damageDealt += proj.damage;
                    }
                    projectiles.splice(i, 1);
                    break;
                }
            }

            if (proj.x < 0 || proj.x > canvas.width || proj.y < 0 || proj.y > canvas.height) {
                projectiles.splice(i, 1);
            }
        } else {
            if (!enemies.includes(proj.target)) {
                projectiles.splice(i, 1);
                continue;
            }

            let dx = proj.target.x - proj.x;
            let dy = proj.target.y - proj.y;
            let dist = Math.hypot(dx, dy);

            if (dist <= step) {
                proj.target.hp -= proj.damage;
                if (proj.tower) {
                    proj.tower.damageDealt += proj.damage;
                }
                projectiles.splice(i, 1);
            } else {
                proj.x += (dx / dist) * step;
                proj.y += (dy / dist) * step;
            }
        }
    }

    // defeated enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i].hp <= 0) {
            dodecahedrons += enemies[i].reward
            score += 25;
            enemies.splice(i, 1);
        }
    }

    // wave completion check
    if (waveInProgress && enemiesLeftToSpawn === 0 && enemies.length === 0) {
        waveInProgress = false;
        wave++;

        let farmIncome = 0;
        towers.forEach(t => {
            if (t.type === 'farm') {
                farmIncome += (TOWER_TYPES.farm.income + (t.level - 1) * 15);
            }
        });
        
        const waveReward = 50 + (wave - 1) * 10 + farmIncome;
        dodecahedrons += waveReward;
        upgradeMessage = `Wave completed. Earned ${waveReward} (${farmIncome} from Farms)`;
        upgradeMessageTimer = 3.0;
        console.log(`Wave completed. Advancing to wave ${wave}`);

        if (autoStartWaves) {
            startWave();
        }
    }
}

 // polygon renderer
function drawPolygon(x, y, radius, sides, color, strokeColor = null) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
        const px = x + radius * Math.cos(angle);
        const py = y + radius * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.closePath();
    ctx.fill();
    if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function drawEntities() {
    // draw towers
    towers.forEach(tower => {
        const pos = gridToPixel(tower.gridX, tower.gridY);

        if (tower.shape === 'square') {
            ctx.fillStyle = tower.color;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(pos.x - 15, pos.y - 15, 30, 30);
            ctx.fill();
            ctx.stroke();
        } else if (tower.shape === 'cross') {
            ctx.fillStyle = tower.color;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.fillRect(pos.x - 5, pos.y - 14, 10, 28);
            ctx.strokeRect(pos.x - 5, pos.y - 14, 10, 28);
            ctx.fillRect(pos.x - 14, pos.y - 5, 28, 10);
            ctx.strokeRect(pos.x - 14, pos.y - 5, 28, 10);
        } else {
            const sides = tower.shape === 'triangle' ? 3 : 5;
            drawPolygon(pos.x, pos.y, 16, sides, tower.color, '#ffffff');
        }

        // level indicator
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Times New Roman';
        ctx.fillText(`L${tower.level}`, pos.x - 10, pos.y + 4);
    });

    // draw selected tower range and highlight
    if (selectedTower) {
        const pos = gridToPixel(selectedTower.gridX, selectedTower.gridY);
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.7)';
        ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, selectedTower.range, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.strokeRect(selectedTower.gridX * TILE_SIZE + 3, selectedTower.gridY * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6);
    }

    // draw pending range
    if (pendingTile) {
        const pos = gridToPixel(pendingTile.gridX, pendingTile.gridY);
        ctx.strokeStyle = 'rgba(68, 137, 255, 0.7)';
        ctx.fillStyle = 'rgba(68, 137, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, TOWER_TYPES[selectedTowerType].range, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(pendingTile.gridX * TILE_SIZE + 5, pendingTile.gridY * TILE_SIZE + 5, TILE_SIZE - 10, TILE_SIZE - 10);
    }

    // draw projectiles
    projectiles.forEach(proj => {
        ctx.fillStyle = proj.color || '#ffff00';
        ctx.strokeStyle = proj.color || '#ffff00';

        if (proj.shape === 'laser') {
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, 3, 0, Math.PI * 2);
            ctx.fill();
        } else if (proj.shape === 'dot') {
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // draw enemies
    enemies.forEach(enemy => {
        if (enemy.shape === 'circle') {
            ctx.fillStyle = enemy.color;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
            ctx.fill();
        } else if (enemy.shape === 'triangle') {
            drawPolygon(enemy.x, enemy.y, enemy.radius, 3, enemy.color);
        } else if (enemy.shape === 'hexagon') {
            drawPolygon(enemy.x, enemy.y, enemy.radius, 6, enemy.color);
        } else if (enemy.shape === 'octagon') {
            drawPolygon(enemy.x, enemy.y, enemy.radius, 8, enemy.color, '#ffffff');
        }

        // enemy health bar
        const barWidth = enemy.shape === 'octagon' ? 40 : 24;
        const barHeight = enemy.shape === 'octagon' ? 6 : 4;
        const yOffset = enemy.shape === 'octagon' ? 30 : 20;

        ctx.fillStyle = '#ff0000';
        ctx.fillRect(enemy.x - barWidth / 2, enemy.y - yOffset, barWidth, barHeight);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(enemy.x - barWidth / 2, enemy.y - yOffset, barWidth * (enemy.hp / enemy.maxHp), barHeight);
    });
}

function drawTowerSidebar() {
    const sidebarX = canvas.width - SIDEBAR_WIDTH;

    ctx.fillStyle = 'rgba(15, 15, 22, 0.95)';
    ctx.fillRect(sidebarX, 0, SIDEBAR_WIDTH, canvas.height);
    ctx.strokeStyle = '#333344';
    ctx.lineWidth = 2;
    ctx.strokeRect(sidebarX, 0, SIDEBAR_WIDTH, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Times New Roman';
    ctx.fillText('TOWERS', sidebarX + 15, 30);

    const keys = Object.keys(TOWER_TYPES);
    const cardHeight = 75;
    const startY = 85;

    keys.forEach((key, index) => {
        const t = TOWER_TYPES[key];
        const cardY = startY + index * (cardHeight + 10);
        const isSelected = selectedTowerType === key;

        // card bg
        ctx.fillStyle = isSelected ? 'rgba(68, 137, 255, 0.2)' : 'rgba(35, 35, 45, 0.8)';
        ctx.strokeStyle = isSelected ? '#4489ff' : '#555566';
        ctx.lineWidth = isSelected ? 2 : 1
        ctx.fillRect(sidebarX + 10, cardY, 180, cardHeight);
        ctx.strokeRect(sidebarX + 10, cardY, 180, cardHeight); 

        // tower name
        ctx.fillStyle = isSelected ? '#00ff88' : '#ffffff';
        ctx.font = 'bold 13px Times New Roman';
        ctx.fillText(`${t.name} (${t.cost})`, sidebarX + 20, cardY + 22);

        // tower stats
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '11px Times New Roman';
        ctx.fillText(`Dmg: ${t.damage} | Rng: ${t.range}`, sidebarX + 20, cardY + 40);

        ctx.fillText(t.desc, sidebarX + 20, cardY + 58);
    });
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 40px Times New Roman';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Times New Roman';
    ctx.fillText(`Final Score: ${score} | Waves survived: ${wave - 1}`, canvas.width / 2, canvas.height / 2 - 5);

    const btnWidth = 180;
    const btnHeight =  45;
    const btnX = (canvas.width - btnWidth) / 2;
    const btnY = canvas.height / 2 + 35;

    ctx.fillStyle = 'rgba(68, 137, 255, 0.9)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
    ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Times New Roman';
    ctx.fillText('Main Menu', canvas.width / 2, btnY + 28);

    ctx.textAlign = 'left';
}

function drawUI() {
    const mapWidth = canvas.width - SIDEBAR_WIDTH;

    // top status bar
    ctx.fillStyle = 'rgba(15, 15, 22, 0.95)';
    ctx.fillRect(0, 0, mapWidth, 40);
    ctx.strokeStyle = '#333344';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 40);
    ctx.lineTo(mapWidth, 40);
    ctx.stroke();

    // top bar stats
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Times New Roman';
    ctx.fillText(`Dodecahedrons: ${dodecahedrons}`, 15, 25);
    ctx.fillText(`Lives: ${coreLives}`, 160, 25);
    ctx.fillText(`Wave: ${wave}`, 250, 25);
    ctx.fillText(`Map: ${MAPS[currentMapKey].name}`, 350, 25);

    // pause and menu buttons
    ctx.fillStyle = 'rgba(50, 50, 70, 0.8)';
    ctx.strokeStyle = '#666688';
    ctx.lineWidth = 1;

    // auto wave button box
    ctx.fillRect(mapWidth - 235, 8, 70, 24);
    ctx.strokeRect(mapWidth - 235, 8, 70, 24);

    // pause button box
    ctx.fillRect(mapWidth - 155, 8, 65, 24);
    ctx.strokeRect(mapWidth - 155, 8, 70, 24);

    // menu button box
    ctx.fillRect(mapWidth - 80, 8, 70, 24);
    ctx.strokeRect(mapWidth - 80, 8, 70, 24);

    // speed button box
    ctx.fillRect(mapWidth - 310, 8, 65, 24);
    ctx.strokeRect(mapWidth - 310, 8, 65, 24);

    // button labels
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Times New Roman';
    ctx.textAlign = 'center';
    ctx.fillText(`Speed: ${gameSpeed}x`, mapWidth - 277.5, 24)
    ctx.fillText(`Auto: ${autoStartWaves ? 'ON' : 'OFF'}`, mapWidth - 200, 24);
    ctx.fillText(gamePaused ? 'Play' : 'Pause', mapWidth - 122.5, 24);
    ctx.fillText('Menu', mapWidth - 45, 24);
    ctx.textAlign = 'left';

    const selectedTemplate = TOWER_TYPES[selectedTowerType];

    if (upgradeMessageTimer > 0 && !pendingTile) {
        ctx.fillStyle = upgradeMessage.includes('Not enough') ? '#ff4444' : '#00ff88';
        ctx.fillText(upgradeMessage, 15, 65);
    } else if (pendingTile) {
        ctx.fillStyle = '#ffff00';
        ctx.fillText('Click tile again to place tower', 15, 65);
    } else if (!selectedTower) {
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(`Current: [${selectedTemplate.name}] (${selectedTemplate.cost})`, 15, 65);
    }

    if (selectedTower) {
        const panelY = canvas.height - 70;
    
        ctx.fillStyle = 'rgba(20, 20, 20, 0.9)';
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.fillRect(10, panelY, mapWidth - 20, 60);
        ctx.strokeRect(10, panelY, mapWidth - 20, 60);

        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 16px Times New Roman';
        ctx.fillText(`${selectedTower.type.toUpperCase()} TOWER (Lv. ${selectedTower.level})`, 25, panelY + 22);

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Times New Roman';
        ctx.fillText(`Damage: ${selectedTower.damage} | Range: ${selectedTower.range} | Dmg Dealt: ${selectedTower.damageDealt}`, 25, panelY + 45);

        ctx.fillStyle = '#ffff00';
        ctx.fillText(`[U] Upgrade (${selectedTower.upgradeCost}) | [Backspace] Sell (+${Math.floor((TOWER_TYPES[selectedTower.type].cost * 0.4) + (selectedTower.totalUpgradeSpent || 0) * 0.4)})`, mapWidth - 300, panelY + 35);
    }

    drawTowerSidebar()
}

let lastTime = performance.now();
function gameLoop(time) {
    let rawDeltaTime = (time - lastTime) / 1000;
    lastTime = time;

    let deltaTime = Math.min(rawDeltaTime * gameSpeed, 0.1);

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'MENU') {
        drawMenu();
    } else if (gameState === 'GAMEOVER') {
        drawGameOver();
    } else {
        if (!gamePaused) {
            updateGame(deltaTime);
        }
        drawGrid();
        drawPath();
        drawEntities();
        drawUI();

        if (gamePaused) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#00ff88';
            ctx.font = 'bold 36px Times New Roman';
            ctx.textAlign = 'center';
            ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
            ctx.fillStyle = '#ffffff';
            ctx.font = '16px Times New Roman';
            ctx.fillText('[ESC] to resume', canvas.width / 2, canvas.height / 2 + 40);
            ctx.textAlign = 'left';
        }

        if (showMenuConfirmation) {
            drawMenuConfirmation()
        }
    }
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);