import * as THREE from 'three';
import BlueNoise from '../textures/BlueNoise_RGBA256.png';

export class UniformsBuilder {
  static createPathTracingUniforms(
    renderer: THREE.WebGLRenderer,
    screenTextureRenderTarget: THREE.WebGLRenderTarget,
    triangleDataTexture: THREE.DataTexture,
    aabbDataTexture: THREE.DataTexture,
    uniqueMaterialTextures: THREE.Texture[],
    worldCamera: THREE.Camera,
  ) {
    // blueNoise texture for efficient random number generation on calls to rand()
    const blueNoiseTexture = new THREE.TextureLoader().load(BlueNoise);
    blueNoiseTexture.wrapS = THREE.RepeatWrapping;
    blueNoiseTexture.wrapT = THREE.RepeatWrapping;
    blueNoiseTexture.flipY = false;
    blueNoiseTexture.minFilter = THREE.NearestFilter;
    blueNoiseTexture.magFilter = THREE.NearestFilter;
    blueNoiseTexture.generateMipmaps = false;

    const sunDirection = new THREE.Vector3();
    const sunAngle = Math.PI / 2.5;
    sunDirection.set(Math.cos(sunAngle) * 1.2, Math.sin(sunAngle), -Math.cos(sunAngle) * 3.0);
	  sunDirection.normalize();

    const textureMaterialsCount = uniqueMaterialTextures.length;

    const pathTracingUniforms = {
      tPreviousTexture: {type: "t", value: screenTextureRenderTarget.texture},
      tTriangleTexture: {type: "t", value: triangleDataTexture},
      tAABBTexture: {type: "t", value: aabbDataTexture},
      //tHDRTexture: { type: "t", value: hdrTexture },
      tBlueNoiseTexture: { type: "t", value: blueNoiseTexture },
      uCameraIsMoving: {type: "b1", value: false},
      uTime: {type: "f", value: 0.0},
      uFrameCounter: {type: "f", value: 1.0},
      uPreviousSampleCount: { type: "f", value: 1.0 },
      uULen: {type: "f", value: 1.0},
      uVLen: {type: "f", value: 1.0},
      uApertureSize: {type: "f", value: 0.0},
      uFocusDistance: {type: "f", value: 1.0},
      uSkyLightIntensity: {type: "f", value: 2.0},
      uSunLightIntensity: {type: "f", value: 2.0},
      uSunColor: {type: "v3", value: new THREE.Color(1.0, 0.98, 0.92)},

      uResolution: {type: "v2", value: new THREE.Vector2(renderer.getContext().drawingBufferWidth, renderer.getContext().drawingBufferHeight)},
      uRandomVec2: { type: "v2", value: new THREE.Vector2(Math.random(), Math.random()) },
      
      uSunDirection: {type: "v3", value: sunDirection},
      uCameraMatrix: {type: "m4", value: new THREE.Matrix4().copy(worldCamera.matrixWorld)},

      tAlbedoTextures: {type: "t", value: uniqueMaterialTextures},
      uAlbedoTexturesMatrices: {value: [...uniqueMaterialTextures.map(texture => texture.matrix), ...new Array(8 - textureMaterialsCount).fill(new THREE.Matrix3()) ]},
    };

    return pathTracingUniforms;
  }
}