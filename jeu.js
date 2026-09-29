/* Aim Trainer 3D — pièce pour random.plagnito.com
 * Script classique (pas de module, pas de build). Dépend de ./three.min.js (Three.js r158, MIT).
 * Le SDK window.atlasJeu est facultatif : tout le jeu fonctionne sans lui.
 */
(function () {
  'use strict';

  /* =====================================================================
   * 0. Utilitaires
   * ===================================================================== */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const DEG = Math.PI / 180;
  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
  const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const COARSE = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
  const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const SDK = window.atlasJeu; // undefined hors du site : normal

  function fatal(msg) {
    $('#fatal-msg').textContent = msg;
    $('#fatal').hidden = false;
  }
  if (!window.THREE) {
    fatal("Le moteur 3D n'a pas pu se charger (fichier three.min.js introuvable). Recharge la page.");
    return;
  }
  const THREE = window.THREE;

  /* =====================================================================
   * 1. Données : difficultés, couleurs, modes, succès
   * ===================================================================== */
  const DIFFS = [
    { id: 0, nom: 'Facile', info: 'cibles grosses et lentes · points ×1', taille: 1.3, vit: 0.75, mult: 1 },
    { id: 1, nom: 'Normal', info: 'le réglage de référence · points ×1,5', taille: 1.0, vit: 1.0, mult: 1.5 },
    { id: 2, nom: 'Difficile', info: 'cibles petites et vives · points ×2', taille: 0.7, vit: 1.35, mult: 2 },
  ];
  const TCOLORS = [
    { id: 'rose', nom: 'Rose', hex: '#ff3d7f' },
    { id: 'cyan', nom: 'Cyan', hex: '#2de2e6' },
    { id: 'vert', nom: 'Vert', hex: '#7dff6a' },
    { id: 'orange', nom: 'Orange', hex: '#ff9f1c' },
    { id: 'violet', nom: 'Violet', hex: '#b388ff' },
  ];
  const XCOLORS = [
    { id: '#2de2e6', nom: 'Cyan' },
    { id: '#ffffff', nom: 'Blanc' },
    { id: '#7dff6a', nom: 'Vert' },
    { id: '#ffd166', nom: 'Jaune' },
    { id: '#ff3d7f', nom: 'Rose' },
  ];
  const XSTYLES = [
    { id: 'croix', nom: 'Croix' },
    { id: 'point', nom: 'Point' },
    { id: 'cercle', nom: 'Cercle' },
    { id: 'cible', nom: 'Cercle et point' },
    { id: 't', nom: 'Croix en T' },
  ];
  const PSIZES = [
    { id: 'large', nom: 'Larges', k: 1.4, mult: 0.8 },
    { id: 'standard', nom: 'Standard', k: 1, mult: 1 },
    { id: 'fine', nom: 'Fines', k: 0.7, mult: 1.3 },
    { id: 'minuscule', nom: 'Minuscules', k: 0.5, mult: 1.7 },
  ];
  const recKey = (id, diff, psIdx) => id + ':' + diff + (id === 'precision' && psIdx !== 1 ? ':' + PSIZES[psIdx].id : '');
  const BULL = 0.35; // rayon relatif du centre de la cible

  const ACH = [
    ['premiere-cible', 'Première cible', 'Toucher une cible pour la première fois.'],
    ['echauffe', 'Échauffé', 'Terminer ta première partie.'],
    ['combo-max', 'Combo au maximum', "Atteindre le multiplicateur ×4 (15 cibles touchées d'affilée)."],
    ['sans-faute', 'Sans faute', 'Finir une partie de Grille avec au moins 25 cibles touchées et aucun raté.'],
    ['oeil-de-lynx', 'Œil de lynx', 'Finir une partie avec 90 % de précision ou plus (30 tirs minimum).'],
    ['cinq-mille', 'Cinq mille', 'Marquer 5 000 points dans une seule partie.'],
    ['dix-mille', 'Dix mille', 'Marquer 10 000 points dans une seule partie.'],
    ['doigts-eclair', "Doigts d'éclair", 'Toucher la cible en moins de 200 ms en mode Réflexes.'],
    ['colle-a-la-cible', 'Collé à la cible', 'Rester au moins 80 % du temps sur la cible en mode Suivi.'],
    ['touche-a-tout', 'Touche-à-tout', 'Jouer une partie dans chacun des six modes.'],
    ['sans-filet', 'Sans filet', 'Finir une partie en Difficile avec 70 % de précision ou plus (20 tirs minimum).'],
    ['centenaire', 'Centenaire', 'Toucher 100 cibles au total.'],
    ['habitue', 'Habitué du dojo', 'Jouer 10 parties.'],
    ['defi-du-jour', 'Défi relevé', 'Terminer le défi du jour.'],
    ['serie-3-jours', 'Trois jours de suite', 'Relever le défi du jour trois jours de suite.'],
    ['microscope', 'Microscope', 'Marquer 3 000 points en Précision avec des cibles minuscules.'],
    ['note-s', 'Note S', "Obtenir la note S dans n'importe quel mode."],
    ['record-battu', 'Toujours plus haut', "Battre l'un de tes propres records."],
    ['millier', 'Millier', 'Toucher 1 000 cibles au total.', true],
    ['trop-presse', 'Trop pressé', 'Faire un faux départ en mode Réflexes.', true],
    ['rafale-dans-le-vide', 'Rafale dans le vide', 'Rater 10 tirs d\'affilée.', true],
  ].map((a) => ({ id: a[0], titre: a[1], texte: a[2], secret: !!a[3] }));

  /* =====================================================================
   * 2. Sauvegarde (localStorage seul, dans des try/catch)
   * ===================================================================== */
  const CLE = 'etat';
  function defaults() {
    return {
      v: 1,
      opt: { sens: 1, fov: 90, xs: 'croix', xc: '#2de2e6', xz: 1, vol: 0.6, mute: false, ctl: COARSE ? 'curseur' : 'verrou', diff: 1, tc: 'rose', fx: true, inv: false, deco: 'neon', qual: 'auto', gyro: false, psz: 1 },
      rec: {},
      tot: { parties: 0, tirs: 0, touches: 0, sec: 0, serie: 0 },
      hist: [],
      succ: [],
      modes: [],
      jour: { d: '', s: 0, serie: 0 },
      ev: {},
    };
  }
  function normalize(raw) {
    const d = defaults();
    if (!raw || typeof raw !== 'object') return d;
    const o = raw.opt && typeof raw.opt === 'object' ? raw.opt : {};
    Object.keys(d.opt).forEach((k) => { if (typeof o[k] === typeof d.opt[k]) d.opt[k] = o[k]; });
    d.opt.sens = clamp(d.opt.sens, 0.2, 3);
    d.opt.fov = clamp(d.opt.fov, 60, 110);
    d.opt.xz = clamp(d.opt.xz, 0.6, 2.2);
    d.opt.vol = clamp(d.opt.vol, 0, 1);
    d.opt.diff = clamp(Math.round(d.opt.diff), 0, 2);
    if (!XSTYLES.some((x) => x.id === d.opt.xs)) d.opt.xs = 'croix';
    if (!/^#[0-9a-f]{6}$/i.test(d.opt.xc)) d.opt.xc = '#2de2e6';
    if (!TCOLORS.some((x) => x.id === d.opt.tc)) d.opt.tc = 'rose';
    if (d.opt.ctl !== 'verrou' && d.opt.ctl !== 'curseur') d.opt.ctl = 'verrou';
    d.opt.psz = clamp(Math.round(d.opt.psz), 0, 3);
    if (d.opt.deco !== 'neon' && d.opt.deco !== 'epure') d.opt.deco = 'neon';
    if (['auto', 'eco', 'haute'].indexOf(d.opt.qual) < 0) d.opt.qual = 'auto';
    if (raw.rec && typeof raw.rec === 'object') Object.keys(raw.rec).forEach((k) => { if (Number.isFinite(raw.rec[k])) d.rec[k] = raw.rec[k]; });
    if (raw.tot && typeof raw.tot === 'object') Object.keys(d.tot).forEach((k) => { if (Number.isFinite(raw.tot[k])) d.tot[k] = raw.tot[k]; });
    if (Array.isArray(raw.hist)) d.hist = raw.hist.filter((h) => Array.isArray(h) && h.length >= 5).slice(0, 20);
    if (Array.isArray(raw.succ)) d.succ = raw.succ.filter((s) => typeof s === 'string').slice(0, 80);
    if (Array.isArray(raw.modes)) d.modes = raw.modes.filter((s) => typeof s === 'string').slice(0, 10);
    if (raw.ev && typeof raw.ev === 'object') {
      Object.keys(raw.ev).slice(0, 10).forEach((k) => {
        if (Array.isArray(raw.ev[k])) d.ev[k] = raw.ev[k].filter((v) => Number.isFinite(v)).slice(-30);
      });
    }
    if (raw.jour && typeof raw.jour === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(raw.jour.d || '')) {
      d.jour = { d: raw.jour.d, s: Number.isFinite(raw.jour.s) ? raw.jour.s : 0, serie: Number.isFinite(raw.jour.serie) ? clamp(Math.round(raw.jour.serie), 0, 9999) : 0 };
    }
    return d;
  }
  function loadSave() {
    try { return normalize(JSON.parse(localStorage.getItem(CLE))); } catch (e) { return normalize(null); }
  }
  let S = loadSave();
  let saveTimer = 0;
  function save(now) {
    if (now) {
      clearTimeout(saveTimer); saveTimer = 0;
      try { localStorage.setItem(CLE, JSON.stringify(S)); } catch (e) { /* stockage indisponible : on joue quand même */ }
    } else if (!saveTimer) {
      saveTimer = setTimeout(() => { saveTimer = 0; save(true); }, 350);
    }
  }
  addEventListener('pagehide', () => save(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });

  /* =====================================================================
   * 3. Son (Web Audio, démarré au premier geste)
   * ===================================================================== */
  const Snd = (() => {
    let ctx = null, master = null, noiseBuf = null, humO = null, humG = null;
    const level = () => (S.opt.mute ? 0 : S.opt.vol * 0.7);
    const live = () => ctx && level() > 0;
    function unlock() {
      try {
        if (!ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          ctx = new AC();
          master = ctx.createGain();
          master.gain.value = level();
          master.connect(ctx.destination);
          noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
          const d = noiseBuf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ctx.state === 'suspended') ctx.resume();
      } catch (e) { ctx = null; }
    }
    function refresh() { if (master) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.02); if (!live()) humStop(); }
    function tone(f0, f1, dur, type, g, delay) {
      if (!live()) return;
      const t = ctx.currentTime + (delay || 0);
      const o = ctx.createOscillator(), a = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      a.gain.setValueAtTime(0.0001, t);
      a.gain.exponentialRampToValueAtTime(g || 0.3, t + 0.006);
      a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(a); a.connect(master);
      o.start(t); o.stop(t + dur + 0.03);
    }
    function noise(dur, g, hp) {
      if (!live()) return;
      const t = ctx.currentTime;
      const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 1500;
      const a = ctx.createGain();
      a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(a); a.connect(master);
      s.start(t); s.stop(t + dur + 0.02);
    }
    function humStart() {
      if (!live() || humO) return;
      humO = ctx.createOscillator(); humG = ctx.createGain();
      humO.type = 'triangle'; humO.frequency.value = 200; humG.gain.value = 0;
      humO.connect(humG); humG.connect(master); humO.start();
    }
    function humSet(on, p) {
      if (!humO) return;
      humG.gain.setTargetAtTime(on ? 0.13 : 0, ctx.currentTime, 0.04);
      humO.frequency.setTargetAtTime(190 + (p || 0) * 160, ctx.currentTime, 0.05);
    }
    function humStop() {
      if (!humO) return;
      try { humO.stop(); humO.disconnect(); humG.disconnect(); } catch (e) { /* déjà arrêté */ }
      humO = humG = null;
    }
    return {
      unlock, refresh, humStart, humSet, humStop,
      shoot() { noise(0.05, 0.22, 2500); tone(260, 70, 0.09, 'square', 0.12); },
      hit(mult, bull) {
        const f = 560 * (1 + 0.14 * (mult - 1));
        tone(f, f * 1.5, 0.12, 'sine', 0.3);
        if (bull) { tone(f * 2, f * 2.6, 0.16, 'triangle', 0.22, 0.03); }
      },
      miss() { tone(150, 70, 0.13, 'triangle', 0.22); },
      combo(mult) { const f = 520 + mult * 110; tone(f, f, 0.09, 'triangle', 0.2); tone(f * 1.5, f * 1.5, 0.15, 'triangle', 0.2, 0.08); },
      expire() { tone(200, 90, 0.22, 'sawtooth', 0.1); },
      beep(f, d) { tone(f, f, d || 0.12, 'square', 0.14); },
      go() { tone(880, 880, 0.3, 'square', 0.16); },
      fanfare(rank) {
        const notes = rank >= 3 ? [523, 659, 784, 1046, 1318] : rank >= 1 ? [440, 554, 659, 880] : [330, 392, 494];
        notes.forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.22, i * 0.11));
      },
    };
  })();

  /* =====================================================================
   * 4. Scène 3D
   * ===================================================================== */
  THREE.ColorManagement.enabled = false; // les couleurs écrites sont les couleurs affichées
  const canvas = $('#scene');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    fatal("Ton navigateur ne peut pas afficher la 3D (WebGL indisponible). Essaie un autre navigateur ou active l'accélération matérielle.");
    return;
  }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const BGC = 0x0a0d26;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BGC);
  scene.fog = new THREE.FogExp2(BGC, 0.016);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 120);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  const view = { yaw: 0, pitch: 0 };

  // --- Salle ---
  const RW = 18, RYMIN = -5, RYMAX = 10, RD = 18;
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  function gridDraw(bg, line, glow) {
    return (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.globalAlpha = 0.28; x.strokeStyle = glow; x.lineWidth = 12; x.strokeRect(0, 0, w, h);
      x.globalAlpha = 1; x.strokeStyle = line; x.lineWidth = 3; x.strokeRect(1.5, 1.5, w - 3, h - 3);
    };
  }
  const THEMES = {
    neon: { bg: 0x0a0d26, fog: 0.016, deco: true, side: [['#10164a', '#0b1038'], '#3a4bd0', '#2de2e6'], floor: [['#1a0f3d', '#140b33'], '#ff3d7f', '#ff3d7f'], ceil: [['#0c1035', '#0c1035'], '#3a2a8c', '#7b5cff'] },
    epure: { bg: 0x0b0d14, fog: 0.011, deco: false, side: [['#181b28', '#11141d'], '#2c3350', '#3d4870'], floor: [['#15171f', '#101219'], '#2c3350', '#3d4870'], ceil: [['#0d0f16', '#0d0f16'], '#232940', '#2c3350'] },
  };
  const room = { mats: [], sets: {}, deco: [] };
  (function buildRoom() {
    Object.keys(THEMES).forEach((k) => {
      const t = THEMES[k];
      room.sets[k] = {
        side: canvasTex(128, 128, gridDraw(t.side[0], t.side[1], t.side[2]), [12, 5]),
        floor: canvasTex(128, 128, gridDraw(t.floor[0], t.floor[1], t.floor[2]), [12, 12]),
        ceil: canvasTex(128, 128, gridDraw(t.ceil[0], t.ceil[1], t.ceil[2]), [12, 12]),
      };
    });
    const n = room.sets.neon;
    const mk = (map) => new THREE.MeshBasicMaterial({ map, side: THREE.BackSide });
    room.mats = [mk(n.side), mk(n.side), mk(n.ceil), mk(n.floor), mk(n.side), mk(n.side)];
    const box = new THREE.Mesh(new THREE.BoxGeometry(RW * 2, RYMAX - RYMIN, RD * 2), room.mats);
    box.position.y = (RYMAX + RYMIN) / 2;
    scene.add(box);

    // Néons (décor « Néon » uniquement)
    const neon = (c, w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: c, fog: false }));
      m.position.set(x, y, z); scene.add(m); room.deco.push(m);
    };
    [-9, 0, 9].forEach((x, i) => neon(i === 1 ? 0xff3d7f : 0x2de2e6, 0.22, 0.06, RD * 2 - 1, x, RYMAX - 0.04, 0));
    const by = RYMIN + 0.1;
    neon(0x2de2e6, RW * 2, 0.12, 0.12, 0, by, -RD + 0.06);
    neon(0x2de2e6, RW * 2, 0.12, 0.12, 0, by, RD - 0.06);
    neon(0xff3d7f, 0.12, 0.12, RD * 2, -RW + 0.06, by, 0);
    neon(0xff3d7f, 0.12, 0.12, RD * 2, RW - 0.06, by, 0);

    // Panneaux muraux (repères pour s'orienter en 360°)
    const sign = (w, h, draw, x, y, z, ry) => {
      const tex = canvasTex(512, Math.round(512 * h / w), draw);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); room.deco.push(m);
    };
    const textDraw = (txt, col, size) => (x, w, h) => {
      x.clearRect(0, 0, w, h);
      x.font = 'italic 900 ' + size + 'px "Trebuchet MS", system-ui, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = col; x.shadowBlur = 24; x.fillStyle = col;
      x.fillText(txt, w / 2, h / 2); x.fillText(txt, w / 2, h / 2);
    };
    const rings = (x, w, h) => {
      x.clearRect(0, 0, w, h);
      const cols = ['#ff3d7f', '#2de2e6', '#ff3d7f', '#2de2e6'];
      cols.forEach((c, i) => {
        x.beginPath(); x.arc(w / 2, h / 2, w * (0.46 - i * 0.11), 0, Math.PI * 2);
        x.lineWidth = 8; x.strokeStyle = c; x.globalAlpha = 0.28; x.shadowColor = c; x.shadowBlur = 20; x.stroke();
      });
    };
    sign(14, 14, rings, 0, 2.5, -RD + 0.05, 0);
    sign(16, 4, textDraw('AIM TRAINER 3D', '#2de2e6', 76), 0, 3, RD - 0.05, Math.PI);
    sign(14, 4, textDraw('DOJO', '#ff3d7f', 150), -RW + 0.05, 3, 0, Math.PI / 2);
    sign(16, 4, textDraw('VISE JUSTE', '#ffd166', 100), RW - 0.05, 3, 0, -Math.PI / 2);
  })();
  function applyTheme() {
    const th = THEMES[S.opt.deco] || THEMES.neon, set = room.sets[S.opt.deco] || room.sets.neon;
    [0, 1, 4, 5].forEach((i) => { room.mats[i].map = set.side; });
    room.mats[2].map = set.ceil; room.mats[3].map = set.floor;
    scene.background.set(th.bg); scene.fog.color.set(th.bg); scene.fog.density = th.fog;
    room.deco.forEach((o) => { o.visible = th.deco; });
  }
  applyTheme();

  // --- Sprites de lueur, particules ---
  const glowTex = canvasTex(64, 64, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  const NP = 260;
  const P = {
    pos: new Float32Array(NP * 3), col: new Float32Array(NP * 3), base: new Float32Array(NP * 3),
    vel: new Float32Array(NP * 3), life: new Float32Array(NP), max: new Float32Array(NP), n: 0, next: 0,
  };
  for (let i = 0; i < NP; i++) P.pos[i * 3 + 1] = -999;
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(P.pos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(P.col, 3));
  const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.42, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false,
  }));
  pts.frustumCulled = false;
  scene.add(pts);
  const tmpC = new THREE.Color();
  function burst(p, hex, n, speed) {
    if (!S.opt.fx) n = Math.ceil(n * 0.3);
    tmpC.set(hex);
    for (let k = 0; k < n; k++) {
      const i = P.next; P.next = (P.next + 1) % NP;
      const a = Math.random() * Math.PI * 2, b = Math.acos(rnd(-1, 1)), s = speed * rnd(0.4, 1);
      P.pos[i * 3] = p.x; P.pos[i * 3 + 1] = p.y; P.pos[i * 3 + 2] = p.z;
      P.vel[i * 3] = Math.sin(b) * Math.cos(a) * s; P.vel[i * 3 + 1] = Math.cos(b) * s; P.vel[i * 3 + 2] = Math.sin(b) * Math.sin(a) * s;
      const w = Math.random() < 0.3 ? 1 : 0;
      P.base[i * 3] = tmpC.r + (1 - tmpC.r) * w * 0.8; P.base[i * 3 + 1] = tmpC.g + (1 - tmpC.g) * w * 0.8; P.base[i * 3 + 2] = tmpC.b + (1 - tmpC.b) * w * 0.8;
      P.life[i] = P.max[i] = rnd(0.35, 0.7);
    }
    P.n = NP;
  }
  function updateParticles(dt) {
    if (!P.n) return;
    let alive = 0;
    for (let i = 0; i < NP; i++) {
      if (P.life[i] <= 0) continue;
      P.life[i] -= dt;
      const f = Math.max(0, P.life[i] / P.max[i]);
      if (P.life[i] <= 0) { P.pos[i * 3 + 1] = -999; P.col[i * 3] = P.col[i * 3 + 1] = P.col[i * 3 + 2] = 0; continue; }
      alive++;
      P.vel[i * 3 + 1] -= 6 * dt;
      P.pos[i * 3] += P.vel[i * 3] * dt; P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt; P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
      P.col[i * 3] = P.base[i * 3] * f; P.col[i * 3 + 1] = P.base[i * 3 + 1] * f; P.col[i * 3 + 2] = P.base[i * 3 + 2] * f;
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
    if (!alive) P.n = 0;
  }

  // --- Impacts sur les murs et traçantes ---
  const holeTex = canvasTex(64, 64, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(0.35, 'rgba(0,0,0,.75)'); g.addColorStop(0.55, 'rgba(255,209,102,.9)'); g.addColorStop(0.75, 'rgba(255,61,127,.35)'); g.addColorStop(1, 'rgba(255,61,127,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  const holes = [];
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false, fog: false }));
    m.visible = false; m.userData.t0 = 0; scene.add(m); holes.push(m);
  }
  let holeI = 0;
  const tracers = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false }));
    l.visible = false; l.frustumCulled = false; l.userData.t0 = 0; scene.add(l); tracers.push(l);
  }
  let tracI = 0;
  const V = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3() };
  function rayBox(dir, out) {
    const tx = dir.x > 1e-6 ? RW / dir.x : dir.x < -1e-6 ? -RW / dir.x : 1e9;
    const ty = dir.y > 1e-6 ? RYMAX / dir.y : dir.y < -1e-6 ? RYMIN / dir.y : 1e9;
    const tz = dir.z > 1e-6 ? RD / dir.z : dir.z < -1e-6 ? -RD / dir.z : 1e9;
    const t = Math.min(tx, ty, tz);
    out.p.copy(dir).multiplyScalar(t);
    out.n.set(0, 0, 0);
    if (t === tx) out.n.x = -Math.sign(dir.x); else if (t === ty) out.n.y = -Math.sign(dir.y); else out.n.z = -Math.sign(dir.z);
    return out;
  }
  const hitOut = { p: new THREE.Vector3(), n: new THREE.Vector3() };
  function addHole(dir) {
    rayBox(dir, hitOut);
    const m = holes[holeI]; holeI = (holeI + 1) % holes.length;
    m.position.copy(hitOut.p).addScaledVector(hitOut.n, 0.03);
    m.lookAt(V.a.copy(hitOut.p).add(hitOut.n));
    m.userData.t0 = performance.now(); m.material.opacity = 1; m.visible = true;
    return hitOut.p;
  }
  function addTracer(end, hex) {
    const l = tracers[tracI]; tracI = (tracI + 1) % tracers.length;
    V.b.set(0.32, -0.28, -0.8).applyQuaternion(camera.quaternion);
    const a = l.geometry.attributes.position;
    a.setXYZ(0, V.b.x, V.b.y, V.b.z); a.setXYZ(1, end.x, end.y, end.z); a.needsUpdate = true;
    l.material.color.set(hex); l.material.opacity = 0.9; l.userData.t0 = performance.now(); l.visible = true;
  }
  function updateMarks(nowMs) {
    for (const h of holes) {
      if (!h.visible) continue;
      const age = (nowMs - h.userData.t0) / 1000;
      if (age > 6) { h.visible = false; continue; }
      h.material.opacity = age < 4 ? 1 : 1 - (age - 4) / 2;
    }
    for (const l of tracers) {
      if (!l.visible) continue;
      const age = (nowMs - l.userData.t0) / 1000;
      if (age > 0.14) { l.visible = false; continue; }
      l.material.opacity = 0.9 * (1 - age / 0.14);
    }
  }

  // --- Cibles : pool de sphères à anneaux (shader) ---
  const targetGeo = new THREE.SphereGeometry(1, 36, 24);
  const VERT = 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vP = mv.xyz; gl_Position = projectionMatrix * mv; }';
  const FRAG = [
    'uniform vec3 uColor; uniform float uFlash; uniform float uHot; uniform float uWarn; uniform float uTime;',
    'varying vec3 vN; varying vec3 vP;',
    'void main(){',
    '  vec3 n = normalize(vN); vec3 v = normalize(-vP);',
    '  float c = clamp(dot(n, v), 0.0, 1.0); float rho = sqrt(1.0 - c*c);',
    '  vec3 col = uColor * 0.5;',
    '  float band1 = smoothstep(0.35 - 0.012, 0.35 + 0.012, rho) * (1.0 - smoothstep(0.68 - 0.012, 0.68 + 0.012, rho));',
    '  col = mix(col, uColor * 1.1, band1);',
    '  float core = 1.0 - smoothstep(0.35 - 0.012, 0.35 + 0.012, rho);',
    '  col = mix(col, vec3(1.0, 0.96, 0.78), core);',
    '  float sep = (1.0 - smoothstep(0.0, 0.016, abs(rho - 0.35) - 0.008)) + (1.0 - smoothstep(0.0, 0.016, abs(rho - 0.68) - 0.008));',
    '  col = mix(col, vec3(0.04, 0.03, 0.12), clamp(sep, 0.0, 1.0) * 0.85);',
    '  col *= 0.86 + 0.14 * n.y;',
    '  col += uColor * pow(1.0 - c, 3.0) * 0.7;',
    '  col = mix(col, vec3(1.0), uHot * 0.45);',
    '  float blink = step(0.0, sin(uTime * 26.0));',
    '  col = mix(col, vec3(1.0, 0.15, 0.2), uWarn * blink * 0.65);',
    '  col += vec3(uFlash);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}',
  ].join('\n');
  const pool = [];
  function makeTarget() {
    const u = { uColor: { value: new THREE.Color('#ff3d7f') }, uFlash: { value: 0 }, uHot: { value: 0 }, uWarn: { value: 0 }, uTime: { value: 0 } };
    const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG });
    const mesh = new THREE.Mesh(targetGeo, mat);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff3d7f, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0.8 }));
    glow.scale.setScalar(3.6);
    mesh.add(glow);
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, glow, u, alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), r: 1, born: 0, ready: 0, life: 0, pop: 1, deco: false };
  }
  for (let i = 0; i < 8; i++) pool.push(makeTarget());
  const tColor = () => (TCOLORS.find((c) => c.id === S.opt.tc) || TCOLORS[0]).hex;

  let autoScale = 1, qAcc = 0, qN = 0;
  function pixelRatio() {
    const dpr = window.devicePixelRatio || 1, q = S.opt.qual;
    let r = Math.min(dpr, q === 'eco' ? 1 : q === 'haute' ? 3 : COARSE ? 1.75 : 2);
    if (q === 'auto') r *= autoScale;
    return Math.max(0.6, r);
  }
  // En mode « auto » : si la partie tourne sous ~36 i/s, on baisse un peu la résolution
  function qualityWatch(raw) {
    if (S.opt.qual !== 'auto' || raw > 0.5) return;
    qAcc += raw; qN++;
    if (qN >= 90) {
      const avg = qAcc / qN; qAcc = 0; qN = 0;
      if (avg > 0.028 && autoScale > 0.6) { autoScale = Math.max(0.6, autoScale * 0.8); resize(); }
    }
  }
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    applyFov();
    positionCross();
    renderOnce();
  }
  function applyFov() {
    const v = 2 * Math.atan(Math.tan(S.opt.fov * DEG / 2) / camera.aspect) / DEG;
    camera.fov = clamp(v, 35, 105);
    camera.updateProjectionMatrix();
  }
  function radPerPx() {
    const hf = 2 * Math.atan(Math.tan(camera.fov * DEG / 2) * camera.aspect);
    return hf / Math.max(1, innerWidth);
  }
  function dirFrom(yaw, pitch, out) {
    const cp = Math.cos(pitch);
    return out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
  }
  function applyView() {
    view.pitch = clamp(view.pitch, -1.45, 1.45);
    camera.rotation.set(view.pitch, view.yaw, 0);
    camera.updateMatrixWorld(true);
  }

  /* =====================================================================
   * 5. Effets DOM : viseur, points flottants, hit marker, flèche
   * ===================================================================== */
  const fxEl = $('#fx'), crossEl = $('#cross'), crossIn = $('#cross-in'), hitm = $('#hitm'), arrowEl = $('#arrow');
  function xhSVG(style, color, px) {
    const path = style === 'croix' ? 'M20 4V14M20 26V36M4 20H14M26 20H36' : style === 't' ? 'M20 25V36M4 20H14M26 20H36' : '';
    const circ = style === 'cercle' || style === 'cible' ? '<circle cx="20" cy="20" r="11"/>' : '';
    const dotR = style === 'point' ? 3.2 : style === 'cible' ? 2.2 : style === 't' ? 1.8 : 0;
    const layer = (stroke, w, fill) =>
      '<g fill="none" stroke="' + stroke + '" stroke-width="' + w + '" stroke-linecap="round">' + (path ? '<path d="' + path + '"/>' : '') + circ + '</g>' +
      (dotR ? '<circle cx="20" cy="20" r="' + (dotR + (fill === '#000' ? 1.3 : 0)) + '" fill="' + fill + '"/>' : '');
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + px + '" height="' + px + '" viewBox="0 0 40 40" aria-hidden="true">' +
      '<g opacity=".85">' + layer('#000', 5, '#000') + '</g>' + layer(color, 2.4, color) + '</svg>';
  }
  function drawCross() {
    const html = xhSVG(S.opt.xs, S.opt.xc, Math.round(40 * S.opt.xz));
    crossIn.innerHTML = html;
    const prev = $('#xh-prev'); if (prev) prev.innerHTML = html;
    hitm.innerHTML = '<path d="M-15 -15L-8 -8M15 -15L8 -8M-15 15L-8 8M15 15L8 8" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>';
  }
  function positionCross() {
    if (cursorMode() && input.type === 'mouse' && input.ptrSet && effCursor()) moveCross(input.mouseX, input.mouseY);
    else moveCross(innerWidth / 2, innerHeight / 2);
  }
  function moveCross(x, y) { crossEl.style.transform = 'translate(' + x + 'px,' + y + 'px)'; }
  function crossKick() {
    if (REDUCED || !crossIn.animate) return;
    crossIn.animate([{ transform: 'translate(-50%,-50%) scale(1.35)' }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 110, easing: 'ease-out' });
  }
  function hitMarker(bull) {
    hitm.style.color = bull ? '#ffd166' : '#ffffff';
    if (hitm.animate) hitm.animate([{ opacity: 1, transform: 'translate(-50%,-50%) scale(.7)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.25)' }], { duration: 220, easing: 'ease-out' });
  }
  // Points flottants (pool)
  const pops = [];
  for (let i = 0; i < 10; i++) { const d = document.createElement('div'); d.className = 'pop'; fxEl.appendChild(d); pops.push(d); }
  let popI = 0;
  const pv = new THREE.Vector3(), av = new THREE.Vector3();
  function worldToScreen(p, out) {
    av.copy(p).applyMatrix4(camera.matrixWorldInverse);
    out.front = av.z < 0;
    pv.copy(p).project(camera);
    out.x = (pv.x * 0.5 + 0.5) * innerWidth; out.y = (-pv.y * 0.5 + 0.5) * innerHeight;
    return out;
  }
  const sc = { x: 0, y: 0, front: true };
  function pop(text, worldPos, cls) {
    const d = pops[popI]; popI = (popI + 1) % pops.length;
    worldToScreen(worldPos, sc);
    if (!sc.front) return;
    d.textContent = text; d.className = 'pop' + (cls ? ' ' + cls : '');
    const x = clamp(sc.x, 30, innerWidth - 60), y = clamp(sc.y, 60, innerHeight - 40);
    d.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    if (d.animate) {
      d.getAnimations().forEach((a) => a.cancel());
      d.animate([
        { opacity: 1, transform: 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%) scale(1.3)' },
        { opacity: 1, transform: 'translate(' + x + 'px,' + (y - 24) + 'px) translate(-50%,-50%) scale(1)', offset: 0.3 },
        { opacity: 0, transform: 'translate(' + x + 'px,' + (y - 70) + 'px) translate(-50%,-50%) scale(1)' },
      ], { duration: 750, easing: 'ease-out' });
    }
  }
  function tapRipple(x, y) {
    if (REDUCED || !fxEl.animate) return;
    const d = document.createElement('div'); d.className = 'tapr';
    d.style.left = x - 23 + 'px'; d.style.top = y - 23 + 'px'; fxEl.appendChild(d);
    const a = d.animate([{ opacity: 0.9, transform: 'scale(.5)' }, { opacity: 0, transform: 'scale(1.4)' }], { duration: 260 });
    a.onfinish = () => d.remove();
  }
  // Flèche vers la cible hors champ
  function updateArrow() {
    let best = null, ba = 9;
    const fwd = V.c; dirFrom(view.yaw, view.pitch, fwd);
    for (const t of G.targets) {
      if (!t.alive) continue;
      const a = fwd.angleTo(V.d.copy(t.pos).normalize());
      if (a < ba) { ba = a; best = t; }
    }
    if (!best) { arrowEl.hidden = true; return; }
    av.copy(best.pos).applyMatrix4(camera.matrixWorldInverse);
    let onScreen = false;
    if (av.z < 0) {
      pv.copy(best.pos).project(camera);
      onScreen = Math.abs(pv.x) < 0.94 && Math.abs(pv.y) < 0.94;
    }
    if (onScreen) { arrowEl.hidden = true; return; }
    const ang = Math.atan2(av.y, av.x);
    const R = Math.min(innerWidth, innerHeight) * 0.36;
    arrowEl.hidden = false;
    arrowEl.style.transform = 'translate(' + (innerWidth / 2 + Math.cos(ang) * R - 22) + 'px,' + (innerHeight / 2 - Math.sin(ang) * R - 22) + 'px) rotate(' + -ang + 'rad)';
  }

  /* =====================================================================
   * 6. État du jeu
   * ===================================================================== */
  let state = 'menu';   // menu | countdown | play | pause | end
  let screen = 'menu';  // écran d'interface affiché ('' = aucun)
  let G = { targets: [], mode: null };
  let selMode = null;
  let sessionCursor = false;
  const input = { type: COARSE ? 'touch' : 'mouse', mouseX: 0, mouseY: 0, drag: null, ptrSet: false };
  const effCursor = () => S.opt.ctl === 'curseur' || sessionCursor || COARSE && input.type === 'touch';
  const cursorMode = () => document.pointerLockElement !== canvas;
  // Visée au gyroscope (mobile) : la vue suit le téléphone, un toucher tire au centre
  const gyro = { seen: false, fail: false, last: 0, timer: 0 };
  const gyroActive = () => !!S.opt.gyro && COARSE && !gyro.fail && effCursor();
  function gyroEvent(e) {
    if ((state !== 'play' && state !== 'countdown') || !gyroActive()) { gyro.last = 0; return; }
    const rr = e.rotationRate;
    if (!rr) return;
    gyro.seen = true;
    const now = performance.now(), dt = gyro.last ? Math.min(0.1, (now - gyro.last) / 1000) : 0;
    gyro.last = now;
    if (!dt) return;
    const b = (rr.beta || 0) * DEG, g = (rr.gamma || 0) * DEG;
    const o = window.screen && window.screen.orientation;
    const a = (((o && o.angle) || window.orientation || 0) % 360 + 360) % 360;
    let y, p;
    if (a === 90) { y = b; p = g; } else if (a === 180) { y = -g; p = b; } else if (a === 270) { y = -b; p = -g; } else { y = g; p = -b; }
    view.yaw = wrapAngle(view.yaw + y * dt * S.opt.sens);
    view.pitch += p * dt * S.opt.sens * (S.opt.inv ? -1 : 1);
  }
  function gyroSync() {
    removeEventListener('devicemotion', gyroEvent);
    if (S.opt.gyro && COARSE) addEventListener('devicemotion', gyroEvent);
  }
  async function setGyro(on) {
    if (!on) { S.opt.gyro = false; gyroSync(); syncSettings(); save(); return; }
    const DM = window.DeviceMotionEvent;
    if (!DM) { toast("Ce navigateur n'expose pas les capteurs de mouvement.", 'info'); return; }
    if (typeof DM.requestPermission === 'function') {
      try {
        if ((await DM.requestPermission()) !== 'granted') { toast('Accès aux capteurs refusé : gyroscope indisponible.', 'info'); return; }
      } catch (e) { toast('Accès aux capteurs impossible depuis cette page.', 'info'); return; }
    }
    S.opt.gyro = true; gyro.fail = false; gyroSync(); syncSettings(); save();
    toast('Gyroscope activé : lance une partie et bouge ton téléphone. Touche l\'écran pour tirer.', 'info');
  }

  function newGame(mode, diff) {
    const dur = mode.duree || 0;
    return {
      mode, diff, dm: DIFFS[diff], t: 0, dur, cd: 3, score: 0, shots: 0, hits: 0, miss: 0, expired: 0, streak: 0, best: 0, mult: 1, bulls: 0,
      ms: { round: 0, phase: 'wait', times: [], pts: [], falseStarts: 0, longest: 0 }, started: false, daily: false, shotLog: [], lastTick: 0, kill: [], slices: new Array(Math.max(1, Math.ceil((dur || 50) / 5))).fill(0), lastHit: 0, missRun: 0, firing: false, onTime: 0, targets: pool, over: false,
      hudCache: {}, prevRecord: 0, ps: null, psIdx: 1, k: 1, sliceOn: [],
    };
  }
  function clearTargets() { pool.forEach((t) => { t.alive = false; t.deco = false; t.mesh.visible = false; }); }
  function spawn(pos, r, opt) {
    const tg = pool.find((t) => !t.alive);
    if (!tg) return null;
    opt = opt || {};
    tg.alive = true; tg.deco = false; tg.pos.copy(pos); tg.r = r; tg.vel.set(0, 0, 0); if (opt.vel) tg.vel.copy(opt.vel);
    tg.born = G.t; tg.ready = Math.max(G.t, G.lastHit); tg.life = opt.life || 0; tg.pop = 0;
    tg.mesh.visible = true; tg.mesh.position.copy(pos); tg.mesh.scale.setScalar(0.001);
    const c = tColor();
    tg.u.uColor.value.set(c); tg.glow.material.color.set(c);
    tg.u.uHot.value = 0; tg.u.uWarn.value = 0; tg.u.uFlash.value = 0.7;
    return tg;
  }
  function kill(tg) { tg.alive = false; tg.mesh.visible = false; }
  const easeBack = (x) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  function updateTargets(dt, nowS) {
    for (const t of pool) {
      if (!t.alive || t.deco) continue;
      if (t.pop < 1) { t.pop = Math.min(1, t.pop + dt / 0.16); }
      t.mesh.scale.setScalar(Math.max(0.001, t.r * easeBack(t.pop)));
      t.mesh.position.copy(t.pos);
      t.u.uFlash.value = Math.max(0, t.u.uFlash.value - dt * 3);
      t.u.uTime.value = nowS;
      if (t.life > 0) {
        const left = t.life - (G.t - t.born);
        t.u.uWarn.value = left < 0.8 ? 1 : 0;
        if (left <= 0) { if (G.mode.onExpire) G.mode.onExpire(t); else kill(t); }
      }
    }
  }

  /* =====================================================================
   * 7. Modes de jeu
   * ===================================================================== */
  const aimDirV = new THREE.Vector3();
  function aimDir(nx, ny) {
    aimDirV.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
    return aimDirV;
  }
  // Test rayon / sphère depuis l'origine : renvoie la cible la plus proche touchée
  function pickTarget(dir, extra) {
    let best = null, bt = 1e9, brho = 0;
    for (const t of pool) {
      if (!t.alive || t.deco) continue;
      const tt = t.pos.dot(dir);
      if (tt <= 0) continue;
      const perp2 = t.pos.lengthSq() - tt * tt;
      const rr = t.r * (extra || 1);
      if (perp2 <= rr * rr && tt < bt) { best = t; bt = tt; brho = Math.sqrt(Math.max(0, perp2)) / t.r; }
    }
    return best ? { tg: best, t: bt, rho: brho } : null;
  }

  function registerHit(tg, rho) {
    const m = G.mode, bull = rho <= BULL;
    G.hits++; G.streak++; G.best = Math.max(G.best, G.streak); G.missRun = 0;
    const prev = G.mult;
    G.mult = Math.min(4, 1 + Math.floor(G.streak / 5));
    const base = bull ? (m.bullPts || 150) : 100;
    const pts = Math.round(base * G.mult * G.dm.mult * (G.ps ? G.ps.mult : 1));
    G.score += pts;
    if (bull) G.bulls++;
    G.kill.push(G.t - tg.ready);
    G.slices[Math.min(G.slices.length - 1, Math.floor(G.t / 5))]++;
    G.lastHit = G.t;
    burst(tg.pos, tColor(), 22, 7);
    pop((bull ? '★ ' : '') + '+' + fmt(pts), tg.pos, bull ? 'gold' : '');
    hitMarker(bull);
    Snd.hit(G.mult, bull);
    if (G.mult > prev) {
      const el = $('#h-mult'); el.classList.remove('up'); void el.offsetWidth; el.classList.add('up');
      Snd.combo(G.mult);
      if (G.mult === 4) unlock('combo-max');
    }
    unlock('premiere-cible');
    kill(tg);
    if (m.onHit) m.onHit(tg);
  }
  function registerMiss(fromShot) {
    G.miss++; G.streak = 0; G.mult = 1;
    if (fromShot) {
      G.missRun++;
      if (G.missRun >= 10) unlock('rafale-dans-le-vide');
      Snd.miss();
      if (G.mode.penalty) G.score = Math.max(0, G.score - Math.round(G.mode.penalty * G.dm.mult));
    }
  }

  // Carte des tirs : position de chaque tir par rapport à la cible la plus proche (en rayons de cible)
  const _q = new THREE.Quaternion(), _d = new THREE.Vector3(), _t = new THREE.Vector3();
  function recordShot(dir, hit) {
    if (G.shotLog.length >= 400) return;
    let best = null, bc = -2;
    for (const t of pool) {
      if (!t.alive || t.deco) continue;
      const c = dir.dot(t.pos) / t.pos.length();
      if (c > bc) { bc = c; best = t; }
    }
    if (!best) return;
    _q.copy(camera.quaternion).invert();
    _d.copy(dir).applyQuaternion(_q); _t.copy(best.pos).applyQuaternion(_q);
    if (_d.z >= -0.01 || _t.z >= -0.01) return;
    const rad = best.r / _t.length();
    const dx = (_d.x / -_d.z - _t.x / -_t.z) / rad, dy = (_d.y / -_d.z - _t.y / -_t.z) / rad;
    if (Math.abs(dx) > 4.4 || Math.abs(dy) > 4.4) return;
    G.shotLog.push([dx, dy, hit ? 1 : 0]);
  }
  function shoot(nx, ny, evTime) {
    if (state !== 'play' || G.mode.hold) return;
    const dir = aimDir(nx, ny);
    G.shots++;
    Snd.shoot(); crossKick();
    const pk = pickTarget(dir);
    recordShot(dir, !!pk);
    const now = evTime && evTime > 0 && evTime < performance.now() + 50 ? evTime : performance.now();
    if (G.mode.onShot && G.mode.onShot(pk, now, dir)) { if (!pk) addTracer(addHole(dir), '#ffffff'); else addTracer(V.a.copy(dir).multiplyScalar(pk.t), tColor()); return; }
    if (pk) {
      addTracer(V.a.copy(dir).multiplyScalar(pk.t), tColor());
      registerHit(pk.tg, pk.rho);
    } else {
      addTracer(addHole(dir), '#ffffff');
      registerMiss(true);
    }
    updateHud();
  }

  // --- Mode 1 : Grille ---
  function gridSpawn() {
    const used = new Set(pool.filter((t) => t.alive).map((t) => t.cell));
    let c, guard = 0;
    do { c = (Math.random() * 15) | 0; } while ((used.has(c) || c === G.ms.last) && guard++ < 40);
    G.ms.last = c;
    const tg = spawn(new THREE.Vector3(((c % 5) - 2) * 2.5, (((c / 5) | 0) - 1) * 2.5 + 0.5, -14), 0.55 * G.dm.taille);
    if (tg) tg.cell = c;
  }
  // --- Mode 2 : Éclair 360° ---
  function flashSpawn() {
    let sgn = Math.random() < 0.5 ? -1 : 1;
    let yaw = view.yaw + sgn * rnd(35, 110) * DEG;
    if (Math.abs(wrapAngle(yaw)) > 140 * DEG) yaw = view.yaw - sgn * rnd(35, 110) * DEG;
    const pitch = rnd(-14, 28) * DEG;
    const p = dirFrom(yaw, pitch, new THREE.Vector3()).multiplyScalar(rnd(9, 13));
    spawn(p, 0.62 * G.dm.taille, { life: 2.6 / G.dm.vit });
  }
  // --- Mode 4 : Précision ---
  function precSpawn() {
    let p = new THREE.Vector3(), ok = false, g = 0;
    while (!ok && g++ < 12) {
      dirFrom(rnd(-22, 22) * DEG, rnd(-10, 14) * DEG, p).multiplyScalar(14);
      ok = pool.every((t) => !t.alive || t.pos.distanceTo(p) > 2);
    }
    spawn(p, 0.27 * G.dm.taille * (G.ps ? G.ps.k : 1), { life: 3.4 / G.dm.vit });
  }
  // --- Mode 5 : Volantes ---
  const FLY = { x: 10, y0: -3.5, y1: 6, z0: -16.5, z1: -10 };
  function flySpawn() {
    const a = rnd(0, Math.PI * 2), sp = 4.2 * G.dm.vit;
    const vel = new THREE.Vector3(Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rnd(-0.4, 0.4) * sp);
    spawn(new THREE.Vector3(rnd(-8, 8), rnd(-2, 5), rnd(-16, -11)), 0.62 * G.dm.taille, { vel });
  }
  // --- Mode 6 : Réflexes ---
  const ROUNDS = 10;
  function reflexNext() {
    const m = G.ms;
    if (m.round >= ROUNDS) { finish(); return; }
    m.phase = 'wait'; m.timer = rnd(1.1, 3.4);
    setMsg('Attends la cible…', true);
    updateHud();
  }
  function reflexEnd(text, pts, ms) {
    const m = G.ms;
    m.phase = 'result'; m.timer = 1.0; m.round++;
    m.pts.push(pts); m.times.push(ms);
    G.score += pts;
    setMsg(text, true);
    updateHud();
  }

  const MODES = [
    {
      id: 'grille', nom: 'Grille', ic: '▦', court: 'Trois cibles fixes sur un mur. Clique vite, clique juste.', duree: 60,
      desc: "Trois cibles sont accrochées au mur d'en face. Dès que tu en touches une, une nouvelle apparaît ailleurs. Le mode idéal pour s'échauffer.",
      regles: ['Dure 60 secondes.', 'Le centre clair de la cible vaut 150 points au lieu de 100.', 'Chaque raté casse ton combo.'],
      astuce: 'Touche les cibles une à une, sans te précipiter.', grades: [3000, 6000, 10000, 15000],
      start() { G.ms = { last: -1 }; for (let i = 0; i < 3; i++) gridSpawn(); },
      onHit() { gridSpawn(); },
    },
    {
      id: 'eclair', nom: 'Éclair 360°', ic: '⚡', court: 'Une cible surgit autour de toi : retourne-toi, vise, tire.', duree: 60, wide: true,
      desc: "Une seule cible apparaît, n'importe où autour de toi, et disparaît vite. Retourne-toi, vise et tire avant qu'elle ne s'évanouisse.",
      regles: ['Dure 60 secondes.', 'Une cible qui clignote en rouge va disparaître : elle casse ton combo.', "Une flèche dorée te montre la direction quand la cible est hors de l'écran."],
      astuce: 'Suis la flèche dorée si la cible est derrière toi.', grades: [2500, 5000, 8000, 12000],
      start() { flashSpawn(); },
      onHit() { flashSpawn(); },
      onExpire(tg) { kill(tg); G.expired++; registerMiss(false); Snd.expire(); flashSpawn(); updateHud(); },
    },
    {
      id: 'suivi', nom: 'Suivi', ic: '🌀', court: 'Garde ton viseur sur une sphère mobile, tir maintenu.', duree: 30, hold: true,
      desc: 'Une grosse sphère se promène en changeant sans cesse de direction. Garde ton viseur dessus et maintiens le tir pour marquer.',
      regles: ['Dure 30 secondes.', 'Maintiens le clic (ou le doigt) pressé : les points tombent tant que tu es sur la sphère.', 'Elle devient blanche quand tu la tiens bien. Environ 200 points par seconde de suivi.'],
      astuce: 'Maintiens le tir et reste sur la sphère.', grades: [2000, 3500, 4800, 5600],
      start() {
        const a = { yaw: 0, pitch: 0.05, vy: 0, vp: 0, tvy: 0, tvp: 0, next: 0, on: false, cur: 0, longest: 0 };
        G.ms = a;
        a.tg = spawn(dirFrom(0, 0.05, new THREE.Vector3()).multiplyScalar(13), 0.9 * G.dm.taille);
        a.tg.life = 0;
        Snd.humStart();
      },
      update(dt) {
        const a = G.ms, tg = a.tg, sp = 20 * G.dm.vit * DEG;
        a.next -= dt;
        if (a.next <= 0) { a.next = rnd(0.5, 1.4); const ang = rnd(0, Math.PI * 2), k = rnd(0.35, 1); a.tvy = Math.cos(ang) * sp * k; a.tvp = Math.sin(ang) * sp * k * 0.7; }
        const f = 1 - Math.exp(-4 * dt);
        a.vy += (a.tvy - a.vy) * f; a.vp += (a.tvp - a.vp) * f;
        a.yaw += a.vy * dt; a.pitch += a.vp * dt;
        const YM = 28 * DEG, PMN = -14 * DEG, PMX = 18 * DEG;
        if (a.yaw > YM) { a.yaw = YM; a.tvy = -Math.abs(a.tvy); a.vy = -Math.abs(a.vy); } else if (a.yaw < -YM) { a.yaw = -YM; a.tvy = Math.abs(a.tvy); a.vy = Math.abs(a.vy); }
        if (a.pitch > PMX) { a.pitch = PMX; a.tvp = -Math.abs(a.tvp); a.vp = -Math.abs(a.vp); } else if (a.pitch < PMN) { a.pitch = PMN; a.tvp = Math.abs(a.tvp); a.vp = Math.abs(a.vp); }
        dirFrom(a.yaw, a.pitch, tg.pos).multiplyScalar(13);
        // Viseur sur la cible ?
        let on = false;
        if (G.firing) {
          const c = aimPoint();
          const pk = pickTarget(aimDir(c.x, c.y));
          on = !!pk;
        }
        if (on) {
          G.onTime += dt; G.score += 200 * G.dm.mult * dt; a.cur += dt; a.longest = Math.max(a.longest, a.cur);
          G.slices[Math.min(G.slices.length - 1, Math.floor(G.t / 5))] += dt;
        } else a.cur = 0;
        a.on = on;
        tg.u.uHot.value += ((on ? 1 : 0) - tg.u.uHot.value) * Math.min(1, dt * 12);
        tg.glow.material.opacity = on ? 1 : 0.8;
        Snd.humSet(on, tg.u.uHot.value);
        if (!G.hudCache.tick || G.t - G.hudCache.tick > 0.1) { G.hudCache.tick = G.t; updateHud(); }
      },
    },
    {
      id: 'precision', nom: 'Précision', ic: '🔬', court: 'Micro-cibles qui disparaissent. Les ratés coûtent des points.', duree: 45, bullPts: 200, penalty: 40, tailleReglable: true,
      desc: 'Deux toutes petites cibles, qui ne restent pas longtemps. Vise le centre clair pour un gros bonus, mais chaque tir dans le vide te coûte des points.',
      regles: ['Dure 45 secondes.', 'Le centre clair vaut 200 points (100 sur le reste de la cible).', 'Un raté retire 40 points (× la difficulté) et casse ton combo.', 'Tu choisis la taille des cibles avant de démarrer : plus elles sont petites, plus elles rapportent.'],
      astuce: 'Respire : mieux vaut tirer juste que tirer vite.', grades: [3000, 6500, 11000, 16000],
      start() { precSpawn(); precSpawn(); },
      onHit() { precSpawn(); },
      onExpire(tg) { kill(tg); G.expired++; registerMiss(false); Snd.expire(); precSpawn(); updateHud(); },
    },
    {
      id: 'volantes', nom: 'Volantes', ic: '🛸', court: 'Quatre cibles qui rebondissent dans la salle.', duree: 60,
      desc: "Quatre cibles flottent et rebondissent dans la salle, sans jamais s'arrêter. Suis-les des yeux et tire en avance.",
      regles: ['Dure 60 secondes.', 'Quand tu en touches une, une autre repart aussitôt.', 'Les cibles lointaines paraissent plus petites : elles rapportent autant.'],
      astuce: 'Choisis une cible et enchaîne, sans courir après toutes.', grades: [2500, 5000, 8000, 12000],
      start() { for (let i = 0; i < 4; i++) flySpawn(); },
      onHit() { flySpawn(); },
      update(dt) {
        for (const t of pool) {
          if (!t.alive) continue;
          t.pos.addScaledVector(t.vel, dt);
          if (t.pos.x > FLY.x) { t.pos.x = FLY.x; t.vel.x = -Math.abs(t.vel.x); } else if (t.pos.x < -FLY.x) { t.pos.x = -FLY.x; t.vel.x = Math.abs(t.vel.x); }
          if (t.pos.y > FLY.y1) { t.pos.y = FLY.y1; t.vel.y = -Math.abs(t.vel.y); } else if (t.pos.y < FLY.y0) { t.pos.y = FLY.y0; t.vel.y = Math.abs(t.vel.y); }
          if (t.pos.z > FLY.z1) { t.pos.z = FLY.z1; t.vel.z = -Math.abs(t.vel.z); } else if (t.pos.z < FLY.z0) { t.pos.z = FLY.z0; t.vel.z = Math.abs(t.vel.z); }
        }
      },
    },
    {
      id: 'reflexes', nom: 'Réflexes', ic: '⏱️', court: 'La cible apparaît sans prévenir : touche-la le plus vite possible.', duree: 0, rounds: ROUNDS,
      desc: "Dix manches. À chaque fois, attends que la cible apparaisse puis touche-la le plus vite possible. On mesure ton temps de réaction.",
      regles: ['10 manches, pas de chronomètre : seul compte ton temps.', "Tirer avant l'apparition est un faux départ : la manche vaut 0.", 'Moins de 200 ms, c\'est un temps de champion. Environ 1 000 points pour une réponse instantanée.'],
      astuce: 'Ne tire pas avant que la cible apparaisse.', grades: [3500, 5500, 6800, 7800],
      start() { G.ms = { round: 0, phase: 'wait', timer: rnd(1.1, 3.4), times: [], pts: [], falseStarts: 0, goT: 0, tg: null }; setMsg('Attends la cible…', true); },
      update(dt) {
        const m = G.ms;
        if (m.phase === 'wait') {
          m.timer -= dt;
          if (m.timer <= 0) {
            const p = dirFrom(view.yaw + rnd(-14, 14) * DEG, view.pitch + rnd(-8, 8) * DEG, new THREE.Vector3()).multiplyScalar(13);
            if (p.y < RYMIN + 1.5) p.y = RYMIN + 1.5;
            m.tg = spawn(p, 0.7 * G.dm.taille);
            m.phase = 'go'; m.goT = performance.now();
            Snd.go(); setMsg('Maintenant !', true);
          }
        } else if (m.phase === 'go') {
          if (performance.now() - m.goT > 2200) {
            if (m.tg) kill(m.tg);
            reflexEnd('Trop lent !', 0, 0);
            Snd.expire();
          }
        } else if (m.phase === 'result') {
          m.timer -= dt;
          if (m.timer <= 0) reflexNext();
        }
      },
      onResume() { const m = G.ms; if (m.phase === 'go') { if (m.tg) kill(m.tg); m.phase = 'wait'; m.timer = rnd(1.1, 2.5); setMsg('Attends la cible…', true); } },
      onShot(pk, now) {
        const m = G.ms;
        if (m.phase === 'wait') {
          m.falseStarts++; G.miss++;
          unlock('trop-presse');
          Snd.miss();
          reflexEnd('Faux départ ! Trop tôt.', 0, 0);
          return true;
        }
        if (m.phase === 'go') {
          if (pk) {
            const ms = Math.max(1, Math.round(now - m.goT));
            const pts = Math.round(Math.max(0, (700 - ms) / 700) * 1000 * G.dm.mult);
            G.hits++; G.streak++; G.best = Math.max(G.best, G.streak);
            burst(pk.tg.pos, tColor(), 22, 7); hitMarker(pk.rho <= BULL); Snd.hit(1, pk.rho <= BULL);
            pop(ms + ' ms', pk.tg.pos, ms < 200 ? 'gold' : '');
            kill(pk.tg);
            if (ms < 200) unlock('doigts-eclair');
            reflexEnd(ms + ' ms · +' + fmt(pts) + ' points', pts, ms);
            unlock('premiere-cible');
          } else { G.miss++; G.streak = 0; G.missRun++; Snd.miss(); if (G.missRun >= 10) unlock('rafale-dans-le-vide'); }
          return true;
        }
        return true; // pendant l'écran de résultat : tir ignoré
      },
    },
  ];
  MODES.push(Object.assign({}, MODES[0], {
    id: 'libre', nom: 'Échauffement libre', ic: '🧘', libre: true, duree: 0,
    court: 'Sans chrono ni score : règle ta sensibilité et ton viseur.',
    desc: "Les trois cibles de la Grille, sans chronomètre et sans classement. Parfait pour te mettre en jambes ou tester tes réglages.",
    regles: ["Aucune limite de temps : la partie s'arrête quand tu quittes.", "Ouvre ⏸ Pause puis Réglages pour ajuster sensibilité, champ de vision et viseur, puis reprends.", 'Rien n’est enregistré : ni record, ni statistique, ni succès de score.'],
    astuce: 'Échauffement libre : ⏸ Pause puis Réglages pour ajuster ta sensibilité.', grades: [1, 1, 1, 1],
  }));
  const SCORED = MODES.filter((m) => !m.libre);
  const modeById = (id) => MODES.find((m) => m.id === id);

  /* =====================================================================
   * 8. HUD
   * ===================================================================== */
  const hud = { root: $('#hud'), score: $('#h-score'), mult: $('#h-mult'), time: $('#h-time'), tlbl: $('#h-tlbl'), bar: $('#h-bar'), acc: $('#h-acc'), msg: $('#h-msg'), count: $('#count') };
  function setText(el, key, v) { if (G.hudCache[key] !== v) { G.hudCache[key] = v; el.textContent = v; } }
  function setMsg(text, big) {
    if (!text) { hud.msg.hidden = true; return; }
    hud.msg.hidden = false; hud.msg.textContent = text; hud.msg.classList.toggle('big', !!big);
  }
  function updateHud() {
    const m = G.mode; if (!m) return;
    setText(hud.score, 's', fmt(G.score));
    if (m.id === 'reflexes') {
      hud.tlbl.textContent = 'Manche';
      setText(hud.time, 't', Math.min(ROUNDS, G.ms.round + (G.ms.phase === 'result' ? 0 : 1)) + '/' + ROUNDS);
      hud.bar.style.transform = 'scaleX(' + (G.ms.round / ROUNDS) + ')';
      setText(hud.mult, 'm', '');
      const done = G.ms.times.filter((x) => x > 0);
      setText(hud.acc, 'a', done.length ? 'Moyenne ' + Math.round(done.reduce((a, b) => a + b, 0) / done.length) + ' ms' : '');
      return;
    }
    if (m.libre) {
      hud.tlbl.textContent = 'Libre'; setText(hud.time, 't', '∞'); hud.bar.style.transform = 'scaleX(1)';
      setText(hud.mult, 'm', '×' + G.mult + (G.streak ? ' · série ' + G.streak : ''));
      setText(hud.acc, 'a', G.shots ? G.hits + ' ✓ · ' + Math.round((G.hits / G.shots) * 100) + ' %' : '');
      return;
    }
    hud.tlbl.textContent = 'Temps';
    const left = Math.max(0, G.dur - G.t);
    setText(hud.time, 't', String(Math.ceil(left)));
    hud.time.classList.toggle('low', left <= 10);
    hud.bar.style.transform = 'scaleX(' + (left / G.dur) + ')';
    if (m.id === 'suivi') {
      setText(hud.mult, 'm', '');
      setText(hud.acc, 'a', 'Sur la cible : ' + Math.round(G.t > 0 ? (G.onTime / G.t) * 100 : 0) + ' %');
    } else {
      setText(hud.mult, 'm', '×' + G.mult + (G.streak ? ' · série ' + G.streak : ''));
      setText(hud.acc, 'a', G.shots ? G.hits + ' ✓ · ' + Math.round((G.hits / G.shots) * 100) + ' %' : '');
    }
  }
  function syncSoundButtons() {
    const mute = S.opt.mute;
    const b = $('#b-snd'); b.textContent = mute ? '🔇' : '🔊'; b.setAttribute('aria-pressed', String(mute)); b.setAttribute('aria-label', mute ? 'Remettre le son' : 'Couper le son');
    const t = $('#t-mute'); t.textContent = mute ? '🔇 Son coupé' : '🔊 Son activé'; t.setAttribute('aria-pressed', String(mute));
  }
  function toggleMute() { S.opt.mute = !S.opt.mute; Snd.unlock(); Snd.refresh(); syncSoundButtons(); save(); }

  /* =====================================================================
   * 9. Flux de partie
   * ===================================================================== */
  function controlsHTML() {
    if (gyroActive()) {
      return '<b>Contrôles :</b> incline et tourne ton téléphone pour viser : la vue suit tes mouvements. Touche l\'écran pour tirer au centre' + (selMode && selMode.hold ? ' (garde le doigt appuyé)' : '') + '.';
    }
    if (effCursor()) {
      return '<b>Contrôles :</b> touche ou clique directement sur les cibles pour tirer. ' + (selMode && selMode.wide ? 'Glisse pour tourner la vue. ' : '') +
        (selMode && selMode.hold ? 'Garde le doigt (ou le clic) appuyé sur la sphère.' : '') + ' <span class="kbd">P</span> pause.';
    }
    return '<b>Contrôles :</b> la souris sera verrouillée. Bouge-la pour viser, <b>clic gauche</b> pour tirer' + (selMode && selMode.hold ? ' (maintiens-le)' : '') +
      '. <span class="kbd">Échap</span> ou <span class="kbd">P</span> : pause.';
  }
  function startGame(modeId, opts) {
    opts = opts || {};
    Snd.unlock();
    const mode = modeById(modeId || (selMode && selMode.id));
    if (!mode) return;
    selMode = mode;
    Snd.humStop();
    clearTargets();
    G = newGame(mode, opts.diff != null ? opts.diff : S.opt.diff);
    G.daily = !!opts.daily && !mode.libre;
    G.psIdx = mode.tailleReglable ? (G.daily ? 1 : opts.psz != null ? opts.psz : S.opt.psz) : 1;
    G.ps = mode.tailleReglable ? PSIZES[G.psIdx] : null;
    G.k = G.dm.mult * (G.ps ? G.ps.mult : 1);
    G.prevRecord = S.rec[recKey(mode.id, G.diff, G.psIdx)] || 0;
    sessionCursor = false;
    view.yaw = 0; view.pitch = 0; applyView();
    state = 'countdown'; G.cd = 3;
    hud.time.classList.remove('low');
    showScreen('');
    hud.root.hidden = false; setMsg(mode.astuce, false);
    hud.msg.classList.remove('big');
    updateHud();
    hud.count.hidden = false; hud.count.textContent = '3'; tickCount();
    updateCursorVisual();
    if (!effCursor()) requestLock('start');
    gyro.fail = false; gyro.last = 0; clearTimeout(gyro.timer);
    if (gyroActive()) {
      gyro.seen = false;
      gyro.timer = setTimeout(() => {
        if (!gyro.seen && gyroActive() && (state === 'countdown' || state === 'play')) {
          gyro.fail = true; updateCursorVisual();
          toast('Aucun capteur de mouvement détecté : retour aux commandes tactiles.', 'info');
        }
      }, 2600);
    }
    Snd.beep(440);
    kick();
  }
  function tickCount() { hud.count.classList.remove('tick'); void hud.count.offsetWidth; hud.count.classList.add('tick'); }
  function beginPlay() {
    state = 'play';
    hud.count.hidden = true;
    if (G.started) { if (G.mode.onResume) G.mode.onResume(); if (G.mode.id !== 'reflexes') setMsg(''); return; }
    G.started = true;
    G.t = 0; G.lastHit = 0;
    Snd.beep(880, 0.25);
    G.mode.start();
    if (G.mode.id !== 'reflexes') { setMsg(G.mode.astuce, false); G.hudCache.hint = 4; }
    updateHud();
  }
  function pause() {
    if (state !== 'play' && state !== 'countdown') return;
    G.prevState = state;
    state = 'pause';
    G.firing = false; input.drag = null;
    Snd.humSet(false, 0);
    if (document.pointerLockElement === canvas) { wasLocked = false; try { document.exitPointerLock(); } catch (e) { /* ignoré */ } }
    hud.count.hidden = true;
    $('#pause-info').textContent = G.mode.nom + ' · ' + G.dm.nom + ' · score ' + fmt(G.score);
    showScreen('pause');
    updateCursorVisual();
    renderOnce();
  }
  function resume() {
    if (state !== 'pause') return;
    showScreen('');
    state = 'countdown'; G.cd = G.started ? 2 : 3;
    hud.count.hidden = false; hud.count.textContent = String(G.cd); tickCount();
    if (!effCursor()) requestLock('resume');
    updateCursorVisual();
    kick();
  }
  function restart() {
    if (!G.mode || (state !== 'play' && state !== 'countdown' && state !== 'pause')) return;
    startGame(G.mode.id, replayOpts());
  }
  const replayOpts = () => ({ diff: G.diff, daily: G.daily, psz: G.psIdx });
  function quitToMenu() {
    Snd.humStop();
    releaseLock();
    state = 'menu'; hud.root.hidden = true; setMsg(''); hud.count.hidden = true; arrowEl.hidden = true;
    clearTargets(); ambientInit();
    updateCursorVisual();
    showScreen('menu'); refreshMenu();
    kick();
  }

  function gradeOf(mode, score) {
    const raw = score / G.k, g = mode.grades;
    return raw >= g[3] ? 'S' : raw >= g[2] ? 'A' : raw >= g[1] ? 'B' : raw >= g[0] ? 'C' : 'D';
  }
  function finish() {
    if (G.over) return;
    G.over = true;
    const m = G.mode;
    if (m.duree) G.t = Math.min(G.t, m.duree);
    Snd.humStop();
    releaseLock();
    state = 'end'; hud.root.hidden = true; setMsg(''); hud.count.hidden = true; arrowEl.hidden = true;
    updateCursorVisual();
    const score = Math.round(G.score);
    const hitMode = m.id !== 'suivi' && m.id !== 'reflexes';
    const acc = G.shots ? G.hits / G.shots : 0;
    const grade = gradeOf(m, score);
    const key = recKey(m.id, G.diff, G.psIdx);
    const prev = G.prevRecord;
    const isRecord = score > 0 && score > prev;
    if (isRecord) S.rec[key] = score;

    // Totaux
    const tot = S.tot;
    tot.parties++; tot.sec += Math.round(G.t);
    if (hitMode || m.id === 'reflexes') { tot.tirs += G.shots; tot.touches += G.hits; }
    tot.serie = Math.max(tot.serie, G.best);
    S.hist.unshift([m.id, G.diff, score, Math.round(acc * 100), Math.floor(Date.now() / 1000)]);
    S.hist = S.hist.slice(0, 20);
    S.ev[m.id] = (S.ev[m.id] || []).concat([Math.round(score / G.k * 1.5)]).slice(-30);
    if (S.modes.indexOf(m.id) < 0) S.modes.push(m.id);
    G.dailyOk = G.daily && score > 0;
    if (G.dailyOk) {
      const today = dayKey(), j = S.jour;
      if (j.d === today) j.s = Math.max(j.s, score);
      else { j.serie = j.d === yesterdayKey() ? j.serie + 1 : 1; j.d = today; j.s = score; }
    }

    // Détails + graphique
    const rows = [], sr = { vals: [], cap: '', unit: '' };
    if (hitMode) {
      const avg = G.kill.length ? G.kill.reduce((a, b) => a + b, 0) / G.kill.length : 0;
      rows.push(['Cibles touchées', G.hits], ['Tirs', G.shots], ['Précision', Math.round(acc * 100) + ' %'], ['Tirs au centre', G.bulls],
        ['Meilleure série', G.best], ['Temps moyen / cible', avg ? Math.round(avg * 1000) + ' ms' : '—']);
      if (m.onExpire) rows.push(['Cibles disparues', G.expired]);
      sr.vals = G.slices.slice(); sr.cap = 'Cibles touchées toutes les 5 secondes — pour voir si tu faiblis.';
    } else if (m.id === 'suivi') {
      const pct = G.t > 0 ? G.onTime / G.t : 0;
      rows.push(['Temps sur la cible', G.onTime.toFixed(1) + ' s'], ['Précision du suivi', Math.round(pct * 100) + ' %'], ['Plus longue poursuite', G.ms.longest.toFixed(1) + ' s']);
      sr.vals = G.slices.map((v) => v / 5); sr.cap = 'Part du temps passée sur la cible, toutes les 5 secondes.';
      G.suiviPct = pct;
    } else {
      const ok = G.ms.times.filter((x) => x > 0);
      rows.push(['Temps moyen', ok.length ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) + ' ms' : '—'], ['Meilleur temps', ok.length ? Math.min.apply(null, ok) + ' ms' : '—'],
        ['Plus lent', ok.length ? Math.max.apply(null, ok) + ' ms' : '—'], ['Manches réussies', ok.length + '/' + ROUNDS], ['Faux départs', G.ms.falseStarts]);
      sr.vals = G.ms.times.slice(); sr.cap = 'Temps de réaction de chaque manche, en ms (une barre basse, c\'est rapide ; aucune barre : manche ratée).'; sr.unit = 'ms';
    }
    save(true);
    renderEnd(m, score, grade, isRecord, prev, rows, sr);
    showScreen('end');
    Snd.fanfare(grade === 'S' ? 3 : grade === 'A' || grade === 'B' ? 1 : 0);
    clearTargets(); ambientInit();

    // Succès
    unlock('echauffe');
    if (hitMode) {
      if (m.id === 'grille' && G.hits >= 25 && G.miss === 0) unlock('sans-faute');
      if (G.shots >= 30 && acc >= 0.9) unlock('oeil-de-lynx');
      if (G.diff === 2 && G.shots >= 20 && acc >= 0.7) unlock('sans-filet');
    }
    if (score >= 5000) unlock('cinq-mille');
    if (score >= 10000) unlock('dix-mille');
    if (m.id === 'suivi' && G.suiviPct >= 0.8) unlock('colle-a-la-cible');
    if (SCORED.every((x) => S.modes.indexOf(x.id) >= 0)) unlock('touche-a-tout');
    if (tot.touches >= 100) unlock('centenaire');
    if (tot.touches >= 1000) unlock('millier');
    if (tot.parties >= 10) unlock('habitue');
    if (grade === 'S') unlock('note-s');
    if (isRecord && prev > 0) unlock('record-battu');
    if (m.id === 'precision' && G.ps && G.ps.id === 'minuscule' && score >= 3000) unlock('microscope');
    if (G.dailyOk) { unlock('defi-du-jour'); if (S.jour.serie >= 3) unlock('serie-3-jours'); }

    // Classement (seulement si accordé par la coquille)
    submitScore(m, score, acc);
    kick();
  }

  /* =====================================================================
   * 10. Boucle principale
   * ===================================================================== */
  let raf = 0, lastTs = 0, lastDraw = 0, ambientT = 0;
  const wantLoop = () => !document.hidden && (state === 'countdown' || state === 'play' || (!REDUCED && state !== 'pause'));
  function kick() {
    if (raf) return;
    if (wantLoop()) { lastTs = performance.now(); raf = requestAnimationFrame(loop); } else renderOnce();
  }
  function renderOnce() { applyView(); renderer.render(scene, camera); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (state === 'play' || state === 'countdown') pause(); } else kick(); });

  function loop(ts) {
    raf = 0;
    const live = state === 'play' || state === 'countdown';
    if (!live && ts - lastDraw < 33) { raf = requestAnimationFrame(loop); return; } // ambiance : 30 i/s
    lastDraw = ts;
    const raw = (ts - lastTs) / 1000;
    const dt = Math.min(0.1, Math.max(0, raw)); lastTs = ts;
    if (state === 'play') qualityWatch(raw);
    const nowS = ts / 1000;
    if (state === 'countdown') {
      const prev = Math.ceil(G.cd);
      G.cd -= dt;
      const cur = Math.ceil(G.cd);
      if (G.cd <= 0) beginPlay();
      else if (cur !== prev) { hud.count.textContent = String(cur); tickCount(); Snd.beep(440); }
    } else if (state === 'play') {
      G.t += dt;
      if (G.mode.update) G.mode.update(dt);
      if (G.hudCache.hint !== undefined && G.t > G.hudCache.hint && G.mode.id !== 'reflexes') { setMsg(''); G.hudCache.hint = undefined; }
      updateTargets(dt, nowS);
      if (G.mode.duree && G.t >= G.mode.duree) finish();
      else if (G.mode.duree) {
        const s = Math.ceil(G.dur - G.t);
        if (s <= 3 && s >= 1 && G.lastTick !== s) { G.lastTick = s; Snd.beep(660, 0.07); }
        if (G.mode.id !== 'suivi' && G.hudCache.t !== String(s)) updateHud();
      }
    } else if (state !== 'pause') {
      ambientUpdate(dt, nowS);
    }
    if (state === 'play') updateArrow();
    updateParticles(dt);
    updateMarks(ts);
    applyView();
    renderer.render(scene, camera);
    if (wantLoop()) raf = requestAnimationFrame(loop);
  }

  // Décor animé du menu : cibles qui orbitent, caméra qui balaye
  function ambientInit() {
    clearTargets();
    ambientT = 0;
    const c = tColor();
    for (let i = 0; i < 6; i++) {
      const tg = pool[i];
      tg.alive = true; tg.deco = true; tg.r = 0.7; tg.mesh.visible = true; tg.u.uColor.value.set(c); tg.glow.material.color.set(c);
      tg.u.uHot.value = 0; tg.u.uFlash.value = 0; tg.u.uWarn.value = 0; tg.mesh.scale.setScalar(0.7); tg.ph = (i / 6) * Math.PI * 2;
    }
  }
  function ambientUpdate(dt, nowS) {
    ambientT += dt;
    for (let i = 0; i < 6; i++) {
      const tg = pool[i]; if (!tg.deco) continue;
      const a = ambientT * 0.35 + tg.ph;
      dirFrom(Math.sin(a) * 0.75, Math.sin(a * 1.7 + i) * 0.22 + 0.05, tg.mesh.position).multiplyScalar(11 + (i % 3));
      tg.mesh.rotation.y = a; tg.u.uTime.value = nowS;
    }
    view.yaw = Math.sin(ambientT * 0.12) * 0.18; view.pitch = 0.02;
  }

  /* =====================================================================
   * 11. Entrées : souris verrouillée, curseur, tactile, clavier
   * ===================================================================== */
  let wasLocked = false, lockCtx = null, lockTimer = 0, lockErrTimer = 0;
  function updateCursorVisual() {
    const inG = state === 'play' || state === 'countdown';
    crossEl.hidden = !inG;
    document.body.classList.toggle('jeu-curseur-cache', inG);
    document.body.classList.toggle('verrou', inG && !effCursor());
    const touch = input.type === 'touch';
    crossIn.style.visibility = touch && !gyroActive() ? 'hidden' : 'visible';
    positionCross();
  }
  function requestLock(ctxName) {
    if (!canvas.requestPointerLock) { lockCtx = ctxName; lockFailed(); return; }
    lockCtx = ctxName;
    clearTimeout(lockTimer);
    lockTimer = setTimeout(() => { if (document.pointerLockElement !== canvas) lockFailed(); else lockCtx = null; }, 1600);
    const plain = () => {
      try { const q = canvas.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch (e) { lockFailed(); }
    };
    try {
      const p = canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(plain);
    } catch (e) { plain(); }
  }
  function releaseLock() {
    clearTimeout(lockTimer); clearTimeout(lockErrTimer); lockCtx = null;
    wasLocked = false;
    if (document.pointerLockElement === canvas) { try { document.exitPointerLock(); } catch (e) { /* ignoré */ } }
  }
  function lockFailed() {
    clearTimeout(lockTimer);
    if (!lockCtx) return;
    const c = lockCtx; lockCtx = null;
    if (document.pointerLockElement === canvas) return;
    if (c === 'resume') {
      if (state === 'countdown' || state === 'play') pause();
      toast("La souris n'a pas pu être verrouillée. Attends une seconde puis clique sur « Reprendre ».", 'info');
    } else if (state === 'countdown' || state === 'play') {
      sessionCursor = true;
      toast('Verrouillage de la souris indisponible : on passe en mode curseur libre. Clique directement sur les cibles.', 'info');
      updateCursorVisual();
    }
  }
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (locked) { wasLocked = true; lockCtx = null; clearTimeout(lockTimer); updateCursorVisual(); }
    else {
      if (wasLocked && (state === 'play' || state === 'countdown')) pause();
      wasLocked = false;
    }
  });
  document.addEventListener('pointerlockerror', () => { clearTimeout(lockErrTimer); lockErrTimer = setTimeout(() => { if (document.pointerLockElement !== canvas) lockFailed(); }, 350); });

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas || (state !== 'play' && state !== 'countdown')) return;
    const mx = e.movementX || 0, my = e.movementY || 0;
    if (Math.abs(mx) > 400 || Math.abs(my) > 400) return; // saut parasite à la capture
    const k = 0.0012 * S.opt.sens * (camera.fov / 75);
    view.yaw -= mx * k; view.pitch -= my * k * (S.opt.inv ? -1 : 1);
    view.yaw = wrapAngle(view.yaw);
    applyView();
  });

  const toNdc = (x, y) => ({ x: (x / innerWidth) * 2 - 1, y: -((y / innerHeight) * 2 - 1) });
  // Point visé : centre de l'écran (souris verrouillée) ou position du pointeur
  function aimPoint() {
    if (gyroActive() || document.pointerLockElement === canvas || !input.ptrSet) return { x: 0, y: 0 };
    return toNdc(input.mouseX, input.mouseY);
  }
  function setPtr(e) {
    input.type = e.pointerType === 'mouse' ? 'mouse' : 'touch';
    input.mouseX = e.clientX; input.mouseY = e.clientY; input.ptrSet = true;
    if (input.type === 'mouse' && cursorMode()) moveCross(e.clientX, e.clientY);
    crossIn.style.visibility = input.type === 'touch' && !gyroActive() ? 'hidden' : 'visible';
  }
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    Snd.unlock();
    if (state !== 'play') return;
    e.preventDefault();
    if (gyroActive()) { if (G.mode.hold) G.firing = true; else shoot(0, 0, e.timeStamp); return; }
    const locked = document.pointerLockElement === canvas;
    if (locked && e.pointerType === 'mouse') {
      if (e.button !== 0) return;
      if (G.mode.hold) G.firing = true; else shoot(0, 0, e.timeStamp);
      return;
    }
    if (input.drag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    setPtr(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignoré */ }
    const n = toNdc(e.clientX, e.clientY);
    input.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, n };
    if (input.type === 'touch') tapRipple(e.clientX, e.clientY);
    if (G.mode.hold) G.firing = true;
    else if (!G.mode.wide) shoot(n.x, n.y, e.timeStamp);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (document.pointerLockElement === canvas) return;
    setPtr(e);
    const d = input.drag;
    if (!d || d.id !== e.pointerId || state !== 'play') return;
    if (G.mode.wide) {
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 9) { d.moved = true; d.lx = d.x; d.ly = d.y; }
      if (d.moved) {
        const k = radPerPx() * S.opt.sens;
        view.yaw = wrapAngle(view.yaw + (e.clientX - d.lx) * k); view.pitch += (e.clientY - d.ly) * k * (S.opt.inv ? -1 : 1);
        d.lx = e.clientX; d.ly = e.clientY; applyView();
      }
    }
  });
  function endPointer(e) {
    const d = input.drag;
    if (gyroActive()) { G.firing = false; return; }
    if (document.pointerLockElement === canvas && e.pointerType === 'mouse') { G.firing = false; return; }
    if (!d || d.id !== e.pointerId) return;
    input.drag = null;
    if (state === 'play' && G.mode.wide && !d.moved && e.type === 'pointerup') shoot(d.n.x, d.n.y, e.timeStamp);
    G.firing = false;
  }
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);
  window.addEventListener('blur', () => { if (G) G.firing = false; if (state === 'play' || state === 'countdown') pause(); });
  canvas.addEventListener('pointerleave', () => { /* le viseur reste à sa dernière position */ });

  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'm') { toggleMute(); return; }
    if (state === 'play' || state === 'countdown') {
      if (k === 'p' || k === 'Escape') { e.preventDefault(); pause(); }
      else if (k === 'r') { e.preventDefault(); restart(); }
    } else if (state === 'pause' && screen === 'pause') {
      if (k === 'p') resume();
      else if (k === 'r') restart();
    }
  });

  /* =====================================================================
   * 12. Interface : écrans
   * ===================================================================== */
  const screens = {};
  $$('#ui > .screen').forEach((s) => { screens[s.id.replace('s-', '')] = s; });
  let backTo = 'menu';
  function showScreen(name) {
    screen = name;
    $('#ui').hidden = !name;
    Object.keys(screens).forEach((k) => { screens[k].hidden = k !== name; });
    if (name) {
      const s = screens[name];
      try { s.scrollTop = 0; $('#ui').scrollTop = 0; s.focus({ preventScroll: true }); } catch (e) { /* ignoré */ }
    }
  }
  function open(name, back) { backTo = back || screen || 'menu'; showScreen(name); }
  function toast(msg, kind) {
    const d = document.createElement('div'); d.className = 'toast' + (kind ? ' ' + kind : ''); d.textContent = msg;
    $('#toasts').appendChild(d);
    setTimeout(() => d.remove(), kind === 'info' ? 5200 : 4200);
    while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
  }
  const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // --- Défi du jour : mode et difficulté tirés de la date (même choix pour tout le monde, sans serveur) ---
  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function yesterdayKey() { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); }
  function dailyPlan() {
    let h = 2166136261;
    const key = dayKey();
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
    h >>>= 0;
    return { mode: SCORED[h % SCORED.length], diff: [0, 1, 1, 2][(h >>> 8) % 4] };
  }
  function dailySerie() { const j = S.jour; return j.d === dayKey() || j.d === yesterdayKey() ? j.serie : 0; }
  let briefDaily = false;

  // --- Menu ---
  function bestOf(modeId, diff) { return S.rec[modeId + ':' + diff] || 0; }
  function buildMenu() {
    const box = $('#modes'); box.innerHTML = '';
    MODES.forEach((m) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'card' + (m.libre ? ' wide' : ''); b.dataset.mode = m.id;
      b.innerHTML = '<span class="ic" aria-hidden="true">' + m.ic + '</span><span class="nm">' + escHtml(m.nom) + '</span><span class="ct">' + escHtml(m.court) +
        '</span><span class="bs"></span>';
      b.addEventListener('click', () => openBrief(m));
      box.appendChild(b);
    });
    const d = $('#diff'); d.innerHTML = '';
    DIFFS.forEach((df) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.v = df.id; b.textContent = df.nom;
      b.addEventListener('click', () => { S.opt.diff = df.id; save(); refreshMenu(); });
      d.appendChild(b);
    });
    $('#help-modes').innerHTML = MODES.map((m) => '<li><b>' + m.ic + ' ' + escHtml(m.nom) + '</b> : ' + escHtml(m.court) + '</li>').join('');
    // Sélecteurs de réglages
    $('#g-xs').innerHTML = XSTYLES.map((x) => '<button type="button" role="radio" data-v="' + x.id + '" aria-label="' + escHtml(x.nom) + '">' + xhSVG(x.id, '#2de2e6', 36) + '</button>').join('');
    $('#g-xc').innerHTML = XCOLORS.map((c) => '<button type="button" class="swatch" role="radio" data-v="' + c.id + '" aria-label="' + c.nom + '" style="background:' + c.id + ';color:' + c.id + '"></button>').join('');
    $('#g-tc').innerHTML = TCOLORS.map((c) => '<button type="button" class="swatch" role="radio" data-v="' + c.id + '" aria-label="' + c.nom + '" style="background:' + c.hex + ';color:' + c.hex + '"></button>').join('');
  }
  function refreshMenu() {
    const df = DIFFS[S.opt.diff];
    $$('#diff button').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.v === S.opt.diff)));
    $('#diff-info').textContent = '— ' + df.info;
    $$('#modes .card').forEach((c) => {
      const b = bestOf(c.dataset.mode, S.opt.diff);
      $('.bs', c).textContent = c.dataset.mode === 'libre' ? 'Sans score enregistré' : b ? 'Record : ' + fmt(b) + ' pts' : 'Pas encore de record';
    });
    const plan = dailyPlan(), j = S.jour, done = j.d === dayKey(), serie = dailySerie();
    $('#dy-title').textContent = plan.mode.ic + ' ' + plan.mode.nom + ' · ' + DIFFS[plan.diff].nom;
    $('#dy-info').textContent = (done ? '✓ Relevé aujourd\'hui, meilleur : ' + fmt(j.s) + ' pts' : 'Pas encore relevé aujourd\'hui') + ' · Série : ' + serie + ' jour' + (serie > 1 ? 's' : '');
    $('#dy-go').textContent = done ? 'Rejouer le défi' : 'Relever le défi';
  }
  function briefBest() {
    const m = selMode, diff = briefDaily ? dailyPlan().diff : S.opt.diff, idx = m.tailleReglable && !briefDaily ? S.opt.psz : 1;
    const b = S.rec[recKey(m.id, diff, idx)] || 0;
    $('#br-best').textContent = m.libre ? 'Échauffement libre : aucun score enregistré.' : b ? 'Ton record : ' + fmt(b) + ' points' : 'Aucun record pour le moment : à toi de jouer !';
  }
  function syncBriefSize() {
    $$('#br-size [role=radio]').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.v === S.opt.psz)));
    $('#psz-info').textContent = '— points ×' + String(PSIZES[S.opt.psz].mult).replace('.', ',');
  }
  function openBrief(m, daily) {
    selMode = m;
    briefDaily = !!daily && !m.libre;
    const diff = briefDaily ? dailyPlan().diff : S.opt.diff;
    $('#t-brief').textContent = (briefDaily ? '🗓️ Défi du jour · ' : '') + m.ic + ' ' + m.nom;
    $('#br-diff').textContent = 'Difficulté : ' + DIFFS[diff].nom + ' (points ×' + String(DIFFS[diff].mult).replace('.', ',') + ')' + (briefDaily ? ' — imposée par le défi du jour' : '');
    $('#br-desc').textContent = m.desc;
    $('#br-rules').innerHTML = m.regles.map((r) => '<li>' + escHtml(r) + '</li>').join('');
    $('#br-ctrl').innerHTML = controlsHTML();
    $('#br-size-box').hidden = !(m.tailleReglable && !briefDaily);
    syncBriefSize(); briefBest();
    open('brief', 'menu');
    setTimeout(() => $('#br-go').focus({ preventScroll: true }), 30);
  }

  // --- Fin de partie ---
  function renderEnd(m, score, grade, isRecord, prev, rows, sr) {
    $('#e-mode').textContent = m.nom + ' · ' + G.dm.nom;
    $('#e-score').textContent = fmt(score);
    $('#e-record').hidden = !isRecord;
    $('#e-best').textContent = isRecord ? (prev ? 'Ancien record : ' + fmt(prev) : 'Premier record dans ce mode !') : 'Record : ' + fmt(prev) + ' points';
    const g = $('#e-grade'); g.textContent = grade; g.dataset.g = grade; g.setAttribute('aria-label', 'Note ' + grade);
    $('#e-stats').innerHTML = rows.map((r) => '<div class="stat"><div class="k">' + escHtml(r[0]) + '</div><div class="v">' + escHtml(String(r[1])) + '</div></div>').join('');
    drawChart($('#e-chart'), sr);
    $('#e-chartcap').textContent = sr.cap;
    const st = $('#e-status'); st.className = 'status'; st.textContent = '';
    $('#e-board').hidden = !caps().classement;
    lastResult = { m, score, grade, isRecord, rows, diff: G.diff, daily: G.daily };
    // Défi du jour
    const dy = $('#e-daily'); dy.hidden = !G.dailyOk;
    if (G.dailyOk) dy.textContent = '🗓️ Défi du jour relevé ! Série : ' + S.jour.serie + ' jour' + (S.jour.serie > 1 ? 's' : '') + '.';
    // Progression vers la note suivante
    const th = m.grades, L = ['C', 'B', 'A', 'S'], raw = score / G.k;
    const k = th.findIndex((t) => raw < t);
    const nx = $('#e-next');
    if (k < 0) { nx.textContent = 'Note maximale atteinte : bravo, c\'est un S !'; $('#e-nextbar').style.transform = 'scaleX(1)'; }
    else {
      const need = Math.ceil(th[k] * G.k - score), prevT = k ? th[k - 1] : 0;
      nx.textContent = 'Prochaine note, ' + L[k] + ' : encore ' + fmt(need) + ' points.';
      $('#e-nextbar').style.transform = 'scaleX(' + clamp((raw - prevT) / (th[k] - prevT), 0.02, 1) + ')';
    }
    // Carte des tirs
    const has = G.shotLog.length >= 3;
    $('#e-mapbox').hidden = !has;
    if (has) { $('#e-map').innerHTML = mapHTML(G.shotLog); $('#e-bias').textContent = biasText(G.shotLog); }
  }
  let lastResult = null;
  function mapHTML(log) {
    const c = tColor();
    let h = '<circle r="1" fill="' + c + '" fill-opacity=".28" stroke="' + c + '" stroke-width=".05"/><circle r=".35" fill="#ffe9a6" fill-opacity=".6"/>' +
      '<path d="M-4.4 0H4.4M0 -4.4V4.4" stroke="#fff" stroke-opacity=".12" stroke-width=".04"/>';
    log.forEach((p) => {
      h += p[2] ? '<circle cx="' + p[0].toFixed(2) + '" cy="' + (-p[1]).toFixed(2) + '" r=".12" fill="#2de2e6"/>'
        : '<path d="M' + (p[0] - 0.13).toFixed(2) + ' ' + (-p[1] - 0.13).toFixed(2) + 'l.26 .26m0 -.26l-.26 .26" stroke="#ff3d7f" stroke-width=".07" stroke-linecap="round"/>';
    });
    const ms = log.filter((p) => !p[2]);
    if (ms.length >= 4) {
      const mx = ms.reduce((a, p) => a + p[0], 0) / ms.length, my = ms.reduce((a, p) => a + p[1], 0) / ms.length;
      h += '<circle cx="' + mx.toFixed(2) + '" cy="' + (-my).toFixed(2) + '" r=".2" fill="none" stroke="#ffd166" stroke-width=".07"/>';
    }
    return h;
  }
  function biasText(log) {
    const ms = log.filter((p) => !p[2]);
    if (ms.length < 4) return 'Très peu de ratés : impossible de dégager une tendance, beau travail !';
    const mx = ms.reduce((a, p) => a + p[0], 0) / ms.length, my = ms.reduce((a, p) => a + p[1], 0) / ms.length;
    const parts = [];
    if (Math.abs(mx) > 0.6) parts.push(mx < 0 ? 'à gauche' : 'à droite');
    if (Math.abs(my) > 0.6) parts.push(my > 0 ? 'en haut' : 'en bas');
    if (!parts.length) return 'Tes ratés sont bien répartis autour de la cible : pas de biais marqué.';
    return 'Tes tirs ratés partent plutôt ' + parts.join(' et ') + ' de la cible' + (Math.hypot(mx, my) > 2 ? ' (nettement)' : '') + '. Le rond doré marque leur position moyenne.';
  }
  // Image du score à télécharger (génération locale, aucun envoi)
  function downloadCard() {
    const r = lastResult; if (!r) return;
    const W = 1200, H = 630, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), F = '"Trebuchet MS", system-ui, sans-serif';
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#101437'); g.addColorStop(1, '#2a0f3d');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(45,226,230,.18)'; x.lineWidth = 2;
    for (let i = 0; i <= W; i += 60) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
    for (let k = 0; k <= H; k += 60) { x.beginPath(); x.moveTo(0, k); x.lineTo(W, k); x.stroke(); }
    x.fillStyle = '#2de2e6'; x.shadowColor = '#2de2e6'; x.shadowBlur = 18; x.font = 'italic 900 54px ' + F; x.fillText('AIM TRAINER 3D', 60, 100); x.shadowBlur = 0;
    x.fillStyle = '#aeb6e8'; x.font = '700 34px ' + F; x.fillText((r.daily ? 'Défi du jour · ' : '') + r.m.nom + ' · ' + DIFFS[r.diff].nom, 60, 160);
    x.fillStyle = '#fff'; x.shadowColor = '#ff3d7f'; x.shadowBlur = 40; x.font = 'italic 900 190px ' + F; x.fillText(fmt(r.score), 60, 360); x.shadowBlur = 0;
    x.fillStyle = '#ffd166'; x.font = '700 36px ' + F; x.fillText('points' + (r.isRecord ? ' · nouveau record !' : ''), 66, 420);
    const gc = { S: '#ff3d7f', A: '#7dff6a', B: '#2de2e6', C: '#aeb6e8', D: '#aeb6e8' }[r.grade];
    x.beginPath(); x.arc(1010, 250, 110, 0, Math.PI * 2); x.lineWidth = 12; x.strokeStyle = gc; x.shadowColor = gc; x.shadowBlur = 24; x.stroke(); x.shadowBlur = 0;
    x.fillStyle = gc; x.textAlign = 'center'; x.font = 'italic 900 150px ' + F; x.fillText(r.grade, 1010, 302); x.textAlign = 'left';
    r.rows.slice(0, 4).forEach((row, i) => {
      const px = 60 + i * 280;
      x.fillStyle = '#aeb6e8'; x.font = '600 24px ' + F; x.fillText(String(row[0]).toUpperCase(), px, 500);
      x.fillStyle = '#fff'; x.font = '800 42px ' + F; x.fillText(String(row[1]), px, 550);
    });
    x.fillStyle = '#7f88c9'; x.font = '500 24px ' + F; x.fillText('random.plagnito.com/a/aim-trainer · ' + new Date().toLocaleDateString('fr-FR'), 60, 605);
    c.toBlob((blob) => {
      if (!blob) { toast("Impossible de créer l'image.", 'info'); return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'aim-trainer-' + r.m.id + '-' + r.score + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast('Image du score enregistrée dans tes téléchargements.', 'info');
    }, 'image/png');
  }
  function drawChart(svg, sr) {
    const W = 300, H = 90, vals = sr.vals, n = vals.length;
    if (!n) { svg.innerHTML = ''; return; }
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'none');
    const max = Math.max.apply(null, vals.concat([0.0001]));
    const bw = W / n;
    let html = '<line x1="0" y1="' + (H - 0.5) + '" x2="' + W + '" y2="' + (H - 0.5) + '" stroke="#3a4bd0" stroke-width="1"/>';
    vals.forEach((v, i) => {
      const h = v > 0 ? Math.max(3, (v / max) * (H - 14)) : 0;
      html += '<rect x="' + (i * bw + bw * 0.12) + '" y="' + (H - h) + '" width="' + bw * 0.76 + '" height="' + h + '" rx="3" fill="' + (i % 2 ? '#2de2e6' : '#ff3d7f') + '" opacity=".9"/>';
    });
    svg.innerHTML = html;
  }

  // --- Statistiques ---
  let evMode = 'grille';
  function drawEv() {
    const svg = $('#sx-ev'), vals = S.ev[evMode] || [], cap = $('#sx-evcap'), n = vals.length;
    $$('#sx-evm [role=radio]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === evMode)));
    const W = Math.max(220, svg.clientWidth || 300), H = 120;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.removeAttribute('preserveAspectRatio');
    if (n < 2) {
      svg.innerHTML = '';
      cap.textContent = n ? 'Une seule partie dans ce mode : joues-en une autre pour voir apparaître ta courbe.' : 'Aucune partie dans ce mode pour le moment.';
      return;
    }
    const max = Math.max.apply(null, vals.concat([1])), padL = 8, padR = 8, padT = 16, padB = 10;
    const X = (i) => padL + (i / (n - 1)) * (W - padL - padR), Y = (v) => H - padB - (v / max) * (H - padT - padB);
    const ma = vals.map((_, i) => { const a = vals.slice(Math.max(0, i - 2), i + 1); return a.reduce((x, y) => x + y, 0) / a.length; });
    let h = '<line x1="0" y1="' + (H - padB) + '" x2="' + W + '" y2="' + (H - padB) + '" stroke="#3a4bd0" stroke-width="1"/>' +
      '<polyline fill="none" stroke="#ff3d7f" stroke-width="2.5" stroke-linejoin="round" points="' + ma.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ') + '"/>';
    vals.forEach((v, i) => { h += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="3.2" fill="#2de2e6"/>'; });
    const bi = vals.indexOf(max);
    h += '<text x="' + clamp(X(bi), 26, W - 26).toFixed(1) + '" y="' + (Y(max) - 6).toFixed(1) + '" fill="#ffd166" font-size="11" font-weight="700" text-anchor="middle">' + fmt(max) + '</text>';
    svg.innerHTML = h;
    let trend = '';
    if (n >= 6) {
      const k = Math.min(5, Math.floor(n / 2)), avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      const pct = Math.round(((avg(vals.slice(-k)) - avg(vals.slice(-2 * k, -k))) / Math.max(1, avg(vals.slice(-2 * k, -k)))) * 100);
      trend = pct >= 3 ? ' Tendance : +' + pct + ' % sur tes ' + k + ' dernières parties.' : pct <= -3 ? ' Tendance : ' + pct + ' % sur tes ' + k + ' dernières parties.' : ' Tendance : stable.';
    }
    cap.textContent = 'Tes ' + n + ' dernières parties, ramenées à la difficulté Normal. Points cyan : chaque partie ; courbe rose : moyenne glissante sur 3 parties.' + trend;
  }
  function buildStats() {
    const t = S.tot;
    const pct = t.tirs ? Math.round((t.touches / t.tirs) * 100) + ' %' : '—';
    const h = Math.floor(t.sec / 3600), mi = Math.floor((t.sec % 3600) / 60), s = t.sec % 60;
    const time = h ? h + ' h ' + mi + ' min' : mi + ' min ' + s + ' s';
    const cells = [['Parties jouées', fmt(t.parties)], ['Cibles touchées', fmt(t.touches)], ['Précision globale', pct], ['Temps de jeu', time], ['Meilleure série', fmt(t.serie)], ['Défi du jour : série', dailySerie() + ' j']];
    $('#sx-tot').innerHTML = cells.map((r) => '<div class="stat"><div class="k">' + r[0] + '</div><div class="v">' + r[1] + '</div></div>').join('');
    $('#sx-rec').innerHTML = '<tr><th>Mode</th>' + DIFFS.map((d) => '<th class="r">' + d.nom + '</th>').join('') + '</tr>' +
      SCORED.map((m) => '<tr><td>' + m.ic + ' ' + escHtml(m.nom) + '</td>' + DIFFS.map((d) => '<td class="r">' + (bestOf(m.id, d.id) ? fmt(bestOf(m.id, d.id)) : '—') + '</td>').join('') + '</tr>').join('') +
      PSIZES.filter((z) => z.id !== 'standard').map((z) => {
        const v = DIFFS.map((d) => S.rec['precision:' + d.id + ':' + z.id] || 0);
        return v.some(Boolean) ? '<tr><td>🔬 Précision · ' + z.nom.toLowerCase() + '</td>' + v.map((x) => '<td class="r">' + (x ? fmt(x) : '—') + '</td>').join('') + '</tr>' : '';
      }).join('');
    $('#sx-evm').innerHTML = SCORED.map((m) => '<button type="button" role="radio" data-v="' + m.id + '">' + m.ic + ' ' + escHtml(m.nom) + '</button>').join('');
    const hist = S.hist.slice(0, 10);
    $('#sx-hist').innerHTML = hist.length
      ? '<tr><th>Mode</th><th>Difficulté</th><th class="r">Score</th><th class="r">Préc.</th><th class="r">Date</th></tr>' + hist.map((r) => {
        const m = modeById(r[0]);
        const dt = new Date(r[4] * 1000);
        const ds = isNaN(dt) ? '' : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        return '<tr><td>' + (m ? escHtml(m.nom) : '?') + '</td><td>' + (DIFFS[r[1]] ? DIFFS[r[1]].nom : '') + '</td><td class="r">' + fmt(r[2]) + '</td><td class="r">' + (m && (m.id === 'suivi') ? '—' : r[3] + ' %') + '</td><td class="r">' + ds + '</td></tr>';
      }).join('')
      : '<tr><td class="dim">Aucune partie jouée pour l\'instant.</td></tr>';
    const c = $('#sx-clear'); c.classList.remove('armed'); c.textContent = 'Effacer mes stats';
  }

  // --- Réglages ---
  function syncSettings() {
    const o = S.opt;
    $('#r-sens').value = o.sens; $('#o-sens').textContent = o.sens.toFixed(2).replace('.', ',');
    $('#r-fov').value = o.fov; $('#o-fov').textContent = o.fov + '°';
    $('#r-vol').value = Math.round(o.vol * 100); $('#o-vol').textContent = Math.round(o.vol * 100) + ' %';
    $('#r-xz').value = o.xz; $('#o-xz').textContent = '×' + o.xz.toFixed(1).replace('.', ',');
    const radio = (sel, v) => $$(sel + ' [role=radio]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === String(v))));
    radio('#g-ctl', o.ctl); radio('#g-deco', o.deco); radio('#g-qual', o.qual); radio('#g-xs', o.xs); radio('#g-xc', o.xc); radio('#g-tc', o.tc);
    const fx = $('#t-fx'); fx.textContent = o.fx ? '✨ Effets : activés' : '✨ Effets : réduits'; fx.setAttribute('aria-pressed', String(o.fx));
    $('#f-gyro').hidden = !COARSE;
    const gy = $('#t-gyro'); gy.textContent = o.gyro ? '📱 Visée au gyroscope : activée' : '📱 Visée au gyroscope : désactivée'; gy.setAttribute('aria-pressed', String(o.gyro));
    const iv = $('#t-inv'); iv.textContent = o.inv ? '↕️ Axe vertical : inversé' : '↕️ Axe vertical : normal'; iv.setAttribute('aria-pressed', String(o.inv));
    syncSoundButtons();
    drawCross();
  }
  function bindSettings() {
    const num = (id, key, conv, after) => $(id).addEventListener('input', (e) => { S.opt[key] = conv(+e.target.value); syncSettings(); if (after) after(); save(); });
    num('#r-sens', 'sens', (v) => v);
    num('#r-fov', 'fov', (v) => v, () => { applyFov(); renderOnce(); });
    num('#r-vol', 'vol', (v) => v / 100, () => { Snd.unlock(); Snd.refresh(); });
    num('#r-xz', 'xz', (v) => v);
    $('#r-vol').addEventListener('change', () => { Snd.unlock(); Snd.hit(2, false); });
    const grp = (id, key, after) => $(id).addEventListener('click', (e) => {
      const b = e.target.closest('[role=radio]'); if (!b) return;
      S.opt[key] = b.dataset.v; syncSettings(); if (after) after(); save();
    });
    grp('#g-ctl', 'ctl', () => { sessionCursor = false; updateCursorVisual(); });
    grp('#g-deco', 'deco', () => { applyTheme(); renderOnce(); });
    grp('#g-qual', 'qual', () => { autoScale = 1; qAcc = 0; qN = 0; resize(); });
    $('#t-gyro').addEventListener('click', () => setGyro(!S.opt.gyro));
    $('#t-inv').addEventListener('click', () => { S.opt.inv = !S.opt.inv; syncSettings(); save(); });
    grp('#g-xs', 'xs'); grp('#g-xc', 'xc');
    grp('#g-tc', 'tc', () => { pool.forEach((t) => { if (t.deco) { t.u.uColor.value.set(tColor()); t.glow.material.color.set(tColor()); } }); renderOnce(); });
    $('#t-mute').addEventListener('click', toggleMute);
    $('#b-snd').addEventListener('click', toggleMute);
    $('#t-fx').addEventListener('click', () => { S.opt.fx = !S.opt.fx; syncSettings(); save(); });
    $('#st-back').addEventListener('click', () => { showScreen(backTo); if (backTo === 'menu') refreshMenu(); });
  }

  // --- Boutons ---
  function bindUi() {
    $('#br-go').addEventListener('click', () => startGame(selMode.id, briefDaily ? { diff: dailyPlan().diff, daily: true } : {}));
    $('#dy-go').addEventListener('click', () => openBrief(dailyPlan().mode, true));
    $('#br-size').innerHTML = PSIZES.map((z, i) => '<button type="button" role="radio" data-v="' + i + '">' + z.nom + '<small>×' + String(z.mult).replace('.', ',') + ' points</small></button>').join('');
    $('#br-size').addEventListener('click', (e) => {
      const b = e.target.closest('[role=radio]'); if (!b) return;
      S.opt.psz = +b.dataset.v; save(); syncBriefSize(); briefBest();
    });
    $('#e-card').addEventListener('click', downloadCard);
    $('#br-back').addEventListener('click', () => showScreen('menu'));
    $('#m-settings').addEventListener('click', () => { syncSettings(); open('settings', 'menu'); });
    $('#m-stats').addEventListener('click', () => { buildStats(); open('stats', 'menu'); requestAnimationFrame(drawEv); });
    $('#sx-evm').addEventListener('click', (e) => { const b = e.target.closest('[role=radio]'); if (b) { evMode = b.dataset.v; drawEv(); } });
    $('#m-help').addEventListener('click', () => open('help', 'menu'));
    $('#m-board').addEventListener('click', () => openBoard('menu'));
    $('#m-ach').addEventListener('click', () => openAch('menu'));
    $('#hp-back').addEventListener('click', () => showScreen('menu'));
    $('#sx-back').addEventListener('click', () => showScreen('menu'));
    $('#bd-back').addEventListener('click', () => showScreen(backTo));
    $('#ac-back').addEventListener('click', () => showScreen(backTo));
    $('#sx-clear').addEventListener('click', (e) => {
      const b = e.currentTarget;
      if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Confirmer : tout effacer ?'; return; }
      S.rec = {}; S.tot = defaults().tot; S.hist = []; S.modes = []; S.ev = {};
      save(true); buildStats(); drawEv(); toast('Statistiques effacées (réglages et succès conservés).', 'info');
    });
    $('#p-resume').addEventListener('click', resume);
    $('#p-restart').addEventListener('click', restart);
    $('#p-settings').addEventListener('click', () => { syncSettings(); open('settings', 'pause'); });
    $('#p-quit').addEventListener('click', quitToMenu);
    $('#b-pause').addEventListener('click', pause);
    $('#e-again').addEventListener('click', () => startGame(G.mode.id, replayOpts()));
    $('#e-menu').addEventListener('click', quitToMenu);
    $('#e-board').addEventListener('click', () => openBoard('end'));
  }

  /* =====================================================================
   * 13. SDK atlasJeu (tout est facultatif)
   * ===================================================================== */
  const caps = () => (SDK && SDK.capacites) || {};
  function refreshCaps() {
    const c = caps();
    $('#m-board').hidden = !c.classement;
    $('#m-ach').hidden = !c.succes;
    const pseudo = c.identite && SDK.identite && SDK.identite.pseudo;
    const p = $('#pseudo');
    p.hidden = !pseudo;
    if (pseudo) p.textContent = 'Joueur : ' + pseudo;
  }
  async function initSdk() {
    if (!SDK) return;
    refreshCaps();
    try { await Promise.race([SDK.pret, new Promise((r) => setTimeout(r, 5000))]); } catch (e) { /* on continue avec la sauvegarde locale */ }
    const before = S.opt.ctl;
    S = loadSave();
    if (S.opt.ctl !== before) sessionCursor = false;
    applyAllSettings();
    refreshCaps();
    if (screen === 'menu') refreshMenu();
    if (caps().succes && SDK.succes && SDK.succes.liste) {
      try {
        const l = await SDK.succes.liste();
        (l || []).forEach((a) => { if (a && a.obtenu && S.succ.indexOf(a.id) < 0) S.succ.push(a.id); });
      } catch (e) { /* ignoré */ }
    }
  }
  function unlock(id) {
    if (!caps().succes || !SDK.succes || !SDK.succes.debloquer) return;
    if (S.succ.indexOf(id) >= 0) return;
    const a = ACH.find((x) => x.id === id);
    if (!a) return;
    S.succ.push(id); // évite les doubles appels pendant l'envoi
    SDK.succes.debloquer(id).then(() => { toast('🏆 Succès débloqué : ' + a.titre); save(); }, () => { S.succ = S.succ.filter((x) => x !== id); });
  }
  async function submitScore(m, score, acc) {
    const st = $('#e-status');
    if (!caps().classement || !SDK.soumettreScore || score <= 0) return;
    st.className = 'status'; st.textContent = 'Envoi du score au classement…';
    const parts = [(G.daily ? 'Défi · ' : '') + m.nom + (G.ps && G.ps.id !== 'standard' ? ' ' + G.ps.nom.toLowerCase() : ''), DIFFS[G.diff].nom];
    if (m.id !== 'suivi' && m.id !== 'reflexes') parts.push(Math.round(acc * 100) + ' %');
    let detail = parts.join(' · ');
    if (detail.length > 40) detail = parts.slice(0, 2).join(' · ');
    detail = detail.slice(0, 40);
    try {
      const r = await SDK.soumettreScore(score, detail);
      const rang = r && (r.rang || r.rank);
      st.className = 'status ok'; st.textContent = 'Score envoyé au classement ✓' + (rang ? ' — rang n° ' + rang : '');
    } catch (e) {
      st.className = 'status ko'; st.textContent = "Le score n'a pas pu être envoyé au classement. Ton record reste sauvegardé.";
    }
  }
  async function openBoard(back) {
    open('board', back);
    const st = $('#bd-status'), tab = $('#bd-tab');
    tab.innerHTML = ''; st.className = 'status'; st.textContent = 'Chargement du classement…';
    try {
      let l = await SDK.classement(20);
      if (l && !Array.isArray(l)) l = l.entrees || l.classement || l.scores || l.liste || l.items || [];
      l = Array.isArray(l) ? l : [];
      const me = caps().identite && SDK.identite && SDK.identite.pseudo;
      if (!l.length) { st.textContent = 'Aucun score pour le moment. Sois le premier !'; return; }
      st.textContent = '';
      tab.innerHTML = '<tr><th>#</th><th>Joueur</th><th class="r">Points</th><th>Détail</th></tr>' + l.map((e, i) => {
        const name = e.pseudo || e.nom || e.joueur || e.name || 'Anonyme';
        const sc = e.score != null ? e.score : e.valeur != null ? e.valeur : '';
        return '<tr' + (me && name === me ? ' class="me"' : '') + '><td>' + (e.rang || e.rank || i + 1) + '</td><td>' + escHtml(name) + '</td><td class="r">' + (typeof sc === 'number' ? fmt(sc) : escHtml(sc)) +
          '</td><td>' + escHtml(e.detail || e.details || '') + '</td></tr>';
      }).join('');
    } catch (e) {
      st.className = 'status ko'; st.textContent = 'Classement indisponible pour le moment. Réessaie plus tard.';
    }
  }
  async function openAch(back) {
    open('ach', back);
    const st = $('#ac-status'), box = $('#ac-list');
    box.innerHTML = ''; st.className = 'status'; st.textContent = 'Chargement…';
    let list = null;
    try { list = await SDK.succes.liste(); } catch (e) { /* repli local ci-dessous */ }
    if (!Array.isArray(list)) { list = ACH.map((a) => Object.assign({}, a, { obtenu: S.succ.indexOf(a.id) >= 0 })); st.textContent = 'Liste locale (le serveur n\'a pas répondu).'; }
    else st.textContent = '';
    const got = list.filter((a) => a.obtenu).length;
    st.textContent = (st.textContent ? st.textContent + ' ' : '') + got + ' / ' + list.length + ' succès obtenus.';
    box.innerHTML = list.map((a) => {
      const hidden = a.secret && !a.obtenu;
      return '<div class="ach' + (a.obtenu ? '' : ' off') + '"><span class="em" aria-hidden="true">' + (a.obtenu ? '🏆' : hidden ? '❔' : '🔒') + '</span><div><b>' +
        escHtml(hidden ? 'Succès secret' : a.titre) + '</b><span>' + escHtml(hidden ? 'À découvrir en jouant.' : a.texte) + (a.obtenu ? '' : '') + '</span></div></div>';
    }).join('');
  }

  /* =====================================================================
   * 14. Démarrage
   * ===================================================================== */
  function applyAllSettings() {
    gyroSync(); applyTheme(); applyFov(); syncSettings(); Snd.refresh(); refreshMenu();
    pool.forEach((t) => { if (t.deco) { t.u.uColor.value.set(tColor()); t.glow.material.color.set(tColor()); } });
    renderOnce();
  }
  buildMenu();
  bindSettings();
  bindUi();
  gyroSync();
  drawCross();
  syncSettings();
  refreshMenu();
  refreshCaps();
  resize();
  addEventListener('resize', resize);
  ambientInit();
  showScreen('menu');
  kick();
  initSdk();

  if (/[?&]debug\b/.test(location.search)) {
    window.__aim = { get G() { return G; }, get state() { return state; }, pool, view, camera, S, MODES, shoot, startGame, finish, pause, resume, unlock };
  }
})();
