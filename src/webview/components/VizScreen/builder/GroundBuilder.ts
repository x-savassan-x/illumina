import {
    BoxGeometry,
    MeshStandardMaterial,
    Mesh,
    EdgesGeometry,
    LineBasicMaterial,
    LineSegments,
    CanvasTexture,
    PlaneGeometry,
    MeshBasicMaterial
} from 'three';
import { Area } from './Area';


export class GroundBuilder {
    private readonly _GROUND_HEIGHT = 0.2;
    private readonly _GROUND_BASE_COLOR = 0x333333;
    private readonly _GROUND_OFFSET_COLOR = 0x111111;
    private readonly _GROUND_EDGE_COLOR = 0x000000;

    public build(
        area: Area,
        baseSize: number,
        level: number,
        name: string,
        labelHeight: number,
        userdata: Record<string, unknown> = {}
    ): Mesh {
        const { width, depth, center } = area;
        const geometry = new BoxGeometry(width, this._GROUND_HEIGHT, depth);

        const material = new MeshStandardMaterial({
            color: this._GROUND_BASE_COLOR + level * this._GROUND_OFFSET_COLOR,
            metalness: 0.1,
            roughness: 0.9
        });

        const mesh = new Mesh(geometry, material);
        mesh.position.set(
            center.x - baseSize / 2,
            this._GROUND_HEIGHT * (level - 0.5),
            center.z - baseSize / 2
        );
        mesh.receiveShadow = true;

        const edgeGeometry = new EdgesGeometry(geometry);
        const edgeMaterial = new LineBasicMaterial({
            color: this._GROUND_EDGE_COLOR,
            linewidth: 1.5
        });
        const outline = new LineSegments(edgeGeometry, edgeMaterial);
        mesh.add(outline);

        const label = this._createLabel(name, width, labelHeight);
        label.renderOrder = 1;
        label.position.set(0, 0.2, depth / 2 - labelHeight / 2);
        label.rotation.x = -Math.PI / 2;
        mesh.add(label);

        mesh.userData = userdata;

        return mesh;
    }

    private _createLabel(
        text: string,
        maxWidth: number,
        maxHeight: number
    ): Mesh {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return new Mesh();

        const baseFontSize = 100;
        context.font = `bold ${baseFontSize}px Arial`;
        const textMetrics = context.measureText(text);

        canvas.width = Math.pow(2, Math.ceil(Math.log2(textMetrics.width)));
        canvas.height = 128;

        let fontSize = baseFontSize;
        while (context.measureText(text).width > canvas.width * 0.9) {
            fontSize -= 2;
            context.font = `bold ${fontSize}px Arial`;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);

        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = `bold ${fontSize}px Arial`;
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        const aspectRatio = canvas.width / canvas.height;
        const width = Math.min(maxWidth, maxHeight * aspectRatio);
        const height = width / aspectRatio;
        const geometry = new PlaneGeometry(width, height);

        const texture = new CanvasTexture(canvas);
        texture.needsUpdate = true;
        const material = new MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -4
        });

        return new Mesh(geometry, material);
    }
}
