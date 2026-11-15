// The planet: one segmented mesh that blends between a sphere and the flat
// world map according to `view.flatten` (0 = sphere, 1 = map), drawn with
// earth.jpg and the active layer on top (FR1.1, FR1.2, FR3, NFR1).
//
// Both shapes live in one geometry: `position` holds the sphere and `aPlane`
// the flat map, and the vertex shader mixes them, so the blend costs nothing
// on the CPU. The flat map is shifted so the Amazon centre sits where the
// sphere's front point is once the planet faces the Amazon: the region stays
// in place while the planet flattens around it.
//
// Picking (FR4.1, FR4.2): an invisible sphere while on the planet and an
// invisible plane while on the map; nothing is picked during the transition.

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Euler,
  Matrix3,
  Matrix4,
  ShaderMaterial,
  Vector4,
  type Group,
  type IUniform,
  type Mesh,
  type Vector3,
  type Texture,
} from "three";
import type { BoundingBox } from "../data/types";
import type { ViewMode, ViewState } from "./FocusTransition";
import {
  GLOBE_RADIUS,
  PLANE_HEIGHT,
  PLANE_WIDTH,
  bboxCenter,
  isInsideBbox,
  lonLatToPlanePoint,
  lonLatToSpherePoint,
  planeUvToLonLat,
  spherePointToLonLat,
} from "./geo";
import type { LayerTextures } from "./layerTexture";

/** Turn speed of the spinning planet, radians per second. */
const SPIN_SPEED = 0.08;
/** Turn per dragged pixel, radians. */
const DRAG_SPEED = 0.005;
const MAX_PITCH = 1.2;
/** A press that moves more than this is a drag, not a click. */
const CLICK_TOLERANCE_PX = 5;
/** How often the point under a resting cursor is looked up again, seconds. */
const HOVER_REFRESH_SECONDS = 0.05;
/** Opacity of the active layer over the base image. */
const LAYER_OPACITY = 0.8;

export interface GlobeHit {
  lon: number;
  lat: number;
  clientX: number;
}

export interface EarthMeshProps {
  /** earth.jpg; null while loading or when it failed (a plain ocean colour is drawn). */
  baseTexture: Texture | null;
  layerTextures: LayerTextures;
  bbox: BoundingBox;
  view: RefObject<ViewState>;
  mode: ViewMode;
  segments: { width: number; height: number };
  onHover: (hit: GlobeHit | null) => void;
  onGlobeClick: (lon: number, lat: number) => void;
}

const VERTEX_SHADER = /* glsl */ `
  attribute vec3 aPlane;
  uniform mat3 uRotation;
  uniform float uFlatten;
  varying vec2 vUv;
  varying float vShade;

  void main() {
    vUv = uv;
    vec3 spherePosition = uRotation * position;
    vec3 blended = mix(spherePosition, aPlane, uFlatten);
    // Soft light from the upper left on the sphere; the flat map is lit evenly.
    float light = 0.55 + 0.45 * max(dot(normalize(spherePosition), normalize(vec3(-0.4, 0.5, 1.0))), 0.0);
    vShade = mix(light, 1.0, uFlatten);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(blended, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uBase;
  uniform bool uHasBase;
  uniform sampler2D uLayerGlobal;
  uniform bool uHasGlobal;
  uniform sampler2D uLayerRegion;
  uniform vec4 uBbox; // west, south, east, north in degrees
  uniform float uLayerOpacity;
  varying vec2 vUv;
  varying float vShade;

  void main() {
    vec3 color = uHasBase ? texture2D(uBase, vUv).rgb : vec3(0.04, 0.11, 0.23);
    float lon = -180.0 + 360.0 * vUv.x;
    float lat = -90.0 + 180.0 * vUv.y;
    vec4 overlay = vec4(0.0);
    if (lon >= uBbox.x && lon <= uBbox.z && lat >= uBbox.y && lat <= uBbox.w) {
      // Inside the Amazon: the detailed regional grid (north row first).
      vec2 regionUv = vec2((lon - uBbox.x) / (uBbox.z - uBbox.x), (uBbox.w - lat) / (uBbox.w - uBbox.y));
      overlay = texture2D(uLayerRegion, regionUv);
    } else if (uHasGlobal) {
      overlay = texture2D(uLayerGlobal, vec2(vUv.x, 1.0 - vUv.y));
    }
    color = mix(color, overlay.rgb, overlay.a * uLayerOpacity);
    gl_FragColor = vec4(color * vShade, 1.0);
  }
`;

