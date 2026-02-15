// ========== CONSTANTS ==========
const STATSKEY = 'minion_chase_stats_v1';
const COINSKEY = 'minion_chase_coins_v1';
const HIGHKEY = 'minion_chase_high_v1';

const UPGRADES = {
  HP: { name: 'HP', icon: '❤️', cost: 100, baseValue: 1, statKey: 'hp', suffix: '' },
  DAMAGE: { name: 'Damage', icon: '💥', cost: 150, baseValue: 0.2, statKey: 'damage', suffix: '' },
  CRIT_DAMAGE: { name: 'Crit Damage', icon: '⚡', cost: 200, baseValue: 0.2, statKey: 'criticalDamage', suffix: 'x' },
  CRIT_RATE: { name: 'Crit Rate', icon: '🎯', cost: 180, baseValue: 0.05, statKey: 'criticalRate', suffix: '%' },
  FIRE_RATE: { name: 'Fire Rate', icon: '🔥', cost: 120, baseValue: -0.02, statKey: 'fireRate', suffix: 's' },
  MOVEMENT: { name: 'Movement Speed', icon: '🏃', cost: 140, baseValue: 50, statKey: 'movement', suffix: '' },
  JUMP_SPEED: { name: 'Jump Speed', icon: '⬆️', cost: 160, baseValue: 100, statKey: 'jumpSpeed', suffix: '' }
};

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
        this.hp = data.hp || 3;
        this.damage = data.damage || 1.0;
        this.criticalDamage = data.criticalDamage || 1.5;
        this.criticalRate = data.criticalRate || 0.1;
        this.fireRate = data.fireRate || 0.25;
        this.movement = data.movement || 400;
        this.jumpSpeed = data.jumpSpeed || 950;
      } catch (e) {
        this.setDefaults();
      }
    } else {
      this.setDefaults();
    }
  }

  setDefaults() {
    this.hp = 3;
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

  spendCoins(amount) {
    if (this.totalCoins >= amount) {
      this.totalCoins -= amount;
      this.saveCoins();
      return true;
    }
    return false;
  }

  upgradeUpgrade(upgradeKey) {
    const upgrade = UPGRADES[upgradeKey];
    if (!upgrade) return false;
    if (!this.spendCoins(upgrade.cost)) return false;

    const statKey = upgrade.statKey;
    const currentValue = this[statKey];
    let newValue;

    if (upgradeKey === 'FIRE_RATE') {
      newValue = Math.max(0.05, currentValue + upgrade.baseValue);
    } else {
      newValue = currentValue + upgrade.baseValue;
    }

    this[statKey] = newValue;
    this.saveStats();
    return true;
  }

  resetStats() {
    this.setDefaults();
    this.totalCoins = 0;
    this.saveCoins();
  }
}

const playerStats = new PlayerStats();

// ========== UI FUNCTIONS ==========
function showNotification(message, isError = false) {
  const notif = document.getElementById('notification');
  notif.textContent = message;
  notif.className = `notification ${isError ? 'error' : ''}`;
  notif.style.display = 'block';

  setTimeout(() => {
    notif.style.display = 'none';
  }, 3000);
}

function formatValue(value, suffix) {
  if (suffix === '%') {
    return (value * 100).toFixed(0) + '%';
  } else if (suffix === 'x') {
    return value.toFixed(2) + 'x';
  } else if (suffix === 's') {
    return value.toFixed(2) + 's';
  }
  return Math.round(value).toString();
}

function updateDisplay() {
  document.getElementById('totalCoins').textContent = playerStats.totalCoins;
  document.getElementById('statHP').textContent = playerStats.hp;
  document.getElementById('statDamage').textContent = playerStats.damage.toFixed(2);
  document.getElementById('statCritDmg').textContent = playerStats.criticalDamage.toFixed(2) + 'x';
  document.getElementById('statCritRate').textContent = (playerStats.criticalRate * 100).toFixed(0) + '%';
  document.getElementById('statFireRate').textContent = playerStats.fireRate.toFixed(2) + 's';
  document.getElementById('statMovement').textContent = playerStats.movement;
}

function createUpgradeCard(key, upgrade) {
  const card = document.createElement('div');
  card.className = 'upgrade-card';

  const statKey = upgrade.statKey;
  const currentValue = playerStats[statKey];
  const canAfford = playerStats.totalCoins >= upgrade.cost;
  const nextValue = statKey === 'fireRate' ? Math.max(0.05, currentValue + upgrade.baseValue) : currentValue + upgrade.baseValue;

  card.innerHTML = `
    <div class="upgrade-header">
      <div class="upgrade-icon">${upgrade.icon}</div>
      <div class="upgrade-info">
        <h2>${upgrade.name}</h2>
        <p>Upgrade your ${upgrade.name.toLowerCase()}</p>
      </div>
    </div>

    <div class="upgrade-stats">
      <div class="stat-row">
        <span class="stat-label">Current Value:</span>
        <span class="stat-value">${formatValue(currentValue, upgrade.suffix)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">After Upgrade:</span>
        <span class="stat-value" style="color: #00ff88;">+${formatValue(nextValue, upgrade.suffix)}</span>
      </div>
    </div>

    <div class="cost-display">
      <span class="cost-text">Cost:</span>
      <span class="cost-amount">${upgrade.cost}💰</span>
    </div>

    <button class="buy-button ${!canAfford ? 'disabled' : ''}" onclick="buyUpgrade('${key}')" ${!canAfford ? 'disabled' : ''}>
      <span class="button-text">
        ${canAfford ? '✓ BUY UPGRADE' : '✗ NOT ENOUGH COINS'}
      </span>
    </button>
    ${!canAfford ? `<div class="warning-text">Need ${upgrade.cost - playerStats.totalCoins} more coins</div>` : ''}
  `;

  return card;
}

function renderUpgrades() {
  const container = document.getElementById('upgradesContainer');
  container.innerHTML = '';

  const upgradeOrder = ['HP', 'DAMAGE', 'CRIT_DAMAGE', 'CRIT_RATE', 'FIRE_RATE', 'MOVEMENT', 'JUMP_SPEED'];

  upgradeOrder.forEach(key => {
    const upgrade = UPGRADES[key];
    const card = createUpgradeCard(key, upgrade);
    container.appendChild(card);
  });
}

function buyUpgrade(key) {
  const upgrade = UPGRADES[key];
  const statKey = upgrade.statKey;
  const statName = upgrade.name;

  if (playerStats.upgradeUpgrade(key)) {
    const newValue = playerStats[statKey];
    showNotification(`✓ ${statName} upgraded! New value: ${formatValue(newValue, upgrade.suffix)}`);
    updateDisplay();
    renderUpgrades();
  } else {
    showNotification(`✗ Not enough coins! Need ${upgrade.cost}💰`, true);
  }
}

function goBackToMenu() {
  window.location.href = 'menu.html';
}

function confirmResetAll() {
  if (confirm('⚠️ Are you sure? This will reset ALL upgrades!\n\nThis cannot be undone!')) {
    playerStats.resetStats();
    showNotification('✓ All upgrades reset!');
    updateDisplay();
    renderUpgrades();
  }
}

// ========== INITIALIZATION ==========
window.addEventListener('DOMContentLoaded', () => {
  updateDisplay();
  renderUpgrades();
});