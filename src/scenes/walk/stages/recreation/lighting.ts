import type { Placement } from '../../rig';
import { H, Z0, Z1 } from './layout';
export function lights(): Placement[] {
  return [
    { kind: 'spot', position: [-28, H - 0.3, -31], target: [-28, 0, -31], color: 0xdff0f6, intensity: 90, distance: 22, angle: Math.PI / 2.6, penumbra: 0.7, decay: 1.7 },
    { kind: 'spot', position: [-46, H - 0.3, -31], target: [-46, 0, -31], color: 0xdff0f6, intensity: 90, distance: 22, angle: Math.PI / 2.6, penumbra: 0.7, decay: 1.7 },
    { kind: 'point', position: [-34, 1.6, Z0 + 1.4], color: 0x3d7be0, intensity: 6, distance: 8, decay: 2 },
    { kind: 'point', position: [-24.1, 1.4, Z1 - 1.6], color: 0x6ec1d6, intensity: 4, distance: 6, decay: 2 },
  ];
}
