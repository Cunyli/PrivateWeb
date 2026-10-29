// Keep native density on ordinary Retina/phone layouts, while bounding large
// viewports and the GPU's maximum buffer dimension. This includes curl overscan.
export function paperPixelRatio(width:number,height:number,density:number,maxDimension:number) {
  return Math.min(density || 1,3,Math.sqrt(6_000_000/Math.max(1,width*height)),maxDimension/Math.max(1,width,height))
}
