import type { World } from "./world";
import { CASTLE_SIZE } from "./castleData";

export type LandmarkKind = "castle" | "spawn" | "village" | "tower" | "ruin";
export interface Landmark { id: string; name: string; kind: LandmarkKind; x: number; z: number }

/** Registry of map landmarks. Add future castles, villages, towers here. */
export function getLandmarks(world: World): Landmark[] {
  const [ox, , oz] = world.castleOrigin();
  const [sx, , sz] = world.castleSpawn();
  return [
    { id: "citadel", name: "Stone Citadel", kind: "castle", x: ox + CASTLE_SIZE[0] / 2, z: oz + CASTLE_SIZE[2] / 2 },
    { id: "spawn", name: "Pilgrim's Rest", kind: "spawn", x: sx, z: sz },
  ];
}

export const LANDMARK_GLYPH: Record<LandmarkKind, string> = {
  castle: "♜", spawn: "⚑", village: "⌂", tower: "♖", ruin: "☗",
};

/** shared map view state (mutable, HUD re-renders via emit) */
export const mapView = { open: false, heading: 0 };
