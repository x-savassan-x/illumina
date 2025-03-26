import {
    BoxGeometry,
    MeshStandardMaterial,
    Mesh,
    Group,
    Color,
    EdgesGeometry,
    LineBasicMaterial,
    LineSegments,
    Object3D,
    CanvasTexture,
    PlaneGeometry,
    MeshBasicMaterial,
    DoubleSide
} from 'three';
import { hierarchy, treemap, HierarchyRectangularNode } from 'd3';
import { SceneManager } from './SceneManager';
import { MetricNode, FolderMetricNode, FileMetricNode } from '@shared/index';


interface TreemapData {
    name: string;
    path: string;
    metrics: MetricNode;
    value?: number;
    children?: TreemapData[];
}


export class CityBuilder {
    public collidableObjects: Mesh[] = [];
    private readonly _expandedFolders: Set<string> = new Set();
    private _rootNode: FolderMetricNode | undefined;
    private _cityGroup: Group | undefined;
    private _size: number = 0;
    private _selectedObject: Object3D | undefined;

    private readonly _OUTER_PADDING = 15;
    private readonly _INNER_PADDING = 20;
    private readonly _BOTTOM_PADDING = 80;

    private readonly _GROUND_HEIGHT = 0.5;
    private readonly _GROUND_BASE_COLOR = 0x333333;
    private readonly _GROUND_OFFSET_AMOUNT = 0x111111;
    private readonly _GROUND_EDGE_COLOR = 0x000000;
    
    private readonly _MIN_BUILDING_HEIGHT = 1;
    private readonly _MAX_BUILDING_HEIGHT = 200;
    
    private readonly _FOLDER_BASE_COLOR = 0x4A8F69;
    private readonly _FOLDER_HIGHLIGHT_COLOR = 0x7AE89D;
    private readonly _FOLDER_EDGE_COLOR = 0x263238;

    private readonly _FILE_BASE_COLOR = 0xCCCC00;
    private readonly _FILE_HIGHLIGHT_COLOR = 0xFDD835;
    private readonly _FILE_EDGE_COLOR = 0x666600;

    public constructor(
        private readonly _sceneManager: SceneManager
    ) { }

    public load(rootData: FolderMetricNode): void {
        this._rootNode = rootData;
        this._expandedFolders.clear();
        this._buildCity();
    }

    public selectObject(object: Object3D | undefined): void {
        if (object === this._selectedObject) return;

        if (this._selectedObject) {
            const prevMesh = this._selectedObject as Mesh;
            if (prevMesh.material instanceof MeshStandardMaterial)
                prevMesh.material.emissive = new Color(0x000000);
        }

        this._selectedObject = object;

        if (object) {
            const mesh = object as Mesh;
            if (mesh.material instanceof MeshStandardMaterial)
                mesh.material.emissive = new Color(0x333333);
        }
    }

    private _buildCity(hasNewData: boolean = true): void {
        if (!this._rootNode) return;

        this._clearScene();

        if (hasNewData) {
            this._calculateOptimalCitySize();
            this._sceneManager.update(this._size);
        }

        this._cityGroup = new Group();

        const baseGround = this._createBaseGround();
        this._cityGroup.add(baseGround);

        const data = this._convertToTreemapData(this._rootNode, this._rootNode.name);
        const rootHierarchy = hierarchy(data)
            .sum(d => d.value!)
            .sort((a, b) => {
                if (a.children && !b.children) return -1;
                if (!a.children && b.children) return 1;
                return b.value! - a.value!;
            });
        const layout = treemap<TreemapData>()
            .size([this._size, this._size])
            .paddingOuter(this._OUTER_PADDING)
            .paddingInner(this._INNER_PADDING)
            .paddingBottom(this._BOTTOM_PADDING)
            (rootHierarchy);

        this._processTreemapNode(layout);

        this._sceneManager.scene.add(this._cityGroup);
    }

    private _calculateOptimalCitySize(): void {
        const baseSize = Math.sqrt(this._rootNode!.leafCount) * 100;
        const depthFactor = 1 + this._rootNode!.height * 0.5;
        this._size = Math.max(120, Math.ceil(baseSize * depthFactor));
    }

