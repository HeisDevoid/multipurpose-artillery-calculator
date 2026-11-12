/** Map view: world coordinates of the canvas top-left corner (m) and pixels per metre. */
export interface PinchView {
  x0: number
  y0: number
  scale: number
}

/** A finger position relative to the canvas, px. */
export interface TouchPoint {
  x: number
  y: number
}

const middle = (a: TouchPoint, b: TouchPoint): TouchPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const spread = (a: TouchPoint, b: TouchPoint) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * The view after a two-finger gesture. The world point that was between the fingers when the
 * gesture started stays between them: spreading the fingers zooms, moving both drags the map.
 */
export function pinchView(
  start: PinchView,
  from: [TouchPoint, TouchPoint],
  to: [TouchPoint, TouchPoint],
  minScale: number,
  maxScale: number
): PinchView {
  const startSpread = spread(from[0], from[1])
  // Fingers that started on the same pixel give no ratio: only the drag applies
  const factor = startSpread > 0 ? spread(to[0], to[1]) / startSpread : 1
  const scale = Math.min(maxScale, Math.max(minScale, start.scale * factor))
  const anchor = middle(from[0], from[1])
  const worldX = start.x0 + anchor.x / start.scale
  const worldY = start.y0 - anchor.y / start.scale
  const now = middle(to[0], to[1])
  return { scale, x0: worldX - now.x / scale, y0: worldY + now.y / scale }
}
