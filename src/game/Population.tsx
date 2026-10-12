// @ts-nocheck
// Kingdom population: townsfolk with roles, livestock, horse-drawn carts. Instanced for performance.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { getGame } from "./state";
import { K_CX, K_CZ, hash2 } from "./world";

const N_PEOPLE = 160, N_CARTS = 18;
// role: [shirt, legs, hat|null, speed, label]
const ROLES = [
  ["#7a3b22", "#3a2a1c", null, 0.0], // blacksmith (apron)
  ["#c9b48a", "#5a4632", "#e8e2d0", 0.0], // baker (white cap)
  ["#2f4f7f", "#3b3b3b", "#8a1c1c", 0.0], // merchant
  ["#6b6e72", "#4a4a4a", "#9aa0a6", 0.6], // guard (steel)
  ["#1d1d1d", "#1d1d1d", null, 0.5], // priest
  ["#6f7d3a", "#5a4a2a", "#c8a25a", 0.0], // farmer (straw hat)
  ["#8e5a7a", "#6a3e58", null, 1.1], // townswoman
  ["#5d6b4c", "#4b3a28", "#5a4632", 1.2], // townsman
  ["#b0563a", "#47603a", null, 1.6], // child
  ["#4a3a6a", "#2b2b3b", "#2b2b3b", 0.9], // noble
];
const SKIN = ["#e8c4a0", "#c99872", "#8d5a3b", "#f1d3b6"];
const PASTURES = [[63, -45], [81, -45], [63, -63], [81, 45]];
const FARMS = [[63, -9], [63, 9], [63, -27], [63, 27], [81, -27], [81, 27], [63, 45], [63, 63], [81, -63]];
const STALLS = [[-45, -9], [-45, 9], [-45, -27]];
const SMITHS = [[-45, -45], [-63, -9], [-81, 27]];
const BAKERS = [[-27, 45], [-9, 81], [45, 9]];
// animal: [body, head, sx, sy, sz, legH, speed]
const ANIMALS = [
  ["#6b4a2e", "#5a3c24", 0.5, 0.55, 1.3, 0.7, 0.8], // horse
  ["#efe9de", "#2a2420", 0.55, 0.55, 1.1, 0.5, 0.4], // cow
  ["#eae4d4", "#3a3430", 0.5, 0.45, 0.75, 0.35, 0.4], // sheep
  ["#d8c8a8", "#c43a2a", 0.22, 0.22, 0.28, 0.12, 0.6], // chicken
  ["#c27a3a", "#a86630", 0.18, 0.18, 0.42, 0.14, 0.9], // cat
];

type Agent = { x: number; z: number; tx: number; tz: number; yaw: number; sp: number; kind: number; mode: number; ax: number; az: number; r: number; wait: number; phase: number; s: number; col: number };

