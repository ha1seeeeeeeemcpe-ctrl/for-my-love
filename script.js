/* Если Three.js не загрузился (нет интернета / блокировка CDN) — говорим об этом прямо на кнопке */
if (typeof THREE === 'undefined') {
  const b = document.getElementById('startBtn');
  if (b) b.textContent = 'ERROR: Three.js not loaded — check internet';
  throw new Error('Three.js failed to load');
}

/* =====================================================================
   НАСТРОЙКИ — меняй тексты и картинки здесь
   ===================================================================== */
const CONFIG = {
  // Фразы, которые летают по спирали вокруг чёрной дыры
  phrases: [
    'HAPPY GIRLFRIEND DAY ♥', 'I ADORE YOU', 'YOU ARE MAGIC', 'FOR THE LOVE OF MY LIFE',
    'THE BEST GIRLFRIEND ♥', 'INFINITE LOVE', 'MY FAVORITE PERSON', 'TODAY WE CELEBRATE',
    'I LOVE YOU SO MUCH', 'YOU ARE MY EVERYTHING', 'MY LIFE ♥', 'MY LOVE'
  ],

  // Кликабельные «пузырьки». Чтобы показать свою фотографию, добавь поле
  //   img: 'photo1.jpg'   (положи файл рядом с index.html)
  memories: [
    { icon: '❤️', img: 'img/photo_1' title: 'Love of My Life', text: 'The longer we are together, the more I love you.' },
    { icon: '🐻', img: 'img/photo_2' title: 'For You', text: 'For you, who make my heart beat in a way no one else can. In every memory and every heartbeat, there you are.' },
    { icon: '🌹', img: 'img/photo_3' title: 'Adventures Together', text: 'There is no place in the world I would rather be than by your side, discovering new places.' },
    { icon: '🎀', img: 'img/photo_4' title: 'My Favorite Person', text: 'With you to the end of the world and a little bit further.' },
    { icon: '🌙', img: 'img/photo_5' title: 'Every Night', text: 'All my favorite stars look like you.' },
    { icon: '💌', img: 'img/photo_6' title: 'A Little Letter', text: 'Thank you for existing, for your laughter, and for making my days so much brighter.' },
    { icon: '✨', img: 'img/photo_7' title: 'You Are Magic', text: 'With you, even the simplest things become extraordinary.' },
    { icon: '🧸', img: 'img/photo_8' title: 'My Home', text: 'Your arms are my favorite place in the whole world.' }
  ]
};

/* =====================================================================
   БАЗА
   ===================================================================== */
const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const isMobile = Math.min(innerWidth, innerHeight) < 700 || matchMedia('(pointer: coarse)').matches;
const PIXEL = Math.min(devicePixelRatio || 1, isMobile ? 1.5 : 2);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(PIXEL);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);

/* Камера: сферические координаты вокруг центра */
const cam = {
  yaw: 0.3, pitch: 1.25,           // стартовый вид — почти сверху
  dist: 34,
  targetPitch: 0.42, targetDist: 17, // после взрыва — наклон как на видео
  autoRotate: 0.035,
  target: new THREE.Vector3(0, 3.4, 0)
};
let dragging = false, userZoomed = false;

function updateCamera() {
  const cp = Math.cos(cam.pitch);
  camera.position.set(
    cam.target.x + cam.dist * cp * Math.sin(cam.yaw),
    cam.target.y + cam.dist * Math.sin(cam.pitch),
    cam.target.z + cam.dist * cp * Math.cos(cam.yaw)
  );
  camera.lookAt(cam.target);
}

/* Общие uniform'ы */
const U = {
  uTime:   { value: 0 },
  uIntro:  { value: 0 },   // 0 → 1  «взрыв» галактики
  uHeart:  { value: 0 },   // 0 → 1  появление сердца
  uTheme:  { value: 0 },   // 0 розовый → 1 красный
  uPixel:  { value: PIXEL }
};

const easeOut = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
const rand = (a, b) => a + Math.random() * (b - a);

/* Общий фрагментный шейдер: мягкая светящаяся точка */
const FRAG = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = pow(1.0 - d * 2.0, 1.6) * vAlpha;
    gl_FragColor = vec4(vColor * a, a);
  }
`;
/* Красная тема: уводим цвет в красный */
const THEME_FN = `
  uniform float uTheme;
  vec3 themed(vec3 c) {
    vec3 red = vec3(c.r * 1.05, c.g * 0.08, c.b * 0.12);
    return mix(c, red, uTheme);
  }
