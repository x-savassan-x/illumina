import {
    Scene,
    PerspectiveCamera,
    WebGLRenderer,
    Color,
    AmbientLight,
    HemisphereLight,
    DirectionalLight,
    PCFSoftShadowMap,
    LinearToneMapping
} from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';

export class SceneManager {
    public readonly scene: Scene;
    public readonly camera: PerspectiveCamera;
    public readonly renderer: WebGLRenderer;
    public readonly controls: OrbitControls;

    private readonly _mainLight: DirectionalLight;

    public constructor(
        private readonly _container: HTMLElement
    ) {
        this.scene = this._setupScene();
        this.camera = this._setupCamera();
        this.renderer = this._setupRenderer();
        this.controls = this._setupControls();

        this._mainLight = this._createMainLight();

        this._handleResize = this._handleResize.bind(this);
        window.addEventListener('resize', this._handleResize);
    }

    public startRendering(): void {
        this.renderer.setAnimationLoop(() => {
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        });
    }

    public update(citySize: number): void {
        const lightDistance = citySize * 1.2;
        const lightHeight = citySize * 0.7;

        this._mainLight.position.set(lightDistance, lightHeight, lightDistance);
        this._mainLight.shadow.camera.left = -citySize;
        this._mainLight.shadow.camera.right = citySize;
        this._mainLight.shadow.camera.top = citySize;
        this._mainLight.shadow.camera.bottom = -citySize;
        this._mainLight.shadow.camera.far = lightDistance * 2;
        this._mainLight.shadow.camera.updateProjectionMatrix();
    }

    public dispose(): void {
        this.renderer.setAnimationLoop(null);
        window.removeEventListener('resize', this._handleResize);
        this._container.removeChild(this.renderer.domElement);
        this.renderer.dispose();
    }

    private _setupScene(): Scene {
        const scene = new Scene();
        scene.background = new Color(0xf2f2f2);

        const ambientLight = new AmbientLight(0xffffff, 0.6);
        const hemisphereLight = new HemisphereLight(0xddeeff, 0xfff0e0, 0.5);

        scene.add(ambientLight, hemisphereLight);

        return scene;
    }

    private _createMainLight(): DirectionalLight {
        const mainLight = new DirectionalLight(0xffffff, 0.7);
        mainLight.position.setScalar(150);

        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 10;
        mainLight.shadow.camera.far = 400;
        mainLight.shadow.camera.left = -100;
        mainLight.shadow.camera.right = 100;
        mainLight.shadow.camera.top = 100;
        mainLight.shadow.camera.bottom = -100;
        mainLight.shadow.bias = -0.0002;

        this.scene.add(mainLight);
        return mainLight;
    }

    private _setupCamera(): PerspectiveCamera {
        const { clientWidth, clientHeight } = this._container;
        const camera = new PerspectiveCamera(60, clientWidth / clientHeight, 1, 10000);
        camera.position.set(100, 100, 120);
        camera.lookAt(0, 0, 0);
        return camera;
    }

    private _setupRenderer(): WebGLRenderer {
        const renderer = new WebGLRenderer({ antialias: true, alpha: true });

        const { clientWidth, clientHeight } = this._container;
        renderer.setSize(clientWidth, clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = PCFSoftShadowMap;
        renderer.toneMapping = LinearToneMapping;

        this._container.appendChild(renderer.domElement);
        return renderer;
    }

    private _setupControls(): OrbitControls {
        const controls = new OrbitControls(this.camera, this.renderer.domElement);

        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.maxPolarAngle = Math.PI / 2 - 0.05;
        controls.minDistance = 50;

        return controls;
    }

    private _handleResize(): void {
        const { clientWidth, clientHeight } = this._container;
        this.camera.aspect = clientWidth / clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(clientWidth, clientHeight);
    }
}