/** Grid of vertices from the north-west corner: sphere in `position`, shifted flat map in `aPlane`. */
function buildMorphGeometry(columns: number, rows: number, bbox: BoundingBox): BufferGeometry {
  const count = (columns + 1) * (rows + 1);
  const spherePositions = new Float32Array(count * 3);
  const planePositions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const center = bboxCenter(bbox);
  const shift = lonLatToPlanePoint(center.lon, center.lat);

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const lat = 90 - 180 * v;
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const lon = -180 + 360 * u;
      const index = row * (columns + 1) + column;
      const sphere = lonLatToSpherePoint(lon, lat);
      const plane = lonLatToPlanePoint(lon, lat);
      spherePositions.set([sphere.x, sphere.y, sphere.z], index * 3);
      planePositions.set([plane.x - shift.x, plane.y - shift.y, GLOBE_RADIUS], index * 3);
      uvs.set([u, 1 - v], index * 2);
    }
  }

  const indices: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(spherePositions, 3));
  geometry.setAttribute("aPlane", new BufferAttribute(planePositions, 3));
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

interface Uniforms {
  [name: string]: IUniform;
  uRotation: IUniform<Matrix3>;
  uFlatten: IUniform<number>;
  uBase: IUniform<Texture | null>;
  uHasBase: IUniform<boolean>;
  uLayerGlobal: IUniform<Texture | null>;
  uHasGlobal: IUniform<boolean>;
  uLayerRegion: IUniform<Texture | null>;
  uBbox: IUniform<Vector4>;
  uLayerOpacity: IUniform<number>;
}

