import * as THREE from 'three';
import viewerShaderFragment from '../shaders/viewerShaderFragment';
import vertexShaderFragment from '../shaders/commonPathTracingVertex';
import screenCopyFragment from '../shaders/screenCopyFragment';
import screenOutputFragment from '../shaders/screenOutputFragment';

export class ShaderMaterialBuilder {
  static createPathTracingMaterial(pathTracingUniforms: any, pathTracingDefines: any) {
    const pathTracingMaterial = new THREE.ShaderMaterial({
      uniforms: pathTracingUniforms,
      defines: pathTracingDefines,
      vertexShader: vertexShaderFragment,
      fragmentShader: viewerShaderFragment,
      depthTest: false,
      depthWrite: false
    });

    return pathTracingMaterial;
  }

  static createScreenCopyMaterial(pathTracingRenderTarget: THREE.WebGLRenderTarget) {
    const screenTextureUniforms = {
      tPathTracedImageTexture: { type: "t", value: pathTracingRenderTarget.texture }
    };
      
    const screenCopyMaterial = new THREE.ShaderMaterial({
      uniforms: screenTextureUniforms,
      vertexShader: vertexShaderFragment,
      fragmentShader: screenCopyFragment,
      depthWrite: false,
      depthTest: false
    });

    return screenCopyMaterial;
  }

  static createScreenOutputMaterial(screenOutputUniforms: any) {      
    const screenOutputMaterial = new THREE.ShaderMaterial({
      uniforms: screenOutputUniforms,
      vertexShader: vertexShaderFragment,
      fragmentShader: screenOutputFragment,
      depthWrite: false,
      depthTest: false
    });

    return screenOutputMaterial;
  }
}