`;

/* =====================================================================
   ГАЛАКТИКА
   ===================================================================== */
function makeGalaxy() {
  const N = isMobile ? 30000 : 90000;
  const R = 17;
  const radius = new Float32Array(N), angle = new Float32Array(N), height = new Float32Array(N);
  const size = new Float32Array(N), color = new Float32Array(N * 3), seed = new Float32Array(N);
  const palette = [
    new THREE.Color('#ff3d94'), new THREE.Color('#ff7ab8'), new THREE.Color('#ffd0e6'),
    new THREE.Color('#d6338a'), new THREE.Color('#9b2fae')
  ];

  for (let i = 0; i < N; i++) {
    const inner = i < N * 0.22;                      // яркое кольцо у чёрной дыры
    const r = inner ? rand(1.35, 4.2) : 1.4 + Math.pow(Math.random(), 1.7) * R;
    const arm = Math.floor(Math.random() * 3) * (Math.PI * 2 / 3);
    const spread = inner ? 0.35 : 0.15 + r * 0.05;
    angle[i] = arm + r * 0.55 + (Math.random() - 0.5) * spread * 3 + (inner ? Math.random() * 6.28 : 0);
    radius[i] = r;
    height[i] = (Math.random() - 0.5) * (inner ? 0.18 : 0.25 + r * 0.03);
    seed[i] = Math.random();

    const c = palette[(Math.random() * palette.length) | 0].clone();
    const k = inner ? 1.0 : Math.max(0.18, 1 - r / R * 0.75);
    if (Math.random() < 0.12) c.set('#ffffff');
    c.multiplyScalar(k);
    color.set([c.r, c.g, c.b], i * 3);
    size[i] = inner ? rand(1.2, 3.2) : rand(0.5, 2.1) * (Math.random() < 0.02 ? 2.4 : 1);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('aRadius', new THREE.BufferAttribute(radius, 1));
  g.setAttribute('aAngle',  new THREE.BufferAttribute(angle, 1));
  g.setAttribute('aHeight', new THREE.BufferAttribute(height, 1));
  g.setAttribute('aSize',   new THREE.BufferAttribute(size, 1));
  g.setAttribute('aColor',  new THREE.BufferAttribute(color, 3));
  g.setAttribute('aSeed',   new THREE.BufferAttribute(seed, 1));

  const m = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime, uIntro, uPixel;
      attribute float aRadius, aAngle, aHeight, aSize, aSeed;
      attribute vec3 aColor;
      varying vec3 vColor; varying float vAlpha;
      ${THEME_FN}
      void main() {
        float e = uIntro;
        float ang = aAngle + uTime * 1.6 / (1.2 + aRadius * 0.55);
        float r = aRadius * e;
        vec3 p = vec3(cos(ang) * r, aHeight * e + sin(uTime * 0.8 + aSeed * 40.0) * 0.03, sin(ang) * r);
        // во время взрыва частицы разлетаются из центра по лучам
        p.y += (1.0 - e) * (aSeed - 0.5) * 6.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.65 + 0.35 * sin(uTime * 3.0 + aSeed * 60.0);
        gl_PointSize = aSize * uPixel * (24.0 / -mv.z) * (0.6 + e * 0.5);
        vColor = themed(aColor) * 1.25;
        vAlpha = tw * (0.35 + 0.65 * e);
      }`,
    fragmentShader: THEME_FN + FRAG
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  scene.add(pts);

  /* чёрная дыра */
  const hole = new THREE.Mesh(
    new THREE.CircleGeometry(1.3, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.04;
  scene.add(hole);
  return hole;
}

/* свечение вокруг чёрной дыры (спрайт) */
function makeGlow() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 20, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.28, 'rgba(255,255,255,.85)');
  g.addColorStop(0.45, 'rgba(255,255,255,.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const mat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(c), color: 0xff3d94,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 8.5), mat);
  m.rotation.x = -Math.PI / 2; m.position.y = 0.03;
  scene.add(m);
  return mat;
}

/* =====================================================================
   СЕРДЦЕ ИЗ ЧАСТИЦ + ЛУЧ ИЗ ЧЁРНОЙ ДЫРЫ
   ===================================================================== */
function heartXY(t) {
  return [
    16 * Math.pow(Math.sin(t), 3),
    13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
  ];
}

