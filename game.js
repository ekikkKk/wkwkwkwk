// ========== INFINITE RUNNER GAME - MINION CHASE ==========
// FIXED VERSION - Resolves double coin HUD display and minion kill freeze

(() => {
  // ========== DOM ELEMENTS ==========
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const scoreEl = document.getElementById('score');
  const highEl = document.getElementById('highscore');
  const stageEl = document.getElementById('stage');
  const pauseBtn = document.getElementById('pauseBtn');
  const comboEl = document.getElementById('combo');
  const pauseModal = document.getElementById('pauseModal');
  const sessionCoinsEl = document.getElementById('sessionCoins');

  // ========== PAUSE MODAL FUNCTIONS ==========
  function showPauseModal() {
    pauseModal.classList.add('active');
    paused = true;
  }

  function hidePauseModal() {
    pauseModal.classList.remove('active');
    paused = false;
  }

  window.resumeGame = function() {
    hidePauseModal();
  };

  window.goToMenu = function() {
    if (score > highscore) {
      highscore = score;
      localStorage.setItem(HIGHKEY, String(highscore));
    }
    
    if (bgmAudio) {
      bgmAudio.pause();
    }
    
    window.location.href = 'menu.html';
  };

  window.restartGame = function() {
    if (bgmAudio) {
      bgmAudio.pause();
    }
    
    location.reload();
  };

  // ========== CANVAS SETUP ==========
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 70;
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  let W = canvas.width;
  let H = canvas.height;
  let GROUND_H = Math.round(H * 0.18);

  // ========== AUDIO SETUP ==========
  const BGM_URL = 'https://assets.mixkit.co/active_storage/sfx/2742/2742-preview.mp3';
  let bgmAudio = null;

  function initBGM() {
    try {
      bgmAudio = new Audio(BGM_URL);
      bgmAudio.loop = true;
      bgmAudio.volume = 0.2;
    } catch (e) {
      console.log('BGM init failed');
    }
  }

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  function playSound(frequency, duration, type = 'sine', volume = 0.3) {
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = frequency;
      osc.type = type;
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + Math.max(0.01, duration));
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + Math.max(0.01, duration));
    } catch (e) {}
  }

  // ========== STORAGE KEYS ==========
  const HIGHKEY = 'minion_chase_high_v1';
  const STATSKEY = 'minion_chase_stats_v1';
  const COINSKEY = 'minion_chase_coins_v1';

  // ========== POWERUP CONFIG ==========
  const POWERUPS = {
    RAPID_FIRE: { name: 'Rapid Fire', color: '#ff4444', bgColor: 'rgba(255, 68, 68, 0.2)', duration: 8, icon: '⚡' },
    SHIELD: { name: 'Shield', color: '#44ff44', bgColor: 'rgba(68, 255, 68, 0.2)', duration: 6, icon: '🛡️' },
    FREEZE: { name: 'Freeze', color: '#4488ff', bgColor: 'rgba(68, 136, 255, 0.2)', duration: 5, icon: '❄️' },
    DAMAGE: { name: 'Damage Boost', color: '#ff1111', bgColor: 'rgba(255, 17, 17, 0.2)', duration: 10, icon: '💥' },
    FIRE_RATE: { name: 'Fire Rate Boost', color: '#ffaa00', bgColor: 'rgba(255, 170, 0, 0.2)', duration: 8, icon: '🔥' },
    BULLET_SPLIT: { name: 'Bullet Split', color: '#00ffff', bgColor: 'rgba(0, 255, 255, 0.2)', duration: 7, icon: '⚔️' },
    MISSILE: { name: 'Missile Mode', color: '#ff00ff', bgColor: 'rgba(255, 0, 255, 0.2)', duration: 6, icon: '🚀' }
  };

  // ========== HELPER FUNCTIONS ==========
  const rand = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rand(a, b + 1));
  const rectsOverlap = (a, b) => !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
  const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

  // ========== PLAYER STATS CLASS ==========
  class PlayerStats {
    constructor() {
      this.loadStats();
      this.loadCoins();
    }

    loadStats() {
      const saved = localStorage.getItem(STATSKEY);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          this.hp = data.hp !== undefined ? data.hp : 20;
          this.damage = data.damage !== undefined ? data.damage : 1.0;
          this.criticalDamage = data.criticalDamage !== undefined ? data.criticalDamage : 1.5;
          this.criticalRate = data.criticalRate !== undefined ? data.criticalRate : 0.1;
          this.fireRate = data.fireRate !== undefined ? data.fireRate : 0.25;
          this.movement = data.movement !== undefined ? data.movement : 400;
          this.jumpSpeed = data.jumpSpeed !== undefined ? data.jumpSpeed : 950;
        } catch (e) {
          this.setDefaults();
        }
      } else {
        this.setDefaults();
      }
    }

    setDefaults() {
      this.hp = 20;
      this.damage = 1.0;
      this.criticalDamage = 1.5;
      this.criticalRate = 0.1;
      this.fireRate = 0.25;
      this.movement = 400;
      this.jumpSpeed = 950;
      this.saveStats();
    }

    saveStats() {
      localStorage.setItem(STATSKEY, JSON.stringify({
        hp: this.hp,
        damage: this.damage,
        criticalDamage: this.criticalDamage,
        criticalRate: this.criticalRate,
        fireRate: this.fireRate,
        movement: this.movement,
        jumpSpeed: this.jumpSpeed
      }));
    }

    loadCoins() {
      this.totalCoins = parseInt(localStorage.getItem(COINSKEY) || '0', 10);
    }

    saveCoins() {
      localStorage.setItem(COINSKEY, String(this.totalCoins));
    }

    addCoins(amount) {
      this.totalCoins += amount;
      this.saveCoins();
    }
  }

  const playerStats = new PlayerStats();

  // ========== CHARACTER ASSET LOADER ==========
  class CharacterAsset {
    constructor() {
      this.image = new Image();
      this.loaded = false;
      this.loadCharacter();
    }

    loadCharacter() {
      this.image.src = 'ROSSY.jpeg';
      this.image.onload = () => {
        this.loaded = true;
      };
      this.image.onerror = () => {
        console.warn('Character asset failed to load, using fallback');
        this.loaded = false;
      };
    }

    draw(ctx, x, y, w, h, alpha = 1) {
      ctx.globalAlpha = alpha;
      if (this.loaded) {
        ctx.drawImage(this.image, x, y, w, h);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, w, h);
      }
      ctx.globalAlpha = 1;
    }
  }

  const characterAsset = new CharacterAsset();

  // ========== PARTICLE CLASS ==========
  class Particle {
    constructor(x, y, vx, vy, color, life = 0.5, size = 4) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.color = color;
      this.life = life;
      this.maxLife = life;
      this.size = size;
    }

    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += H * 1.5 * dt;
      this.life -= dt;
    }

    draw(ctx) {
      const alpha = Math.max(0, this.life / this.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  let particles = [];

  function spawnParticles(x, y, color, count = 8, speed = 200) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const vx = Math.cos(angle) * (speed * (0.6 + Math.random() * 0.8));
      const vy = Math.sin(angle) * (speed * (0.6 + Math.random() * 0.8));
      particles.push(new Particle(x, y, vx, vy, color, 0.6, 2 + Math.random() * 3));
    }
  }

  // ========== MOUNTAIN CLASS ==========
  class Mountain {
    constructor(x, y, w, h, color) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.color = color;
      this.peakX = x + w / 2;
      this.baseY = y + h;
    }

    draw(ctx) {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(this.x, this.baseY);
      ctx.lineTo(this.peakX, this.y);
      ctx.lineTo(this.x + this.w, this.baseY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(this.peakX, this.y);
      ctx.lineTo(this.peakX - this.w * 0.1, this.y + this.h * 0.15);
      ctx.lineTo(this.peakX + this.w * 0.1, this.y + this.h * 0.15);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ========== HP DISPLAY CLASS ==========
  class HPDisplay {
    constructor(maxHP) {
      this.maxHP = maxHP;
      this.currentHP = maxHP;
      this.displayHP = maxHP;
      this.damageFlashIntensity = 0;
      this.width = 300;
      this.height = 80;
    }

    takeDamage(amount) {
      this.currentHP = Math.max(0, this.currentHP - amount);
      this.damageFlashIntensity = 1;
    }

    heal(amount) {
      this.currentHP = Math.min(this.maxHP, this.currentHP + amount);
    }

    update(dt) {
      const hpDiff = this.displayHP - this.currentHP;
      if (Math.abs(hpDiff) > 0.5) {
        this.displayHP -= hpDiff * Math.min(1, dt * 3);
      } else {
        this.displayHP = this.currentHP;
      }

      if (this.damageFlashIntensity > 0) {
        this.damageFlashIntensity = Math.max(0, this.damageFlashIntensity - dt * 2);
      }
    }

    draw(ctx, x, y) {
      const hpPercent = Math.max(0, this.displayHP / this.maxHP);
      const barWidth = this.width - 50;

      const bgGradient = ctx.createLinearGradient(x, y, x, y + this.height);
      bgGradient.addColorStop(0, 'rgba(10, 20, 40, 0.9)');
      bgGradient.addColorStop(1, 'rgba(5, 10, 25, 0.95)');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(x, y, this.width, this.height);
      ctx.strokeStyle = `rgba(0, 255, 255, ${0.3 + this.damageFlashIntensity * 0.5})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, this.width, this.height);

      ctx.font = 'bold 40px Arial';
      ctx.fillStyle = '#ff6666';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('❤️', x + 15, y + this.height / 2);

      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('HP', x + 65, y + 18);

      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = hpPercent > 0.3 ? '#00ff88' : '#ff6666';
      ctx.fillText(`${Math.ceil(this.currentHP)} / ${this.maxHP}`, x + 65, y + 45);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(x + 20, y + 58, barWidth, 16);

      const hpGradient = ctx.createLinearGradient(x + 20, y + 58, x + 20, y + 74);
      if (hpPercent > 0.5) {
        hpGradient.addColorStop(0, '#00ff88');
        hpGradient.addColorStop(1, '#00cc66');
      } else if (hpPercent > 0.25) {
        hpGradient.addColorStop(0, '#ffff00');
        hpGradient.addColorStop(1, '#ffaa00');
      } else {
        hpGradient.addColorStop(0, '#ff6666');
        hpGradient.addColorStop(1, '#ff3333');
      }

      ctx.fillStyle = hpGradient;
      const fillWidth = (barWidth - 4) * hpPercent;
      ctx.fillRect(x + 22, y + 60, fillWidth, 12);

      ctx.strokeStyle = hpGradient;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 20, y + 58, barWidth, 16);

      if (this.damageFlashIntensity > 0) {
        ctx.fillStyle = `rgba(255, 100, 100, ${this.damageFlashIntensity * 0.3})`;
        ctx.fillRect(x, y, this.width, this.height);
      }
    }
  }

  // ========== POWERUP UI CLASS ==========
  class PowerUpUI {
    constructor() {
      this.activePowerups = {};
      this.popupAnimations = [];
      this.offsetX = 20;
      this.offsetY = 120;
      this.maxDisplayed = 4;
      this.cardWidth = 250;
      this.cardHeight = 90;
    }

    addPowerup(type, config, duration) {
      const id = Math.random().toString(36).substr(2, 9);
      this.activePowerups[id] = {
        type,
        config,
        duration,
        maxDuration: duration,
        id
      };

      this.popupAnimations.push({
        x: W / 2,
        y: H / 2,
        vx: (Math.random() - 0.5) * 200,
        vy: -300 - Math.random() * 200,
        life: 0.8,
        maxLife: 0.8,
        text: `+${config.name}!`,
        config
      });

      playSound(1000, 0.1, 'sine', 0.3);
    }

    update(dt) {
      Object.keys(this.activePowerups).forEach(id => {
        const pu = this.activePowerups[id];
        pu.duration -= dt;
        if (pu.duration <= 0) {
          delete this.activePowerups[id];
        }
      });

      for (let i = this.popupAnimations.length - 1; i >= 0; i--) {
        const p = this.popupAnimations[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 300 * dt;
        p.life -= dt;
        if (p.life <= 0) {
          this.popupAnimations.splice(i, 1);
        }
      }
    }

    draw(ctx) {
      const powerups = Object.values(this.activePowerups);
      powerups.slice(0, this.maxDisplayed).forEach((pu, index) => {
        const x = this.offsetX;
        const y = this.offsetY + index * (this.cardHeight + 15);
        this.drawPowerupCard(ctx, x, y, pu);
      });

      this.popupAnimations.forEach(p => {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = p.config.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = p.config.color;
        ctx.shadowBlur = 15;
        ctx.fillText(p.text, p.x, p.y);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      });
    }

    drawPowerupCard(ctx, x, y, powerup) {
      const timePercent = Math.max(0, powerup.duration / powerup.maxDuration);

      const bgGradient = ctx.createLinearGradient(x, y, x, y + this.cardHeight);
      bgGradient.addColorStop(0, powerup.config.bgColor);
      bgGradient.addColorStop(1, 'rgba(10, 20, 40, 0.8)');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(x, y, this.cardWidth, this.cardHeight);

      ctx.strokeStyle = powerup.config.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, this.cardWidth, this.cardHeight);

      ctx.font = 'bold 50px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(powerup.config.icon, x + 45, y + this.cardHeight / 2);

      ctx.font = 'bold 13px Arial';
      ctx.fillStyle = powerup.config.color;
      ctx.textAlign = 'left';
      ctx.fillText(powerup.config.name, x + 90, y + 15);

      ctx.font = 'bold 14px Arial';
      ctx.fillStyle = '#aabbcc';
      ctx.fillText(`${powerup.duration.toFixed(1)}s`, x + 90, y + 35);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(x + 90, y + 48, 150, 8);

      const progGradient = ctx.createLinearGradient(x + 90, y + 48, x + 240, y + 48);
      progGradient.addColorStop(0, powerup.config.color);
      progGradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
      ctx.fillStyle = progGradient;
      ctx.fillRect(x + 90, y + 48, 150 * timePercent, 8);

      ctx.strokeStyle = powerup.config.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 90, y + 48, 150, 8);
    }
  }

  // ========== SCORE MANAGER ==========
  class ScoreManager {
    constructor() {
      this.baseScore = 0;
      this.comboKills = 0;
      this.comboTimer = 0;
      this.comboMultiplier = 1;
      this.maxComboMultiplier = 10;
      this.comboResetTime = 3;
    }

    addScore(amount, type = 'default') {
      const multiplied = Math.floor(amount * this.comboMultiplier);

      switch(type) {
        case 'kill':
          this.baseScore += multiplied;
          this.comboKills++;
          this.comboTimer = this.comboResetTime;
          this.updateComboMultiplier();
          break;
        case 'boss_kill':
          this.baseScore += multiplied * 2;
          this.comboKills = 0;
          this.comboMultiplier = 1;
          break;
        default:
          this.baseScore += multiplied;
      }

      return multiplied;
    }

    updateComboMultiplier() {
      this.comboMultiplier = Math.min(
        this.maxComboMultiplier,
        1 + (Math.floor(this.comboKills / 3) * 0.5)
      );
    }

    update(dt) {
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
          this.comboKills = 0;
          this.comboMultiplier = 1;
        }
      }
    }

    getComboMultiplier() {
      return this.comboMultiplier.toFixed(1);
    }

    getTotalScore() {
      return this.baseScore;
    }
  }

  // ========== BOSS STAGE MANAGER ==========
  class BossStageManager {
    constructor() {
      this.currentStage = 1;
      this.bossDefeated = false;
      this.nextBossScore = 10000;
      this.bossSpawned = false;
    }

    shouldSpawnBoss(currentScore) {
      return currentScore >= this.nextBossScore && !this.bossSpawned && !this.bossDefeated;
    }

    spawnBoss() {
      if (this.bossSpawned) return false;
      this.bossSpawned = true;
      return true;
    }

    onBossDefeated() {
      this.bossDefeated = true;
      this.currentStage++;
      this.nextBossScore += 10000;

      setTimeout(() => {
        this.bossSpawned = false;
        this.bossDefeated = false;
      }, 2000);
    }

    getStage() {
      return this.currentStage;
    }

    getNextBossScore() {
      return this.nextBossScore;
    }
  }

  // ========== PLAYER CLASS ==========
  class Player {
    constructor(x, groundY) {
      this.x = x;
      this.groundY = groundY;
      this.w = Math.round(W * 0.055);
      this.h = Math.round(H * 0.13);
      this.reset();
    }

    reset() {
      this.y = this.groundY - this.h;
      this.vx = 0;
      this.vy = 0;
      this.onGround = true;
      this.alive = true;
      this.hp = playerStats.hp;
      this.maxHp = playerStats.hp;
      this.fireRate = playerStats.fireRate;
      this.fireTimer = 0;
      this.shieldActive = false;
      this.shieldTimer = 0;
      this.rapidFireActive = false;
      this.rapidFireTimer = 0;
      this.freezeActive = false;
      this.freezeTimer = 0;
      this.damageMultiplier = 1.0;
      this.fireRateBoostActive = false;
      this.fireRateBoostTimer = 0;
      this.bulletSplitActive = false;
      this.bulletSplitTimer = 0;
      this.missileActive = false;
      this.missileTimer = 0;
      this.speed = playerStats.movement;
      this.jumpPower = -playerStats.jumpSpeed;
      this.baseDamage = playerStats.damage;
      this.coins = 0;
      this.criticalRate = playerStats.criticalRate;
      this.criticalDamage = playerStats.criticalDamage;

      this.hpDisplay = new HPDisplay(this.maxHp);
      this.powerupUI = new PowerUpUI();
      this.activePowerups = {};
    }

    rect() {
      return { x: this.x, y: this.y, w: this.w, h: this.h };
    }

    centerX() {
      return this.x + this.w / 2;
    }

    centerY() {
      return this.y + this.h / 2;
    }

    getDamage() {
      let dmg = this.baseDamage * this.damageMultiplier;
      if (Math.random() < this.criticalRate) {
        dmg *= this.criticalDamage;
      }
      return dmg;
    }

    getFireRate() {
      let rate = this.fireRate;
      if (this.rapidFireActive) rate *= 0.4;
      if (this.fireRateBoostActive) rate *= 0.5;
      return rate;
    }

    canShoot() {
      return this.fireTimer <= 0;
    }

    shoot() {
      this.fireTimer = this.getFireRate();
      playSound(400, 0.05, 'sine', 0.2);
    }

    jump() {
      if (this.onGround) {
        this.vy = this.jumpPower;
        this.onGround = false;
        playSound(300, 0.08, 'sine', 0.18);
      }
    }

    heal(percentAmount) {
      const healAmount = this.maxHp * percentAmount;
      this.hp = Math.min(this.maxHp, this.hp + healAmount);
      this.hpDisplay.heal(healAmount);
      playSound(800, 0.2, 'sine', 0.25);
      spawnParticles(this.centerX(), this.centerY(), '#00ff88', 15, 200);
    }

    takeDamage() {
      if (!this.shieldActive) {
        this.hp -= 1;
        this.hpDisplay.takeDamage(1);
        playSound(200, 0.2, 'sine', 0.28);
        spawnParticles(this.centerX(), this.centerY(), '#ff4444', 12, 250);
        return true;
      } else if (this.shieldActive) {
        this.shieldActive = false;
        this.shieldTimer = 0;
        playSound(600, 0.08, 'sine', 0.2);
        spawnParticles(this.centerX(), this.centerY(), '#44ff44', 8, 180);
        return true;
      }
      return false;
    }

    activatePowerup(type, config, duration) {
      const id = Math.random().toString(36).substr(2, 9);
      this.activePowerups[id] = {
        type,
        duration,
        startTime: performance.now()
      };
      this.powerupUI.addPowerup(type, config, duration);
      return id;
    }

    update(dt, input) {
      this.vx = 0;
      if (input.left) this.vx = -this.speed;
      if (input.right) this.vx = this.speed;

      this.x += this.vx * dt;
      this.x = Math.max(0, Math.min(W - this.w, this.x));

      if (!this.onGround || this.vy < 0) {
        this.vy += H * 2.8 * dt;
        this.y += this.vy * dt;
        if (this.y >= this.groundY - this.h) {
          this.y = this.groundY - this.h;
          this.vy = 0;
          this.onGround = true;
        }
      }

      if (this.shieldActive) {
        this.shieldTimer -= dt;
        if (this.shieldTimer <= 0) this.shieldActive = false;
      }
      if (this.rapidFireActive) {
        this.rapidFireTimer -= dt;
        if (this.rapidFireTimer <= 0) this.rapidFireActive = false;
      }
      if (this.freezeActive) {
        this.freezeTimer -= dt;
        if (this.freezeTimer <= 0) this.freezeActive = false;
      }
      if (this.fireRateBoostActive) {
        this.fireRateBoostTimer -= dt;
        if (this.fireRateBoostTimer <= 0) this.fireRateBoostActive = false;
      }
      if (this.bulletSplitActive) {
        this.bulletSplitTimer -= dt;
        if (this.bulletSplitTimer <= 0) this.bulletSplitActive = false;
      }
      if (this.missileActive) {
        this.missileTimer -= dt;
        if (this.missileTimer <= 0) this.missileActive = false;
      }

      this.fireTimer = Math.max(0, this.fireTimer - dt);
      this.hpDisplay.update(dt);
      this.powerupUI.update(dt);
    }

    draw(ctx) {
      const pr = this.rect();
      characterAsset.draw(ctx, pr.x, pr.y, pr.w, pr.h, 1);

      if (this.shieldActive) {
        ctx.strokeStyle = 'rgba(68, 255, 68, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pr.x + pr.w / 2, pr.y + pr.h / 2, pr.w / 2 + 15, 0, Math.PI * 2);
        ctx.stroke();
      }

      this.hpDisplay.draw(ctx, 20, 20);
      this.powerupUI.draw(ctx);
    }
  }

  // ========== BULLET CLASS ==========
  class Bullet {
    constructor(x, y, damage = 1.0, type = 'normal') {
      this.x = x;
      this.y = y;
      this.w = Math.round(W * 0.015);
      this.h = Math.round(H * 0.008);
      this.speed = W * 0.8;
      this.damage = damage;
      this.type = type;
    }

    rect() {
      return { x: this.x, y: this.y, w: this.w, h: this.h };
    }

    update(dt) {
      this.x += this.speed * dt;
      if (this.type === 'missile') {
        this.y += Math.sin(this.x * 0.01) * 100 * dt;
      }
    }

    draw(ctx) {
      if (this.type === 'missile') {
        ctx.fillStyle = '#ff00ff';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - 8, this.y - 4);
        ctx.lineTo(this.x - 8, this.y + 4);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.shadowColor = 'rgba(255, 200, 0, 0.8)';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#ff8800';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.w, this.h);
        ctx.shadowColor = 'transparent';
      }
    }
  }

  // ========== MINION CLASS - SIMPLIFIED ==========
  class Minion {
    constructor(x, groundY, scoreMultiplier, playerDamage = 1.0) {
      this.x = x;
      this.y = groundY - Math.round(H * 0.075);
      this.w = Math.round(W * 0.035);
      this.h = Math.round(H * 0.075);
      this.groundY = groundY;
      this.isAlive = true;

      const healthMultiplier = Math.pow(1.12, scoreMultiplier);
      const damageScaling = Math.max(1, playerDamage * 0.5);
      this.health = 3 * healthMultiplier * damageScaling;
      this.maxHealth = this.health;
      this.damaged = false;
      this.damageFlash = 0;

      this.speed = -rand(W * 0.25, W * 0.35);
    }

    rect() {
      return { x: this.x, y: this.y, w: this.w, h: this.h };
    }

    centerX() {
      return this.x + this.w / 2;
    }

    centerY() {
      return this.y + this.h / 2;
    }

    takeDamage(amount = 1.0) {
      this.health -= amount;
      this.damaged = true;
      this.damageFlash = 0.18;
      playSound(150, 0.08, 'sine', 0.22);
      spawnParticles(this.centerX(), this.centerY(), '#ffaa00', 6, 150);
    }

    update(dt, freeze = false) {
      if (this.damaged) {
        this.damageFlash -= dt;
        if (this.damageFlash <= 0) this.damaged = false;
      }
      if (!freeze) this.x += this.speed * dt;
    }

    draw(ctx) {
      const pr = this.rect();
      if (this.damaged) ctx.globalAlpha = 0.6;

      ctx.fillStyle = '#ffd54a';
      ctx.fillRect(pr.x, pr.y, pr.w, pr.h);

      const healthBarW = pr.w * 0.8;
      const healthPercent = this.health / this.maxHealth;
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(pr.x + pr.w * 0.1, pr.y - 6, healthBarW, 3);
      ctx.fillStyle = '#44ff44';
      ctx.fillRect(pr.x + pr.w * 0.1, pr.y - 6, healthBarW * healthPercent, 3);

      ctx.fillStyle = '#000';
      const eyeW = pr.w * 0.15;
      const eyeH = pr.h * 0.2;
      ctx.fillRect(pr.x + pr.w * 0.15, pr.y + pr.h * 0.25, eyeW, eyeH);
      ctx.fillRect(pr.x + pr.w * 0.55, pr.y + pr.h * 0.25, eyeW, eyeH);

      ctx.globalAlpha = 1.0;
    }
  }

  // ========== BOSS MINION CLASS - SIMPLIFIED ==========
  class BossMinion {
    constructor(x, groundY, scoreMultiplier, playerDamage = 1.0) {
      this.x = x;
      this.y = groundY - Math.round(H * 0.14);
      this.w = Math.round(W * 0.08);
      this.h = Math.round(H * 0.14);
      this.groundY = groundY;
      this.isAlive = true;

      const healthMultiplier = Math.pow(1.12, scoreMultiplier);
      const damageScaling = Math.max(1, playerDamage * 0.5);
      this.health = 25 * healthMultiplier * damageScaling;
      this.maxHealth = this.health;
      this.damaged = false;
      this.damageFlash = 0;
      this.invulnTimer = 0;

      this.speed = -rand(W * 0.15, W * 0.25);
    }

    rect() {
      return { x: this.x, y: this.y, w: this.w, h: this.h };
    }

    centerX() {
      return this.x + this.w / 2;
    }

    centerY() {
      return this.y + this.h / 2;
    }

    takeDamage(amount = 1.0) {
      this.health -= amount;
      this.damaged = true;
      this.damageFlash = 0.2;
      this.invulnTimer = 0.1;
      playSound(100, 0.12, 'sine', 0.28);
      spawnParticles(this.centerX(), this.centerY(), '#ff6b4a', 10, 200);
    }

    update(dt, freeze = false) {
      if (this.damaged) {
        this.damageFlash -= dt;
        if (this.damageFlash <= 0) this.damaged = false;
      }
      if (this.invulnTimer > 0) this.invulnTimer -= dt;
      if (!freeze) this.x += this.speed * dt;
    }

    draw(ctx) {
      const pr = this.rect();

      ctx.save();
      const gradient = ctx.createRadialGradient(
        pr.x + pr.w / 2,
        pr.y + pr.h / 2,
        0,
        pr.x + pr.w / 2,
        pr.y + pr.h / 2,
        pr.w / 2 + 15
      );
      gradient.addColorStop(0, 'rgba(255, 100, 100, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 100, 100, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(pr.x - 15, pr.y - 15, pr.w + 30, pr.h + 30);
      ctx.restore();

      if (this.damaged) ctx.globalAlpha = 0.6;

      ctx.fillStyle = '#ff6b4a';
      ctx.fillRect(pr.x, pr.y, pr.w, pr.h);

      const healthBarW = pr.w * 0.9;
      const healthPercent = Math.max(0, this.health / this.maxHealth);
      ctx.fillStyle = '#ff2222';
      ctx.fillRect(pr.x + pr.w * 0.05, pr.y - 12, healthBarW, 6);
      ctx.fillStyle = '#ffff44';
      ctx.fillRect(pr.x + pr.w * 0.05, pr.y - 12, healthBarW * healthPercent, 6);

      ctx.fillStyle = '#000';
      ctx.fillRect(pr.x + pr.w * 0.15, pr.y + pr.h * 0.2, pr.w * 0.2, pr.h * 0.25);
      ctx.fillRect(pr.x + pr.w * 0.65, pr.y + pr.h * 0.2, pr.w * 0.2, pr.h * 0.25);

      ctx.globalAlpha = 1.0;
    }
  }

  // ========== COIN CLASS ==========
  class Coin {
    constructor(x, y, groundY, value = 20) {
      this.x = x;
      this.groundY = groundY;
      this.y = y;
      this.r = Math.max(10, Math.round(H * 0.022));
      this.floatTimer = 0;
      this.targetFloatHeight = rint(15, 40);
      this.hasAttraction = false;
      this.value = value;
      this.spawnTime = performance.now();
      this.lifespan = 8000;
    }

    isExpired() {
      return (performance.now() - this.spawnTime) > this.lifespan;
    }

    rect() {
      return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 };
    }

    update(dt, px, py) {
      if (this.isExpired()) return;

      this.floatTimer += dt;
      const fw = Math.sin(this.floatTimer * 3) * this.targetFloatHeight;
      this.y = this.groundY - this.r - this.targetFloatHeight + fw;

      const dist = distance(this.x, this.y, px, py);
      if (dist < 80) {
        this.hasAttraction = true;
        const angle = Math.atan2(py - this.y, px - this.x);
        this.x += Math.cos(angle) * W * 0.3 * dt;
        this.y += Math.sin(angle) * W * 0.2 * dt;
      }
    }

    draw(ctx) {
      if (this.isExpired()) {
        ctx.globalAlpha = Math.max(0, 1 - ((performance.now() - this.spawnTime - this.lifespan + 2000) / 2000));
      }

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.floatTimer * 4);

      if (this.hasAttraction) {
        ctx.fillStyle = 'rgba(255, 255, 100, 0.5)';
        ctx.beginPath();
        ctx.arc(0, 0, this.r + 8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#ffd54a';
      ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, this.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#f0b81f';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#333';
      ctx.font = `bold ${this.r}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);

      ctx.shadowColor = 'transparent';
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // ========== HP RECOVERY ITEM CLASS ==========
  class HPRecoveryItem {
    constructor(x, y, groundY) {
      this.x = x;
      this.y = y;
      this.groundY = groundY;
      this.r = 20;
      this.floatTimer = 0;
      this.targetFloatHeight = 25;
      this.hasAttraction = false;
      this.spawnTime = performance.now();
      this.lifespan = 8000;
      this.recoveryAmount = 0.25;
    }

    isExpired() {
      return (performance.now() - this.spawnTime) > this.lifespan;
    }

    rect() {
      return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 };
    }

    update(dt, playerX, playerY) {
      if (this.isExpired()) return;

      this.floatTimer += dt;
      const fw = Math.sin(this.floatTimer * 2.5) * this.targetFloatHeight;
      this.y = this.groundY - this.r - this.targetFloatHeight + fw;

      const dx = playerX - this.x;
      const dy = playerY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 120) {
        this.hasAttraction = true;
        const angle = Math.atan2(dy, dx);
        this.x += Math.cos(angle) * 250 * dt;
        this.y += Math.sin(angle) * 200 * dt;
      }
    }

    draw(ctx) {
      if (this.isExpired()) {
        ctx.globalAlpha = Math.max(0, 1 - ((performance.now() - this.spawnTime - this.lifespan + 2000) / 2000));
      }

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.floatTimer * 3);

      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 20;

      ctx.fillStyle = 'rgba(0, 255, 136, 0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, this.r + 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#00ff88';
      ctx.beginPath();
      ctx.arc(0, 0, this.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = `bold ${this.r * 1.4}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('❤️', 0, 0);

      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // ========== POWERUP CLASS ==========
  class PowerUp {
    constructor(x, y, type, groundY) {
      this.x = x;
      this.groundY = groundY;
      this.y = y;
      this.r = Math.round(H * 0.025);
      this.type = type;
      this.config = POWERUPS[type];
      this.floatTimer = 0;
      this.blink = 0;
      this.targetFloatHeight = rint(20, 50);
      this.hasAttraction = false;
      this.spawnTime = performance.now();
      this.lifespan = 8000;
    }

    isExpired() {
      return (performance.now() - this.spawnTime) > this.lifespan;
    }

    rect() {
      return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 };
    }

    update(dt, px, py) {
      if (this.isExpired()) return;

      this.floatTimer += dt;
      this.blink += dt;

      const fw = Math.sin(this.floatTimer * 2.5) * this.targetFloatHeight;
      this.y = this.groundY - this.r - this.targetFloatHeight + fw;

      const dist = distance(this.x, this.y, px, py);
      if (dist < 80) {
        this.hasAttraction = true;
        const angle = Math.atan2(py - this.y, px - this.x);
        this.x += Math.cos(angle) * W * 0.35 * dt;
        this.y += Math.sin(angle) * W * 0.2 * dt;
      }
    }

    draw(ctx) {
      if (this.isExpired()) {
        ctx.globalAlpha = Math.max(0, 1 - ((performance.now() - this.spawnTime - this.lifespan + 2000) / 2000));
      }

      if (Math.floor(this.blink * 3) % 2 === 0) ctx.globalAlpha = 0.6;

      ctx.save();
      ctx.translate(this.x, this.y);

      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, this.r);
      g.addColorStop(0, this.config.color);
      g.addColorStop(1, 'transparent');
      ctx.shadowColor = this.config.color;
      ctx.shadowBlur = 20;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, this.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = this.config.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.r * 0.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = `bold ${this.r * 1.4}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.config.icon, 0, 0);

      ctx.shadowColor = 'transparent';
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // ========== SPAWN COINS FUNCTION ==========
  function spawnCoinsFromMinion(x, groundY) {
    const coinCount = rint(3, 4);
    
    for (let i = 0; i < coinCount; i++) {
      const offsetX = rand(-40, 40);
      const offsetY = rand(-10, 30);
      coins.push(new Coin(x + offsetX, groundY - 20 + offsetY, groundY, 20));
    }
  }

  // ========== GAME STATE ==========
  let lastTime = performance.now() / 1000;
  let running = false;
  let paused = false;

  let currentStage = 1;
  let spawnInterval = 3.0;
  let timeSinceSpawn = 0;

  let bullets = [];
  let minions = [];
  let bosses = [];
  let coins = [];
  let powerups = [];
  let recoveryItems = [];
  let mountains = [];
  let player = null;
  let score = 0;
  let sessionCoins = 0;
  let minionKills = 0;
  let bossKills = 0;
  let nextBossScore = 10000;
  let highscore = parseInt(localStorage.getItem(HIGHKEY) || '0', 10);
  let bossDefeatedTimer = 0;
  let waveNumber = 0;

  const scoreManager = new ScoreManager();
  const bossStageManager = new BossStageManager();
  const input = { left: false, right: false, shoot: false, jump: false };

  // ========== GENERATE MOUNTAINS ==========
  function generateMountains() {
    mountains = [];
    const colors = ['#8b6f47', '#a0845f', '#755a3f', '#9d7d5f', '#806b45'];
    let x = -100;
    while (x < W * 2.5) {
      const h = rint(150, 350);
      const w = rint(200, 400);
      const y = H - GROUND_H - h;
      const color = colors[rint(0, colors.length - 1)];
      mountains.push(new Mountain(x, y, w, h, color));
      x += w + rint(50, 150);
    }
  }

  // ========== START GAME ==========
  function startGame() {
    player = new Player(W / 2, H - GROUND_H);
    bullets = [];
    minions = [];
    bosses = [];
    coins = [];
    powerups = [];
    recoveryItems = [];
    particles = [];
    generateMountains();

    score = 0;
    scoreManager.baseScore = 0;
    sessionCoins = 0;
    minionKills = 0;
    bossKills = 0;
    bossDefeatedTimer = 0;
    waveNumber = 0;
    nextBossScore = 10000;
    spawnInterval = 3.0;
    timeSinceSpawn = 0;
    currentStage = 1;
    running = true;
    paused = false;

    bossStageManager.currentStage = 1;
    bossStageManager.bossDefeated = false;
    bossStageManager.nextBossScore = 10000;
    bossStageManager.bossSpawned = false;

    if (bgmAudio) {
      bgmAudio.currentTime = 0;
      bgmAudio.play().catch(() => {});
    }

    initBGM();
  }

  // ========== SPAWN WAVE MINIONS ==========
  function spawnWaveMinions() {
    let minionCount = 1;
    let spawnDelay = 0;

    if (waveNumber % 4 === 0) {
      minionCount = 1;
      spawnDelay = 0;
    } else if (waveNumber % 4 === 1) {
      minionCount = 2;
      spawnDelay = 0.9;
    } else if (waveNumber % 4 === 2) {
      minionCount = 2;
      spawnDelay = 0;
    } else {
      minionCount = 3;
      spawnDelay = 1.2;
    }

    for (let i = 0; i < minionCount; i++) {
      setTimeout(() => {
        if (running && bosses.length === 0) {
          const x = W + 50 + i * 150;
          const m = new Minion(x, H - GROUND_H, Math.floor(score / 1000), player.baseDamage);
          minions.push(m);
          playSound(500 + i * 80, 0.08, 'sine', 0.12);
        }
      }, spawnDelay * i * 1000);
    }
    waveNumber++;
  }

  // ========== SPAWN BOSS ==========
  function spawnBoss() {
    if (!bossStageManager.spawnBoss()) return;
    
    const boss = new BossMinion(W + 50, H - GROUND_H, bossKills, player.baseDamage);
    bosses.push(boss);
    playSound(200, 0.5, 'sine', 0.4);
    spawnParticles(W + 50, H / 2, '#ff6b4a', 20, 300);
  }

  // ========== GAME OVER ==========
  function showGameOverModal(finalScore, sessionCoins, minionKills, bossKills, highscore) {
    running = false;
    if (bgmAudio) bgmAudio.pause();
    playSound(100, 0.5, 'sine', 0.3);

    setTimeout(() => {
      if (typeof window.showGameOverModal === 'function') {
        window.showGameOverModal(finalScore, sessionCoins, minionKills, bossKills, highscore);
      }
    }, 1000);
  }

  // ========== UPDATE FUNCTION ==========
  function update(dt) {
    if (!running || paused) return;

    scoreEl.textContent = score;

    if (bossDefeatedTimer > 0) {
      bossDefeatedTimer -= dt;  
      return;
    }

    if (bossStageManager.shouldSpawnBoss(score)) {
      spawnBoss();
    }

    timeSinceSpawn += dt;
    if (timeSinceSpawn >= spawnInterval && bosses.length === 0) {
      spawnWaveMinions();
      timeSinceSpawn = 0;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update(dt);
      if (particles[i].life <= 0) particles.splice(i, 1);
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].update(dt);
      if (bullets[i].x > W + 200) bullets.splice(i, 1);
    }

    // ========== MINION UPDATE & COLLISION ==========
    for (let i = minions.length - 1; i >= 0; i--) {
      const m = minions[i];
      m.update(dt, player.freezeActive);

      // Bullet collision
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (rectsOverlap(b.rect(), m.rect())) {
          m.takeDamage(b.damage);
          bullets.splice(j, 1);

          if (m.health <= 0 && m.isAlive) {
            m.isAlive = false;

            const groundY = H - GROUND_H;
            spawnCoinsFromMinion(m.x, groundY);

            if (Math.random() < 0.10) {
              recoveryItems.push(new HPRecoveryItem(m.x + rand(-30, 30), groundY - 25, groundY));
            }

            if (Math.random() < 0.4) {
              const types = Object.keys(POWERUPS);
              const type = types[rint(0, types.length - 1)];
              powerups.push(new PowerUp(m.x, groundY - 25, type, groundY));
            }

            minionKills++;
            scoreManager.addScore(200, 'kill');
            score = scoreManager.getTotalScore();
            comboEl.textContent = `x${scoreManager.getComboMultiplier()} COMBO`;

            sessionCoins += 80;
            sessionCoinsEl.textContent = sessionCoins;
            playSound(800, 0.12, 'sine', 0.28);
            
            // ✅ LANGSUNG HAPUS dari array
            minions.splice(i, 1);
            break;
          }
          break;
        }
      }

      // Player collision
      if (i < minions.length && rectsOverlap(player.rect(), m.rect())) {
        if (player.takeDamage()) {
          minions.splice(i, 1);
          if (player.hp <= 0) {
            if (score > highscore) {
              highscore = score;
              localStorage.setItem(HIGHKEY, String(highscore));
            }
            showGameOverModal(score, sessionCoins, minionKills, bossKills, highscore);
          }
        }
      }

      if (i < minions.length && m.x < -200) {
        minions.splice(i, 1);
      }
    }

    // ========== BOSS UPDATE & COLLISION ==========
    for (let i = bosses.length - 1; i >= 0; i--) {
      const b = bosses[i];
      b.update(dt, player.freezeActive);

      for (let j = bullets.length - 1; j >= 0; j--) {
        const bl = bullets[j];
        if (rectsOverlap(bl.rect(), b.rect())) {
          b.takeDamage(bl.damage);
          bullets.splice(j, 1);
          score += 50;

          if (b.health <= 0) {
            const groundY = H - GROUND_H;

            for (let k = 0; k < 2; k++) {
              spawnCoinsFromMinion(b.x + rand(-60, 60), groundY);
            }

            for (let w = 0; w < 2; w++) {
              recoveryItems.push(new HPRecoveryItem(b.x + rand(-60, 60), groundY - 40, groundY));
            }

            const types = Object.keys(POWERUPS);
            const type = types[rint(0, types.length - 1)];
            powerups.push(new PowerUp(b.x, groundY - 25, type, groundY));

            bosses.splice(i, 1);
            bossKills++;
            bossStageManager.onBossDefeated();
            currentStage++;
            score += 1000;
            sessionCoins += 160;
            bossDefeatedTimer = 2;
            stageEl.textContent = `🎮 Stage: ${currentStage} | 💰 Coins: ${sessionCoins}`;
            playSound(1200, 0.4, 'sine', 0.4);
            break;
          }
          break;
        }
      }

      if (i < bosses.length && rectsOverlap(player.rect(), b.rect())) {
        if (player.takeDamage()) {
          if (player.hp <= 0) {
            if (score > highscore) {
              highscore = score;
              localStorage.setItem(HIGHKEY, String(highscore));
            }
            showGameOverModal(score, sessionCoins, minionKills, bossKills, highscore);
          }
        }
      }

      if (i < bosses.length && b.x < -200) {
        bosses.splice(i, 1);
      }
    }

    // Update coins
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.update(dt, player.centerX(), player.centerY());

      if (rectsOverlap(player.rect(), c.rect())) {
        coins.splice(i, 1);
        sessionCoins += c.value;
        playerStats.addCoins(c.value);
        score += 50;
        playSound(600, 0.08, 'sine', 0.2);
        spawnParticles(player.centerX(), player.centerY(), '#ffd54a', 6, 120);
      } else if (c.isExpired()) {
        coins.splice(i, 1);
      }
    }

    // Update recovery items
    for (let i = recoveryItems.length - 1; i >= 0; i--) {
      const item = recoveryItems[i];
      item.update(dt, player.centerX(), player.centerY());

      if (rectsOverlap(player.rect(), item.rect())) {
        player.heal(item.recoveryAmount);
        recoveryItems.splice(i, 1);
        score += 100;
        playSound(900, 0.15, 'sine', 0.3);
      } else if (item.isExpired()) {
        recoveryItems.splice(i, 1);
      }
    }

    // Update powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.update(dt, player.centerX(), player.centerY());

      if (rectsOverlap(player.rect(), p.rect())) {
        const type = p.type;
        if (type === 'RAPID_FIRE') {
          player.rapidFireActive = true;
          player.rapidFireTimer = POWERUPS.RAPID_FIRE.duration;
          player.activatePowerup(type, POWERUPS.RAPID_FIRE, POWERUPS.RAPID_FIRE.duration);
        } else if (type === 'SHIELD') {
          player.shieldActive = true;
          player.shieldTimer = POWERUPS.SHIELD.duration;
          player.activatePowerup(type, POWERUPS.SHIELD, POWERUPS.SHIELD.duration);
        } else if (type === 'FREEZE') {
          player.freezeActive = true;
          player.freezeTimer = POWERUPS.FREEZE.duration;
          player.activatePowerup(type, POWERUPS.FREEZE, POWERUPS.FREEZE.duration);
        } else if (type === 'DAMAGE') {
          player.damageMultiplier += 0.5;
          player.activatePowerup(type, POWERUPS.DAMAGE, 10);
          spawnParticles(player.centerX(), player.centerY(), '#ff1111', 12, 220);
        } else if (type === 'FIRE_RATE') {
          player.fireRateBoostActive = true;
          player.fireRateBoostTimer = POWERUPS.FIRE_RATE.duration;
          player.activatePowerup(type, POWERUPS.FIRE_RATE, POWERUPS.FIRE_RATE.duration);
        } else if (type === 'BULLET_SPLIT') {
          player.bulletSplitActive = true;
          player.bulletSplitTimer = POWERUPS.BULLET_SPLIT.duration;
          player.activatePowerup(type, POWERUPS.BULLET_SPLIT, POWERUPS.BULLET_SPLIT.duration);
        } else if (type === 'MISSILE') {
          player.missileActive = true;
          player.missileTimer = POWERUPS.MISSILE.duration;
          player.activatePowerup(type, POWERUPS.MISSILE, POWERUPS.MISSILE.duration);
        }

        powerups.splice(i, 1);
        score += 150;
        playSound(1000, 0.15, 'sine', 0.3);
      } else if (p.isExpired()) {
        powerups.splice(i, 1);
      }
    }

    scoreManager.update(dt);
    player.update(dt, input);

    if (input.shoot && running && player.canShoot()) {
      const bulletY = player.y + player.h / 2;
      const damage = player.getDamage();

      if (player.missileActive) {
        bullets.push(new Bullet(player.x + player.w, bulletY, damage, 'missile'));
      } else if (player.bulletSplitActive) {
        bullets.push(new Bullet(player.x + player.w, bulletY - 20, damage, 'normal'));
        bullets.push(new Bullet(player.x + player.w, bulletY, damage, 'normal'));
        bullets.push(new Bullet(player.x + player.w, bulletY + 20, damage, 'normal'));
      } else {
        bullets.push(new Bullet(player.x + player.w, bulletY, damage, 'normal'));
      }

      player.shoot();
    }
  }

  // ========== DRAW FUNCTION ==========
  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#cfeefb');
    g.addColorStop(1, '#90d1a8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const m of mountains) m.draw(ctx);

    ctx.fillStyle = '#2f7a3a';
    ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fillRect(0, H - GROUND_H, W, Math.round(GROUND_H * 0.18));

    for (const m of minions) m.draw(ctx);
    for (const b of bosses) b.draw(ctx);
    for (const bl of bullets) bl.draw(ctx);
    for (const c of coins) c.draw(ctx);
    for (const item of recoveryItems) item.draw(ctx);
    for (const p of powerups) p.draw(ctx);
    for (const part of particles) part.draw(ctx);

    player.draw(ctx);
  }

  // ========== MAIN LOOP ==========
  function gameLoop() {
    const now = performance.now() / 1000;
    const dt = Math.min(now - lastTime, 0.016);
    lastTime = now;

    if (!paused) {
      update(dt);
    }
    draw();

    requestAnimationFrame(gameLoop);
  }

  // ========== EVENT LISTENERS ==========
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = true;
    if (e.code === 'Space') {
      e.preventDefault();
      input.jump = true;
      player.jump();
    }
    if (e.code === 'KeyP') {
      e.preventDefault();
      paused = !paused;
      if (paused) {
        showPauseModal();
      } else {
        hidePauseModal();
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = false;
    if (e.code === 'Space') input.jump = false;
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.shoot = true;
      if (!running) startGame();
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.shoot = false;
  });

  canvas.addEventListener('mouseleave', () => {
    input.shoot = false;
  });

  canvas.addEventListener('touchstart', (ev) => {
    input.shoot = true;
    if (!running) startGame();
  }, { passive: true });

  canvas.addEventListener('touchend', () => {
    input.shoot = false;
  }, { passive: true });

  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    if (paused) {
      showPauseModal();
      pauseBtn.textContent = '▶ RESUME';
    } else {
      hidePauseModal();
      pauseBtn.textContent = '⏸ PAUSE';
    }
  });

  // ========== INITIALIZATION ==========
  initBGM();
  highEl.textContent = highscore;
  startGame();
  gameLoop();
})();