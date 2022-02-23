import * as THREE from 'three';

export class DataTextureBuilder {
  static createDataTexture(array: Float32Array) {
    const dataTexture = new THREE.DataTexture(array,
      2048,
      2048,
      THREE.RGBAFormat,
      THREE.FloatType,
      THREE.Texture.DEFAULT_MAPPING,
      THREE.ClampToEdgeWrapping,
      THREE.ClampToEdgeWrapping,
      THREE.NearestFilter,
      THREE.NearestFilter,
      1,
      THREE.LinearEncoding
    );
  
    dataTexture.flipY = false;
    dataTexture.generateMipmaps = false;
    dataTexture.needsUpdate = true;

    return dataTexture
  }
}