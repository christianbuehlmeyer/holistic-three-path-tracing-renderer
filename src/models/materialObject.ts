import { MaterialOpacity } from './enums/materialOpacity';

export interface MaterialObject {
  type: MaterialOpacity,
  albedoTextureID: number,
  albedoTexture: THREE.Texture,
  color: THREE.Color,
  roughness: number,
  metalness: number,
  opacity: number,
}