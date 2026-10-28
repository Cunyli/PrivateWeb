// Keep storage paths out of the client rendition registry. Pair each stable photo
// ID with a source fingerprint so replacing its file cannot reuse stale metadata.
export function photoRenditionKey(source){
  const family=new URL(source,'https://portfolio.local').pathname.replace(/^\//,'').replace(/\/(?:original\.[^/]+|w\d+\.webp)$/,'')
  let hash=2166136261
  for(let i=0;i<family.length;i++)hash=Math.imul(hash^family.charCodeAt(i),16777619)
  return (hash>>>0).toString(16)
}