    private _createBaseGround(): Mesh {
        const geometry = new BoxGeometry(this._size, this._GROUND_HEIGHT, this._size);
        const material = new MeshStandardMaterial({
            color: this._GROUND_BASE_COLOR,
            metalness: 0.1,
            roughness: 0.9
        });

        const mesh = new Mesh(geometry, material);
        mesh.position.set(0, -this._GROUND_HEIGHT / 2, 0);
        mesh.receiveShadow = true;

        if (this._rootNode) {
            const label = this._createTextLabel(this._rootNode.name, this._size);
            label.position.set(0, this._GROUND_HEIGHT / 2, this._size / 2 - this._BOTTOM_PADDING / 2);
            label.rotation.x = -Math.PI / 2;
            mesh.add(label);
        }

        return mesh;
    }

    private _convertToTreemapData(node: FolderMetricNode, path: string): TreemapData {
        return {
            name: node.name,
            metrics: node,
            path,
            children: Object.entries(node.children).map(([name, child]) => {
                const childPath = `${path}/${name}`;

                return 'children' in child
                    ? this._convertToTreemapData(child as FolderMetricNode, childPath)
                    : {
                        name,
                        metrics: child,
                        path: childPath,
                        value: Math.max(10, child.totalLines)
                    };
            })
        };
    }

    private _processTreemapNode(
        node: HierarchyRectangularNode<TreemapData>,
        level: number = 1
    ): void {
        if (!node.parent) {
            node.children?.forEach(child => this._processTreemapNode(child, level));
            return;
        }

        const isFolder = !!node.children;
        const nodePath = node.data.path;
        const nodeName = node.data.name;

        if (this._expandedFolders.has(nodePath)) {
            const ground = this._createGround(node, level);
            ground.userData = {
                name: nodeName,
                onDoubleClick: (): void => this._toggleFolder(nodePath)
            };
            this.collidableObjects.push(ground);
            this._cityGroup?.add(ground);

            node.children!.forEach(child => this._processTreemapNode(child, level + 1));
        }
        else {
            if (isFolder) {
                const ground = this._createGround(node, level);
                this._cityGroup?.add(ground);
            }

            const building = this._createBuilding(node, isFolder);
            building.userData = {
                name: nodeName,
                onDoubleClick: isFolder ? ((): void => this._toggleFolder(nodePath)) : undefined
            };

            this.collidableObjects.push(building);
            this._cityGroup?.add(building);
        }
    }

    private _createGround(
        node: HierarchyRectangularNode<TreemapData>,
        level: number
    ): Mesh {
        const { x0, y0, x1, y1 } = node;
        const width = x1 - x0;
        const depth = y1 - y0;

        const geometry = new BoxGeometry(width, this._GROUND_HEIGHT, depth);
        const color = new Color(this._GROUND_BASE_COLOR + level * this._GROUND_OFFSET_AMOUNT);
        const material = new MeshStandardMaterial({
            color,
            metalness: 0.1,
            roughness: 0.9
        });

        const mesh = new Mesh(geometry, material);
        mesh.position.set(
            x0 - this._size / 2 + width / 2,
            this._GROUND_HEIGHT * (level - 0.5),
            y0 - this._size / 2 + depth / 2
        );
        mesh.receiveShadow = true;

        const outlineGeometry = new EdgesGeometry(new BoxGeometry(width, 0.1, depth));
        const outlineMaterial = new LineBasicMaterial({
            color: this._GROUND_EDGE_COLOR,
            linewidth: 1.5,
            opacity: 0.7
        });
        const outline = new LineSegments(outlineGeometry, outlineMaterial);
        outline.position.y = this._GROUND_HEIGHT / 2;
        mesh.add(outline);

        const label = this._createTextLabel(node.data.name, width * 0.9);
        label.position.set(0, this._GROUND_HEIGHT / 2, depth / 2 - this._BOTTOM_PADDING / 2);
        label.rotation.x = -Math.PI / 2;
        mesh.add(label);

        return mesh;
    }

