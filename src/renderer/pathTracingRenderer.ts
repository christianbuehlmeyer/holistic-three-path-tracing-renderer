// A lot of code is copy pasted from https://github.com/erichlof/THREE.js-PathTracing-Renderer

import '../shaders/commonShaderFragments';

import * as THREE from 'three';
import { DataTextureBuilder } from '../builder/dataTextureBuilder';
import { MaterialBuilder } from '../builder/materialBuilder';
import { BVHHelper } from '../helper/bvhHelper';
import { SceneHelper } from '../helper/sceneHelper';
import { UniformsBuilder } from '../builder/uniformsBuilder';
import { ShaderMaterialBuilder } from '../builder/shaderMaterialBuilder';

const extensions = [
  'EXT_color_buffer_float'
];

interface PathTracingRendererProps {
  webGlRenderer?: THREE.WebGLRenderer;
  worldScene: THREE.Scene;
  worldCamera: THREE.PerspectiveCamera;
}

interface CameraState {
  position: THREE.Vector3;
  rotation: THREE.Euler;
}

export class PathTracingRenderer {
  private webGlRenderer: THREE.WebGLRenderer;
  private pathTracingRenderTarget: THREE.WebGLRenderTarget;
  private screenCopyRenderTarget: THREE.WebGLRenderTarget;

  private worldCamera: THREE.PerspectiveCamera;
  private worldScene: THREE.Scene;
  private screenCopyScene: THREE.Scene;
  private screenOutputScene: THREE.Scene;

  // quadCamera is simply the camera to help render the full screen quad (2 triangles),
  // hence the name.  It is an Orthographic camera that sits facing the view plane, which serves as
  // the window into our 3d world. This camera will not move or rotate for the duration of the app.
  private quadCamera: THREE.Camera;

  private pathTracingUniforms: any;
  private screenOutputUniforms: any;

  private sampleCounter = 1;
  private frameCounter = 1;

  private latestCameraState: CameraState;

  public mesh: THREE.Mesh;

  constructor(props: PathTracingRendererProps) {
    const {
      webGlRenderer = new THREE.WebGLRenderer(),
      worldScene,
      worldCamera,
    } = props;

    this.webGlRenderer = webGlRenderer;
    this.worldCamera = worldCamera;
    this.worldScene = worldScene;

    this.latestCameraState = {
      position: new THREE.Vector3(),
      rotation: new THREE.Euler(),
    }
    this.setCameraState();
    this.setup();
  }

  public render() {
    // RENDERING in 3 steps

    // STEP 1
    // Perform PathTracing and Render(save) into pathTracingRenderTarget, a full-screen texture.
    // Read previous screenCopyRenderTarget(via texelFetch inside fragment shader) to use as a new starting point to blend with
    this.webGlRenderer.setRenderTarget(this.pathTracingRenderTarget);
    this.webGlRenderer.render(this.worldScene, this.worldCamera);

    // STEP 2
    // Render(copy) the pathTracingScene output(pathTracingRenderTarget above) into screenCopyRenderTarget.
    // This will be used as a new starting point for Step 1 above (essentially creating ping-pong buffers)
    this.webGlRenderer.setRenderTarget(this.screenCopyRenderTarget);
    this.webGlRenderer.render(this.screenCopyScene, this.quadCamera);

    // STEP 3
    // Render full screen quad with generated pathTracingRenderTarget in STEP 1 above.
    // After applying tonemapping and gamma-correction to the image, it will be shown on the screen as the final accumulated output
    this.webGlRenderer.setRenderTarget(null);
    this.webGlRenderer.render(this.screenOutputScene, this.quadCamera);
  }

  public animate() {
    this.render();
    this.sampleCounter += 1;
    this.frameCounter += 1;

    if (this.hasCameraChanged()) {
      this.setCameraState();
      this.sampleCounter = 1;
      this.frameCounter = 1;
      this.pathTracingUniforms.uCameraIsMoving = true;
      this.pathTracingUniforms.uCameraMatrix.value.copy(this.worldCamera.matrixWorld);
    } else {
      this.pathTracingUniforms.uCameraIsMoving = false;
    }

    if (this.pathTracingUniforms) {
      this.pathTracingUniforms.uFrameCounter.value = this.frameCounter;
      this.pathTracingUniforms.uRandomVec2.value.set(Math.random(), Math.random());

      this.mesh.updateMatrixWorld(true); // 'true' forces immediate matrix update
    }
    if (this.screenOutputUniforms) this.screenOutputUniforms.uOneOverSampleCounter.value = 1 / this.sampleCounter;
    requestAnimationFrame(this.animate.bind(this));
  }

