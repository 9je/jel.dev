import type { Placement } from '../../rig';
import { H, RACK_Z } from './layout';
export function lights(): Placement[] {
  return [
    { kind: 'spot', position: [-62, H - 0.2, -31], target: [-62, 0, -31], color: 0xdff0f6, intensity: 80, distance: 20, angle: Math.PI / 2.4, penumbra: 0.7, decay: 1.7 },
    { kind: 'spot', position: [-70, H - 0.2, -31], target: [-70, 0, -31], color: 0xdff0f6, intensity: 80, distance: 20, angle: Math.PI / 2.4, penumbra: 0.7, decay: 1.7 },
    { kind: 'point', position: [-67, 1.4, RACK_Z.south + 1], color: 0x3d7be0, intensity: 5, distance: 9, decay: 2 },
    { kind: 'point', position: [-67, 1.4, RACK_Z.north - 1], color: 0x3d7be0, intensity: 5, distance: 9, decay: 2 },
  ];
}
