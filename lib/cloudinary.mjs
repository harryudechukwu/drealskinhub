import { createHash, randomUUID } from 'node:crypto';

export function createCloudinary({env=process.env,fetchImpl=fetch}={}){
  const cloud=env.CLOUDINARY_CLOUD_NAME||'',key=env.CLOUDINARY_API_KEY||'',secret=env.CLOUDINARY_API_SECRET||'';
  const configured=!!(cloud&&key&&secret);
  if([cloud,key,secret].some(Boolean)&&!configured)throw new Error('Set all three Cloudinary environment variables.');
  if(configured&&!/^[a-zA-Z0-9_-]+$/.test(cloud))throw new Error('Invalid Cloudinary cloud name.');
  const authorization='Basic '+Buffer.from(`${key}:${secret}`).toString('base64');
  const api=`https://api.cloudinary.com/v1_1/${cloud}`;
  async function upload(bytes,type,{privateAsset=false}={}){
    if(!configured)throw new Error('Cloudinary is not configured.');
    const form=new FormData();
    form.set('file',new Blob([bytes],{type}),`${randomUUID()}.${type.split('/')[1]==='jpeg'?'jpg':type.split('/')[1]}`);
    form.set('public_id',`drealskinhub/${privateAsset?'payment-proofs':'products'}/${randomUUID()}`);
    form.set('overwrite','false');
    let response;
    try{response=await fetchImpl(`${api}/image/${privateAsset?'authenticated':'upload'}`,{method:'POST',redirect:'error',headers:{Authorization:authorization},body:form,signal:AbortSignal.timeout(20000)});}
    catch{throw new Error('Image storage is temporarily unavailable. Please try again.');}
    if(!response.ok)throw new Error('Image storage rejected the upload. Please try again.');
    const result=await response.json();
    if(typeof result.asset_id!=='string'||!/^[a-zA-Z0-9_-]{16,128}$/.test(result.asset_id)||typeof result.secure_url!=='string')throw new Error('Image storage returned an invalid upload.');
    const url=new URL(result.secure_url);
    if(url.protocol!=='https:'||url.hostname!=='res.cloudinary.com'||url.port||url.username||url.password||!url.pathname.startsWith(`/${cloud}/image/${privateAsset?'authenticated':'upload'}/`))throw new Error('Image storage returned an unexpected URL.');
    return {assetId:result.asset_id,url:result.secure_url};
  }
  async function download(assetId){
    if(!configured||!/^[a-zA-Z0-9_-]{16,128}$/.test(assetId||''))throw new Error('Invalid private image reference.');
    const timestamp=String(Math.floor(Date.now()/1000));
    const signature=createHash('sha1').update(`asset_id=${assetId}&timestamp=${timestamp}${secret}`).digest('hex');
    const query=new URLSearchParams({asset_id:assetId,timestamp,api_key:key,signature});
    let response;
    try{response=await fetchImpl(`${api}/asset/download?${query}`,{redirect:'error',signal:AbortSignal.timeout(20000)});}
    catch{throw new Error('Payment image is temporarily unavailable.');}
    if(!response.ok)throw new Error('Payment image is unavailable.');
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length>3000000)throw new Error('Payment image is too large.');
    return bytes;
  }
  function ownsPublicUrl(value){
    if(!configured)return false;
    try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='res.cloudinary.com'&&url.port===''&&url.username===''&&url.password===''&&url.search===''&&url.hash===''&&url.pathname.startsWith(`/${cloud}/image/upload/`);}
    catch{return false;}
  }
  return {configured,upload,download,ownsPublicUrl};
}
