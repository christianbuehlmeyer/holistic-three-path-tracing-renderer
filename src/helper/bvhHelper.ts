// A lot of code is copy pasted from https://github.com/erichlof/THREE.js-PathTracing-Renderer

import * as THREE from 'three';
import { BVH_Build_Iterative } from '../builder/accStructureIterativeFastBuilder';
import { MaterialObject } from '../models/materialObject';
import { mergeBufferGeometries } from './bufferGeometryUtils';

export class BVHHelper {
  static createMergedGeometryMesh(meshList: THREE.Mesh[]): THREE.Mesh {
    // Gather all geometry from the mesh list that now contains loaded models
    const geoList = meshList.map(
      mesh => mesh.geometry
        .rotateX(-mesh.rotation.x)
        .rotateY(-mesh.rotation.y)
        .rotateZ(-mesh.rotation.z)
        .scale(mesh.scale.x, mesh.scale.y, mesh.scale.z)
        .translate(mesh.position.x, mesh.position.y, mesh.position.z)
    );

    // Merge geometry from all models into one new mesh
    let modelMesh = new THREE.Mesh(mergeBufferGeometries(geoList));
    if (modelMesh.geometry.index)
      modelMesh.geometry = modelMesh.geometry.toNonIndexed(); // why do we need NonIndexed geometry?

    return modelMesh;
  }

  static getUniqueMaterialTextures(meshList: THREE.Mesh[]): THREE.Texture[] {
    const uniqueMaterialTextures: THREE.Texture[] = [];

    const addMaterialToArray = (material: THREE.MeshStandardMaterial) => {
      if (material.map) uniqueMaterialTextures.push(material.map);
    }

    meshList.forEach(mesh => {
      const material = mesh.material;
      const isArray = Array.isArray(material);
      isArray
        ? material.forEach(addMaterialToArray)
        : addMaterialToArray(material as THREE.MeshStandardMaterial);
    });
  
    // Remove duplicate entries
    return Array.from(new Set(uniqueMaterialTextures));
  }

  static assignTexturesToPathTracingMaterialList(meshList: THREE.Mesh[], uniqueMaterialTextures: THREE.Texture[], materialObjects: MaterialObject[]): MaterialObject[] {
    // Deep copy of materialObjects
    const updatedMaterialObjects = materialObjects.map(materialObject => Object.assign({}, materialObject));

    const updateMaterialObjectTextureID = (meshIndex: number, material: THREE.MeshStandardMaterial) => {
      if (material.map) {
        for (let j = 0; j < uniqueMaterialTextures.length; j++) {
          if (material.map.image.src === uniqueMaterialTextures[j].image.src) {
            updatedMaterialObjects[meshIndex].albedoTextureID = j;
            material.map.updateMatrix();
            updatedMaterialObjects[meshIndex].albedoTexture = uniqueMaterialTextures[j];
          }
        }
      }
    }
    
    // Assign textures to the path tracing material with the correct id
    meshList.forEach((mesh, meshIndex) => {
      const material = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
      Array.isArray(material)
        ? material.forEach((mat) => updateMaterialObjectTextureID(meshIndex, mat))
        : updateMaterialObjectTextureID(meshIndex, material);
    })

    return updatedMaterialObjects;
  }

