import {
    BoxGeometry,
    MeshStandardMaterial,
    Mesh,
    EdgesGeometry,
    LineBasicMaterial,
    LineSegments,
    Color
} from 'three';
import { Area } from './Area';


export class BuildingBuilder {
    private readonly _SCALING_FACTOR = 0.9;

    private readonly _BASE_HEIGHT = 1;

    private readonly _FOLDER_COLOR = {
        low: new Color(0x673AB7),
        mid: new Color(0x3F51B5),
        high: new Color(0x2196F3)
    };

    private readonly _FILE_COLOR = {
        low: new Color(0x7AE89D),
        mid: new Color(0xFFEB3B),
        high: new Color(0xFF5252)
    };

    private readonly _EDGE_DARKENING_FACTOR = 0.3;

    public build(
        area: Area,
        baseSize: number,
        heightValue: number,
        colorValue: number,
        isFolder: boolean,
        userdata: Record<string, unknown>
    ): Mesh {
        const { width, depth, center } = area;

        const height = this._BASE_HEIGHT + heightValue;

        const geometry = new BoxGeometry(
            width * this._SCALING_FACTOR,
            height,
            depth * this._SCALING_FACTOR
        );
        const material = this._createMaterial(colorValue, isFolder);

        const mesh = new Mesh(geometry, material);
        mesh.position.set(
            center.x - baseSize / 2,
            height / 2,
            center.z - baseSize / 2
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const edgesGeometry = new EdgesGeometry(geometry);
        const edgesMaterial = new LineBasicMaterial({
            color: material.color.clone().multiplyScalar(this._EDGE_DARKENING_FACTOR),
            linewidth: 1
        });
        const edges = new LineSegments(edgesGeometry, edgesMaterial);
        mesh.add(edges);

        mesh.userData = userdata;

        return mesh;
    }

    private _createMaterial(value: number, isFolder: boolean): MeshStandardMaterial {
        const { low, mid, high } = isFolder ? this._FOLDER_COLOR : this._FILE_COLOR;

        const color = value < 0.5
            ? low.clone().lerp(mid, value * 2)
            : mid.clone().lerp(high, (value - 0.5) * 2);

        return new MeshStandardMaterial({
            color: color,
            metalness: isFolder ? 0.2 : 0.3,
            roughness: isFolder ? 0.8 : 0.6
        });
    }
}
