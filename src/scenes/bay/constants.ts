import type { Wing } from '../../content/schema';

export type WingId = Wing;
export interface WingDef { id: WingId; name: string; route: string; light: string; gateX: number }

export const WINGS: WingDef[] = [
  { id: 'operations', name: 'Operations', route: '/operations', light: '#CFE6EE', gateX: -15 },
  { id: 'fabrication', name: 'Fabrication', route: '/fabrication', light: '#E0813A', gateX: -5 },
  { id: 'recreation', name: 'Recreation', route: '/recreation', light: '#3D7BE0', gateX: 5 },
  { id: 'containment', name: 'Containment', route: '/containment', light: '#D7383A', gateX: 15 },
];

export const HANGAR = { width: 40, height: 12, zFront: 30, zBack: -40, length: 70 } as const;
export const CAMERA = { x: 0, y: 1.7, zStart: 26 } as const;
export const BOOTH = { glassZ: 23, consoleZ: 24.5 } as const;
export const BANK_Z = [20, 5, -10, -25] as const;

export const COLORS = {
  bayBlack: 0x0e161e,
  steel: 0x2a3b4a,
  glassCyan: 0x6ec1d6,
  panelWhite: 0xd9e8ee,
  terraBlue: 0x2455a4,
  hazard: 0xe8b923,
  crate: 0xd8722c,
  warning: 0xc8322b,
  wall: 0x17222c,
} as const;
