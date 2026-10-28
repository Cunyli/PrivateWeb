export const restingPaperAngle = Math.PI * 7 / 180

export function paperIndices(columns: number, rows: number) {
  const indices = new Uint16Array(columns * rows * 6)
  let offset = 0
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1
      indices.set([a, b, c, b, d, c], offset)
      offset += 6
    }
  }
  return indices
}

// Shared vertices keep both position and texture coordinates continuous.
// Projection is performed by WebGL so texture interpolation stays correct
// through the perspective, instead of approximating each triangle in 2D.
export function writePaperMesh(target: Float32Array, columns: number, rows: number,
  width: number, height: number, turn: number, bend: number, grip: number, direction: number) {
  // The spring can overshoot, but the visible sheet must not cross below
  // either resting page. Residual bend must also vanish at both endpoints.
  const progress = Math.max(0, Math.min(1, turn))
  const envelope = Math.sin(Math.PI * progress)
  const visibleBend = progress > 0 && progress < 1 ? bend : 0
  const angle = restingPaperAngle + (Math.PI - restingPaperAngle * 2) * progress
  let offset = 0
  for (let row = 0; row <= rows; row++) {
    const v = row / rows
    const curve = visibleBend * (.92 + .3 * (v - grip))
    const root = angle - curve * (.5 - .18 * envelope)
    for (let column = 0; column <= columns; column++) {
      const u = column / columns, tangent = root + curve * u
      const x = Math.abs(curve) < .0001 ? u * Math.cos(angle) : (Math.sin(tangent) - Math.sin(root)) / curve
      const z = Math.abs(curve) < .0001 ? u * Math.sin(angle) : (Math.cos(root) - Math.cos(tangent)) / curve
      target[offset++] = x * width * direction
      target[offset++] = (v - .5) * height - envelope * u * u * (v - grip) * height * .025
      target[offset++] = z * width
      target[offset++] = direction > 0 ? u : 1 - u
      target[offset++] = v
    }
  }
}
