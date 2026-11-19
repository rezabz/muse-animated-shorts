// The whole place as one three.js scene: sky, 1814 London street, the Meux brewery yard with its giant wooden
// vats, the beer wave and flood, the soda-bottle analogy table, and the cast. update(id, f, camera) poses
// everything for shot `id` at frame f (pure function of id + f).
import * as THREE from "three";
import { Batch, boxGeo, V, lam, house } from "./build";
import { ctex, planksHD, stoneHD, cobbleHD, cloudHD, brick } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stageBeer, setLightName } from "./cast";
import { FPS, D0, SHOTS, VAT_BIG, VAT_L, VAT_R, SODA_TABLE, BURST, SODA_SHAKE0, SODA_POP, WAVE_Z0, waveZ, waveH, vatIntact, pressure, camAt, ShotDef } from "./story";

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});

function quadUp(x0: number, x1: number, z0: number, z1: number, u: number, v: number, dy = 0) {
  const y = D0 + dy, g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
}

type Mats = Record<string, THREE.Material>;

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight; private fill: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();
  // dynamic pieces
  private vatBig: THREE.Group; private vatBigBody: THREE.Mesh; private vatLid: THREE.Mesh; private geyser: THREE.Mesh; private geyserFoam: THREE.Mesh;
  private vatSmallL: THREE.Group; private vatSmallR: THREE.Group;
  private concreteL: THREE.Group; private concreteR: THREE.Group;
  private waveFront: THREE.Mesh; private waveRoller: THREE.Mesh; private waveCrest: THREE.Mesh; private flood: THREE.Mesh;
  private sodaBottle: THREE.Mesh; private sodaCap: THREE.Mesh; private sodaFoam: THREE.Mesh;
  private table: THREE.Group;

  constructor() {
    const R = this.root, M: Mats = {};
    // ---- sky + light ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.fill = new THREE.DirectionalLight("#9fb8ff", 0.35);
    R.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- ground + street (static batch) ----
    const b = new Batch();
    M.cobble = lam("cobbleHD", () => ({ map: cobbleHD() }));
    M.dirt = lam("dirtHD", () => ({ color: "#b89a6a" }));
    M.wall = lam("wallHD", () => ({ map: stoneHD("wallHD", ["#c9bcaa", "#bfb19f", "#d1c5b4", "#b8aa97"], "#958776") }));
    M.brickM = lam("brickM", () => ({ map: brick() }));
    M.iron = twoTone(new THREE.MeshPhongMaterial({ color: "#3d414c", specular: "#8a8a8a", shininess: 60 }), 0.15);
    M.wood = lam("wood", () => ({ map: planksHD() }));
    M.beer = lam("beer", () => ({ color: "#8a5a1a" }));
    M.foam = lam("foam", () => ({ color: "#f2e6c8" }));
    M.concrete = lam("concrete", () => ({ color: "#9a938a" }));
    M.glass = lam("glass", () => ({ color: "#16331f" }));
    // street along z, sidewalks, and the far ground
    b.add(quadUp(-6, 6, -44, 44, 3, 22, 0.0), M.cobble);
    b.add(quadUp(-9.5, -6, -44, 44, 1.75, 22, 0.012), M.cobble);
    b.add(quadUp(6, 9.5, -44, 44, 1.75, 22, 0.012), M.cobble);
    b.add(quadUp(-300, 300, -44, -300, 150, 64, -0.05), M.dirt);
    b.add(quadUp(-300, 300, 44, 300, 150, 64, -0.05), M.dirt);
    b.add(quadUp(-300, -9.5, -44, 44, 72, 22, -0.05), M.dirt);
    b.add(quadUp(9.5, 300, -44, 44, 72, 22, -0.05), M.dirt);
    // brewery building at the far end (brick, big gabled house + chimney)
    house(b, 0, -44, 0, 18, 9, 10, 7, 0);
    b.add(boxGeo(V(6.5, 0, -46.5), V(7.5, 13, -45.5), 2), M.brickM);
    // yard wall with a gate gap at the street
    b.add(boxGeo(V(-9.5, 0, -37.5), V(-3, 2.2, -37), 2), M.wall);
    b.add(boxGeo(V(3, 0, -37.5), V(9.5, 2.2, -37), 2), M.wall);
    // houses along both sides of the street, fronts facing the street
    const styles = [0, 1, 2, 3, 4, 5, 6, 7];
    for (const side of [-1, 1]) {
      let z = -34, k = 0;
      while (z < 32) {
        const w = 6 + (k % 3), d = 6 + ((k + 1) % 2), h = 5 + (k % 3);
        house(b, side * 9.5, z, side < 0 ? Math.PI / 2 : -Math.PI / 2, w, d, h, styles[(k + (side > 0 ? 3 : 0)) % 8], 0);
        z += d + 1.5; k++;
      }
    }
    b.build(R);

    // ---- vats (dynamic groups) ----
    const makeVat = (r: number, h: number, wood: THREE.Material, iron: THREE.Material): THREE.Group => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), wood);
      body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true;
      g.add(body);
      for (const hy of [h * 0.18, h * 0.5, h * 0.82]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(r + 0.03, 0.09, 8, 32), iron);
        hoop.rotation.x = Math.PI / 2; hoop.position.y = hy; hoop.castShadow = true;
        g.add(hoop);
      }
      return g;
    };
    this.vatBig = makeVat(2.3, 6.7, M.wood, M.iron);
    this.vatBig.position.set(VAT_BIG[0], VAT_BIG[1], VAT_BIG[2]);
    this.vatBigBody = this.vatBig.children[0] as THREE.Mesh;
    this.vatLid = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.18, 24), M.wood);
    this.vatLid.position.set(VAT_BIG[0], 6.75, VAT_BIG[2]); this.vatLid.castShadow = true;
    this.geyser = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 1, 20), M.beer);
    this.geyser.position.set(VAT_BIG[0], 0.5, VAT_BIG[2]); this.geyser.visible = false;
    this.geyserFoam = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), M.foam);
    this.geyserFoam.position.set(VAT_BIG[0], 1, VAT_BIG[2]); this.geyserFoam.visible = false;
    this.vatSmallL = makeVat(1.6, 5.0, M.wood, M.iron);
    this.vatSmallL.position.set(VAT_L[0], VAT_L[1], VAT_L[2]);
    this.vatSmallR = makeVat(1.6, 5.0, M.wood, M.iron);
    this.vatSmallR.position.set(VAT_R[0], VAT_R[1], VAT_R[2]);
    // concrete replacement vats (shot 10-11: the new rule)
    const makeConcrete = (x: number, z: number): THREE.Group => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 4.2, 20), M.concrete);
      body.position.y = 2.1; body.castShadow = true; body.receiveShadow = true;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.82, 0.08, 8, 28), M.iron);
      rim.rotation.x = Math.PI / 2; rim.position.y = 4.2;
      g.add(body, rim); g.position.set(x, 0, z); g.visible = false;
      return g;
    };
    this.concreteL = makeConcrete(-3.5, -30);
    this.concreteR = makeConcrete(4.0, -30);
    R.add(this.vatBig, this.vatLid, this.geyser, this.geyserFoam, this.vatSmallL, this.vatSmallR, this.concreteL, this.concreteR);

    // ---- the wave + flood (hidden until the burst) ----
    // the wave front is a box with a rounded foam roller on its top front edge, so it reads as a wave, not a wall
    this.waveFront = new THREE.Mesh(new THREE.BoxGeometry(11, 1, 2.6), M.beer);
    this.waveFront.castShadow = true; this.waveFront.visible = false;
    this.waveRoller = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 11, 16), M.foam);
    this.waveRoller.rotation.z = Math.PI / 2; this.waveRoller.visible = false;
    this.waveCrest = new THREE.Mesh(new THREE.BoxGeometry(11, 0.5, 0.9), M.foam);
    this.waveCrest.visible = false;
    this.flood = new THREE.Mesh(new THREE.BoxGeometry(11, 0.1, 1), M.beer);
    this.flood.position.y = 0.05; this.flood.visible = false;
    R.add(this.waveFront, this.waveRoller, this.waveCrest, this.flood);

    // ---- soda table (shot 9) ----
    this.table = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.9), M.wood);
    top.position.y = 0.75; top.castShadow = true; top.receiveShadow = true;
    this.table.add(top);
    for (const [lx, lz] of [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]] as const) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.08), M.wood);
      leg.position.set(lx, 0.375, lz); this.table.add(leg);
    }
    this.table.position.set(SODA_TABLE[0], SODA_TABLE[1], SODA_TABLE[2]);
    this.sodaBottle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.24, 12), M.glass);
    this.sodaBottle.position.set(SODA_TABLE[0], 0.79 + 0.12, SODA_TABLE[2]); this.sodaBottle.castShadow = true;
    this.sodaCap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 10), M.iron);
    this.sodaCap.position.set(SODA_TABLE[0], 0.79 + 0.27, SODA_TABLE[2]);
    this.sodaFoam = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), M.foam);
    this.sodaFoam.position.set(SODA_TABLE[0], 1.05, SODA_TABLE[2]); this.sodaFoam.visible = false;
    R.add(this.table, this.sodaBottle, this.sodaCap, this.sodaFoam);
  }

  /** camera-relative sun, frozen per shot: the shot's mean view direction turned by az toward screen right, lifted by el */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(L.az), el = THREE.MathUtils.degToRad(L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], tau = s.tau(t), L = LIGHTS[s.light];
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig: camera-relative sun frozen per shot, two-tone uniforms, shadow fit ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    if (s.light === "golden") Rr = Math.max(Rr, 30);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    this.fill.intensity = 0;
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK[s.light].bounce); TONE.uSat.value = LOOK[s.light].sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, sun disc + halo, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    setLightName(s.light);
    // ---- the big vat: intact until the burst, then it collapses and the lid flies off ----
    const intact = vatIntact(tau);
    const tb = Math.max(0, tau - BURST); // seconds since the burst
    this.vatBig.visible = id < 10 || intact === 1; // shots 10-11: the brewery is rebuilt (concrete vats instead)
    this.vatLid.visible = id < 10; // the lid is cleared away with the wreckage before the rebuild
    if (intact === 1) {
      // pressure: the vat shudders as the hoops slip (amplitude grows with pressure)
      const p = pressure(tau), sh = p * 0.05 * Math.sin(t * 9);
      this.vatBig.position.x = VAT_BIG[0] + sh;
      this.vatBigBody.scale.set(1 + p * 0.015 * Math.sin(t * 7), 1, 1 + p * 0.015 * Math.cos(t * 7));
      this.vatLid.position.set(VAT_BIG[0] + sh, 6.75, VAT_BIG[2]);
      this.vatLid.rotation.set(0, 0, 0);
      this.geyser.visible = this.geyserFoam.visible = false;
    } else {
      this.vatBig.position.x = VAT_BIG[0];
      this.vatBigBody.scale.set(1, Math.max(0.25, 1 - tb * 2), 1);
      // the lid: ballistic flight up and back-left into the brewery, spinning, then it lands and stays on the ground
      const tl = tb, ly = 6.75 + 5.5 * tl - 4.9 * tl * tl;
      const landed = ly <= 0.12;
      this.vatLid.position.set(VAT_BIG[0] - 2.0 * Math.min(tl, 1.35), landed ? 0.12 : ly, VAT_BIG[2] - 2.0 * Math.min(tl, 1.35));
      const tr = Math.min(tl, 1.35);
      this.vatLid.rotation.set(landed ? Math.PI / 2 - 0.2 : tr * 6, tr * 3, tr * 2);
      // the geyser: shoots up in the first second, then subsides over ~4 s
      const gh = tb < 1 ? tb * 8 : Math.max(0, 8 - (tb - 1) * 2.5);
      this.geyser.visible = gh > 0.1;
      this.geyser.scale.y = Math.max(0.1, gh);
      this.geyser.position.y = gh / 2;
      this.geyserFoam.visible = gh > 0.1;
      this.geyserFoam.position.y = gh + 0.2;
      this.geyserFoam.scale.set(1.3, 0.5, 1.3).multiplyScalar(Math.max(0.4, 1 - tb * 0.15));
    }
    // small wooden vats vs concrete replacements (shots 10-11)
    const rebuilt = id >= 10;
    this.vatSmallL.visible = this.vatSmallR.visible = !rebuilt;
    this.concreteL.visible = this.concreteR.visible = rebuilt;
    // ---- the wave + flood ----
    // shot 1 is a flash-forward: it shows the wave as it will look mid-flood (front at z ~ -8, 3.5 m high),
    // even though the burst has not happened yet in story time. The flood only exists in shots 6-8 (and the hook);
    // shots 9-11 are other places/times (the analogy, the rebuild, the callback) and the street is dry there.
    const hookWave = id === 1;
    const flooding = tau > BURST || hookWave;
    this.waveFront.visible = this.waveRoller.visible = this.waveCrest.visible = flooding && id <= 8;
    this.flood.visible = flooding && (id === 6 || id === 7 || id === 8 || hookWave);
    if (flooding) {
      const wz = hookWave ? -8 : waveZ(tau), wh = hookWave ? 3.5 : waveH(tau);
      this.waveFront.scale.y = Math.max(0.2, wh);
      this.waveFront.position.set(0, wh / 2, wz);
      this.waveRoller.position.set(0, wh + 0.4, wz + 1.2);
      this.waveCrest.position.set(0, wh + 0.15, wz + 1.1);
      const len = Math.max(1, wz - WAVE_Z0);
      this.flood.scale.z = len;
      this.flood.position.set(0, 0.05, WAVE_Z0 + len / 2);
    }
    // ---- the soda bottle: shaken, then the cap pops (only on screen in shot 9) ----
    const sodaShot = id === 9;
    const shaking = sodaShot && tau >= SODA_SHAKE0 && tau < SODA_POP;
    this.table.visible = this.sodaBottle.visible = this.sodaCap.visible = sodaShot;
    this.sodaBottle.rotation.z = shaking ? 0.12 * Math.sin(t * 14) : 0;
    this.sodaBottle.position.x = SODA_TABLE[0] + (shaking ? 0.01 * Math.sin(t * 14) : 0);
    if (sodaShot && tau >= SODA_POP) {
      const tp = Math.min(tau - SODA_POP, 1.0);
      this.sodaCap.position.set(SODA_TABLE[0] + 0.4 * tp, 1.18 + 2.2 * tp - 4.9 * tp * tp, SODA_TABLE[2] + 0.2 * tp);
      this.sodaCap.rotation.set(tp * 8, tp * 5, 0);
      this.sodaFoam.visible = tau < SODA_POP + 2;
      this.sodaFoam.scale.setScalar(1 + (tau - SODA_POP) * 0.8);
      this.sodaFoam.position.y = 1.05 + (tau - SODA_POP) * 0.2;
    } else {
      this.sodaCap.position.set(SODA_TABLE[0], 0.79 + 0.27, SODA_TABLE[2]);
      this.sodaCap.rotation.set(0, 0, 0);
      this.sodaFoam.visible = false;
    }
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stageBeer(id, t, { pos: cam.position, right, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const tint = s.light === "golden" ? "#ffcf9e" : "#ffffff";
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      if (a.mat.emissiveMap) a.mat.emissive.set(tint);
      a.mesh.castShadow = false;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e = this.fx(fi++);
      e.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e.use(!!p.soft);
      e.mesh.visible = true;
      e.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e.mesh.quaternion.copy(cam.quaternion); e.mesh.rotateZ(p.rot ?? 0); }
      e.mesh.scale.set(p.w, p.h, 1);
      fused.push(e);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e of fused) e.bind();
    return focus;
  }
}
