// Numbers the planet shader needs to draw a relief layer (forest, like NASA SVS
// 4950) from a height texture: the colour bar, the presence alpha and the levels
// of detail of the shaded relief and of the raised height. Pure functions, so
// the shader gets exactly what the CPU colour ramps use (layerTexture.ts).

import { rampColor, type ColorRamp } from "./layerTexture";

/** Number of colour bar stops the shader holds (`uniform vec3 uColorbar[11]`). */
export const SHADER_STOPS = 11;

/**
 * Distance between the samples of the shaded relief, in degrees: fixed, so its
 * strength does not depend on the resolution of the height texture. Larger
 * when the texture is coarser than this (the grid fallback) or the view is far.
 */
export const SHADE_STEP_GLOBAL_DEGREES = 0.1;
export const SHADE_STEP_REGION_DEGREES = 0.02;

/**
 * The ramp's colours at SHADER_STOPS evenly spaced values (0 to 255), as a flat
 * list of 0..1 RGB triples for a `vec3[11]` uniform. For the forest these are
 * exactly the GEDI colour bar stops (every 5 m from 0 to 50 m).
 */
export function shaderColorbar(ramp: ColorRamp): Float32Array {
  const out = new Float32Array(SHADER_STOPS * 3);
  for (let i = 0; i < SHADER_STOPS; i += 1) {
    const color = rampColor(ramp, (i * 255) / (SHADER_STOPS - 1));
    out.set([color[0] / 255, color[1] / 255, color[2] / 255], i * 3);
  }
  return out;
}

/**
 * Presence alpha of the ramp for the shader, on the 0..1 height scale: alpha is
 * clamp((h - start) / fade, 0, 1), the same as rampAlpha (0 up to `from - fade`,
 * opaque from `from`). A ramp without `presence` keeps alpha = value.
 */
export function shaderPresence(ramp: ColorRamp): [start: number, fade: number] {
  if (!ramp.presence) return [0, 1 / ramp.maxAlpha];
  const { from, fade } = ramp.presence;
  return [(from - fade) / 255, fade / 255];
}

/**
 * Mipmap level whose texels are about `spacingDegrees` wide, for a texture with
 * cells of `cellDegrees`: used to sample the height once per mesh vertex (raised
 * height) or once per shading step without aliasing. 0 when the spacing is finer
 * than a texel or a size is unknown.
 */
export function lodForSpacing(spacingDegrees: number, cellDegrees: number): number {
  if (!(spacingDegrees > 0) || !(cellDegrees > 0)) return 0;
  return Math.max(0, Math.log2(spacingDegrees / cellDegrees));
}

/** Shading step in degrees: the fixed step, or one texel when the texture is coarser. */
export function shadeStepDegrees(fixedDegrees: number, cellDegrees: number): number {
  return Math.max(fixedDegrees, cellDegrees > 0 ? cellDegrees : 0);
}
