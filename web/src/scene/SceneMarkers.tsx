// Clickable scene points on the flattened Amazon map. Each marker is a small
// amber ring with a larger invisible hit area; the popup itself is a DOM card.

import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";
import type { BoundingBox } from "../data/types";
import type { SceneDefinition } from "../scenes/types";
import { sceneMapPosition } from "../scenes/geometry";
import { GLOBE_RADIUS } from "./geo";

export interface SceneMarkersProps {
  scenes: SceneDefinition[];
  bbox: BoundingBox;
  onSelect: (scene: SceneDefinition) => void;
}

export function SceneMarkers({ scenes, bbox, onSelect }: SceneMarkersProps) {
  const gl = useThree((state) => state.gl);
  const points = useMemo(
    () => scenes.map((scene) => ({ scene, ...sceneMapPosition(scene, bbox) })),
    [scenes, bbox],
  );

  const setCursor = (value: string): void => {
    gl.domElement.style.cursor = value;
  };

  const handleOver = (event: ThreeEvent<PointerEvent>): void => {
    event.stopPropagation();
    setCursor("pointer");
  };

  const handleOut = (): void => {
    setCursor("");
  };

  const handleClick = (event: ThreeEvent<MouseEvent>, scene: SceneDefinition): void => {
    event.stopPropagation();
    setCursor("pointer");
    onSelect(scene);
  };

  return (
    <group>
      {points.map(({ scene, x, y }) => (
        <group key={scene.id} position={[x, y, GLOBE_RADIUS + 0.015]} name={`scene-marker-${scene.id}`} userData={{ sceneId: scene.id }}>
          <mesh renderOrder={3} onPointerOver={handleOver} onPointerOut={handleOut} onClick={(event) => handleClick(event, scene)}>
            <ringGeometry args={[0.028, 0.048, 32]} />
            <meshBasicMaterial color="#fbbf24" toneMapped={false} transparent opacity={0.95} />
          </mesh>
          <mesh renderOrder={3} onPointerOver={handleOver} onPointerOut={handleOut} onClick={(event) => handleClick(event, scene)}>
            <circleGeometry args={[0.016, 24]} />
            <meshBasicMaterial color="#fff7ed" toneMapped={false} />
          </mesh>
          <mesh onPointerOver={handleOver} onPointerOut={handleOut} onClick={(event) => handleClick(event, scene)}>
            <circleGeometry args={[0.09, 24]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
