import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createCloudinary } from '../lib/cloudinary.mjs';
import { createApplication } from '../server.mjs';

test('Cloudinary sends public products and private proofs through server credentials',async()=>{
  const requests=[],cloud='test-cloud',assetId='wu1js8tlwoib7839a0bkw';
  const adapter=createCloudinary({env:{CLOUDINARY_CLOUD_NAME:cloud,CLOUDINARY_API_KEY:'key',CLOUDINARY_API_SECRET:'secret'},fetchImpl:async(url,options)=>{
    requests.push({url,options});
    if(url.includes('/asset/download'))return new Response(new Uint8Array([255,216,255,0]));
    const privateAsset=url.endsWith('/image/authenticated');
    return Response.json({asset_id:assetId,secure_url:`https://res.cloudinary.com/${cloud}/image/${privateAsset?'authenticated':'upload'}/v1/drealskinhub/test.jpg`});
  }});
  const publicAsset=await adapter.upload(Buffer.from([255,216,255,0]),'image/jpeg');
  const proof=await adapter.upload(Buffer.from([255,216,255,0]),'image/jpeg',{privateAsset:true});
  assert.equal(adapter.ownsPublicUrl(publicAsset.url),true);
  assert.equal(adapter.ownsPublicUrl(proof.url),false);
  assert.equal(adapter.ownsPublicUrl('https://other.example/image.jpg'),false);
  assert.match(requests[0].url,/\/image\/upload$/);
  assert.match(requests[1].url,/\/image\/authenticated$/);
  assert.equal(requests[1].options.body.has('type'),false);
  assert.equal(requests[0].options.headers.Authorization,`Basic ${Buffer.from('key:secret').toString('base64')}`);
  assert.deepEqual(await adapter.download(assetId),Buffer.from([255,216,255,0]));
  const download=new URL(requests[2].url),query=download.searchParams;
  assert.match(download.pathname,/\/asset\/download$/);
  assert.equal(query.get('asset_id'),assetId);
  assert.equal(query.get('api_key'),'key');
  assert.equal(query.get('signature'),createHash('sha1').update(`asset_id=${assetId}&timestamp=${query.get('timestamp')}secret`).digest('hex'));
  assert.equal(requests[2].options.headers,undefined);
});

test('environment credentials own admin access and password rotation invalidates old sessions',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'dreal-admin-env-'));
  const path=join(folder,'store.sqlite');
  let app;
  try{
    const launch=async(password)=>{
      app=await createApplication({databasePath:path,databaseOptions:{url:null},sender:{enabled:false},adminCredentialsEnv:{ADMIN_EMAIL:'owner@example.test',ADMIN_PASSWORD:password,ADMIN_NAME:'Owner'}});
      await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
      return `http://127.0.0.1:${app.server.address().port}`;
    };
    let origin=await launch('first secure password');
    const call=async(route,data,cookie='')=>{
      const response=await fetch(origin+route,{method:data?'POST':'GET',headers:{Origin:origin,...(data?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});
      return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
    };
    assert.equal((await call('/api/session')).data.setupRequired,false);
    assert.equal((await call('/api/setup',{name:'Wrong',email:'other@example.test',password:'another secure password'})).status,409);
    assert.equal((await call('/api/auth/login',{email:'owner@example.test',password:'incorrect password'})).status,401);
    const login=await call('/api/auth/login',{email:'owner@example.test',password:'first secure password'});
    assert.equal(login.status,200);
    assert.equal(login.data.user.role,'admin');
    assert.equal((await call('/api/admin/dashboard',undefined,login.cookie)).status,200);
    assert.equal((await call('/api/auth/login',{email:'owner@example.test',password:'first secure password'})).status,200);
    assert.equal((await call('/api/admin/dashboard',undefined,login.cookie)).status,200);
    const stored=await app.store.db.prepare('SELECT password FROM users WHERE email=?').get('owner@example.test');
    assert.notEqual(stored.password,'first secure password');
    await app.close();
    origin=await launch('second secure password');
    assert.equal((await call('/api/session',undefined,login.cookie)).data.user,null);
    assert.equal((await call('/api/auth/login',{email:'owner@example.test',password:'first secure password'})).status,401);
    assert.equal((await call('/api/auth/login',{email:'owner@example.test',password:'second secure password'})).status,200);
  }finally{if(app)await app.close().catch(()=>{});await rm(folder,{recursive:true,force:true});}
});

test('admin image uploads use Cloudinary URLs and reject off-cloud image references',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'dreal-cloud-'));
  const cloudUrl='https://res.cloudinary.com/test-cloud/image/upload/v1/drealskinhub/products/example.jpg';
  const cloudinary=createCloudinary({env:{CLOUDINARY_CLOUD_NAME:'test-cloud',CLOUDINARY_API_KEY:'key',CLOUDINARY_API_SECRET:'secret'},fetchImpl:async()=>Response.json({asset_id:'wu1js8tlwoib7839a0bkw',secure_url:cloudUrl})});
  const app=await createApplication({databasePath:join(folder,'store.sqlite'),databaseOptions:{url:null},cloudinary,sender:{enabled:false},adminCredentialsEnv:{ADMIN_EMAIL:'owner@example.test',ADMIN_PASSWORD:'a secure admin password'}});
  try{
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    const origin=`http://127.0.0.1:${app.server.address().port}`;
    const call=async(route,payload,cookie='',method='POST')=>{const response=await fetch(origin+route,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(payload)});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
    const login=await call('/api/auth/login',{email:'owner@example.test',password:'a secure admin password'});
    const upload=await call('/api/admin/upload',{type:'image/jpeg',data:Buffer.from([255,216,255,0]).toString('base64')},login.cookie);
    assert.equal(upload.status,200);
    assert.equal(upload.data.url,cloudUrl);
    const original=await app.store.get('products','daily-cleanser');
    assert.equal((await call('/api/admin/products/daily-cleanser',{...original,images:[cloudUrl]},login.cookie,'PUT')).status,200);
    assert.equal((await app.store.get('products','daily-cleanser')).images[0],cloudUrl);
    assert.equal((await call('/api/admin/products/daily-cleanser',{...original,images:['https://other.example/injected.svg']},login.cookie,'PUT')).status,400);
  }finally{await app.close();await rm(folder,{recursive:true,force:true});}
});
