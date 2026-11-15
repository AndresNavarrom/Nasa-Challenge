// Clickable scene points on the flattened Amazon map. Each marker is a small
// dot with a larger invisible hit area; the points fade in when the map
// appears. The popup itself is a DOM card.

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { MeshBasicMaterial } from "three";
import type { BoundingBox } from "../data/types";
import type { SceneDefinition } from "../scenes/types";
import { sceneMapPosition } from "../scenes/geometry";
import { GLOBE_RADIUS } from "./geo";

const MARKER_RADIUS = 0.012;
const HIT_RADIUS = 0.05;
const FADE_IN_SECONDS = 0.5;

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
  const dotMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#fbbf24",
        transparent: true,
        opacity: 0,
        toneMapped: false,
        depthWrite: false,
      }),
    [],
  );
  const fade = useRef(0);

  useEffect(() => () => dotMaterial.dispose(), [dotMaterial]);

  useFrame((_, delta) => {
    if (fade.current >= 1) return;
    fade.current = Math.min(1, fade.current + Math.min(0.1, delta) / FADE_IN_SECONDS);
    dotMaterial.opacity = fade.current;
  });

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
        <group key={scene.id} position={[x, y, GLOBE_RADIUS + 0.012]} name={`scene-marker-${scene.id}`} userData={{ sceneId: scene.id }}>
          <mesh
            renderOrder={3}
            material={dotMaterial}
            onPointerOver={handleOver}
            onPointerOut={handleOut}
            onClick={(event) => handleClick(event, scene)}
          >
            <circleGeometry args={[MARKER_RADIUS, 20]} />
          </mesh>
          <mesh onPointerOver={handleOver} onPointerOut={handleOut} onClick={(event) => handleClick(event, scene)}>
            <circleGeometry args={[HIT_RADIUS, 20]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
