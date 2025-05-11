import React, { useRef, useEffect, useState } from 'react';
import { Raycaster, Vector2, Mesh } from 'three';
import { FolderMetricNode } from '@shared/index';
import { SceneManager } from './SceneManager';
import { CityBuilder } from './builder';
import { getVSCodeAPI } from '@webview/vscode-api';
import './VizScreen.css';


export const VizScreen: React.FC<{ data: FolderMetricNode }> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const cityBuilderRef = useRef<CityBuilder | null>(null);

  const raycasterRef = useRef<Raycaster>(new Raycaster());
  const mouseRef = useRef<Vector2>(new Vector2());

  const [mousePosition, setMousePosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [hoveredObject, setHoveredObject] = useState<string>();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const vscode = getVSCodeAPI();

    const sceneManager = new SceneManager(container);
    sceneManagerRef.current = sceneManager;

    cityBuilderRef.current = new CityBuilder(
      sceneManager.scene,
      (size: number) => sceneManager.update(size)
    );

    cityBuilderRef.current.openFile = (filePath: string) => {
      vscode.postMessage({
        command: 'openFile',
        data: filePath,
      });
    }

    sceneManager.startRendering();

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleClick);
    container.addEventListener('dblclick', handleDoubleClick);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('dblclick', handleDoubleClick);
      sceneManager.dispose();
    };
  }, []);

  useEffect(() => {
    cityBuilderRef.current?.load(data);
  }, [data]);

  const handleMouseMove = (event: MouseEvent) => {
    setMousePosition({ x: event.clientX, y: event.clientY });
    const intersectedObject = getIntersectedObject(event);
    const userdata = intersectedObject?.userData;
    setHoveredObject(userdata?.name);
    document.body.style.cursor = userdata?.onDoubleClick ? 'pointer' : 'default';
  };

  const handleClick = (event: MouseEvent) => {
    const intersectedObject = getIntersectedObject(event);
    cityBuilderRef.current?.selectObject(intersectedObject as Mesh);
  };

  const handleDoubleClick = (event: MouseEvent) => {
    const intersectedObject = getIntersectedObject(event);
    intersectedObject?.userData?.onDoubleClick?.();
  };

  const getIntersectedObject = (event: MouseEvent): Mesh | undefined => {
    const container = containerRef.current;
    const sceneManager = sceneManagerRef.current;
    const cityBuilder = cityBuilderRef.current;

    if (!container || !sceneManager || !cityBuilder) return;

    const { clientX, clientY } = event;
    const { left, top } = container.getBoundingClientRect();
    const { clientWidth, clientHeight } = container;
    const mouse = mouseRef.current;
    mouse.x = ((clientX - left) / clientWidth) * 2 - 1;
    mouse.y = -((clientY - top) / clientHeight) * 2 + 1;

    const raycaster = raycasterRef.current;
    raycaster.setFromCamera(mouse, sceneManager.camera);
    const intersects = raycaster.intersectObjects(cityBuilder.collidableObjects, false);

    return intersects[0]?.object as Mesh;
  };

  return (
    <div className="city-metaphor-wrapper">
      <div className="city-metaphor-container" ref={containerRef}>
        {hoveredObject && (
          <div
            className="tooltip"
            style={{
              left: `${mousePosition.x + 15}px`,
              top: `${mousePosition.y - 10}px`
            }}
          >
            {hoveredObject}
          </div>
        )}
      </div>
      <div className="controls-footer">
          <span className="control-instruction">Left Click: Select</span>
          <span className="control-divider">|</span>
          <span className="control-instruction">Double Click: Expand/Collapse</span>
          <span className="control-divider">|</span>
          <span className="control-instruction">Left Click + Drag: Rotate</span>
          <span className="control-divider">|</span>
          <span className="control-instruction">Right Click + Drag: Pan</span>
          <span className="control-divider">|</span>
          <span className="control-instruction">Mouse Wheel: Zoom</span>
        </div>
    </div>
  );
};