export function Population() {
  const g = getGame();
  const Y = g.world.kingdomGround() + 1;
  const rand = (() => { let i = 1; return () => hash2(i++, 77, g.world.seed ?? 1); })();
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const node = () => {
    let a, b;
    do { a = (Math.floor(rand() * 11) - 5) * 18; b = (Math.floor(rand() * 11) - 5) * 18; } while (Math.max(Math.abs(a), Math.abs(b)) < 36);
    return [a, b];
  };

  const { people, animals, carts } = useMemo(() => {
    const people: Agent[] = [];
    const add = (kind, x, z, mode, r = 0) => people.push({ x, z, tx: x, tz: z, yaw: rand() * 6.28, sp: ROLES[kind][3] || 0.5, kind, mode, ax: x, az: z, r, wait: rand() * 3, phase: rand() * 6, s: kind === 8 ? 0.65 : 0.92 + rand() * 0.12, col: Math.floor(rand() * 4) });
    for (const [u, v] of SMITHS) for (let i = 0; i < 3; i++) add(0, u - 3 + i * 2, v - 3, 1, 2);
    for (const [u, v] of BAKERS) for (let i = 0; i < 2; i++) add(1, u + i * 2, v, 1, 2);
    for (const [u, v] of STALLS) for (let i = 0; i < 6; i++) add(2, u - 6 + (i % 3) * 5, v + (i < 3 ? -4 : 5), 1, 1);
    for (const [u, v] of STALLS) for (let i = 0; i < 6; i++) add(i % 2 ? 6 : 7, u, v, 1, 6);
    for (const [u, v] of FARMS) for (let i = 0; i < 2; i++) add(5, u - 3 + rand() * 6, v - 3 + rand() * 6, 1, 5);
    for (let i = 0; i < 3; i++) add(4, 9 + i, 45, 1, 3); // priest & acolytes
    for (const d of [-1, 1]) for (const s of [-1, 1]) { add(3, d * 97, s * 2.5, 2); add(3, s * 2.5, d * 97, 2); } // gate sentries
    for (const d of [-1, 1]) { add(3, d * 22 + d * 2, -4, 2); add(3, d * 22 + d * 2, 4, 2); } // citadel gates
    while (people.length < N_PEOPLE) {
      const k = rand() < 0.12 ? 3 : pick([6, 7, 6, 7, 8, 9, 6, 7]);
      const [a, b] = node();
      add(k, a, b, 0);
    }
    const animals: Agent[] = [];
    const addA = (kind, x, z, r) => animals.push({ x, z, tx: x, tz: z, yaw: rand() * 6.28, sp: ANIMALS[kind][6], kind, mode: 1, ax: x, az: z, r, wait: rand() * 4, phase: rand() * 6, s: 1, col: 0 });
    for (const [u, v] of PASTURES) { for (let i = 0; i < 4; i++) addA(1, u, v, 5); for (let i = 0; i < 4; i++) addA(2, u, v, 5); }
    for (const [u, v] of [[27, -45], [-27, -63]]) for (let i = 0; i < 4; i++) addA(0, u, v, 4); // stables
    for (const [u, v] of FARMS) for (let i = 0; i < 3; i++) addA(3, u, v, 5);
    for (let i = 0; i < 10; i++) { const [a, b] = node(); addA(4, a + 4, b + 4, 6); }
    const carts: Agent[] = [];
    for (let i = 0; i < N_CARTS; i++) { const [a, b] = node(); carts.push({ x: a, z: b, tx: a, tz: b, yaw: 0, sp: 1.4, kind: i % 3, mode: 0, ax: 0, az: 0, r: 0, wait: rand() * 5, phase: 0, s: 1, col: 0 }); }
    return { people, animals, carts };
  }, []);

  const parts = useMemo(() => {
    const mk = (n, w, h, d, y = 0) => { const geo = new THREE.BoxGeometry(w, h, d); geo.translate(0, y, 0); const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), n); m.castShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); return m; };
    const P = people.length, A = animals.length, C = carts.length;
    return {
      legL: mk(P, 0.17, 0.75, 0.2, -0.375), legR: mk(P, 0.17, 0.75, 0.2, -0.375),
      torso: mk(P, 0.46, 0.68, 0.26), armL: mk(P, 0.13, 0.62, 0.15, -0.31), armR: mk(P, 0.13, 0.62, 0.15, -0.31),
      head: mk(P, 0.3, 0.32, 0.3), hat: mk(P, 0.42, 0.1, 0.42),
      aBody: mk(A + C, 1, 1, 1), aHead: mk(A + C, 1, 1, 1), aLegs: mk(A + C, 1, 1, 1, -0.5),
      bed: mk(C, 1.4, 0.5, 2.2), wheel: mk(C * 2, 0.15, 0.9, 0.9), load: mk(C, 1.1, 0.6, 1.6),
    };
  }, []);

  useMemo(() => {
    const c = new THREE.Color();
    people.forEach((p, i) => {
      const r = ROLES[p.kind];
      parts.torso.setColorAt(i, c.set(r[0])); parts.armL.setColorAt(i, c.set(r[0])); parts.armR.setColorAt(i, c.set(r[0]));
      parts.legL.setColorAt(i, c.set(r[1])); parts.legR.setColorAt(i, c.set(r[1]));
      parts.head.setColorAt(i, c.set(SKIN[p.col])); parts.hat.setColorAt(i, c.set(r[2] ?? "#3a2a1c"));
    });
    const all = [...animals.map((a) => a.kind), ...carts.map(() => 0)];
    all.forEach((k, i) => { const a = ANIMALS[k]; parts.aBody.setColorAt(i, c.set(a[0])); parts.aHead.setColorAt(i, c.set(a[1])); parts.aLegs.setColorAt(i, c.set(a[1])); });
    carts.forEach((ct, i) => { parts.bed.setColorAt(i, c.set("#7a5634")); parts.load.setColorAt(i, c.set(["#c8a25a", "#8a6a3a", "#e0d8c0"][ct.kind])); parts.wheel.setColorAt(i * 2, c.set("#3a2a1c")); parts.wheel.setColorAt(i * 2 + 1, c.set("#3a2a1c")); });
  }, []);

  const o = useMemo(() => new THREE.Object3D(), []);
  const q = useMemo(() => new THREE.Object3D(), []);
  const t = useRef(0);

  const steer = (a: Agent, dt, street) => {
    const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
    if (d < 0.2) {
      a.wait -= dt;
      if (a.wait > 0) return false;
      if (street) {
        const step = rand() < 0.5 ? [18, 0] : [0, 18], s = rand() < 0.5 ? -1 : 1;
        let nx = Math.round(a.x / 18) * 18 + step[0] * s, nz = Math.round(a.z / 18) * 18 + step[1] * s;
        if (Math.abs(nx) > 90 || Math.abs(nz) > 90 || Math.max(Math.abs(nx), Math.abs(nz)) < 36) { nx = Math.round(a.x / 18) * 18; nz = Math.round(a.z / 18) * 18; }
        const lane = a.mode === 0 && street === 1 ? (rand() - 0.5) * 3 : 0;
        a.tx = nx + (step[1] ? lane : 0); a.tz = nz + (step[0] ? lane : 0);
        a.wait = street === 2 ? rand() * 4 : rand() * 1.5;
      } else if (a.r > 0) {
        a.tx = a.ax + (rand() - 0.5) * 2 * a.r; a.tz = a.az + (rand() - 0.5) * 2 * a.r; a.wait = 1 + rand() * 5;
      } else { a.wait = 2 + rand() * 4; a.yaw += (rand() - 0.5) * 1.5; }
      return false;
    }
    const v = Math.min(d, a.sp * dt);
    a.x += (dx / d) * v; a.z += (dz / d) * v;
    const ty = Math.atan2(dx, dz); let dy = ty - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * Math.min(1, dt * 6);
    return true;
  };

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05); t.current += dt;
    const px = g.pos.x - K_CX, pz = g.pos.z - K_CZ;
    people.forEach((p, i) => {
      const near = Math.abs(p.x - px) < 70 && Math.abs(p.z - pz) < 70;
      const moving = near && p.mode !== 2 ? steer(p, dt, p.mode === 0 ? 1 : 0) : false;
      if (p.mode === 1 && p.sp === 0) p.sp = 0.5;
      const sw = moving ? Math.sin(t.current * 7 * (p.sp / 1.1 + 0.3) + p.phase) * 0.6 : p.kind <= 1 ? Math.max(0, Math.sin(t.current * 4 + p.phase)) * -1.2 : 0;
      const s = p.s, hip = 0.75 * s;
      const base = (yOff, xOff, zOff) => { o.position.set(K_CX + p.x + Math.cos(p.yaw) * xOff * s, Y + yOff * s, K_CZ + p.z - Math.sin(p.yaw) * xOff * s); o.rotation.set(0, p.yaw, 0); o.scale.setScalar(s); };
      const put = (m, yOff, xOff, rx) => { base(yOff, xOff, 0); o.rotateX(rx); o.updateMatrix(); m.setMatrixAt(i, o.matrix); };
      put(parts.legL, 0.75, -0.1, sw); put(parts.legR, 0.75, 0.1, -sw);
      put(parts.torso, 1.09, 0, 0);
      put(parts.armL, 1.4, -0.3, -sw * (p.kind <= 1 ? 1 : 0.8)); put(parts.armR, 1.4, 0.3, p.kind <= 1 ? sw : sw * 0.8);
      put(parts.head, 1.6, 0, 0);
      if (ROLES[p.kind][2]) put(parts.hat, 1.8, 0, 0); else { o.scale.setScalar(0); o.updateMatrix(); parts.hat.setMatrixAt(i, o.matrix); }
      void hip;
    });
    const animalPut = (i, kind, x, z, yaw, moving, ph) => {
      const a = ANIMALS[kind], bob = moving ? Math.abs(Math.sin(t.current * 8 + ph)) * 0.05 : 0;
      const by = Y + a[5] + a[3] / 2 + bob;
      o.position.set(x, by, z); o.rotation.set(0, yaw, 0); o.scale.set(a[2], a[3], a[4]); o.updateMatrix(); parts.aBody.setMatrixAt(i, o.matrix);
      o.position.set(x, Y + a[5], z); o.scale.set(a[2] * 0.85, a[5], a[4] * 0.8); o.updateMatrix(); parts.aLegs.setMatrixAt(i, o.matrix);
      const hs = a[2] * 0.7, graze = !moving && kind <= 2 && Math.sin(t.current * 0.7 + ph) > 0.3 ? -a[3] * 0.6 : a[3] * (kind === 0 ? 0.7 : 0.35);
      o.position.set(x + Math.sin(yaw) * a[4] * 0.6, by + graze, z + Math.cos(yaw) * a[4] * 0.6); o.scale.set(hs, hs, hs * (kind === 0 ? 1.6 : 1.1)); o.updateMatrix(); parts.aHead.setMatrixAt(i, o.matrix);
    };
    animals.forEach((a, i) => {
      const near = Math.abs(a.x - px) < 70 && Math.abs(a.z - pz) < 70;
      const mv = near ? steer(a, dt, 0) : false;
      animalPut(i, a.kind, K_CX + a.x, K_CZ + a.z, a.yaw, mv, a.phase);
    });
    carts.forEach((c, j) => {
      const mv = steer(c, dt, 2);
      const i = animals.length + j, fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      const cx = K_CX + c.x, cz = K_CZ + c.z;
      animalPut(i, 0, cx + fx * 1.4, cz + fz * 1.4, c.yaw, mv, j);
      q.position.set(cx - fx * 1.0, Y + 0.75, cz - fz * 1.0); q.rotation.set(0, c.yaw, 0); q.scale.setScalar(1); q.updateMatrix(); parts.bed.setMatrixAt(j, q.matrix);
      q.position.y = Y + 1.25; q.updateMatrix(); parts.load.setMatrixAt(j, q.matrix);
      for (const s of [0, 1]) {
        const sx = (s ? 1 : -1) * 0.78;
        q.position.set(cx - fx * 1.0 + fz * sx, Y + 0.45, cz - fz * 1.0 - fx * sx); q.rotation.set(0, c.yaw, 0); if (mv) q.rotateX(t.current * 3); q.updateMatrix(); parts.wheel.setMatrixAt(j * 2 + s, q.matrix);
      }
    });
    for (const m of Object.values(parts)) m.instanceMatrix.needsUpdate = true;
  });

  return <>{Object.values(parts).map((m, i) => <primitive key={i} object={m} />)}</>;
}
