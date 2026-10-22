import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export function createMedia({directory,hosted=false}={}) {
  return {
    async put(name,buffer,type){
      if(hosted){const {getStore}=await import('@netlify/blobs');const store=getStore({name:'dreal-media-'+(process.env.CONTEXT==='production'?'production':'preview'),consistency:'strong'});await store.set(name,new Uint8Array(buffer).buffer,{metadata:{type},onlyIfNew:true});}
      else {await mkdir(directory,{recursive:true});await writeFile(join(directory,name),buffer,{flag:'wx'});}
    },
    async get(name){
      if(!/^[a-f0-9-]+\.(jpg|png|webp|pdf)$/.test(name))return null;
      if(hosted){const {getStore}=await import('@netlify/blobs');const result=await getStore({name:'dreal-media-'+(process.env.CONTEXT==='production'?'production':'preview'),consistency:'strong'}).getWithMetadata(name,{type:'arrayBuffer'});return result?{body:Buffer.from(result.data),type:result.metadata.type}:null;}
      const types={jpg:'image/jpeg',png:'image/png',webp:'image/webp',pdf:'application/pdf'};
      try{return {body:await readFile(join(directory,name)),type:types[name.split('.').pop()]};}catch(error){if(error.code==='ENOENT')return null;throw error;}
    }
  };
}
