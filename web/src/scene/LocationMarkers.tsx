// The selected listening point and the hovered crosshair, on the globe and on
// the flat Amazon map. Both are billboard sprites: they face the camera and stay
// legible while the planet turns or the map zooms.

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, SpriteMaterial, type Sprite } from "three";
import type { BoundingBox } from "../data/types";
import {
  GLOBE_RADIUS,
  bboxCenter,
  isInsideBbox,
  lonLatToPlanePoint,
  lonLatToSpherePoint,
} from "./geo";
import type { ListeningPoint } from "./listeningPoint";

const SELECTED_SIZE = 0.018;
const PULSE_SIZE = 0.022;
const CROSSHAIR_SIZE = 0.024;
const PULSE_SECONDS = 1.6;

type Position = [number, number, number];

function canvasTexture(draw: (context: CanvasRenderingContext2D) => void): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Location markers need a 2D canvas context.");
  draw(context);
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function selectedTexture(): CanvasTexture {
  return canvasTexture((context) => {
    context.clearRect(0, 0, 64, 64);
    context.beginPath();
    context.arc(32, 32, 25, 0, Math.PI * 2);
    context.fillStyle = "#ffffff";
    context.fill();
  });
}

function pulseTexture(): CanvasTexture {
  return canvasTexture((context) => {
    context.clearRect(0, 0, 64, 64);
    context.beginPath();
    context.arc(32, 32, 24, 0, Math.PI * 2);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 3;
    context.stroke();
  });
}

function crosshairTexture(): CanvasTexture {
  return canvasTexture((context) => {
    context.clearRect(0, 0, 64, 64);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(32, 5);
    context.lineTo(32, 59);
    context.moveTo(5, 32);
    context.lineTo(59, 32);
    context.stroke();
    context.beginPath();
    context.arc(32, 32, 2, 0, Math.PI * 2);
    context.fillStyle = "#ffffff";
    context.fill();
  });
}

function materialFor(texture: CanvasTexture, opacity = 1, depthTest = true): SpriteMaterial {
  return new SpriteMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthTest,
    depthWrite: false,
    toneMapped: false,
  });
}

export interface LocationMarkersProps {
  mode: "globe" | "map";
  bbox?: BoundingBox;
  selectedPoint?: ListeningPoint | null;
  hoverPoint?: { lon: number; lat: number } | null;
}

export function LocationMarkers({ mode, bbox, selectedPoint, hoverPoint }: LocationMarkersProps) {
  const pulseRef = useRef<Sprite>(null);
  const selectedMap = useMemo(selectedTexture, []);
  const pulseMap = useMemo(pulseTexture, []);
  const crosshairMap = useMemo(crosshairTexture, []);
  const selectedMaterial = useMemo(() => materialFor(selectedMap), [selectedMap]);
  const pulseMaterial = useMemo(() => materialFor(pulseMap, 0.7), [pulseMap]);
  const crosshairMaterial = useMemo(() => materialFor(crosshairMap, 0.95, false), [crosshairMap]);

  useEffect(() => {
    return () => {
      selectedMap.dispose();
      pulseMap.dispose();
      crosshairMap.dispose();
      selectedMaterial.dispose();
      pulseMaterial.dispose();
      crosshairMaterial.dispose();
    };
  }, [crosshairMap, crosshairMaterial, pulseMap, pulseMaterial, selectedMap, selectedMaterial]);

  const positionFor = (lon: number, lat: number): Position | null => {
    if (mode === "globe") {
      const point = lonLatToSpherePoint(lon, lat, GLOBE_RADIUS * 1.015);
      return [point.x, point.y, point.z];
    }
    if (!bbox || !isInsideBbox(lon, lat, bbox)) return null;
    const center = bboxCenter(bbox);
    const shift = lonLatToPlanePoint(center.lon, center.lat);
    const point = lonLatToPlanePoint(lon, lat);
    return [point.x - shift.x, point.y - shift.y, GLOBE_RADIUS + 0.02];
  };

  const selectedPosition = selectedPoint ? positionFor(selectedPoint.lon, selectedPoint.lat) : null;
  const hoverPosition = hoverPoint ? positionFor(hoverPoint.lon, hoverPoint.lat) : null;

  useFrame((state) => {
    const pulse = pulseRef.current;
    if (!pulse) return;
    const progress = (state.clock.elapsedTime % PULSE_SECONDS) / PULSE_SECONDS;
    pulse.scale.setScalar(PULSE_SIZE * (1 + progress * 0.8));
    pulseMaterial.opacity = 0.7 * (1 - progress);
  });

  return (
    <group>
      {selectedPosition && (
        <>
          <sprite position={selectedPosition} scale={[SELECTED_SIZE, SELECTED_SIZE, 1]} material={selectedMaterial} renderOrder={10} raycast={() => {}} />
          <sprite
            ref={pulseRef}
            position={selectedPosition}
            scale={[PULSE_SIZE, PULSE_SIZE, 1]}
            material={pulseMaterial}
            renderOrder={9}
            raycast={() => {}}
          />
        </>
      )}
      {hoverPosition && (
        <sprite position={hoverPosition} scale={[CROSSHAIR_SIZE, CROSSHAIR_SIZE, 1]} material={crosshairMaterial} renderOrder={11} raycast={() => {}} />
      )}
    </group>
  );
}
