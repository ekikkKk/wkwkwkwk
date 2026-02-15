// ========== STORAGE KEYS ==========
const HIGHKEY = 'minion_chase_high_v1';
const STATSKEY = 'minion_chase_stats_v1';
const COINSKEY = 'minion_chase_coins_v1';
const SETTINGS_KEY = 'minion_chase_settings_v1';

// ========== SETTINGS CLASS ==========
class GameSettings {
  constructor() {
    this.loadSettings();
  }

  loadSettings() {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.sfx = data.sfx !== undefined ? data.sfx : true;
        this.bgm = data.bgm !== undefined ? data.bgm : true;
      } catch (e) {
        this.setDefaults();
      }
    } else {
      this.setDefaults();
    }
  }

  setDefaults() {
    this.sfx = true;
    this.bgm = true;
    this.saveSettings();
  }

  saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      sfx: this.sfx,
      bgm: this.bgm
    }));
  }

  toggleSFX() {
    this.sfx = !this.sfx;
    this.saveSettings();
  }

  toggleBGM() {
    this.bgm = !this.bgm;
    this.saveSettings();
  }
}

const gameSettings = new GameSettings();

// ========== STATISTICS ==========
function getHighScore() {
  return parseInt(localStorage.getItem(HIGHKEY) || '0', 10);
}

function getTotalCoins() {
  return parseInt(localStorage.getItem(COINSKEY) || '0', 10);
}

function getBossKills() {
  const stats = localStorage.getItem(STATSKEY);
  if (!stats) return 0;
  try {
    const data = JSON.parse(stats);
    return data.bossKills || 0;
  } catch (e) {
    return 0;
  }
}

function getPlayTime() {
  const playTimeMs = parseInt(localStorage.getItem('minion_chase_playtime_v1') || '0', 10);
  const hours = Math.floor(playTimeMs / (1000 * 60 * 60));
  return hours;
}

// ========== UI FUNCTIONS ==========
function updateStatsDisplay() {
  document.getElementById('totalCoins').textContent = getTotalCoins();
  document.getElementById('highScore').textContent = getHighScore().toLocaleString();
  document.getElementById('bossKills').textContent = getBossKills();
  document.getElementById('playTime').textContent = getPlayTime() + 'h';
}

function playGame() {
  window.location.href = 'game.html';
}

function goToUpgrade() {
  window.location.href = 'upgrade.html';
}

function openSettings() {
  document.getElementById('settingsModal').style.display = 'block';
  updateSettingsUI();
}

function closeSettings() {
  document.getElementById('settingsModal').style.display = 'none';
}

function updateSettingsUI() {
  const sfxToggle = document.getElementById('sfxToggle');
  const bgmToggle = document.getElementById('bgmToggle');

  if (gameSettings.sfx) {
    sfxToggle.classList.add('active');
  } else {
    sfxToggle.classList.remove('active');
  }

  if (gameSettings.bgm) {
    bgmToggle.classList.add('active');
  } else {
    bgmToggle.classList.remove('active');
  }
}

function toggleSFX() {
  gameSettings.toggleSFX();
  updateSettingsUI();
}

function toggleBGM() {
  gameSettings.toggleBGM();
  updateSettingsUI();
}

function confirmResetAll() {
  if (confirm('⚠️ Are you sure? This will reset EVERYTHING:\n\n❌ All upgrades\n❌ All coins\n❌ All statistics\n\nThis cannot be undone!')) {
    resetAll();
  }
}

function resetAll() {
  localStorage.removeItem(HIGHKEY);
  localStorage.removeItem(STATSKEY);
  localStorage.removeItem(COINSKEY);
  localStorage.removeItem('minion_chase_playtime_v1');

  updateStatsDisplay();
  closeSettings();
  alert('✓ All data has been reset!');
}

function quitGame() {
  if (confirm('Are you sure you want to quit the game?')) {
    window.close();
  }
}

// ========== GENERATE STARS ==========
function generateStars() {
  const container = document.getElementById('starsContainer');
  const starCount = 50;

  for (let i = 0; i < starCount; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.animationDelay = Math.random() * 3 + 's';
    container.appendChild(star);
  }
}

// ========== CLOSE MODAL ON OUTSIDE CLICK ==========
window.addEventListener('click', (event) => {
  const modal = document.getElementById('settingsModal');
  if (event.target === modal) {
    closeSettings();
  }
});

// ========== INITIALIZATION ==========
window.addEventListener('DOMContentLoaded', () => {
  generateStars();
  updateStatsDisplay();
});