    private _createTextLabel(text: string, maxWidth: number): Mesh {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return new Mesh();

        const baseFontSize = 60;
        context.font = `bold ${baseFontSize}px Arial`;
        const textMetrics = context.measureText(text);

        let canvasWidth = Math.min(1024, Math.max(256, textMetrics.width * 1.2));
        canvasWidth = Math.pow(2, Math.ceil(Math.log2(canvasWidth)));

        canvas.width = canvasWidth;
        canvas.height = 128;

        context.fillStyle = 'transparent';
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        const fontSize = Math.round(canvas.height * 0.8);
        context.font = `bold ${fontSize}px Arial`;

        const textWidth = context.measureText(text).width;

        let displayText = text;
        if (textWidth > canvas.width * 0.9) {
            let tempText = text;
            while (tempText.length
                    && context.measureText(`${tempText}...`).width > canvas.width * 0.9
            ) tempText = tempText.slice(0, -1);
            displayText = `${tempText}...`;
        }

        context.fillText(displayText, canvas.width / 2, canvas.height / 2);

        const aspectRatio = canvas.width / canvas.height;
        const width = Math.min(maxWidth, this._BOTTOM_PADDING * aspectRatio);
        const height = width / aspectRatio;
        const geometry = new PlaneGeometry(width, height);

        const texture = new CanvasTexture(canvas);
        texture.needsUpdate = true;
        const material = new MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: DoubleSide
        });

        return new Mesh(geometry, material);
    }

    private _createBuilding(
        node: d3.HierarchyRectangularNode<TreemapData>,
        isFolder: boolean
    ): Mesh {
        let depthPadding = isFolder ? this._BOTTOM_PADDING : 0;
        const { x0, y0, x1, y1 } = node;
        let width = (x1 - x0) * 0.95;
        let depth = (y1 - y0 - depthPadding) * 0.95;

        const metricNode = node.data.metrics;
        const height = this._MIN_BUILDING_HEIGHT
            + (metricNode.commentDensity * (this._MAX_BUILDING_HEIGHT - this._MIN_BUILDING_HEIGHT));

        const geometry = new BoxGeometry(width, height, depth);
        const material = isFolder
            ? this._createFolderMaterial(metricNode as FolderMetricNode)
            : this._createFileMaterial(metricNode as FileMetricNode);

        const mesh = new Mesh(geometry, material);
        const offsetX = (x1 - x0 - width) / 2;
        const offsetZ = (y1 - y0 - depthPadding - depth) / 2;
        mesh.position.set(
            x0 + offsetX - this._size / 2 + width / 2,
            height / 2,
            y0 + offsetZ - this._size / 2 + depth / 2
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const edgesGeometry = new EdgesGeometry(geometry);
        const edgesMaterial = new LineBasicMaterial({
            color: isFolder ? this._FOLDER_EDGE_COLOR : this._FILE_EDGE_COLOR,
            opacity: 0.6,
            transparent: true,
            linewidth: 1
        });
        const edges = new LineSegments(edgesGeometry, edgesMaterial);
        mesh.add(edges);

        return mesh;
    }

    private _createFolderMaterial(folderNode: FolderMetricNode): MeshStandardMaterial {
        const enhancedAbstractness = Math.pow(folderNode.abstractness, 0.7);

        const baseColor = new Color(this._FOLDER_BASE_COLOR);
        const highlightColor = new Color(this._FOLDER_HIGHLIGHT_COLOR);

        return new MeshStandardMaterial({
            color: baseColor.lerp(highlightColor, enhancedAbstractness),
            metalness: 0.2,
            roughness: 0.7
        });
    }

    private _createFileMaterial(_: FileMetricNode): MeshStandardMaterial {
        const baseColor = new Color(this._FILE_BASE_COLOR);
        const highlightColor = new Color(this._FILE_HIGHLIGHT_COLOR);

        return new MeshStandardMaterial({
            color: baseColor.lerp(highlightColor, Math.random()),
            metalness: 0.3,
            roughness: 0.6
        });
    }

    private _toggleFolder(folderPath: string): void {
        if (this._expandedFolders.has(folderPath))
            this._expandedFolders.delete(folderPath);
        else
            this._expandedFolders.add(folderPath);
        this._buildCity(false);
    }

    private _clearScene(): void {
        if (this._cityGroup) {
            this._sceneManager.scene.remove(this._cityGroup);
            this._cityGroup = undefined;
        }
        this.collidableObjects = [];
        this._selectedObject = undefined;
    }
}
