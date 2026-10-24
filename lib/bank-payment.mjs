import { createHash, timingSafeEqual } from 'node:crypto';

export function bankDetails(env=process.env) {
  const bank=String(env.BANK_NAME||'').trim();
  const name=String(env.BANK_ACCOUNT_NAME||'').trim();
  const number=String(env.BANK_ACCOUNT_NUMBER||'').trim();
  if(!bank&&!name&&!number)return null;
  const safe=/^[\p{L}\p{N} .,()&'\/-]+$/u;
  if(!bank||bank.length>100||!safe.test(bank)||!name||name.length>120||!safe.test(name)||!/^\d{10}$/.test(number))return null;
  return {bank,name,number};
}

export function tokenMatches(token,storedHash) {
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||typeof storedHash!=='string'||!/^[a-f0-9]{64}$/.test(storedHash))return false;
  const digest=createHash('sha256').update(token).digest();
  return timingSafeEqual(digest,Buffer.from(storedHash,'hex'));
}

export function proofImage(data,type) {
  if(typeof data!=='string'||data.length>4100000||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data))throw new Error('Upload a valid image file.');
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type];
  if(!ext)throw new Error('Upload a JPG, PNG, or WebP image.');
  const bytes=Buffer.from(data,'base64');
  if(bytes.length<32||bytes.length>3000000)throw new Error('The image must be smaller than 3 MB.');
  const valid=ext==='jpg'?bytes.subarray(0,3).equals(Buffer.from([255,216,255]))&&bytes.subarray(-2).equals(Buffer.from([255,217])):
    ext==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.subarray(-8,-4).toString('ascii')==='IEND':
    bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'&&bytes.readUInt32LE(4)+8===bytes.length;
  if(!valid)throw new Error('The file does not match its image type.');
  return {bytes,ext};
}
