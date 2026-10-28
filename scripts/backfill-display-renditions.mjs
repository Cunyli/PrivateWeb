import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { S3Client, HeadObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { photoRenditionKey } from '../lib/photo-rendition-key.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const manifestPath=path.join(root,'data/photo-display-renditions.json')
const requested=process.argv.find(v=>v.startsWith('--ids='))?.slice(6).split(',').map(Number)
const apply=process.argv.includes('--apply')
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY)
const s3=new S3Client({endpoint:process.env.R2_ENDPOINT_URL,region:'auto',forcePathStyle:true,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}})
const Bucket=process.env.R2_BUCKET_NAME
const result=await db.from('pictures').select('id,image_url').eq('is_published',true).order('id')
if(result.error)throw result.error
const photos=result.data.filter(p=>!requested||requested.includes(p.id))
const manifest=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):{}
const save=()=>{const temporary=manifestPath+'.tmp';fs.writeFileSync(temporary,JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a],[b])=>a.localeCompare(b))),null,2)+'\n');fs.renameSync(temporary,manifestPath)}
let position=0,completed=0,created=0,bytes=0
const started=Date.now()
console.log(JSON.stringify({eligible:photos.length,apply,maxEdge:2560,workers:3}))
if(apply){
 await Promise.all(Array.from({length:3},async()=>{
  while(position<photos.length){
   const photo=photos[position++]
   const original=new URL(photo.image_url,'https://portfolio.local').pathname.replace(/^\//,'')
   if(!/^picture\/responsive\/[^/]+\/original\.(?:jpe?g|png|webp)$/i.test(original))throw Error(`Unexpected source for ${photo.id}`)
   const family=original.replace(/\/original\.[^.]+$/,'')
   const Key=family+'/w2560.webp'
   const fingerprint=photoRenditionKey(photo.image_url)
   if(manifest[photo.id]?.key!==fingerprint){
    let existing
    try{existing=await s3.send(new HeadObjectCommand({Bucket,Key}))}catch(error){if(error.$metadata?.httpStatusCode!==404)throw error}
    let width=Number(existing?.Metadata?.width),height=Number(existing?.Metadata?.height)
    if(!existing){
     const source=await s3.send(new GetObjectCommand({Bucket,Key:original}))
     if(Number(source.ContentLength)>80*1024*1024)throw Error(`Oversized source for ${photo.id}`)
     const buffer=await source.Body.transformToByteArray()
     const rendered=await sharp(buffer,{limitInputPixels:100_000_000}).autoOrient().resize({width:2560,height:2560,fit:'inside',withoutEnlargement:true}).webp({quality:84,effort:4}).toBuffer({resolveWithObject:true})
     width=rendered.info.width;height=rendered.info.height
     await s3.send(new PutObjectCommand({Bucket,Key,Body:rendered.data,ContentType:'image/webp',CacheControl:'public,max-age=31536000,immutable',Metadata:{width:String(width),height:String(height)},IfNoneMatch:'*'}))
     bytes+=rendered.data.length;created++
    }else if(!width||!height){
     const object=await s3.send(new GetObjectCommand({Bucket,Key}));const info=await sharp(await object.Body.transformToByteArray()).metadata();width=info.width;height=info.height
    }
    manifest[photo.id]={width,height,key:fingerprint}
    save()
   }
   completed++
   if(completed%25===0||completed===photos.length)console.log(JSON.stringify({completed,total:photos.length,created,uploadedMiB:Math.round(bytes/1048576),elapsedS:Math.round((Date.now()-started)/1000)}))
  }
 }))
}