  static generateBVHWorkingSet(totalNumberOfTriangles: number, mergedGeometryMesh: THREE.Mesh, triangleMaterialMarkers: number[], materialObjects: MaterialObject[]) {
    const totalWork = new Uint32Array(totalNumberOfTriangles);

    // Initialize triangle and aabb arrays where 2048 = width and height of texture and 4 are the r, g, b and a components
    const triangleArray = new Float32Array(2048 * 2048 * 4);
    const aabbArray = new Float32Array(2048 * 2048 * 4);

    const triangleBBoxMin = new THREE.Vector3();
    const triangleBBoxMax = new THREE.Vector3();
    const triangleBBoxCentroid = new THREE.Vector3();

    if (mergedGeometryMesh.geometry.attributes.normal === undefined)
    mergedGeometryMesh.geometry.computeVertexNormals();
    const vna = new Float32Array(mergedGeometryMesh.geometry.attributes.normal.array);
    const vpa = new Float32Array(mergedGeometryMesh.geometry.attributes.position.array);

    let vta = new Float32Array();
    let modelHasUVs = false;
    if (mergedGeometryMesh.geometry.attributes.uv !== undefined) {
      vta = new Float32Array(mergedGeometryMesh.geometry.attributes.uv.array);
      modelHasUVs = true;
    }

    let materialNumber = 0;
    for (let i = 0; i < totalNumberOfTriangles; i++) {

      triangleBBoxMin.set(Infinity, Infinity, Infinity);
      triangleBBoxMax.set(-Infinity, -Infinity, -Infinity);

      let vt0 = new THREE.Vector2();
      let vt1 = new THREE.Vector2();
      let vt2 = new THREE.Vector2();
      // record vertex texture coordinates (UVs)
      if (modelHasUVs) {
        vt0.set(vta[6 * i + 0], vta[6 * i + 1]);
        vt1.set(vta[6 * i + 2], vta[6 * i + 3]);
        vt2.set(vta[6 * i + 4], vta[6 * i + 5]);
      } else {
        vt0.set(-1, -1);
        vt1.set(-1, -1);
        vt2.set(-1, -1);
      }

      // record vertex normals
      let vn0 = new THREE.Vector3(vna[9 * i + 0], vna[9 * i + 1], vna[9 * i + 2]).normalize();
      let vn1 = new THREE.Vector3(vna[9 * i + 3], vna[9 * i + 4], vna[9 * i + 5]).normalize();
      let vn2 = new THREE.Vector3(vna[9 * i + 6], vna[9 * i + 7], vna[9 * i + 8]).normalize();

      // record vertex positions
      let vp0 = new THREE.Vector3(vpa[9 * i + 0], vpa[9 * i + 1], vpa[9 * i + 2]);
      let vp1 = new THREE.Vector3(vpa[9 * i + 3], vpa[9 * i + 4], vpa[9 * i + 5]);
      let vp2 = new THREE.Vector3(vpa[9 * i + 6], vpa[9 * i + 7], vpa[9 * i + 8]);

      //slot 0
      triangleArray[32 * i + 0] = vp0.x; // r or x
      triangleArray[32 * i + 1] = vp0.y; // g or y
      triangleArray[32 * i + 2] = vp0.z; // b or z
      triangleArray[32 * i + 3] = vp1.x; // a or w

      //slot 1
      triangleArray[32 * i + 4] = vp1.y; // r or x
      triangleArray[32 * i + 5] = vp1.z; // g or y
      triangleArray[32 * i + 6] = vp2.x; // b or z
      triangleArray[32 * i + 7] = vp2.y; // a or w

      //slot 2
      triangleArray[32 * i + 8] = vp2.z; // r or x
      triangleArray[32 * i + 9] = vn0.x; // g or y
      triangleArray[32 * i + 10] = vn0.y; // b or z
      triangleArray[32 * i + 11] = vn0.z; // a or w

      //slot 3
      triangleArray[32 * i + 12] = vn1.x; // r or x
      triangleArray[32 * i + 13] = vn1.y; // g or y
      triangleArray[32 * i + 14] = vn1.z; // b or z
      triangleArray[32 * i + 15] = vn2.x; // a or w

      //slot 4
      triangleArray[32 * i + 16] = vn2.y; // r or x
      triangleArray[32 * i + 17] = vn2.z; // g or y
      triangleArray[32 * i + 18] = vt0.x; // b or z
      triangleArray[32 * i + 19] = vt0.y; // a or w

      //slot 5
      triangleArray[32 * i + 20] = vt1.x; // r or x
      triangleArray[32 * i + 21] = vt1.y; // g or y
      triangleArray[32 * i + 22] = vt2.x; // b or z
      triangleArray[32 * i + 23] = vt2.y; // a or w

      // the remaining slots are used for PBR material properties
      if (i >= triangleMaterialMarkers[materialNumber] && materialObjects[materialNumber + 1] !== undefined)
        materialNumber++;

      //slot 6
      triangleArray[32 * i + 24] = materialObjects[materialNumber].type; // r or x
      triangleArray[32 * i + 25] = materialObjects[materialNumber].color.r; // g or y
      triangleArray[32 * i + 26] = materialObjects[materialNumber].color.g; // b or z
      triangleArray[32 * i + 27] = materialObjects[materialNumber].color.b; // a or w

      //slot 7
      triangleArray[32 * i + 28] = materialObjects[materialNumber].albedoTextureID; // r or x
      triangleArray[32 * i + 29] = materialObjects[materialNumber].opacity; // g or y
      triangleArray[32 * i + 30] = 0; // b or z
      triangleArray[32 * i + 31] = 0; // a or w

      triangleBBoxMin.copy(triangleBBoxMin.min(vp0));
      triangleBBoxMax.copy(triangleBBoxMax.max(vp0));
      triangleBBoxMin.copy(triangleBBoxMin.min(vp1));
      triangleBBoxMax.copy(triangleBBoxMax.max(vp1));
      triangleBBoxMin.copy(triangleBBoxMin.min(vp2));
      triangleBBoxMax.copy(triangleBBoxMax.max(vp2));

      triangleBBoxCentroid.set((triangleBBoxMin.x + triangleBBoxMax.x) * 0.5,
        (triangleBBoxMin.y + triangleBBoxMax.y) * 0.5,
        (triangleBBoxMin.z + triangleBBoxMax.z) * 0.5);

      aabbArray[9 * i + 0] = triangleBBoxMin.x;
      aabbArray[9 * i + 1] = triangleBBoxMin.y;
      aabbArray[9 * i + 2] = triangleBBoxMin.z;
      aabbArray[9 * i + 3] = triangleBBoxMax.x;
      aabbArray[9 * i + 4] = triangleBBoxMax.y;
      aabbArray[9 * i + 5] = triangleBBoxMax.z;
      aabbArray[9 * i + 6] = triangleBBoxCentroid.x;
      aabbArray[9 * i + 7] = triangleBBoxCentroid.y;
      aabbArray[9 * i + 8] = triangleBBoxCentroid.z;

      totalWork[i] = i;

    }

    return { totalWork, triangleArray, aabbArray };
  }

  static buildBVHIterative(totalWork: Uint32Array, aabbArray: Float32Array) {
    return BVH_Build_Iterative(totalWork, aabbArray);
  }
}