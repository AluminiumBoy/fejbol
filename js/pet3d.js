// A kisállat: saját, kódból épített rajzfilmróka three.js-sel.
// mountPet(canvas, opts) → api: setGender, setStage, setMood, setSleep, poke, eat, speak, dispose …
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const STAGE_NAMES = ['Kölyök', 'Kamasz', 'Felnőtt', 'Legenda'];
const STAGE_SCALE = [.7, .8, .91, 1.0];

function gradTex(stops, w = 2, h = 512) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, h);
  stops.forEach(([p, col]) => gr.addColorStop(p, col)); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function radialTex(col) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// bundaszerű felület: finom, irányított zaj normáltérképként
function furNormal() {
  const n = 256, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n);
  const h = new Float32Array(n * n);
  for (let i = 0; i < 2600; i++) { // rövid "szőrszálak"
    let x = Math.random() * n, y = Math.random() * n; const a = Math.random() * .6 - .3 + Math.PI / 2, len = 4 + Math.random() * 7, v = Math.random() * .8 + .2;
    for (let k = 0; k < len; k++) { const xi = ((x | 0) % n + n) % n, yi = ((y | 0) % n + n) % n; h[yi * n + xi] += v; x += Math.cos(a); y += Math.sin(a); }
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, dx = h[y * n + (x + 1) % n] - h[y * n + (x + n - 1) % n], dy = h[((y + 1) % n) * n + x] - h[((y + n - 1) % n) * n + x];
    const nx = -dx * .5, ny = -dy * .5, nz = 1, l = Math.hypot(nx, ny, nz);
    img.data[i * 4] = (nx / l * .5 + .5) * 255; img.data[i * 4 + 1] = (ny / l * .5 + .5) * 255; img.data[i * 4 + 2] = (nz / l * .5 + .5) * 255; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
}