  public buildSceneForRayTracing() {
    let { materialObjects, triangleMaterialMarkers } = MaterialBuilder.buildFromScene(this.worldScene);
    const meshList = new SceneHelper(this.worldScene).flatMeshList();
    const mergedGeometryMesh = BVHHelper.createMergedGeometryMesh(meshList);

    // divide by 9 because of nonIndexed geometry (each triangle has 3 floats with each float constisting of 3 components)
	  const totalNumberOfTriangles = mergedGeometryMesh.geometry.attributes.position.array.length / 9;

    const uniqueMaterialTextures = BVHHelper.getUniqueMaterialTextures(meshList);
    materialObjects = BVHHelper.assignTexturesToPathTracingMaterialList(meshList, uniqueMaterialTextures, materialObjects);
    const { totalWork, triangleArray, aabbArray } = BVHHelper.generateBVHWorkingSet(totalNumberOfTriangles, mergedGeometryMesh, triangleMaterialMarkers, materialObjects);

    // Build the BVH acceleration structure, which places a bounding box ('root' of the tree) around all of the
    // triangles of the entire mesh, then subdivides each box into 2 smaller boxes.  It continues until it reaches 1 triangle,
    // which it then designates as a 'leaf'
    BVHHelper.buildBVHIterative(totalWork, aabbArray);

    const triangleDataTexture = DataTextureBuilder.createDataTexture(triangleArray);
    const aabbDataTexture = DataTextureBuilder.createDataTexture(aabbArray);

    this.pathTracingUniforms = UniformsBuilder.createPathTracingUniforms(this.webGlRenderer, this.screenCopyRenderTarget, triangleDataTexture, aabbDataTexture, uniqueMaterialTextures, this.worldCamera);
    const pathTracingMaterial = ShaderMaterialBuilder.createPathTracingMaterial(this.pathTracingUniforms, {});
    const pathTracingGeometry = new THREE.PlaneBufferGeometry(2, 2);
    const pathTracingMesh = new THREE.Mesh(pathTracingGeometry, pathTracingMaterial);
    this.worldScene.add(pathTracingMesh);

    // the following keeps the large scene ShaderMaterial quad right in front
    // of the camera at all times. This is necessary because without it, the scene
    // quad will fall out of view and get clipped when the camera rotates past 180 degrees.
    this.worldCamera.add(pathTracingMesh);

    const screenCopyMaterial = ShaderMaterialBuilder.createScreenCopyMaterial(this.pathTracingRenderTarget);
    const screenCopyGeometry = new THREE.PlaneBufferGeometry(2, 2);
    const screenCopyMesh = new THREE.Mesh(screenCopyGeometry, screenCopyMaterial);
	  this.screenCopyScene.add(screenCopyMesh);

    this.screenOutputUniforms = {
      uOneOverSampleCounter: { type: "f", value: 0.0 },
      tPathTracedImageTexture: { type: "t", value: this.pathTracingRenderTarget.texture }
    };
    const screenOutputMaterial = ShaderMaterialBuilder.createScreenOutputMaterial(this.screenOutputUniforms);
    const screenOutputGeometry = new THREE.PlaneBufferGeometry(2, 2);
    const screenOutputMesh = new THREE.Mesh(screenOutputGeometry, screenOutputMaterial);
	  this.screenOutputScene.add(screenOutputMesh);

    const fovScale = this.worldCamera.fov * 0.5 * (Math.PI / 180.0);
		this.pathTracingUniforms.uVLen.value = Math.tan(fovScale);
		this.pathTracingUniforms.uULen.value = this.pathTracingUniforms.uVLen.value * this.worldCamera.aspect;
  }

  private hasCameraChanged(): boolean {
    if (!this.worldCamera.position.equals(this.latestCameraState.position)) {
      return true;
    }
    if (!this.worldCamera.rotation.equals(this.latestCameraState.rotation)) {
      return true;
    }

    return false;
  }

  private setCameraState(): void {
    this.latestCameraState.position.copy(this.worldCamera.position);
    this.latestCameraState.rotation.copy(this.worldCamera.rotation);
  }

  private setupExtensions(): void {
    const context = this.webGlRenderer.getContext();
    extensions.forEach(extension => context.getExtension(extension));
  }

  private createRenderTarget(): THREE.WebGLRenderTarget {
    const context = this.webGlRenderer.getContext();
    const renderTarget = new THREE.WebGLRenderTarget(
      context.drawingBufferWidth,
      context.drawingBufferHeight,
      {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        depthBuffer: false,
        stencilBuffer: false
      }
    );
    renderTarget.texture.generateMipmaps = false;
    return renderTarget;
  }

  private setupOutputScenes() {
    this.screenCopyScene = new THREE.Scene();
    this.screenOutputScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    this.screenCopyScene.add(this.quadCamera);
    this.screenOutputScene.add(this.quadCamera);

    this.pathTracingRenderTarget = this.createRenderTarget();
    this.screenCopyRenderTarget = this.createRenderTarget();
  }

  private setup() {
    this.setupExtensions();
    this.setupOutputScenes();
  }

}