function makeHeart() {
  const N = isMobile ? 7000 : 18000;
  const K = 0.22, OY = 5.3;
  const target = new Float32Array(N * 3), seed = new Float32Array(N);
  const size = new Float32Array(N), color = new Float32Array(N * 3);
  const cA = new THREE.Color('#ff3d94'), cB = new THREE.Color('#ffd0e6'), cC = new THREE.Color('#ff9ac8');

  for (let i = 0; i < N; i++) {
    const t = Math.random() * Math.PI * 2;
    let [x, y] = heartXY(t);
    const outline = Math.random() < 0.38;
    let s = 1, z;
    if (outline) {                    // яркий контур
      s = 1 + (Math.random() - 0.5) * 0.06;
      z = (Math.random() - 0.5) * 0.5;
    } else {                          // заполнение
      s = Math.sqrt(Math.random()) * 0.93;
      z = (Math.random() - 0.5) * 1.9 * (1 - s * 0.4);
    }
    x *= s; y = (y - 2) * s + 2;
    target.set([x * K, y * K + OY, z], i * 3);
    seed[i] = Math.random();
    const c = (outline ? (Math.random() < 0.5 ? cB : cC) : (Math.random() < 0.5 ? cA : cC)).clone();
    c.multiplyScalar(outline ? 1.1 : 0.85);
    color.set([c.r, c.g, c.b], i * 3);
    size[i] = outline ? rand(1.2, 2.8) : rand(0.8, 2.2);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('aTarget', new THREE.BufferAttribute(target, 3));
  g.setAttribute('aSeed',   new THREE.BufferAttribute(seed, 1));
  g.setAttribute('aSize',   new THREE.BufferAttribute(size, 1));
  g.setAttribute('aColor',  new THREE.BufferAttribute(color, 3));

  const m = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime, uHeart, uPixel;
      attribute vec3 aTarget, aColor;
      attribute float aSeed, aSize;
      varying vec3 vColor; varying float vAlpha;
      ${THEME_FN}
      void main() {
        float e = uHeart;
        // частицы поднимаются из чёрной дыры в форму сердца
        vec3 start = vec3((aSeed - 0.5) * 0.6, 0.2, (fract(aSeed * 7.0) - 0.5) * 0.6);
        vec3 p = mix(start, aTarget, e);
        float bob = sin(uTime * 1.3) * 0.18;
        float sh = 0.045 * (1.0 + (1.0 - e) * 6.0);
        p += vec3(sin(uTime * 2.0 + aSeed * 90.0), cos(uTime * 2.3 + aSeed * 70.0), sin(uTime * 1.7 + aSeed * 50.0)) * sh;
        p.y += bob;
        float beat = 1.0 + 0.035 * pow(max(0.0, sin(uTime * 2.4)), 6.0);
        p.xz *= beat;
        // медленный поворот вокруг оси Y
        float a = uTime * 0.35;
        p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixel * (22.0 / -mv.z);
        vColor = themed(aColor) * 1.3;
        vAlpha = (0.5 + 0.5 * sin(uTime * 3.5 + aSeed * 80.0)) * 0.7 + 0.3;
        vAlpha *= e;
      }`,
    fragmentShader: THEME_FN + FRAG
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  scene.add(pts);
}

function makeBeam() {
  const N = isMobile ? 900 : 1800;
  const seed = new Float32Array(N), pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) seed[i] = Math.random();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime, uHeart, uPixel;
      attribute float aSeed;
      varying vec3 vColor; varying float vAlpha;
      ${THEME_FN}
      void main() {
        float t = fract(aSeed * 13.0 + uTime * (0.25 + aSeed * 0.3));
        float rad = (1.0 - t) * 0.55 * aSeed + 0.03;
        float ang = aSeed * 400.0 + uTime * 3.0 + t * 8.0;
        vec3 p = vec3(cos(ang) * rad, t * 2.9 + 0.1, sin(ang) * rad);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPixel * (1.0 + aSeed * 2.0) * (22.0 / -mv.z);
        vColor = themed(vec3(1.0, 0.55, 0.8)) * 1.4;
        vAlpha = (1.0 - t) * uHeart;
      }`,
    fragmentShader: THEME_FN + FRAG
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  scene.add(pts);
}

/* Звёздный фон */
function makeStars() {
  const N = isMobile ? 400 : 900, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = rand(60, 120), a = Math.random() * 6.28, b = Math.acos(rand(-0.2, 1));
    pos.set([r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffd6ec, size: 0.5, transparent: true, opacity: 0.7, depthWrite: false })));
}

