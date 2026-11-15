// One-pole (exponential) smoothing for values that drive audio parameters.
//
// The prepared data can jump when a sample crosses the Amazon border (detailed
// regional grid -> coarse global grid). Feeding those jumps straight into the
// Web Audio graph clicks. This smoother spreads a jump over a short time window
// so the ear hears a glide; the engine still applies a parameter ramp on top.

/** Default time constant: ~63% of the distance covered every 150 ms. */
export const DEFAULT_SMOOTHING_SECONDS = 0.15;

export class OnePoleSmoother {
  private currentValue: number;
  private targetValue: number;
  private started: boolean;

  constructor(initial = 0) {
    const safeInitial = Number.isFinite(initial) ? initial : 0;
    this.currentValue = safeInitial;
    this.targetValue = safeInitial;
    this.started = false;
  }

  get value(): number {
    return this.currentValue;
  }

  get target(): number {
    return this.targetValue;
  }

  /** Sets the value to reach. Non-finite input counts as 0. */
  setTarget(target: number): void {
    this.targetValue = Number.isFinite(target) ? target : 0;
    this.started = true;
  }

  /** Jumps straight to a value and makes it the new target. */
  reset(value: number): void {
    const safeValue = Number.isFinite(value) ? value : 0;
    this.currentValue = safeValue;
    this.targetValue = safeValue;
    this.started = true;
  }

  /**
   * Advances the smoother by `dtSeconds`. Returns the new current value.
   *
   * With a non-positive time constant or no elapsed time it snaps to the
   * target, which keeps the first update and paused tabs deterministic.
   */
  advance(dtSeconds: number, timeConstantSeconds: number = DEFAULT_SMOOTHING_SECONDS): number {
    if (!this.started) {
      this.currentValue = this.targetValue;
      this.started = true;
      return this.currentValue;
    }
    const dt = Number.isFinite(dtSeconds) ? Math.max(0, dtSeconds) : 0;
    const timeConstant = Number.isFinite(timeConstantSeconds) ? Math.max(0, timeConstantSeconds) : 0;
    if (dt === 0 || timeConstant === 0) {
      this.currentValue = this.targetValue;
      return this.currentValue;
    }
    const alpha = 1 - Math.exp(-dt / timeConstant);
    this.currentValue += (this.targetValue - this.currentValue) * alpha;
    return this.currentValue;
  }
}
