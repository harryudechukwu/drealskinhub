import { Readable } from 'node:stream';
import { createApplication } from '../../server.mjs';

export function createNetlifyHandler({createApp=createApplication,env=process.env}={}) {
 let application;
 return async function handler(request,context) {
  try {
    if(!env.TURSO_DATABASE_URL||!env.TURSO_AUTH_TOKEN)return Response.json({error:'The store database has not been connected. Add Turso credentials in Netlify environment variables.'},{status:503,headers:{'Cache-Control':'no-store'}});
    application??=createApp({hosted:true,secureCookies:true}).catch(error=>{application=null;throw error;});
    const app=await application,url=new URL(request.url);
    const bytes=Buffer.from(await request.arrayBuffer());if(bytes.length>4200000)return Response.json({error:'This file is too large. Maximum upload size is 3 MB.'},{status:413});
    const req=Readable.from(bytes.length?[bytes]:[]);req.method=request.method;req.url=url.pathname+url.search;
    req.headers=Object.fromEntries(request.headers);req.headers.host=url.host;req.socket={remoteAddress:context.ip||'unknown'};
    const headers=new Headers();let responseBody=null;
    const res={statusCode:200,setHeader:(key,value)=>headers.set(key,value),end:value=>{responseBody=value??null;}};
    await app.handle(req,res);
    return new Response(responseBody,{status:res.statusCode,headers});
  }catch(error){console.error('Store API failed:',error.message);return Response.json({error:'The store is temporarily unavailable. Please try again.'},{status:503,headers:{'Cache-Control':'no-store'}});}
 };
}
export default createNetlifyHandler();
export const config={path:['/api/*','/uploads/*']};