/* =====================================================================
   ТЕКСТ НА СПИРАЛИ + ПУЗЫРЬКИ-ВОСПОМИНАНИЯ
   ===================================================================== */
const orbit = new THREE.Group();   // всё, что вращается вокруг дыры
scene.add(orbit);
const textMats = [];
const bubbles = [];                 // кликабельные спрайты

function makeTextMesh(str, color) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
  const x = c.getContext('2d');
  x.font = 'bold 64px "Courier New", monospace';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = '#ff2d85'; x.shadowBlur = 18;
  x.fillStyle = color; x.fillText(str, 512, 66);
  x.shadowBlur = 6; x.fillText(str, 512, 66);
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  textMats.push(mat);
  return new THREE.Mesh(new THREE.PlaneGeometry(7, 0.875), mat);
}

function buildTexts() {
  const rings = [5.2, 7.4, 9.6, 11.8, 14, 16];
  CONFIG.phrases.forEach((p, i) => {
    const pivot = new THREE.Group();
    const mesh = makeTextMesh(p, i % 3 === 0 ? '#ffe3f0' : '#ff8fc0');
    const r = rings[i % rings.length] + (i >= rings.length ? 1.2 : 0);
    mesh.position.set(r, 0.08, 0);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.set(-Math.PI / 2, -Math.PI / 2, 0);
    pivot.add(mesh);
    pivot.rotation.y = Math.random() * 6.28;
    pivot.userData.speed = (0.16 / Math.sqrt(r)) * (i % 2 ? 1 : 0.8);
    orbit.add(pivot);
  });
}

function makeBubbleTexture(m) {
  return new Promise((resolve) => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const done = () => resolve(new THREE.CanvasTexture(c));
    // круглая «аватарка» с мягкой обводкой
    x.save(); x.beginPath(); x.arc(128, 128, 112, 0, 6.283); x.clip();
    if (m.img) {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(img.width, img.height);
        x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 16, 16, 224, 224);
        x.restore(); ring(); done();
      };
      img.onerror = () => { fallback(); done(); };
      img.src = m.img;
      return;
    }
    fallback(); done();

    function fallback() {
      const g = x.createRadialGradient(128, 100, 10, 128, 128, 128);
      g.addColorStop(0, '#fff5fa'); g.addColorStop(1, '#ffc2dc');
      x.fillStyle = g; x.fillRect(0, 0, 256, 256);
      x.font = '132px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(m.icon, 128, 140);
      x.restore(); ring();
    }
    function ring() {
      x.lineWidth = 8; x.strokeStyle = 'rgba(255,255,255,.95)';
      x.beginPath(); x.arc(128, 128, 112, 0, 6.283); x.stroke();
    }
  });
}

async function buildBubbles() {
  for (let i = 0; i < CONFIG.memories.length; i++) {
    const m = CONFIG.memories[i];
    const tex = await makeBubbleTexture(m);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    const pivot = new THREE.Group();
    const r = 4.8 + (i / CONFIG.memories.length) * 11 + rand(-0.5, 0.5);
    sp.position.set(r, 0.9 + rand(0, 0.5), 0);
    sp.scale.setScalar((1.15 + rand(0, 0.25)) * (isMobile ? 1.3 : 1));
    sp.userData = { memory: m, base: sp.position.y, phase: Math.random() * 6.28 };
    pivot.add(sp);
    pivot.rotation.y = (i / CONFIG.memories.length) * 6.283 + rand(-0.3, 0.3);
    pivot.userData.speed = 0.2 / Math.sqrt(r);
    orbit.add(pivot);
    bubbles.push(sp);
  }
}

/* =====================================================================
   УПРАВЛЕНИЕ: вращение, зум, клик по пузырькам
   ===================================================================== */
