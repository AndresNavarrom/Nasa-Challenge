// Longitude and latitude as text for the HUD ("61.5° W", "3.2° S").

function degreesText(value: number, decimals: number, negative: string, positive: string): string {
  const rounded = Math.abs(value).toFixed(decimals);
  if (Number(rounded) === 0) return `${rounded}°`;
  return `${rounded}° ${value < 0 ? negative : positive}`;
}

export function formatLongitude(lon: number, decimals = 1): string {
  return degreesText(lon, decimals, "W", "E");
}

export function formatLatitude(lat: number, decimals = 1): string {
  return degreesText(lat, decimals, "S", "N");
}

/** A layer value (0..1) as a percentage, or the text for a place without data. */
export function formatLayerValue(value: number | null): string {
  return value === null ? "no data here" : `${Math.round(value * 100)} %`;
}
