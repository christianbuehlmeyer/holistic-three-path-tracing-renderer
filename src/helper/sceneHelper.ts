// A lot of code is copy pasted from https://github.com/erichlof/THREE.js-PathTracing-Renderer

import * as THREE from 'three';

export class SceneHelper {
  constructor(
    private scene: THREE.Scene
  ) { }

  public flatMeshList(): THREE.Mesh[] {
    const meshList: THREE.Mesh[] = [];
    this.scene.traverse(object => {
      if ((object as any).isMesh) {
        const position = this.absolutePosition(object);
        const rotationQuarternion = this.absoluteRotation(object);
        const clone = object.clone() as THREE.Mesh;
        clone.position.set(position.x, position.y, position.z);
        //clone.rotation.setFromQuaternion(rotationQuarternion);
        meshList.push(clone);
      }
    })
    return meshList;
  }

  private absolutePosition(object: THREE.Object3D) {
    const position = new THREE.Vector3();

    let selectedObject = object;
    while (selectedObject) {
      position.add(selectedObject.position);
      selectedObject = selectedObject.parent;
    }

    return position;
  }

  private absoluteRotation(object: THREE.Object3D) {
    const startRotation = new THREE.Euler(Math.PI/2, Math.PI/2, Math.PI/2);
    const rotation = new THREE.Quaternion();
    rotation.setFromEuler(startRotation);

    let selectedObject = object;
    while (selectedObject) {
      rotation.multiply(selectedObject.quaternion.invert());
      selectedObject = selectedObject.parent;
    }

    return rotation;
  }
}