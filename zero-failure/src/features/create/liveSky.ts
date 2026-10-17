// The forged deck rides the simulator's own orbit geometry — the real
// rings (ORBIT_RINGS), the real Kepler periods, positions from the sim's
// pure ringPoint. This module adds only what the sim doesn't ship: how N
// forged planets claim seats in that geometry, following the sim's own
// ring-fill pattern so a forged cast sits exactly where the real one sits.

import { ORBIT_RINGS } from "../simulator/components/canvas/orbits";

export interface OrbitSlot {
  ringIndex: number;
  /** Angle at t=0, radians. */
  baseAngle: number;
}

// The sim's own nine seats — ring and base angle per planet, in cast
// seniority order (orbits.ts's PLANET_ORBITS). A forged planet takes
// these first, so a small forged cast spreads exactly like the real one.
const SIM_SEATS: [ringIndex: number, baseAngleDeg: number][] = [
  [0, 200],
  [0, 340],
  [1, 110],
  [1, 290],
  [2, 30],
  [2, 210],
  [3, 60],
  [3, 180],
  [3, 300]
];

/** Deterministic seat per forged planet: the sim's pattern for the first
 *  nine, then the rings cycle again with golden-angle spacing so extra
 *  bodies never crowd the seats above them. */
export function orbitSlots(count: number): OrbitSlot[] {
  return Array.from({ length: count }, (_, i) => {
    if (i < SIM_SEATS.length) {
      const [ringIndex, deg] = SIM_SEATS[i]!;
      return { ringIndex, baseAngle: (deg * Math.PI) / 180 };
    }
    return {
      ringIndex: i % ORBIT_RINGS.length,
      baseAngle: ((i * 137.508) % 360) * (Math.PI / 180)
    };
  });
}

/** The sim's Kepler sweep: uniform angular speed, one lap per ring
 *  period — the same motion orbitState drives on the canvas. */
export function orbitAngle(slot: OrbitSlot, ringPeriodMs: number, tMs: number): number {
  return slot.baseAngle + (2 * Math.PI * tMs) / ringPeriodMs;
}
