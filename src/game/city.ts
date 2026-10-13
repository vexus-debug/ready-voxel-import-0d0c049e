// @ts-nocheck
// Modern metropolis (inspired by CityMod): skyscraper core, offices, apartment blocks,
// historical shopfronts, parks, asphalt avenues with lane markings and crosswalks.
// Built once into a local grid (u,v in -R..R, h = height above ground) then stamped per chunk.
import { B } from "./blocks";
import { hash2 } from "./world";

export const C_R = 110; // local radius of the city footprint
export const C_Y = 38; // max build height above ground
const N = C_R * 2 + 1;
export const CAIR = 255;
const BLK = 24, ROAD = 6; // grid pitch and road width

export function buildCity(seed: number): Uint8Array {
  const g = new Uint8Array(N * N * C_Y);
  const set = (u, h, v, id) => {
    if (u < -C_R || u > C_R || v < -C_R || v > C_R || h < 0 || h >= C_Y) return;
    g[((h * N) + (v + C_R)) * N + (u + C_R)] = id === 0 ? CAIR : id;
  };
  const rnd = (a, b) => hash2(a, b, seed + 4421);
  const box = (u0, u1, h0, h1, v0, v1, id) => { for (let h = h0; h <= h1; h++) for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) set(u, h, v, id); };
  const mod = (a) => (((a + 12) % BLK) + BLK) % BLK; // 0..ROAD-1 = road

  // ---------- ground: asphalt roads, concrete sidewalks, markings ----------
  for (let v = -C_R; v <= C_R; v++)
    for (let u = -C_R; u <= C_R; u++) {
      const mu = mod(u), mv = mod(v);
      const ru = mu < ROAD, rv = mv < ROAD;
      let id = B.CONCRETE;
      if (ru || rv) {
        id = B.ASPHALT;
        const inter = ru && rv;
        if (!inter) {
          // dashed centre line
          if (ru && (mu === 2 || mu === 3) && ((v & 7) < 4)) id = B.ROAD_LINE;
          if (rv && (mv === 2 || mv === 3) && ((u & 7) < 4)) id = B.ROAD_LINE;
          // zebra crosswalks next to each intersection
          if (ru && (mv === ROAD || mv === BLK - 1) && (u & 1)) id = B.ROAD_LINE;
          if (rv && (mu === ROAD || mu === BLK - 1) && (v & 1)) id = B.ROAD_LINE;
        }
      }
      set(u, 0, v, id);
      // clear everything above so terrain/trees never poke through
      for (let h = 1; h < C_Y; h++) set(u, h, v, 0);
    }
  // street lights on sidewalk corners
  for (let a = -C_R; a <= C_R; a++) for (let b = -C_R; b <= C_R; b++) {
    if (mod(a) === ROAD && mod(b) === ROAD) { box(a, a, 1, 4, b, b, B.STEEL); set(a, 5, b, B.LANTERN); }
  }

  // ---------- building primitives ----------
  // facade with window grid; interiors solid except a hollow ground-floor lobby
  const tower = (u0, v0, w, d, hgt, wall, win, opts = {}) => {
    const { glass = false, band = B.STEEL, lobby = true, setback = 0 } = opts;
    for (let h = 1; h <= hgt; h++) {
      const sb = setback && h > hgt * 0.65 ? setback : 0;
      const a0 = u0 + sb, a1 = u0 + w - 1 - sb, b0 = v0 + sb, b1 = v0 + d - 1 - sb;
      for (let v = b0; v <= b1; v++) for (let u = a0; u <= a1; u++) {
        const eu = u === a0 || u === a1, ev = v === b0 || v === b1;
        if (!eu && !ev) { set(u, h, v, lobby && h <= 3 ? 0 : wall); continue; }
        const t = ev ? u - a0 : v - b0;
        let id = wall;
        if (eu && ev) id = band;
        else if (glass) id = h % 4 === 0 || t % 4 === 0 ? band : win;
        else if (h % 4 !== 0 && h % 4 !== 1 && t % 3 !== 0) id = win;
        if (h === 1 && t > 0 && (glass || t % 2)) id = win; // shop windows
        set(u, h, v, id);
      }
      if (h === hgt) box(a0, a1, h + 1, h + 1, b0, b1, B.CONCRETE); // roof slab
    }
    // entrance doors on both street sides
    const du = u0 + (w >> 1);
    for (const dv of [v0, v0 + d - 1]) { set(du, 1, dv, B.DOOR); set(du, 2, dv, B.DOOR); set(du - 1, 3, dv, B.LANTERN); }
    return hgt + 1;
  };
  const helipad = (cu, cv, top) => {
    box(cu - 3, cu + 3, top + 1, top + 1, cv - 3, cv + 3, B.ASPHALT);
    for (const [a, b] of [[-1, -2], [-1, -1], [-1, 0], [-1, 1], [-1, 2], [1, -2], [1, -1], [1, 0], [1, 1], [1, 2], [0, 0]]) set(cu + a, top + 1, cv + b, B.ROAD_LINE);
  };
  const antenna = (cu, cv, top, len) => { box(cu, cu, top + 1, top + len, cv, cv, B.STEEL); set(cu, top + len + 1, cv, B.LANTERN); };
  const tree = (u, v) => {
    const th = 3 + Math.floor(rnd(u, v) * 2);
    box(u, u, 1, th, v, v, B.LOG);
    for (let dh = -1; dh <= 1; dh++) for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++)
      if (a * a + b * b + dh * dh * 2 <= 5) set(u + a, th + 1 + dh, v + b, B.LEAVES);
  };

  // ---------- lots ----------
  const LOT0 = ROAD + 1, LOTW = BLK - ROAD - 2; // 1-block sidewalk margin each side
  for (let gv = -5; gv <= 4; gv++) for (let gu = -5; gu <= 4; gu++) {
    const u0 = gu * BLK - 12 + LOT0, v0 = gv * BLK - 12 + LOT0;
    if (u0 < -C_R + 2 || v0 < -C_R + 2 || u0 + LOTW > C_R - 1 || v0 + LOTW > C_R - 1) continue;
    const dist = Math.max(Math.abs(gu + 0.5), Math.abs(gv + 0.5)); // 0.5 = core
    const r = rnd(gu * 31, gv * 17), r2 = rnd(gu * 7 + 3, gv * 11 + 5);
    if ((gu === 0 && gv === 0) || r < 0.1) {
      // park: grass, trees, fountain
      box(u0, u0 + LOTW - 1, 0, 0, v0, v0 + LOTW - 1, B.GRASS);
      box(u0, u0 + LOTW - 1, 0, 0, v0 + (LOTW >> 1) - 1, v0 + (LOTW >> 1), B.CONCRETE);
      box(u0 + (LOTW >> 1) - 1, u0 + (LOTW >> 1), 0, 0, v0, v0 + LOTW - 1, B.CONCRETE);
      const c = LOTW >> 1;
      box(u0 + c - 3, u0 + c + 2, 1, 1, v0 + c - 3, v0 + c + 2, B.CONCRETE);
      box(u0 + c - 2, u0 + c + 1, 1, 1, v0 + c - 2, v0 + c + 1, B.WATER);
      for (const [a, b] of [[3, 3], [LOTW - 4, 3], [3, LOTW - 4], [LOTW - 4, LOTW - 4]]) tree(u0 + a, v0 + b);
      continue;
    }
    if (dist <= 1.5) {
      // financial core: glass skyscrapers
      const hgt = Math.round(24 + r2 * 10 - dist * 2);
      const top = tower(u0 + 1, v0 + 1, LOTW - 2, LOTW - 2, hgt, B.STEEL, B.OFFICE_WINDOW, { glass: true, setback: r > 0.5 ? 2 : 0 });
      const c = (LOTW >> 1);
      if (r2 > 0.55) helipad(u0 + c, v0 + c, top); else antenna(u0 + c, v0 + c, top, 3 + Math.floor(r * 3));
    } else if (dist <= 3) {
      // offices & modern apartments
      const kind = Math.floor(r2 * 3);
      if (kind === 0) tower(u0 + 1, v0 + 1, LOTW - 2, LOTW - 2, 14 + Math.floor(r * 8), B.CONCRETE, B.OFFICE_WINDOW, { glass: true, band: B.CONCRETE });
      else if (kind === 1) { // twin apartment slabs with balconies
        for (const s of [0, 1]) {
          const a = u0 + s * (LOTW >> 1);
          const hgt = 11 + Math.floor(rnd(a, v0) * 8);
          tower(a, v0 + 1, (LOTW >> 1) - 1, LOTW - 2, hgt, B.PLASTER, B.OFFICE_WINDOW);
          for (let h = 4; h <= hgt; h += 4) for (let v = v0 + 3; v < v0 + LOTW - 3; v += 3) { set(a - 1, h, v, B.CONCRETE); set(a + (LOTW >> 1) - 1, h, v, B.CONCRETE); }
        }
      } else tower(u0 + 1, v0 + 1, LOTW - 2, LOTW - 2, 12 + Math.floor(r * 6), B.BRICK, B.OFFICE_WINDOW, { band: B.CONCRETE });
    } else {
      // outer ring: historical townhouses with ground-floor shops, row along both streets
      const n = 3, w = Math.floor(LOTW / n);
      for (let i = 0; i < n; i++) for (const side of [0, 1]) {
        const a = u0 + i * w, b = side ? v0 + LOTW - 6 : v0;
        const hh = 6 + Math.floor(rnd(a, b) * 6);
        const mat = [B.BRICK, B.PLASTER, B.STONE_BRICK][Math.floor(rnd(b, a) * 3)];
        tower(a, b, w - 1, 6, hh, mat, B.OFFICE_WINDOW, { band: B.CONCRETE, lobby: true });
        // cornice / awning
        box(a - 1, a + w - 1, 4, 4, side ? b + 6 : b - 1, side ? b + 6 : b - 1, B.TIMBER);
      }
      // courtyard trees
      tree(u0 + (LOTW >> 1), v0 + (LOTW >> 1));
    }
  }
  return g;
}

export function cityAt(g: Uint8Array, u: number, h: number, v: number) {
  if (u < -C_R || u > C_R || v < -C_R || v > C_R || h < 0 || h >= C_Y) return 0;
  return g[((h * N) + (v + C_R)) * N + (u + C_R)];
}
