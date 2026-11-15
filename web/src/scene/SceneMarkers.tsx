// Clickable scene points on the flattened Amazon map. Each point is a small
// white dot with a pulse ring and an invisible hit area; the points fade in when
// the map appears. Hovering shows the scene title through a DOM tooltip.

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { MeshBasicMaterial, Vector3, type Mesh } from "three";
import type { BoundingBox } from "../data/types";
import type { SceneDefinition } from "../scenes/types";
import { sceneMapPosition } from "../scenes/geometry";
import { GLOBE_RADIUS } from "./geo";

const MARKER_RADIUS = 0.006;
const HIT_RADIUS = 0.04;
const RING_INNER = 0.009;
const RING_OUTER = 0.0105;
const PULSE_SECONDS = 1.6;
const FADE_IN_SECONDS = 0.5;

export interface SceneMarkersProps {
  scenes: SceneDefinition[];
  bbox: BoundingBox;
  onSelect: (scene: SceneDefinition) => void;
  onHover: (scene: SceneDefinition | null, clientX?: number, clientY?: number) => void;
}

interface SceneMarkerProps {
  scene: SceneDefinition;
  x: number;
  y: number;
  dotMaterial: MeshBasicMaterial;
  fadeRef: RefObject<number>;
  onSelect: (scene: SceneDefinition) => void;
  onHover: (scene: SceneDefinition | null, clientX?: number, clientY?: number) => void;
}

function SceneMarker({ scene, x, y, dotMaterial, fadeRef, onSelect, onHover }: SceneMarkerProps) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const ringRef = useRef<Mesh>(null);
  const ringMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0,
        toneMapped: false,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => ringMaterial.dispose(), [ringMaterial]);

  useFrame((state) => {
    // Use the shared scene clock, so every pulse is in phase.
    const progress = (state.clock.elapsedTime % PULSE_SECONDS) / PULSE_SECONDS;
    ringRef.current?.scale.setScalar(1 + progress * 1.1);
    ringMaterial.opacity = 0.6 * (1 - progress) * fadeRef.current;
  });

  const handleOver = (event: ThreeEvent<PointerEvent>): void => {
    event.stopPropagation();
    gl.domElement.style.cursor = "pointer";
    // Project the marker centre, not the pointer edge, so the tooltip can sit
    // centred above the dot.
    const projected = new Vector3(x, y, GLOBE_RADIUS + 0.012).project(camera);
    const rect = gl.domElement.getBoundingClientRect();
    onHover(
      scene,
      rect.left + (projected.x * 0.5 + 0.5) * rect.width,
      rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
    );
  };

  const handleOut = (): void => {
    gl.domElement.style.cursor = "";
    onHover(null);
  };

  const handleClick = (event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation();
    gl.domElement.style.cursor = "pointer";
    onSelect(scene);
  };

  return (
    <group
      position={[x, y, GLOBE_RADIUS + 0.012]}
      name={`scene-marker-${scene.id}`}
      userData={{ sceneId: scene.id }}
    >
      <mesh ref={ringRef} renderOrder={2} material={ringMaterial} raycast={() => {}}>
        <ringGeometry args={[RING_INNER, RING_OUTER, 32]} />
      </mesh>
      <mesh renderOrder={3} material={dotMaterial} raycast={() => {}}>
        <circleGeometry args={[MARKER_RADIUS, 20]} />
      </mesh>
      <mesh onPointerOver={handleOver} onPointerOut={handleOut} onClick={handleClick}>
        <circleGeometry args={[HIT_RADIUS, 20]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function SceneMarkers({ scenes, bbox, onSelect, onHover }: SceneMarkersProps) {
  const points = useMemo(
    () => scenes.map((scene) => ({ scene, ...sceneMapPosition(scene, bbox) })),
    [scenes, bbox],
  );
  const dotMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#ffffff",
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

  return (
    <group>
      {points.map(({ scene, x, y }) => (
        <SceneMarker
          key={scene.id}
          scene={scene}
          x={x}
          y={y}
          dotMaterial={dotMaterial}
          fadeRef={fade}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </group>
  );
}
