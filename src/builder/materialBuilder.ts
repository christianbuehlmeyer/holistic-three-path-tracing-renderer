// A lot of code is copy pasted from https://github.com/erichlof/THREE.js-PathTracing-Renderer

import * as THREE from 'three';
import { MaterialObject } from '../models/materialObject';

export interface CombinedMaterialBuilderOutput {
  materialObjects: MaterialObject[];
  triangleMaterialMarkers: number[];
}

export class MaterialBuilder {
  static buildFromScene(scene: THREE.Scene): CombinedMaterialBuilderOutput {
    const materialObjects = MaterialBuilder.buildMaterialObjectsFromScene(scene);
    const triangleMaterialMarkers = MaterialBuilder.buildTriangleMaterialMarkersFromScene(scene);

    return { materialObjects, triangleMaterialMarkers }
  }

  static buildMaterialObjectsFromScene(scene: THREE.Scene): MaterialObject[] {
    let materialObjectList: MaterialObject[] = [];
    scene.traverse(object => {
      if ((object as any).isMesh) {
        const materialObject = MaterialBuilder.buildMaterialObject((object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material);
        materialObjectList.push(materialObject);
      }
    });
    return materialObjectList;
  }

  static buildMaterialObject(material: THREE.MeshStandardMaterial): MaterialObject {
    return {
      type: 1,
      albedoTextureID: -1,
      albedoTexture: new THREE.Texture(),
      color: material.color ? material.color.copy(material.color) : new THREE.Color(1.0, 1.0, 1.0),
      roughness: material.roughness || 0.0,
      metalness: material.metalness || 0.0,
      opacity: material.opacity || 0.0,
    }
  }

  static buildTriangleMaterialMarkersFromScene(scene: THREE.Scene): number[] {
    let triangleMaterialMarkerList: number[] = [];

    scene.traverse(object => {
      if ((object as any).isMesh) {
        const triangleMaterialMarkers = MaterialBuilder.buildTriangleMaterialMarker((object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).geometry);
        triangleMaterialMarkerList = triangleMaterialMarkerList.concat(triangleMaterialMarkers);
      }
    });

    return triangleMaterialMarkerList;
  }

  static buildTriangleMaterialMarker(geometry: THREE.BufferGeometry): number[] {
    const triangleMaterialMarkers: number[] = [];

    if (geometry.groups.length > 0) {
      for (let i = 0; i < geometry.groups.length; i++) {
        triangleMaterialMarkers.push((triangleMaterialMarkers.length > 0 ? triangleMaterialMarkers[triangleMaterialMarkers.length - 1] : 0) + geometry.groups[i].count / 3);
      }
    } else {
      triangleMaterialMarkers.push((triangleMaterialMarkers.length > 0 ? triangleMaterialMarkers[triangleMaterialMarkers.length - 1] : 0) + geometry.index.count / 3);
    }

    return triangleMaterialMarkers;
  }
}