export function EarthMesh({ baseTexture, layerTextures, bbox, view, mode, segments, onHover, onGlobeClick }: EarthMeshProps) {
  const gl = useThree((state) => state.gl);
  const pickGroup = useRef<Group>(null);
  const sphereMesh = useRef<Mesh>(null);
  const planeMesh = useRef<Mesh>(null);
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  // Where the cursor rests over the canvas, so the point under it can be found
  // again while the planet turns or a transition ends beneath a still cursor.
  const pointerRef = useRef<{ inside: boolean; clientX: number }>({ inside: false, clientX: 0 });
  const sinceHoverRefresh = useRef(0);
  // True while the last report to the scene was a point (not "nothing under the cursor").
  const reportedPoint = useRef(false);

  const uniforms = useMemo<Uniforms>(
    () => ({
      uRotation: { value: new Matrix3() },
      uFlatten: { value: 0 },
      uBase: { value: null },
      uHasBase: { value: false },
      uLayerGlobal: { value: null },
      uHasGlobal: { value: false },
      uLayerRegion: { value: null },
      uBbox: { value: new Vector4() },
      uLayerOpacity: { value: LAYER_OPACITY },
    }),
    [],
  );
  const material = useMemo(
    () => new ShaderMaterial({ uniforms, vertexShader: VERTEX_SHADER, fragmentShader: FRAGMENT_SHADER, side: DoubleSide }),
    [uniforms],
  );
  useEffect(() => () => material.dispose(), [material]);

  const geometry = useMemo(
    () => buildMorphGeometry(segments.width, segments.height, bbox),
    [segments.width, segments.height, bbox],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(() => {
    uniforms.uBase.value = baseTexture;
    uniforms.uHasBase.value = baseTexture !== null;
    uniforms.uLayerGlobal.value = layerTextures.global;
    uniforms.uHasGlobal.value = layerTextures.global !== null;
    uniforms.uLayerRegion.value = layerTextures.region;
    uniforms.uBbox.value.set(bbox.west, bbox.south, bbox.east, bbox.north);
  }, [uniforms, baseTexture, layerTextures, bbox]);

  // Dragging follows the pointer anywhere on the page once it started on the planet.
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const state = view.current;
      state.yaw = drag.yaw + (event.clientX - drag.x) * DRAG_SPEED;
      state.pitch = Math.min(MAX_PITCH, Math.max(-MAX_PITCH, drag.pitch + (event.clientY - drag.y) * DRAG_SPEED));
    };
    const end = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [view]);

  useEffect(() => {
    if (mode !== "globe") dragRef.current = null;
    gl.domElement.style.cursor = "";
  }, [mode, gl]);

  const euler = useMemo(() => new Euler(0, 0, 0, "XYZ"), []);
  const rotation = useMemo(() => new Matrix4(), []);
  useFrame((_, delta) => {
    const state = view.current;
    if (state.spinning && mode === "globe" && dragRef.current === null) {
      state.yaw += SPIN_SPEED * Math.min(delta, 0.1);
    }
    euler.set(state.pitch, state.yaw, 0);
    rotation.makeRotationFromEuler(euler);
    uniforms.uRotation.value.setFromMatrix4(rotation);
    uniforms.uFlatten.value = state.flatten;
    pickGroup.current?.rotation.copy(euler);
  });

  // Remember whether the cursor is over the canvas and where, for the lookup below.
  useEffect(() => {
    const canvas = gl.domElement;
    const move = (event: PointerEvent) => {
      pointerRef.current = { inside: true, clientX: event.clientX };
    };
    const leave = () => {
      pointerRef.current = { ...pointerRef.current, inside: false };
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerleave", leave);
    return () => {
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerleave", leave);
    };
  }, [gl]);

  const sphereLonLat = (world: Vector3) => {
    const group = pickGroup.current;
    if (!group) return null;
    const local = group.worldToLocal(world.clone());
    return spherePointToLonLat(local.x, local.y, local.z);
  };

  const emit = (hit: GlobeHit | null) => {
    reportedPoint.current = hit !== null;
    onHover(hit);
  };

  const reportSphere = (world: Vector3, clientX: number) => {
    const point = sphereLonLat(world);
    if (!point) return;
    gl.domElement.style.cursor = isInsideBbox(point.lon, point.lat, bbox) ? "pointer" : "grab";
    emit({ ...point, clientX });
  };

  const reportPlane = (uvX: number, uvY: number, clientX: number) => {
    // PlaneGeometry's texture v grows northwards; planeUvToLonLat counts from the north.
    emit({ ...planeUvToLonLat(uvX, 1 - uvY), clientX });
  };

  // Browsers only send pointer events when the mouse moves. While the planet
  // turns, or when a transition ends under a still cursor, look the point up
  // again a few times a second so the sound follows what is under the cursor.
  useFrame((state, delta) => {
    sinceHoverRefresh.current += delta;
    if (sinceHoverRefresh.current < HOVER_REFRESH_SECONDS) return;
    sinceHoverRefresh.current = 0;
    const { inside, clientX } = pointerRef.current;
    if (!inside) {
      // The cursor left the canvas while the scene was ignoring hovers (a transition).
      if (reportedPoint.current) emit(null);
      return;
    }
    state.raycaster.setFromCamera(state.pointer, state.camera);
    if (mode === "globe" && sphereMesh.current) {
      pickGroup.current?.updateMatrixWorld(true);
      const hit = state.raycaster.intersectObject(sphereMesh.current, false)[0];
      if (hit) reportSphere(hit.point, clientX);
      else emit(null);
    } else if (mode === "map" && planeMesh.current) {
      planeMesh.current.updateMatrixWorld(true);
      const hit = state.raycaster.intersectObject(planeMesh.current, false)[0];
      if (hit?.uv) reportPlane(hit.uv.x, hit.uv.y, clientX);
      else emit(null);
    }
  });

  const handleSphereMove = (event: ThreeEvent<PointerEvent>) => {
    reportSphere(event.point, event.nativeEvent.clientX);
  };

  const handleSphereDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const state = view.current;
    dragRef.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY, yaw: state.yaw, pitch: state.pitch };
  };

  const handleSphereClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > CLICK_TOLERANCE_PX) return;
    const point = sphereLonLat(event.point);
    if (point) onGlobeClick(point.lon, point.lat);
  };

  const handlePlaneMove = (event: ThreeEvent<PointerEvent>) => {
    if (!event.uv) return;
    reportPlane(event.uv.x, event.uv.y, event.nativeEvent.clientX);
  };

  const handleOut = () => {
    gl.domElement.style.cursor = "";
    emit(null);
  };

  const center = bboxCenter(bbox);
  const shift = lonLatToPlanePoint(center.lon, center.lat);

  return (
    <>
      <mesh geometry={geometry} material={material} frustumCulled={false} />

      {mode === "globe" && (
        <group ref={pickGroup}>
          <mesh
            ref={sphereMesh}
            onPointerMove={handleSphereMove}
            onPointerDown={handleSphereDown}
            onClick={handleSphereClick}
            onPointerOut={handleOut}
          >
            <sphereGeometry args={[GLOBE_RADIUS * 1.002, 64, 32]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      )}

      {mode === "map" && (
        <mesh ref={planeMesh} position={[-shift.x, -shift.y, GLOBE_RADIUS]} onPointerMove={handlePlaneMove} onPointerOut={handleOut}>
          <planeGeometry args={[PLANE_WIDTH, PLANE_HEIGHT]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}
