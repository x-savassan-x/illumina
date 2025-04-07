import { MeshStandardMaterial, Mesh, Group, Color, Scene } from 'three';
import { hierarchy, treemap, HierarchyRectangularNode } from 'd3';
import { Area } from './Area';
import { GroundBuilder } from './GroundBuilder';
import { BuildingBuilder } from './BuildingBuilder';
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
    private readonly _groundBuilder: GroundBuilder = new GroundBuilder();
    private readonly _buildingBuilder: BuildingBuilder = new BuildingBuilder();
    private readonly _expandedFolders: Set<string> = new Set();
    private _rootNode: FolderMetricNode | undefined;
    private _treemapRoot: HierarchyRectangularNode<TreemapData> | undefined;
    private _cityGroup: Group | undefined;
    private _size: number = 0;
    private _selectedObject: Mesh | undefined;

    private readonly _OUTER_PADDING = 20;
    private readonly _INNER_PADDING = 20;
    private readonly _BOTTOM_PADDING = 80;

    public constructor(
        private readonly _scene: Scene,
        private readonly _onSizeChange: (size: number) => void
    ) { }

    public load(rootData: FolderMetricNode): void {
        this._rootNode = rootData;
        this._expandedFolders.clear();
        this._buildCity();
    }

    public selectObject(object?: Mesh): void {
        if (object === this._selectedObject) return;

        this._setEmissiveColor(this._selectedObject, 0x000000);
        this._setEmissiveColor(object, 0x333333);
        this._selectedObject = object;
    }

    private _setEmissiveColor(mesh: Mesh | undefined, value: number): void {
        if (mesh && mesh.material instanceof MeshStandardMaterial) {
            mesh.material.emissive = new Color(value);
        }
    }

    private _buildCity(hasNewData: boolean = true): void {
        if (!this._rootNode) return;

        this._clearScene();

        if (hasNewData) {
            this._calculateOptimalCitySize();
            this._onSizeChange(this._size);

            const data = this._convertToTreemapData(this._rootNode, this._rootNode.name);
            const rootHierarchy = hierarchy(data)
                .sum(d => d.value!)
                .sort((a, b) => {
                    if (a.children && !b.children) return -1;
                    if (!a.children && b.children) return 1;
                    return b.value! - a.value!;
                });
            this._treemapRoot = treemap<TreemapData>()
                .size([this._size, this._size])
                .paddingOuter(this._OUTER_PADDING)
                .paddingInner(this._INNER_PADDING)
                .paddingBottom(this._BOTTOM_PADDING)
                (rootHierarchy);
        }

        this._cityGroup = new Group();

        const baseGround = this._groundBuilder.build(
            Area.fromSide(this._size),
            this._size,
            0,
            this._rootNode.name,
            this._BOTTOM_PADDING
        );
        this._cityGroup.add(baseGround);

        this._processTreemapNode(this._treemapRoot!);

        this._scene.add(this._cityGroup);
    }

    private _calculateOptimalCitySize(): void {
        const baseSize = Math.sqrt(this._rootNode!.leafCount) * 100;
        const depthFactor = 1 + this._rootNode!.height * 0.5;
        this._size = Math.max(120, Math.ceil(baseSize * depthFactor));
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
                        value: child.linesOfCode
                    };
            })
        };
    }

    private _processTreemapNode(
        node: HierarchyRectangularNode<TreemapData>,
        level: number = 1
    ): void {
        if (!node.parent) {
            node.children?.forEach(child => this._processTreemapNode(child));
            return;
        }

        const { x0, y0, x1, y1 } = node;
        const isFolder = !!node.children;
        const { path, name, metrics } = node.data;

        if (this._expandedFolders.has(path)) {
            const ground = this._groundBuilder.build(
                new Area(x0, y0, x1, y1),
                this._size,
                level,
                name,
                this._BOTTOM_PADDING,
                {
                    name,
                    onDoubleClick: (): void => this._toggleFolder(path)
                }
            );
            this.collidableObjects.push(ground);
            this._cityGroup?.add(ground);

            node.children!.forEach(child => this._processTreemapNode(child, level + 1));
        }
        else {
            if (isFolder) {
                const ground = this._groundBuilder.build(
                    new Area(x0, y0, x1, y1),
                    this._size,
                    level,
                    name,
                    this._BOTTOM_PADDING
                );
                this._cityGroup?.add(ground);
            }

            console.log(name);
            const building = this._buildingBuilder.build(
                new Area(x0, y0, x1, y1 - (isFolder ? this._BOTTOM_PADDING : 0)),
                this._size,
                metrics.commentDensity * 500,
                isFolder
                    ? (metrics as FolderMetricNode).abstractness
                    : Math.max(0, Math.min(1, ((metrics as FileMetricNode).weightedMethodCount - 30) / (300 - 30))),
                isFolder,
                {
                    name,
                    onDoubleClick: isFolder ? ((): void => this._toggleFolder(path)) : undefined
                }
            );

            this.collidableObjects.push(building);
            this._cityGroup?.add(building);
        }
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
            this._scene.remove(this._cityGroup);
            this._cityGroup = undefined;
        }
        this.collidableObjects = [];
        this._selectedObject = undefined;
    }
}
