// Infinite Terrain (Canvas) - Procedural + Chunking + Parallax
// Controls: A / ← = left, D / → = right, Space = jump
// Mobile: on-screen buttons

(() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const seedText = document.getElementById('seedText');
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');
  const jumpBtn = document.getElementById('jumpBtn');
  const regenBtn = document.getElementById('regenBtn');

  // DPR & resize
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width;
    const cssH = rect.height;
    canvas.width = Math.floor(cssW * devicePixelRatio);
    canvas.height = Math.floor(cssH * devicePixelRatio);
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    W = cssW; H = cssH;
    groundOffset = Math.round(H * 0.62);
  }

  // Logical
  let W = 1000, H = 560;
  let groundOffset = Math.round(H * 0.62);

  // Chunking config
  const CHUNK_WIDTH_PX = 1024;   // width per chunk in px
  const SAMPLE_STEP = 8;         // px between height samples
  const VISIBLE_AHEAD = 1400;    // generate until this ahead of camera
  const KEEP_BEHIND = 1400;      // keep chunks that far behind
  const MAX_CHUNKS_AHEAD = 5;

  // Noise (1D Perlin) with seed
  class Perlin1D {
    constructor(seed = 1337) {
      this.seed = seed | 0;
      this.perm = new Uint8Array(512);
      this._build();
    }
    _rand(i) {
      // simple xorshift-ish deterministic hash
      let x = (i + this.seed) | 0;
      x = (x ^ (x << 13)) >>> 0;
      x = (x ^ (x >>> 17)) >>> 0;
      x = (x ^ (x << 5)) >>> 0;
      return x / 0xFFFFFFFF;
    }
    _build() {
      const p = new Uint8Array(256);
      for (let i=0;i<256;i++) p[i] = i;
      // shuffle using seed
      for (let i=255;i>0;i--){
        const r = Math.floor(this._rand(i) * (i + 1));
        const tmp = p[i];
        p[i] = p[r];
        p[r] = tmp;
      }
      for (let i=0;i<512;i++) this.perm[i] = p[i & 255];
    }
    fade(t){ return t * t * t * (t * (t * 6 - 15) + 10); }
    grad(hash, x){
      // gradients are -1 or +1
      return ((hash & 1) === 0) ? x : -x;
    }
    noise(x){
      const xi = Math.floor(x) & 255;
      const xf = x - Math.floor(x);
      const u = this.fade(xf);
      const a = this.perm[xi];
      const b = this.perm[xi + 1];
      const res = this.lerp(this.grad(a, xf), this.grad(b, xf - 1), u);
      return res * 2; // range approximately [-1,1]
    }
    lerp(a,b,t){ return a + (b - a) * t; }
    // fractal noise
    fractal(x, octaves=5, lacunarity=2, persistence=0.5){
      let amplitude = 1, frequency = 1, sum = 0, norm = 0;
      for (let o=0;o<octaves;o++){
        sum += this.noise(x * frequency) * amplitude;
        norm += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
      }
      return sum / norm;
    }
  }

  // Terrain chunk: holds sample array for x0..x0+CHUNK_WIDTH
  class Chunk {
    constructor(x0, perlin) {
      this.x0 = x0; // left px world coordinate
      this.samples = []; // array of {x, y}
      this.objects = []; // trees/rocks placed on this chunk
      this._build(perlin);
    }
    _build(perlin) {
      const step = SAMPLE_STEP;
      const count = Math.ceil(CHUNK_WIDTH_PX / step) + 1;
      const baseH = groundOffset;
      // parameters tuned for natural look
      for (let i = 0; i < count; i++) {
        const wx = this.x0 + i * step;
        const fx = wx * 0.0022; // base scale
        // use fractal noise for natural hills
        const n = perlin.fractal(fx, 6, 2.0, 0.5);
        // bias and amplify (higher n -> higher hill)
        const height = baseH - (n * 260 + Math.sin(wx * 0.0013) * 20);
        this.samples.push({ x: wx, y: height });
      }
      // place objects based on noise & slope
      for (let i = 4; i < this.samples.length - 4; i++) {
        const s = this.samples[i];
        // slope
        const dy = this.samples[i+1].y - this.samples[i-1].y;
        const slope = Math.abs(dy);
        // object noise
        const objN = (perlin.noise((s.x + 12345) * 0.003) + 1) * 0.5;
        if (objN > 0.68 && slope < 6 && s.y < groundOffset - 40) {
          // place a tree
          this.objects.push({ type:'tree', x: s.x, y: s.y });
        } else if (objN < 0.08 && slope < 6 && s.y < groundOffset - 20) {
          // small rock
          this.objects.push({ type:'rock', x: s.x, y: s.y });
        }
      }
    }
  }

  // Terrain manager: generate chunks on demand and keep them
  class Terrain {
    constructor(perlin) {
      this.perlin = perlin;
      this.chunks = new Map(); // key: chunkIndex -> Chunk
    }
    chunkIndexFromX(x) {
      return Math.floor(x / CHUNK_WIDTH_PX);
    }
    ensureAround(cx) {
      // ensure chunks from cx - 1 to cx + MAX_CHUNKS_AHEAD exist
      for (let i = cx - 2; i <= cx + MAX_CHUNKS_AHEAD; i++) {
        if (!this.chunks.has(i)) {
          const x0 = i * CHUNK_WIDTH_PX;
          const c = new Chunk(x0, this.perlin);
          this.chunks.set(i, c);
        }
      }
      // remove far behind
      for (let key of Array.from(this.chunks.keys())) {
        const idx = Number(key);
        if ((idx + 1) * CHUNK_WIDTH_PX < (cx * CHUNK_WIDTH_PX - KEEP_BEHIND)) {
          this.chunks.delete(idx);
        }
      }
    }
    // get height at world x (linear interpolate between nearest samples)
    getHeightAt(x) {
      const idx = this.chunkIndexFromX(x);
      const c = this.chunks.get(idx);
      if (!c) return groundOffset;
      const rel = x - c.x0;
      const step = SAMPLE_STEP;
      const i = Math.floor(rel / step);
      const a = c.samples[i] || c.samples[0];
      const b = c.samples[i+1] || c.samples[c.samples.length-1];
      if (!b) return a.y;
      const t = (rel - i * step) / step;
      return a.y * (1 - t) + b.y * t;
    }
    // iterate visible chunks for drawing
    forVisible(camX, width, callback) {
      const left = camX - width/2 - CHUNK_WIDTH_PX;
      const right = camX + width/2 + CHUNK_WIDTH_PX;
      const startIdx = this.chunkIndexFromX(left);
      const endIdx = this.chunkIndexFromX(right);
      for (let i = startIdx; i <= endIdx; i++) {
        const c = this.chunks.get(i);
        if (c) callback(c);
      }
    }
  }

  // Player
  class Player {
    constructor(x, terrain) {
      this.x = x;
      this.y = terrain.getHeightAt(x) - 48;
      this.vy = 0;
      this.speed = 240; // px/s
      this.width = 36;
      this.height = 44;
      this.onGround = true;
      this.jumpPower = 540;
      this.terrain = terrain;
    }
    update(dt, input) {
      // horizontal
      if (input.left) this.x -= this.speed * dt;
      if (input.right) this.x += this.speed * dt;
      // apply gravity
      this.vy += 1500 * dt;
      this.y += this.vy * dt;
      // collision with terrain
      const groundY = this.terrain.getHeightAt(this.x) - 0;
      if (this.y + this.height/2 > groundY) {
        this.y = groundY - this.height/2;
        this.vy = 0;
        this.onGround = true;
      } else {
        this.onGround = false;
      }
      // jump
      if (input.jump && this.onGround) {
        this.vy = -this.jumpPower;
        this.onGround = false;
      }
    }
    draw(ctx, camX, camY) {
      const sx = Math.round(this.x - camX + W/2);
      const sy = Math.round(this.y - camY + H/2);
      // body
      ctx.fillStyle = '#ffde59';
      roundRect(ctx, sx - this.width/2, sy - this.height/2, this.width, this.height, 6);
      ctx.fill();
      // wheels
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(sx - 10, sy + this.height/2 - 6, 8, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx + 10, sy + this.height/2 - 6, 8, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // Utilities
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Parallax background (distant hills & clouds)
  function drawParallax(ctx, camX, camY, t) {
    // sky gradient
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, '#bfe9ff');
    g.addColorStop(1, '#9ecfff');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);

    // distant hills - two layers
    for (let layer=0; layer<2; layer++) {
      ctx.fillStyle = layer === 0 ? '#7fa07a' : '#aed6b3';
      ctx.globalAlpha = layer === 0 ? 1.0 : 0.9;
      ctx.beginPath();
      ctx.moveTo(0, H);
      const step = 160;
      const amp = layer===0 ? 80 : 40;
      const speedMul = layer===0 ? 0.25 : 0.5;
      for (let x=0; x<=W; x+=step) {
        const worldX = camX - W/2 + x;
        const nx = worldX * 0.0009 * (1+layer*0.3) + t*0.0002*speedMul;
        const y = Math.sin(nx*6.28) * amp + (H*0.35 + layer*40);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    }

    // clouds
    ctx.globalAlpha = 0.95;
    for (let i=0;i<4;i++){
      const cx = ( (i*boardSeed*0.37) % 1000 ) - (camX*0.15);
      const cy = 60 + (i%2)*18;
      drawCloud(ctx, cx + (t*0.02*(i+1)) % (W+200) - 100, cy, 0.7 + (i%2)*0.3);
    }
    ctx.globalAlpha = 1.0;
  }

  function drawCloud(ctx, x, y, scale=1) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x, y, 28*scale, 0, Math.PI*2);
    ctx.arc(x+30*scale, y+6*scale, 22*scale, 0, Math.PI*2);
    ctx.arc(x-28*scale, y+6*scale, 20*scale, 0, Math.PI*2);
    ctx.fill();
  }

  // draw terrain polygon for a chunk
  function drawChunk(ctx, chunk, camX, camY) {
    ctx.fillStyle = '#3a8b45'; // top grass
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // move to first sample
    for (let i=0;i<chunk.samples.length;i++){
      const s = chunk.samples[i];
      const sx = s.x - camX + W/2;
      const sy = s.y - camY + H/2;
      if (i===0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    // line down to bottom
    const last = chunk.samples[chunk.samples.length-1];
    ctx.lineTo(last.x - camX + W/2, H + 20);
    const first = chunk.samples[0];
    ctx.lineTo(first.x - camX + W/2, H + 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // soil layer (a bit darker under top)
    ctx.fillStyle = '#2f6b36';
    ctx.beginPath();
    for (let i=0;i<chunk.samples.length;i++){
      const s = chunk.samples[i];
      const sx = s.x - camX + W/2;
      const sy = s.y + 8 - camY + H/2;
      if (i===0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.lineTo(last.x - camX + W/2, H + 20);
    ctx.lineTo(first.x - camX + W/2, H + 20);
    ctx.closePath();
    ctx.globalAlpha = 0.95;
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // draw objects: trees/rocks
    for (const obj of chunk.objects) {
      const ox = obj.x - camX + W/2;
      const oy = obj.y - camY + H/2;
      if (ox < -60 || ox > W + 60) continue;
      if (obj.type === 'tree') drawTree(ctx, ox, oy);
      else drawRock(ctx, ox, oy);
    }
  }

  function drawTree(ctx, x, y) {
    // trunk
    ctx.fillStyle = '#7a4b2a';
    ctx.fillRect(x - 4, y - 10, 8, 18);
    // canopy
    ctx.fillStyle = '#2e8b3e';
    ctx.beginPath();
    ctx.arc(x, y - 22, 18, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 12, y - 8, 12, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 12, y - 8, 12, 0, Math.PI*2);
    ctx.fill();
  }
  function drawRock(ctx, x, y) {
    ctx.fillStyle = '#6e6e6e';
    ctx.beginPath();
    ctx.ellipse(x, y - 6, 12, 8, 0, 0, Math.PI*2);
    ctx.fill();
  }

  // Input state
  const input = { left:false, right:false, jump:false };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true;
    if (e.code === 'Space') input.jump = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
    if (e.code === 'Space') input.jump = false;
  });

  // mobile buttons
  leftBtn.addEventListener('touchstart', ()=> input.left = true, {passive:true});
  leftBtn.addEventListener('touchend', ()=> input.left = false);
  rightBtn.addEventListener('touchstart', ()=> input.right = true, {passive:true});
  rightBtn.addEventListener('touchend', ()=> input.right = false);
  jumpBtn.addEventListener('touchstart', ()=> input.jump = true, {passive:true});
  jumpBtn.addEventListener('touchend', ()=> input.jump = false);

  // regenerate new seed
  regenBtn.addEventListener('click', ()=> {
    boardSeed = (Math.random()*0xFFFFF) | 0;
    startNew();
  });

  // global variables
  let perlin;
  let terrain;
  let player;
  let camX = 0, camY = 0;
  let boardSeed = (Math.random()*0xFFFFF) | 0;
  let tStart = performance.now();

  // expose for debug
  window._terrain = () => terrain;

  function startNew() {
    perlin = new Perlin1D(boardSeed);
    terrain = new Terrain(perlin);
    player = new Player(0, terrain);
    camX = player.x;
    camY = player.y - H * 0.25;
    seedText.textContent = String(boardSeed);
    terrain.ensureAround(Math.floor(player.x / CHUNK_WIDTH_PX));
    resize();
  }

  // animation loop
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    // ensure chunks generated around player's chunk
    const pChunkIdx = terrain.chunkIndexFromX(player.x);
    terrain.ensureAround(pChunkIdx);

    // update player
    player.update(dt, input);

    // camera smoothing follow
    camX += (player.x - camX) * Math.min(1, dt * 4.5);
    camY += ((player.y - H * 0.20) - camY) * Math.min(1, dt * 3.2);

    // draw background
    drawParallax(ctx, camX, camY, now - tStart);

    // draw terrain visible chunks
    terrain.forVisible(camX, W, (chunk) => {
      drawChunk(ctx, chunk, camX, camY);
    });

    // draw player
    player.draw(ctx, camX, camY);

    // small HUD: position
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(12, 12, 200, 26);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(`X: ${Math.round(player.x)}  Seed:${boardSeed}`, 18, 31);

    requestAnimationFrame(frame);
  }

  // start
  startNew();
  resize();
  window.addEventListener('resize', resize);
  last = performance.now();
  requestAnimationFrame(frame);
})();