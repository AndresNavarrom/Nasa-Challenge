// The selected listening point and the hovered crosshair, on the globe and on
// the flat Amazon map. Both are billboard sprites: they face the camera and stay
// legible while the planet turns or the map zooms.
//
// On a map the listening point is also a reference mark: two thin guide lines
// cross the whole map through it, along its latitude and its longitude, so the
// place being heard can be found at a glance and read against the map's edges.
// The point takes the contrast colour of the picked layer; the lines stay light,
// because a layer's colour does not stand out over its own map.

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  SpriteMaterial,
  Vector3,
  type Sprite,
} from "three";
import type { BoundingBox } from "../data/types";
import {
  GLOBE_RADIUS,
  bboxCenter,
  isInsideBbox,
  lonLatToPlanePoint,
  lonLatToSpherePoint,
} from "./geo";
import type { ListeningPoint } from "./listeningPoint";

// Angular sizes: multiplied by the camera distance so the markers keep a
// similar size on screen when the map is zoomed in or the planet is far away.
const SELECTED_ANGULAR_SIZE = 0.013;
const PULSE_ANGULAR_RATIO = 1.3;
const CROSSHAIR_ANGULAR_SIZE = 0.018;
// Keep a minimum world size so the markers do not shrink away when the camera
// zooms close, while the angular term keeps them readable from the globe view.
const SELECTED_MIN_SIZE = 0.018;
const CROSSHAIR_MIN_SIZE = 0.022;
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

function selectedTexture(color: string): CanvasTexture {
  return canvasTexture((context) => {
    context.clearRect(0, 0, 64, 64);
    context.beginPath();
    context.arc(32, 32, 26, 0, Math.PI * 2);
    context.fillStyle = "#ffffff";
    context.fill();
    context.beginPath();
    context.arc(32, 32, 20, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
  });
}

function pulseTexture(): CanvasTexture {
  return canvasTexture((context) => {
    context.clearRect(0, 0, 64, 64);
    context.beginPath();
    context.arc(32, 32, 24, 0, Math.PI * 2);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 6;
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
  /** Colour of the listening point. */
  color?: string;
}

/** The listening point without a layer colour: the accent of the palette. */
const DEFAULT_COLOR = "#5ee9b5";
const GUIDE_COLOR = "#e8edf5";
const GUIDE_OPACITY = 0.7;

export function LocationMarkers({ mode, bbox, selectedPoint, hoverPoint, color = DEFAULT_COLOR }: LocationMarkersProps) {
  const selectedRef = useRef<Sprite>(null);
  const pulseRef = useRef<Sprite>(null);
  const crosshairRef = useRef<Sprite>(null);
  const camera = useThree((state) => state.camera);
  const worldPosition = useMemo(() => new Vector3(), []);
  const selectedMap = useMemo(() => selectedTexture(color), [color]);
  const pulseMap = useMemo(pulseTexture, []);
  const crosshairMap = useMemo(crosshairTexture, []);
  const selectedMaterial = useMemo(() => materialFor(selectedMap), [selectedMap]);
  const pulseMaterial = useMemo(() => materialFor(pulseMap, 0.7), [pulseMap]);
  const crosshairMaterial = useMemo(() => materialFor(crosshairMap, 0.95, false), [crosshairMap]);

  // Guide lines of the listening point on a map: along its latitude and its
  // longitude, from edge to edge of the region.
  const guides = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(12), 3));
    const material = new LineBasicMaterial({
      color: GUIDE_COLOR,
      transparent: true,
      opacity: GUIDE_OPACITY,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const lines = new LineSegments(geometry, material);
    lines.renderOrder = 8;
    lines.frustumCulled = false;
    lines.raycast = () => {};
    return lines;
  }, []);
  useEffect(
    () => () => {
      guides.geometry.dispose();
      (guides.material as LineBasicMaterial).dispose();
    },
    [guides],
  );
  const guidePoint =
    mode === "map" && bbox && selectedPoint && isInsideBbox(selectedPoint.lon, selectedPoint.lat, bbox) ? selectedPoint : null;
  const guideLon = guidePoint?.lon ?? null;
  const guideLat = guidePoint?.lat ?? null;
  useEffect(() => {
    if (!bbox || guideLon === null || guideLat === null) return;
    const center = bboxCenter(bbox);
    const shift = lonLatToPlanePoint(center.lon, center.lat);
    const z = GLOBE_RADIUS + 0.015;
    const ends = [
      lonLatToPlanePoint(bbox.west, guideLat),
      lonLatToPlanePoint(bbox.east, guideLat),
      lonLatToPlanePoint(guideLon, bbox.south),
      lonLatToPlanePoint(guideLon, bbox.north),
    ];
    const positions = guides.geometry.getAttribute("position");
    ends.forEach((end, index) => positions.setXYZ(index, end.x - shift.x, end.y - shift.y, z));
    positions.needsUpdate = true;
  }, [guides, bbox, guideLon, guideLat]);

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

  const screenScale = (
    sprite: Sprite | null,
    angularSize: number,
    minSize: number,
  ): number => {
    if (!sprite) return 0;
    sprite.getWorldPosition(worldPosition);
    return Math.max(minSize, camera.position.distanceTo(worldPosition) * angularSize);
  };

  useFrame((state) => {
    const selected = selectedRef.current;
    const pulse = pulseRef.current;
    const crosshair = crosshairRef.current;
    const selectedSize = screenScale(selected, SELECTED_ANGULAR_SIZE, SELECTED_MIN_SIZE);
    if (selected) selected.scale.set(selectedSize, selectedSize, 1);

    if (pulse) {
      const progress = (state.clock.elapsedTime % PULSE_SECONDS) / PULSE_SECONDS;
      const pulseSize = selectedSize * PULSE_ANGULAR_RATIO * (1 + progress * 0.8);
      pulse.scale.set(pulseSize, pulseSize, 1);
      pulseMaterial.opacity = 0.7 * (1 - progress);
    }

    if (crosshair) {
      const crosshairSize = screenScale(crosshair, CROSSHAIR_ANGULAR_SIZE, CROSSHAIR_MIN_SIZE);
      crosshair.scale.set(crosshairSize, crosshairSize, 1);
    }
  });

  return (
    <group>
      {guidePoint && <primitive object={guides} />}
      {selectedPosition && (
        <>
          <sprite
            ref={selectedRef}
            position={selectedPosition}
            scale={[SELECTED_ANGULAR_SIZE, SELECTED_ANGULAR_SIZE, 1]}
            material={selectedMaterial}
            renderOrder={10}
            raycast={() => {}}
          />
          <sprite
            ref={pulseRef}
            position={selectedPosition}
            scale={[SELECTED_ANGULAR_SIZE * PULSE_ANGULAR_RATIO, SELECTED_ANGULAR_SIZE * PULSE_ANGULAR_RATIO, 1]}
            material={pulseMaterial}
            renderOrder={9}
            raycast={() => {}}
          />
        </>
      )}
      {hoverPosition && (
        <sprite
          ref={crosshairRef}
          position={hoverPosition}
          scale={[CROSSHAIR_ANGULAR_SIZE, CROSSHAIR_ANGULAR_SIZE, 1]}
          material={crosshairMaterial}
          renderOrder={11}
          raycast={() => {}}
        />
      )}
    </group>
  );
}