const pointers = new Map();
let moved = 0, pinchStart = 0, pinchDist = 0;

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved = 0; dragging = true;
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchStart = Math.hypot(a.x - b.x, a.y - b.y); pinchDist = cam.targetDist; }
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 1) {
    moved += Math.abs(dx) + Math.abs(dy);
    cam.yaw -= dx * 0.005;
    cam.targetPitch = Math.min(1.3, Math.max(0.12, cam.targetPitch + dy * 0.004));
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    cam.targetDist = Math.min(30, Math.max(8, pinchDist * pinchStart / d)); userZoomed = true;
    moved = 99;
  }
});
function endPointer(e) {
  const had = pointers.delete(e.pointerId);
  if (!had) return;
  if (pointers.size === 0) {
    dragging = false;
    if (moved < 14 && started) pick(e.clientX, e.clientY);
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  cam.targetDist = Math.min(30, Math.max(8, cam.targetDist + e.deltaY * 0.01)); userZoomed = true;
}, { passive: true });

const ray = new THREE.Raycaster();
function pick(x, y) {
  const ndc = new THREE.Vector2((x / canvas.clientWidth) * 2 - 1, -(y / canvas.clientHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(bubbles)[0];
  if (hit) openModal(hit.object.userData.memory);
}

/* Модальное окно */
function openModal(m) {
  const media = $('modalMedia');
  media.innerHTML = '';
  if (m.img) { const i = new Image(); i.src = m.img; media.appendChild(i); }
  else media.textContent = m.icon;
  $('modalTitle').textContent = m.title;
  $('modalText').textContent = m.text;
  $('modal').classList.remove('hidden');
}
$('modalClose').addEventListener('click', () => $('modal').classList.add('hidden'));
$('modal').addEventListener('pointerdown', (e) => { if (e.target === $('modal')) $('modal').classList.add('hidden'); });

/* Кнопка-сердечко: розовая ↔ красная тема */
let themeTarget = 0;
$('heartBtn').addEventListener('click', () => {
  themeTarget = themeTarget ? 0 : 1;
  document.body.classList.toggle('red', !!themeTarget);
});

/* =====================================================================
   ЗАПУСК
   ===================================================================== */
let started = false, startTime = 0;
const glowMat = (makeGalaxy(), makeGlow());
makeHeart(); makeBeam(); makeStars(); buildTexts();
buildBubbles();
updateCamera();

$('startBtn').addEventListener('click', () => {
  if (started) return;
  started = true; startTime = performance.now() / 1000;
  $('intro').classList.add('out');
  setTimeout(() => { $('title').classList.remove('hidden'); $('heartBtn').classList.remove('hidden'); }, 4200);
});

function onResize() {
  const w = window.visualViewport ? visualViewport.width : innerWidth;
  const h = window.visualViewport ? visualViewport.height : innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  // портретный экран телефона: шире угол и камера дальше, чтобы всё помещалось
  const portrait = w < h;
  camera.fov = portrait ? 72 : 55;
  if (!userZoomed) cam.targetDist = portrait ? 19 : 17;
  camera.updateProjectionMatrix();
}
addEventListener('resize', onResize);
addEventListener('orientationchange', () => setTimeout(onResize, 250));
if (window.visualViewport) visualViewport.addEventListener('resize', onResize);
onResize();

const clock = new THREE.Clock();
let last = 0;
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now() / 1000;
  U.uTime.value += dt;
  const since = started ? now - startTime : 0;

  // фазы: 0–3.5с взрыв галактики, 2.5–6с рост сердца, дальше появляются фразы и пузырьки
  U.uIntro.value = started ? easeOut(since / 3.8) : 0;
  U.uHeart.value = started ? easeOut((since - 2.6) / 3.4) : 0;
  const reveal = started ? Math.min(Math.max((since - 4.5) / 2.5, 0), 1) : 0;
  textMats.forEach((m) => (m.opacity = reveal));
  bubbles.forEach((b) => {
    b.material.opacity = reveal;
    b.position.y = b.userData.base + Math.sin(U.uTime.value * 1.2 + b.userData.phase) * 0.12;
  });

  U.uTheme.value += (themeTarget - U.uTheme.value) * Math.min(1, dt * 2.5);
  glowMat.color.setRGB(1, 0.24 - 0.2 * U.uTheme.value, 0.58 - 0.5 * U.uTheme.value);

  orbit.children.forEach((p) => (p.rotation.y += p.userData.speed * dt));

  // камера
  cam.pitch += (cam.targetPitch - cam.pitch) * Math.min(1, dt * (started ? 1.4 : 0));
  cam.dist  += (cam.targetDist - cam.dist) * Math.min(1, dt * (started ? 1.4 : 0));
  if (started && !dragging) cam.yaw += cam.autoRotate * dt;
  updateCamera();

  renderer.render(scene, camera);
}
tick();
