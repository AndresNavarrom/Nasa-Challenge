import { defineConfig } from "vitest/config";

// The tested modules are pure functions (interpolation, timeline, value-to-sound
// mapping, screen-reader descriptions), so the plain Node environment is enough.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