export async function mountPet(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .82;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const dayBg = gradTex([[0, '#3A1F6B'], [.55, '#B4568C'], [1, '#F2A07B']]);
  const nightBg = gradTex([[0, '#070714'], [.6, '#1C1640'], [1, '#2E2350']]);
  scene.background = dayBg;

  const bokeh = [];
  for (let i = 0; i < 14; i++) {
    const col = ['rgba(255,200,140,.9)', 'rgba(255,140,190,.8)', 'rgba(170,150,255,.8)'][i % 3];
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex(col), transparent: true, depthWrite: false, opacity: .3 + Math.random() * .3 }));
    s.position.set((Math.random() - .5) * 8, 1 + Math.random() * 3.5, -4 - Math.random() * 3); s.scale.setScalar(.4 + Math.random() * 1.1);
    s.userData.ph = Math.random() * 6; scene.add(s); bokeh.push(s);
  }
  const hemi = new THREE.HemisphereLight(0xffe2cf, 0x3a2352, 1.0); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe7d0, 2.6); key.position.set(2.5, 5, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 8; key.shadow.bias = -.0004;
  Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1.5 }); scene.add(key);
  const fill = new THREE.DirectionalLight(0xb7a4ff, .9); fill.position.set(-4, 2.5, 2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffc2e2, 1.8); rim.position.set(-1.5, 3, -4); scene.add(rim);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 96), new THREE.MeshStandardMaterial({ color: 0x3E2358, roughness: .95 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.1, .16, 64), new THREE.MeshPhysicalMaterial({ color: 0x8E4FB8, roughness: .85, sheen: .6, sheenColor: 0xE0B0FF, sheenRoughness: .6 }));
  cushion.position.y = .08; cushion.receiveShadow = true; scene.add(cushion);
  // puha árnyékfolt a lábak alatt (jobban "ül" a párnán)
  const blob = new THREE.Mesh(new THREE.CircleGeometry(.7, 48), new THREE.MeshBasicMaterial({ map: radialTex('rgba(20,6,30,.75)'), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = .165; scene.add(blob);

  const camera = new THREE.PerspectiveCamera(32, 1, .05, 100);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .22, .4, .97); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const frame = opts.frame || 'full'; // 'full' vagy 'card' (a kezdőképernyő kártyája)
  function resize() {
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 300;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    camera.aspect = w / h;
    if (frame === 'card') { camera.fov = 30; camera.position.set(0, 1.35, 4.6); camera.lookAt(0, .95, 0); }
    else if (frame === 'mini') { camera.fov = 30; camera.position.set(0, 1.25, 3.3); camera.lookAt(0, 1.02, 0); }
    else { const p = w < h; camera.fov = p ? 40 : 30; camera.position.set(0, p ? 1.55 : 1.45, p ? 5.0 : 4.4); camera.lookAt(0, 1.0, 0); }
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  // ---------- anyagok ----------
  const fn = furNormal();
  const M = {
    fur: new THREE.MeshPhysicalMaterial({ color: 0xE85A12, roughness: .72, sheen: .45, sheenColor: 0xFFB070, sheenRoughness: .5, normalMap: fn, normalScale: new THREE.Vector2(.35, .35) }),
    cream: new THREE.MeshPhysicalMaterial({ color: 0xF7EADB, roughness: .82, sheen: .4, sheenColor: 0xffffff, sheenRoughness: .6, normalMap: fn, normalScale: new THREE.Vector2(.3, .3) }),
    dark: new THREE.MeshPhysicalMaterial({ color: 0x3A2419, roughness: .7, sheen: .5, sheenColor: 0x8a5a40, normalMap: fn, normalScale: new THREE.Vector2(.25, .25) }),
    eye: new THREE.MeshPhysicalMaterial({ color: 0x1A0F0C, roughness: .06, clearcoat: 1, clearcoatRoughness: .04 }),
    iris: new THREE.MeshPhysicalMaterial({ color: 0x6B3A1E, roughness: .1, clearcoat: 1 }),
    shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    nose: new THREE.MeshPhysicalMaterial({ color: 0x241412, roughness: .15, clearcoat: 1 }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x5A1420, roughness: .6 }),
    tongue: new THREE.MeshStandardMaterial({ color: 0xFF7A8A, roughness: .5 }),
    inner: new THREE.MeshPhysicalMaterial({ color: 0xFFD9D0, roughness: .8, sheen: 1, sheenColor: 0xffffff }),
    blush: new THREE.MeshBasicMaterial({ color: 0xFF7FA6, transparent: true, opacity: .18, depthWrite: false }),
    line: new THREE.MeshBasicMaterial({ color: 0x2A140E })
  };
  const sph = (r, mat, sx = 1, sy = 1, sz = 1, seg = 48) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * .66)), mat); m.scale.set(sx, sy, sz); m.castShadow = true; return m; };
  const tube = (pts, r, mat) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 10, false), mat);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---------- test ----------
  const pet = new THREE.Group(); pet.position.y = .16; scene.add(pet);
  const body = sph(.5, M.fur, 1, 1.12, .95); body.position.set(0, .56, 0); pet.add(body);
  const belly = sph(.36, M.cream, .92, 1.08, .55); belly.position.set(0, .5, .3); pet.add(belly);
  [-1, 1].forEach(s => { const h = sph(.26, M.fur, .95, .72, 1.25); h.position.set(s * .34, .2, .06); pet.add(h);
    const f = sph(.12, M.dark, 1.1, .6, 1.4); f.position.set(s * .36, .06, .34); pet.add(f); });
  const paws = [];
  [-1, 1].forEach(s => {
    const g = new THREE.Group(); g.position.set(s * .17, .52, .3);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.085, .34, 8, 24), M.fur); leg.position.y = -.22; leg.castShadow = true; g.add(leg);
    const toe = sph(.1, M.dark, 1, .75, 1.15); toe.position.set(0, -.44, .03); g.add(toe);
    pet.add(g); paws.push(g);
  });
  const tailG = new THREE.Group(); tailG.position.set(.1, .3, -.38); pet.add(tailG);
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, r = .1 + Math.sin(t * Math.PI * .9) * .2;
    const s = sph(r, i >= 7 ? M.cream : M.fur, 1, 1, 1, 32); s.position.set(Math.sin(t * 2.2) * .5, t * .85, -Math.sin(t * 3.1) * .22); tailG.add(s);
  }
  // ---------- fej ----------
  const headG = new THREE.Group(); headG.position.set(0, 1.2, .02); pet.add(headG);
  headG.add(sph(.55, M.fur, 1.1, .94, .98));
  [-1, 1].forEach(s => { const c = sph(.24, M.cream, 1.25, .82, .95); c.position.set(s * .37, -.2, .2); headG.add(c);
    const tuft = sph(.12, M.cream, 1.3, .7, .8); tuft.position.set(s * .56, -.24, .08); tuft.rotation.z = s * .5; headG.add(tuft); });
  const muzzle = sph(.23, M.cream, 1.25, .78, 1.05); muzzle.position.set(0, -.2, .43); headG.add(muzzle);
  const nose = sph(.075, M.nose, 1.25, .85, .9); nose.position.set(0, -.1, .66); headG.add(nose);
  const noseShine = sph(.02, M.shine, 1, 1, 1, 12); noseShine.position.set(-.025, -.08, .72); headG.add(noseShine);
  const smile = tube([V(-.1, -.26, .6), V(-.05, -.3, .63), V(0, -.27, .64), V(.05, -.3, .63), V(.1, -.26, .6)], .012, M.line); headG.add(smile);
  const frown = tube([V(-.07, -.31, .62), V(0, -.27, .64), V(.07, -.31, .62)], .012, M.line); frown.visible = false; headG.add(frown);
  const mouthOpen = new THREE.Group(); mouthOpen.position.set(0, -.3, .6); headG.add(mouthOpen);
  mouthOpen.add(sph(.075, M.mouth, 1.2, 1, .5, 32));
  const tongue = sph(.05, M.tongue, 1.2, .6, .5, 24); tongue.position.set(0, -.035, .015); mouthOpen.add(tongue);
  mouthOpen.scale.set(1, .01, 1);
  const eyes = [];
  [-1, 1].forEach(s => {
    const g = new THREE.Group(); g.position.set(s * .21, .02, .47); g.rotation.y = s * .18;
    const e = sph(.125, M.eye, .82, 1.08, .55); g.add(e);
    const ir = sph(.07, M.iris, .85, 1, .3, 24); ir.position.set(0, -.03, .05); g.add(ir);
    const sh1 = sph(.036, M.shine, 1, 1, 1, 16); sh1.position.set(.04 * -s + .02, .05, .07); g.add(sh1);
    const sh2 = sph(.016, M.shine, 1, 1, 1, 12); sh2.position.set(-.03, -.05, .07); g.add(sh2);
    const happy = tube([V(-.085, -.02, .07), V(0, .06, .08), V(.085, -.02, .07)], .018, M.line); happy.visible = false; g.add(happy);
    const lashes = new THREE.Group(); lashes.visible = false;
    [0, 1, 2].forEach(k => { const l = tube([V(0, 0, 0), V(s * .03, .03, 0), V(s * .06, .045, -.01)], .009, M.line);
      l.position.set(s * (.07 + k * .018), .11 - k * .03, .03); l.rotation.z = s * (-.2 - k * .35); lashes.add(l); });
    g.add(lashes);
    headG.add(g);
    // szemöldök: az érzelmek fő eszköze
    const brow = tube([V(-.07, 0, 0), V(0, .02, .01), V(.07, 0, 0)], .016, M.dark);
    brow.position.set(s * .21, .2, .5); brow.rotation.y = s * .2; headG.add(brow);
    eyes.push({ g, e, ir, sh1, sh2, happy, lashes, brow, s });
  });
  const blushes = [-1, 1].map(s => { const b = new THREE.Mesh(new THREE.CircleGeometry(.07, 32), M.blush); b.position.set(s * .36, -.12, .5); b.rotation.y = s * .5; headG.add(b); return b; });
  function earGeo(h, r) {
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(r * Math.pow(1 - t, .85) * (1 + .15 * Math.sin(t * Math.PI)), t * h)); }
    return new THREE.LatheGeometry(pts, 32);
  }
  const ears = [];
  [-1, 1].forEach(s => {
    const g = new THREE.Group(); g.position.set(s * .33, .38, -.05); g.rotation.set(-.12, 0, s * -.38);
    const outer = new THREE.Mesh(earGeo(.5, .2), M.fur); outer.scale.z = .55; outer.castShadow = true; g.add(outer);
    const inner = new THREE.Mesh(earGeo(.4, .14), M.inner); inner.scale.z = .35; inner.position.set(0, .03, .05); g.add(inner);
    const tip = new THREE.Mesh(earGeo(.17, .082), M.dark); tip.scale.z = .6; tip.position.y = .33; g.add(tip);
    headG.add(g); ears.push(g);
  });
  // ---------- kiegészítők ----------
  const capMat = new THREE.MeshPhysicalMaterial({ color: 0x2F6FE0, roughness: .55, sheen: .5, sheenColor: 0x9cc2ff, clearcoat: .2 });
  const cap = new THREE.Group(); cap.position.set(0, .3, -.02); cap.rotation.x = -.18;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(.4, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), capMat); dome.scale.set(1.12, .72, 1.08); dome.castShadow = true; cap.add(dome);
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .035, 40, 1, false, Math.PI * .75, Math.PI * .5), capMat); visor.position.set(0, .01, -.08); visor.scale.set(1, 1, 1.25); cap.add(visor);
  const capBtn = sph(.04, new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .4 }), 1, .6, 1, 16); capBtn.position.y = .29; cap.add(capBtn);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(.445, .018, 10, 60), new THREE.MeshStandardMaterial({ color: 0xffffff })); stripe.rotation.x = Math.PI / 2; stripe.scale.set(1, .97, 1); stripe.position.y = .015; cap.add(stripe);
  headG.add(cap);
  const bow = new THREE.Group(); bow.position.set(.26, .5, .12); bow.rotation.z = -.3;
  const bowMat = new THREE.MeshPhysicalMaterial({ color: 0xFF4F8B, roughness: .35, clearcoat: .6, sheen: 1, sheenColor: 0xffc0d8 });
  [-1, 1].forEach(s => { const w = new THREE.Mesh(new THREE.ConeGeometry(.1, .17, 24), bowMat); w.rotation.z = s * Math.PI / 2; w.position.x = s * .09; w.scale.z = .5; bow.add(w); });
  bow.add(sph(.045, bowMat, 1, 1, .8, 24)); headG.add(bow);
  const glasses = new THREE.Group(); glasses.position.set(0, .03, .6); glasses.visible = false;
  const gMat = new THREE.MeshPhysicalMaterial({ color: 0x0B0B12, roughness: .05, metalness: .3, clearcoat: 1 });
  [-1, 1].forEach(s => { const l = new THREE.Mesh(new THREE.CapsuleGeometry(.075, .07, 8, 24), gMat); l.rotation.z = Math.PI / 2; l.scale.set(1, 1, .35); l.position.x = s * .2; glasses.add(l); });
  glasses.add(new THREE.Mesh(new THREE.BoxGeometry(.14, .02, .02), gMat)); headG.add(glasses);
  const crown = new THREE.Group(); crown.position.set(0, .5, -.02); crown.visible = false;
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xFFC53D, metalness: 1, roughness: .18, clearcoat: 1, emissive: 0x3a2400, side: THREE.DoubleSide });
  crown.add(new THREE.Mesh(new THREE.CylinderGeometry(.24, .26, .11, 40, 1, true), gold));
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(.045, .14, 16), gold); sp.position.set(Math.cos(a) * .24, .12, Math.sin(a) * .24); crown.add(sp);
    const gem = sph(.028, new THREE.MeshPhysicalMaterial({ color: [0xFF3D5A, 0x3D8BFF, 0x3DDC84][i % 3], roughness: .05, clearcoat: 1, emissive: [0x5a0010, 0x001a5a, 0x004a20][i % 3] }), 1, 1, 1, 16);
    gem.position.set(Math.cos(a) * .255, 0, Math.sin(a) * .255); crown.add(gem);
  }
  headG.add(crown);

  // ---------- részecskék ----------
  const loader = new THREE.TextureLoader();
  const tex = u => { const t = loader.load(u); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const T = { heart: tex(new URL('../img/', import.meta.url).href + 'red_heart.png'), food: tex(new URL('../img/', import.meta.url).href + 'drumstick.png'), zzz: tex(new URL('../img/', import.meta.url).href + 'zzz.png') };
  const parts = [];
  const sparkMat = new THREE.SpriteMaterial({ map: radialTex('rgba(255,240,200,1)'), color: 0xfff1c0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  function sparkle(n = 18) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(sparkMat.clone()); const a = Math.random() * Math.PI * 2, r = .6 + Math.random() * .5;
      s.position.set(Math.cos(a) * r, .6 + Math.random() * 1.2, Math.sin(a) * r * .6 + .2); s.scale.setScalar(.08 + Math.random() * .1);
      scene.add(s); parts.push({ s, v: V((Math.random() - .5) * .3, .5 + Math.random() * .6, 0), life: 1.2 + Math.random() * .6 });
    }
  }
  function hearts(n = 4) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.heart, transparent: true, depthWrite: false }));
      s.position.set((Math.random() - .5) * .8, 1.5 + Math.random() * .3, .4); s.scale.setScalar(.16 + Math.random() * .08);
      scene.add(s); parts.push({ s, v: V((Math.random() - .5) * .4, .7 + Math.random() * .4, 0), life: 1.4 });
    }
  }
  const zzz = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.zzz, transparent: true, depthWrite: false })); zzz.scale.setScalar(.35); zzz.visible = false; scene.add(zzz);

  // ---------- állapot ----------
  const S = { gender: 'm', stage: 0, grow: STAGE_SCALE[0], growTo: STAGE_SCALE[0], asleep: false, sad: 0, sadTo: 0,
    happyT: 0, surpriseT: 0, jumpT: -1, eatT: -1, yawnT: -1, talk: 0, blinkT: 2, blink: 0, earT: 1.5,
    look: new THREE.Vector2(), lookTo: new THREE.Vector2(), lastPointer: 0, idleT: 6, busy: false, listen: 0, listenTo: 0, sadFlash: 0 };
  let food = null, onEaten = null, speakAn = null, voiceSrc = null, ac = null;

  function setGender(g) {
    S.gender = g;
    cap.visible = g === 'm' && S.stage < 3; bow.visible = g === 'f';
    eyes.forEach(e => e.lashes.visible = g === 'f');
  }
  function setStage(s, animate) {
    S.stage = s; S.growTo = STAGE_SCALE[s];
    glasses.visible = s === 2; crown.visible = s >= 3; cap.visible = S.gender === 'm' && s < 3;
    if (animate) { jump(); sparkle(); happy(1.5); }
  }
  const setMood = hungry => { S.sadTo = hungry ? 1 : 0; };
  function setSleep(on) {
    S.asleep = on; zzz.visible = on;
    scene.background = on ? nightBg : dayBg;
    hemi.intensity = on ? .35 : 1; key.intensity = on ? .6 : 2.6; key.color.set(on ? 0x9fb4ff : 0xffe7d0);
    bokeh.forEach(b => b.material.opacity = on ? .15 : .45);
  }
  const jump = () => { S.jumpT = 0; };
  const happy = (sec = 1.2) => { S.happyT = sec; };
  function poke() { if (S.asleep) return false; jump(); happy(); hearts(3); return true; }
  function eat(done) {
    if (food || S.asleep) return false;
    food = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.food, transparent: true, depthWrite: false })); food.scale.setScalar(.34);
    food.position.set(.2, 2.6, .8); scene.add(food); onEaten = done; return true;
  }
  function audio() { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); return ac; }
  // hang lejátszása úgy, hogy a száj a hangerőre mozogjon
  function speak(buf, rate = 1) {
    const a = audio(); try { voiceSrc?.stop(); } catch (e) {}
    const src = a.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const an = a.createAnalyser(); an.fftSize = 1024; src.connect(an); an.connect(a.destination);
    speakAn = an; voiceSrc = src; src.start();
    return new Promise(res => src.onended = () => { if (voiceSrc === src) { speakAn = null; voiceSrc = null; } res(); });
  }
  // bármilyen lejátszott hang (pl. a versfelolvasás) mozgassa a szájat
  function attach(el) {
    const a = audio();
    try { const src = a.createMediaElementSource(el); const an = a.createAnalyser(); an.fftSize = 1024; src.connect(an); an.connect(a.destination); speakAn = an;
      el.addEventListener('ended', () => { if (speakAn === an) speakAn = null; }); el.addEventListener('pause', () => { if (speakAn === an) speakAn = null; }); } catch (e) {}
  }
  // reakció egy válaszra
  function react(kind) {
    if (S.asleep) return;
    if (kind === 'good') { happy(.9); if (Math.random() < .35) jump(); }
    else if (kind === 'bad') { S.sadFlash = 1.2; S.surpriseT = .5; }
    else if (kind === 'great') { happy(1.6); jump(); hearts(4); sparkle(12); }
  }
  const setListening = on => { S.listenTo = on ? 1 : 0; };
  const tbuf = new Float32Array(1024);
  const level = an => { an.getFloatTimeDomainData(tbuf); let s = 0; for (const v of tbuf) s += v * v; return Math.sqrt(s / tbuf.length); };

  // érintés és tekintet
  const onMove = e => { const r = canvas.getBoundingClientRect(); S.lookTo.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); S.lastPointer = performance.now(); };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', e => { onMove(e); opts.onTap?.(); });

  // ---------- fő ciklus ----------
  const clock = new THREE.Clock(), headWorld = V(0, 0, 0);
  let raf = 0, alive = true;
  function tick() {
    if (!alive) return;
    const dt = Math.min(.05, clock.getDelta()), t = clock.elapsedTime, now = performance.now();
    S.grow += (S.growTo - S.grow) * Math.min(1, dt * 3);
    S.sadFlash = Math.max(0, S.sadFlash - dt);
    S.sad += (Math.max(S.sadTo, S.sadFlash > 0 ? .8 : 0) - S.sad) * Math.min(1, dt * (S.sadFlash > 0 ? 6 : 2));
    S.listen += (S.listenTo - S.listen) * Math.min(1, dt * 5);
    // magától is csinál dolgokat: körülnéz, ásít, csóvál
    S.idleT -= dt;
    if (S.idleT <= 0 && !S.asleep) {
      S.idleT = 4 + Math.random() * 6;
      const r = Math.random();
      if (r < .2 && S.eatT < 0) S.yawnT = 0;
      else if (r < .55) { S.lookTo.set((Math.random() - .5) * 1.4, (Math.random() - .3) * .8); }
      else if (r < .75) happy(.8);
      else S.surpriseT = .7;
    }
    if (now - S.lastPointer > 4000 && Math.random() < .01) S.lookTo.multiplyScalar(.5);
    const breath = Math.sin(t * (S.asleep ? 1.3 : 2.4)) * (S.asleep ? .025 : .015);
    let jy = 0, squash = 0;
    if (S.jumpT >= 0) {
      S.jumpT += dt; const p = S.jumpT / .75;
      if (p >= 1) S.jumpT = -1;
      else if (p < .18) squash = Math.sin(p / .18 * Math.PI) * .12;
      else { const q = (p - .18) / .82; jy = Math.sin(q * Math.PI) * .38; squash = -Math.sin(q * Math.PI) * .06; }
    }
    pet.position.y = .16 + jy;
    const slump = S.sad * .04;
    pet.scale.set(S.grow * (1 + squash * .6), S.grow * (1 - squash + breath - slump), S.grow * (1 + squash * .6));
    blob.scale.setScalar(S.grow * (1 - jy * .8)); blob.material.opacity = 1 - jy;
    if (speakAn) S.talk += (Math.min(1, level(speakAn) * 7) - S.talk) * .45; else S.talk *= .75;
    let yawn = 0; if (S.yawnT >= 0) { S.yawnT += dt; yawn = Math.sin(Math.min(1, S.yawnT / 1.6) * Math.PI); if (S.yawnT > 1.6) S.yawnT = -1; }
    const chew = S.eatT >= 0 ? Math.abs(Math.sin(S.eatT * 16)) * .6 : 0;
    mouthOpen.scale.set(1 + S.talk * .2 + yawn * .3, .01 + S.talk * 1.1 + chew + yawn * 1.8, 1);
    const open = mouthOpen.scale.y > .15;
    smile.visible = !open && S.sad < .5; frown.visible = !open && S.sad >= .5;
    // tekintet
    if (!S.asleep) S.look.lerp(S.lookTo, Math.min(1, dt * 4)); else S.look.lerp(new THREE.Vector2(0, -.6), dt * 2);
    headG.rotation.y = S.look.x * .35;
    headG.rotation.x = -S.look.y * .18 + (S.asleep ? .35 : 0) + S.sad * .18 + Math.sin(t * 1.3) * .02 + S.talk * .05 - yawn * .15;
    headG.rotation.z = Math.sin(t * .9) * .04 + (S.asleep ? .15 : 0) + S.sad * .08 + S.listen * .22;
    headG.position.y = 1.2 + breath * 2 - S.sad * .03;
    // szemek, pislogás, szemöldök
    S.blinkT -= dt; if (S.blinkT <= 0) { S.blink = .16; S.blinkT = 2 + Math.random() * 3.5; }
    S.blink = Math.max(0, S.blink - dt);
    const shut = S.asleep || S.happyT > 0;
    const closed = S.blink > 0 ? Math.sin(S.blink / .16 * Math.PI) : 0;
    const surprise = S.surpriseT > 0 ? Math.sin(S.surpriseT / .7 * Math.PI) : 0;
    eyes.forEach(e => {
      e.e.visible = e.ir.visible = e.sh1.visible = e.sh2.visible = !shut;
      e.happy.visible = shut; e.happy.rotation.z = S.asleep ? Math.PI : 0; e.happy.position.y = S.asleep ? -.04 : 0;
      e.g.scale.y = shut ? 1 : (1 - closed * .92) * (1 - S.sad * .15 - yawn * .6) * (1 + surprise * .15);
      e.ir.position.x = S.look.x * .02; e.ir.position.y = -.03 + S.look.y * .015;
      // szemöldök: szomorúan befelé felfelé, boldogan/meglepődve feljebb
      e.brow.position.y = .2 + surprise * .05 + (S.happyT > 0 ? .03 : 0) - yawn * .02;
      e.brow.rotation.z = e.s * (-S.sad * .45 + (S.happyT > 0 ? .1 : 0));
    });
    S.happyT = Math.max(0, S.happyT - dt); S.surpriseT = Math.max(0, S.surpriseT - dt);
    M.blush.opacity += ((S.happyT > 0 ? .55 : .18) - M.blush.opacity) * Math.min(1, dt * 5);
    // fülek, farok, mancsok
    S.earT -= dt; let twitch = 0; if (S.earT <= 0) S.earT = 2 + Math.random() * 4; if (S.earT < .25) twitch = Math.sin(S.earT / .25 * Math.PI) * .35;
    ears.forEach((g, i) => { const s = i ? 1 : -1; const droop = (S.asleep ? .25 : 0) + S.sad * .55;
      g.rotation.z = s * -.38 + (i ? twitch : 0) * s - s * droop + s * S.listen * .15; g.rotation.x = -.12 + (S.asleep ? .3 : 0) + S.sad * .35 - yawn * .2 - S.listen * .25; });
    const wag = S.happyT > 0 ? 9 : S.sad > .5 ? 1 : 2.2;
    tailG.rotation.y = Math.sin(t * wag) * (S.happyT > 0 ? .5 : .25 - S.sad * .15);
    tailG.rotation.z = Math.sin(t * 1.7) * .08;
    paws.forEach((g, i) => g.rotation.x = S.eatT >= 0 ? -.6 - Math.sin(S.eatT * 8 + i) * .1 : 0);
    // etetés
    headG.getWorldPosition(headWorld);
    if (food) {
      const target = headWorld.clone().add(V(0, -.3 * S.grow, .55 * S.grow));
      food.position.lerp(target, Math.min(1, dt * 3.2)); food.material.rotation += dt * 3;
      if (food.position.distanceTo(target) < .1) { scene.remove(food); food = null; S.eatT = 0; }
    }
    if (S.eatT >= 0) { S.eatT += dt; if (S.eatT > 1.3) { S.eatT = -1; happy(1); hearts(5); const cb = onEaten; onEaten = null; cb?.(); } }
    zzz.position.set(headWorld.x + .45 * S.grow, headWorld.y + .45 * S.grow + Math.sin(t * 1.5) * .06, headWorld.z); zzz.material.opacity = .6 + Math.sin(t * 2) * .3;
    crown.rotation.y = Math.sin(t * .8) * .1;
    bokeh.forEach(b => { b.position.y += Math.sin(t * .4 + b.userData.ph) * .0015; });
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt; p.s.position.addScaledVector(p.v, dt); p.s.material.opacity = Math.min(1, p.life);
      if (p.life <= 0) { scene.remove(p.s); parts.splice(i, 1); }
    }
    composer.render();
    raf = requestAnimationFrame(tick);
  }
  // csak akkor rajzol, ha látszik (akkumulátor)
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && alive && !raf) { clock.getDelta(); raf = requestAnimationFrame(tick); } else if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; } });
  io.observe(canvas);

  setGender(opts.gender || 'm'); setStage(opts.stage || 0); S.grow = STAGE_SCALE[opts.stage || 0]; setMood(!!opts.hungry);
  raf = requestAnimationFrame(tick);

  return {
    setGender, setStage, setMood, setSleep, poke, eat, speak, audio, jump, happy, hearts, sparkle, attach, react, setListening,
    isAsleep: () => S.asleep,
    dispose() {
      alive = false; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
      try { voiceSrc?.stop(); } catch (e) {}
      renderer.dispose(); renderer.forceContextLoss?.();
    }
  };
}
