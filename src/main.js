const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const healthEl = document.getElementById('health');
const scoreEl = document.getElementById('score');
const weaponEl = document.getElementById('weapon');
const upgradeEl = document.getElementById('upgrade-time');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const input = { up: false, down: false, left: false, right: false, shooting: false, mouse: { x: WIDTH / 2, y: HEIGHT / 2 } };
const bullets = [];
const enemies = [];
const crates = [];

const weapons = {
  pistol: {
    name: 'Pistol',
    fireRate: 220,
    bulletSpeed: 8,
    damage: 12,
    spread: 0,
    projectiles: 1,
    color: '#9af5ff'
  },
  rifle: {
    name: 'Assault Rifle',
    fireRate: 90,
    bulletSpeed: 10,
    damage: 10,
    spread: 0.04,
    projectiles: 1,
    color: '#f8f29d'
  },
  shotgun: {
    name: 'Shotgun',
    fireRate: 420,
    bulletSpeed: 8,
    damage: 10,
    spread: 0.17,
    projectiles: 5,
    color: '#ffa3a3'
  }
};

const player = {
  x: WIDTH / 2,
  y: HEIGHT / 2,
  size: 26,
  speed: 3.2,
  color: '#4dd2ff',
  health: 100,
  lastShot: 0,
  score: 0,
  weapon: weapons.pistol,
  upgradeTimer: 0
};

let lastSpawn = 0;
let lastTime = performance.now();
let difficulty = 1;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function handleInput() {
  const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const moveY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const length = Math.hypot(moveX, moveY) || 1;
  player.x = clamp(player.x + (moveX / length) * player.speed, player.size / 2, WIDTH - player.size / 2);
  player.y = clamp(player.y + (moveY / length) * player.speed, player.size / 2, HEIGHT - player.size / 2);
}

function spawnEnemy(timestamp) {
  if (timestamp - lastSpawn < Math.max(400 - difficulty * 4, 120)) return;
  lastSpawn = timestamp;
  difficulty += 0.005;

  const edge = Math.floor(Math.random() * 4);
  const margin = 20;
  let x = 0, y = 0;
  if (edge === 0) {
    x = Math.random() * WIDTH;
    y = -margin;
  } else if (edge === 1) {
    x = WIDTH + margin;
    y = Math.random() * HEIGHT;
  } else if (edge === 2) {
    x = Math.random() * WIDTH;
    y = HEIGHT + margin;
  } else {
    x = -margin;
    y = Math.random() * HEIGHT;
  }

  enemies.push({
    x,
    y,
    size: 24,
    speed: 1.2 + difficulty * 0.08,
    color: '#7aff7a',
    health: 28 + difficulty * 2.5
  });
}

function updateEnemies() {
  enemies.forEach((enemy, index) => {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    enemy.x += Math.cos(angle) * enemy.speed;
    enemy.y += Math.sin(angle) * enemy.speed;

    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < (enemy.size + player.size) / 2) {
      player.health = Math.max(0, player.health - 0.24);
      enemy.x -= Math.cos(angle) * 6;
      enemy.y -= Math.sin(angle) * 6;
    }

    if (enemy.health <= 0) {
      enemies.splice(index, 1);
      player.score += 15;
      if (player.score % 120 === 0) {
        spawnCrate();
      }
    }
  });
}

function spawnCrate() {
  crates.push({
    x: Math.random() * (WIDTH - 60) + 30,
    y: Math.random() * (HEIGHT - 60) + 30,
    size: 24,
    weapon: Math.random() > 0.5 ? weapons.rifle : weapons.shotgun,
    ttl: 14000
  });
}

function updateCrates(delta) {
  crates.forEach((crate, index) => {
    crate.ttl -= delta;
    if (crate.ttl <= 0) {
      crates.splice(index, 1);
      return;
    }

    const dist = Math.hypot(crate.x - player.x, crate.y - player.y);
    if (dist < (crate.size + player.size) / 2) {
      player.weapon = crate.weapon;
      player.upgradeTimer = 12000;
      crates.splice(index, 1);
    }
  });
}

function shoot(timestamp) {
  if (!input.shooting) return;
  if (timestamp - player.lastShot < player.weapon.fireRate) return;
  player.lastShot = timestamp;

  for (let i = 0; i < player.weapon.projectiles; i++) {
    const angle = Math.atan2(input.mouse.y - player.y, input.mouse.x - player.x);
    const jitter = (Math.random() - 0.5) * player.weapon.spread;
    const finalAngle = angle + jitter;
    bullets.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(finalAngle) * player.weapon.bulletSpeed,
      vy: Math.sin(finalAngle) * player.weapon.bulletSpeed,
      damage: player.weapon.damage,
      size: 6,
      color: player.weapon.color,
      ttl: 1400
    });
  }
}

