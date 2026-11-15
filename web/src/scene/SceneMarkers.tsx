// Clickable scene points on the flattened Amazon map. Each point is a small
// white dot with a pulse ring and an invisible hit area; the points fade in when
// the map appears. Hovering shows the scene title through a DOM tooltip.

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { MeshBasicMaterial, type Mesh } from "three";
import type { BoundingBox } from "../data/types";
import type { SceneDefinition } from "../scenes/types";
import { sceneMapPosition } from "../scenes/geometry";
import { GLOBE_RADIUS } from "./geo";

const MARKER_RADIUS = 0.006;
const HIT_RADIUS = 0.04;
const RING_INNER = 0.008;
const RING_OUTER = 0.011;
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
  index: number;
  dotMaterial: MeshBasicMaterial;
  fadeRef: RefObject<number>;
  onSelect: (scene: SceneDefinition) => void;
  onHover: (scene: SceneDefinition | null, clientX?: number, clientY?: number) => void;
}

function SceneMarker({ scene, x, y, index, dotMaterial, fadeRef, onSelect, onHover }: SceneMarkerProps) {
  const gl = useThree((state) => state.gl);
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
  const phase = useRef((index * 0.55) % PULSE_SECONDS);

  useEffect(() => () => ringMaterial.dispose(), [ringMaterial]);

  useFrame((_, delta) => {
    phase.current = (phase.current + Math.min(0.1, delta)) % PULSE_SECONDS;
    const progress = phase.current / PULSE_SECONDS;
    ringRef.current?.scale.setScalar(1 + progress * 2.4);
    ringMaterial.opacity = 0.55 * (1 - progress) * fadeRef.current;
  });

  const handleOver = (event: ThreeEvent<PointerEvent>): void => {
    event.stopPropagation();
    gl.domElement.style.cursor = "pointer";
    onHover(scene, event.nativeEvent.clientX, event.nativeEvent.clientY);
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
      {points.map(({ scene, x, y }, index) => (
        <SceneMarker
          key={scene.id}
          scene={scene}
          x={x}
          y={y}
          index={index}
          dotMaterial={dotMaterial}
          fadeRef={fade}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </group>
  );
}
