import { describe, expect, it } from "vitest";
import {
  BASE_IMAGE_4K,
  BASE_IMAGE_8K,
  FOREST_HEIGHT_IMAGES,
  REGION_FOREST_HEIGHT_IMAGE,
  baseImageSteps,
  pickBaseImage,
  pickImage,
} from "./baseImage";

describe("pickImage for the forest height images", () => {
  it("picks the forest image size with the same rule as the base image", () => {
    expect(FOREST_HEIGHT_IMAGES).toEqual({ large: "forest-height-8k.png", small: "forest-height-4k.png" });
    expect(REGION_FOREST_HEIGHT_IMAGE).toBe("forest-height-amazon.png");

    expect(pickImage(16384, false, FOREST_HEIGHT_IMAGES)).toBe("forest-height-8k.png");
    expect(pickImage(8192, false, FOREST_HEIGHT_IMAGES)).toBe("forest-height-8k.png");
    expect(pickImage(4096, false, FOREST_HEIGHT_IMAGES)).toBe("forest-height-4k.png");
    expect(pickImage(16384, true, FOREST_HEIGHT_IMAGES)).toBe("forest-height-4k.png");
    expect(pickImage(null, false, FOREST_HEIGHT_IMAGES)).toBe("forest-height-4k.png");
  });

  it("defaults to the base image", () => {
    expect(pickImage(8192, false)).toBe("earth-8k.jpg");
    expect(pickImage(8192, true)).toBe("earth-4k.jpg");
  });
});

describe("pickBaseImage (FR1.2)", () => {
  it("uses the 8192 image only when the card accepts 8192-pixel textures and lite mode is off", () => {
    expect(BASE_IMAGE_8K).toBe("earth-8k.jpg");
    expect(BASE_IMAGE_4K).toBe("earth-4k.jpg");

    expect(pickBaseImage(8192, false)).toBe("earth-8k.jpg");
    expect(pickBaseImage(16384, false)).toBe("earth-8k.jpg");
    expect(pickBaseImage(4096, false)).toBe("earth-4k.jpg");
  });

  it("always uses the 4096 image with ?lite=1", () => {
    expect(pickBaseImage(16384, true)).toBe("earth-4k.jpg");
    expect(pickBaseImage(8192, true)).toBe("earth-4k.jpg");
  });

  it("falls back to the 4096 image when the largest texture size cannot be read", () => {
    expect(pickBaseImage(null, false)).toBe("earth-4k.jpg");
    expect(pickBaseImage(Number.NaN, false)).toBe("earth-4k.jpg");
  });
});

describe("baseImageSteps (fast first view)", () => {
  it("loads the 4096 image first and then the 8192 one when the card takes it", () => {
    expect(baseImageSteps(8192, false)).toEqual({ first: "earth-4k.jpg", then: "earth-8k.jpg" });
    expect(baseImageSteps(16384, false)).toEqual({ first: "earth-4k.jpg", then: "earth-8k.jpg" });
  });

  it("stops at the 4096 image on smaller cards, in lite mode and when the size is unknown", () => {
    expect(baseImageSteps(4096, false)).toEqual({ first: "earth-4k.jpg", then: null });
    expect(baseImageSteps(16384, true)).toEqual({ first: "earth-4k.jpg", then: null });
    expect(baseImageSteps(null, false)).toEqual({ first: "earth-4k.jpg", then: null });
  });
});