function updateBullets(delta) {
  bullets.forEach((bullet, bulletIndex) => {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    bullet.ttl -= delta;

    if (bullet.x < 0 || bullet.x > WIDTH || bullet.y < 0 || bullet.y > HEIGHT || bullet.ttl <= 0) {
      bullets.splice(bulletIndex, 1);
      return;
    }

    enemies.forEach((enemy, enemyIndex) => {
      const dist = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
      if (dist < (enemy.size + bullet.size) / 2) {
        enemy.health -= bullet.damage;
        bullets.splice(bulletIndex, 1);
        if (enemy.health <= 0) {
          enemies.splice(enemyIndex, 1);
          player.score += 15;
          if (player.score % 120 === 0) spawnCrate();
        }
      }
    });
  });
}

function applyUpgrade(delta) {
  if (player.upgradeTimer <= 0 && player.weapon !== weapons.pistol) {
    player.weapon = weapons.pistol;
  }
  if (player.upgradeTimer > 0) {
    player.upgradeTimer = Math.max(0, player.upgradeTimer - delta);
  }
}

function drawBackground() {
  ctx.fillStyle = '#0f0f15';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i < WIDTH; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, HEIGHT);
    ctx.stroke();
  }
  for (let j = 0; j < HEIGHT; j += 40) {
    ctx.beginPath();
    ctx.moveTo(0, j);
    ctx.lineTo(WIDTH, j);
    ctx.stroke();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = player.color;
  ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size);

  // Barrel direction indicator
  const angle = Math.atan2(input.mouse.y - player.y, input.mouse.x - player.x);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.cos(angle) * player.size / 2.5, Math.sin(angle) * player.size / 2.5, 12, 4);
  ctx.restore();
}

function drawEnemies() {
  enemies.forEach(enemy => {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = enemy.color;
    ctx.fillRect(-enemy.size / 2, -enemy.size / 2, enemy.size, enemy.size);
    ctx.restore();
  });
}

function drawBullets() {
  bullets.forEach(bullet => {
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.size / 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawCrates() {
  crates.forEach(crate => {
    ctx.save();
    ctx.translate(crate.x, crate.y);
    ctx.fillStyle = crate.weapon === weapons.shotgun ? '#ff9a66' : '#ffd966';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.fillRect(-crate.size / 2, -crate.size / 2, crate.size, crate.size);
    ctx.strokeRect(-crate.size / 2, -crate.size / 2, crate.size, crate.size);
    ctx.restore();
  });
}

function drawHUD() {
  healthEl.textContent = Math.round(player.health);
  scoreEl.textContent = player.score;
  weaponEl.textContent = player.weapon.name;
  upgradeEl.textContent = player.upgradeTimer > 0 ? `${Math.ceil(player.upgradeTimer / 1000)}s` : '0s';
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#fff';
  ctx.font = '32px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Game Over', WIDTH / 2, HEIGHT / 2 - 10);
  ctx.font = '20px "Segoe UI", sans-serif';
  ctx.fillText(`Score: ${player.score}`, WIDTH / 2, HEIGHT / 2 + 24);
  ctx.fillText('Refresh to restart', WIDTH / 2, HEIGHT / 2 + 54);
}

function update(timestamp) {
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  handleInput();
  spawnEnemy(timestamp);
  shoot(timestamp);
  updateBullets(delta);
  updateEnemies();
  updateCrates(delta);
  applyUpgrade(delta);
  draw();

  if (player.health <= 0) {
    drawGameOver();
    return;
  }
  requestAnimationFrame(update);
}

function draw() {
  drawBackground();
  drawCrates();
  drawPlayer();
  drawEnemies();
  drawBullets();
  drawHUD();
}

// Input handlers
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW') input.up = true;
  if (e.code === 'KeyS') input.down = true;
  if (e.code === 'KeyA') input.left = true;
  if (e.code === 'KeyD') input.right = true;
  if (e.code === 'Space') input.shooting = true;
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW') input.up = false;
  if (e.code === 'KeyS') input.down = false;
  if (e.code === 'KeyA') input.left = false;
  if (e.code === 'KeyD') input.right = false;
  if (e.code === 'Space') input.shooting = false;
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  input.mouse.x = e.clientX - rect.left;
  input.mouse.y = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', () => {
  input.shooting = true;
});

canvas.addEventListener('mouseup', () => {
  input.shooting = false;
});

// Start the loop
requestAnimationFrame(update);
