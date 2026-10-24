import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../lib/database.mjs';
import { createSender } from '../lib/sender.mjs';
import { createNetlifyHandler } from '../netlify/functions/api.mjs';
import { createApplication } from '../server.mjs';

function remoteDriverDouble() {
  const database=new DatabaseSync(':memory:');let batches=0;
  const execute=async({sql,args=[]})=>{
    const statement=database.prepare(sql);
    if(/^\s*(select|pragma|with)/i.test(sql))return {rows:statement.all(...args)};
    return {...statement.run(...args),rows:[]};
  };
  const client={execute,executeMultiple:async sql=>database.exec(sql),close:()=>database.close(),
    transaction:async()=>{database.exec('BEGIN IMMEDIATE');return {execute,executeMultiple:async sql=>database.exec(sql),batch:async statements=>{batches++;return Promise.all(statements.map(execute));},commit:async()=>database.exec('COMMIT'),rollback:async()=>database.exec('ROLLBACK'),close:()=>{}};}};
  return {client,batches:()=>batches};
}
test('Turso adapter batches pending records and rolls back all writes on failure',async()=>{
  const mock=remoteDriverDouble(),store=await openDatabase(':memory:',{client:mock.client});
  try{
    assert.equal(store.remote,true);assert.equal((await store.all('products')).length,8);
    const initial=mock.batches();
    await store.transaction(async()=>{const product=await store.get('products','daily-cleanser');await store.put('products',{...product,stock:10});assert.equal((await store.get('products',product.id)).stock,10);await store.put('orders',{id:'test',items:[product.id]});});
    assert.equal(mock.batches(),initial+1);assert.equal((await store.get('products','daily-cleanser')).stock,10);
    await assert.rejects(store.transaction(async()=>{await store.put('products',{...await store.get('products','daily-cleanser'),stock:0});await store.db.prepare('INSERT INTO idempotency VALUES(?,?,?)').run('rollback-key','fingerprint','{}');throw new Error('Rollback test');}));
    assert.equal((await store.get('products','daily-cleanser')).stock,10);assert.equal(await store.db.prepare('SELECT * FROM idempotency WHERE key=?').get('rollback-key'),undefined);
  }finally{store.db.close();}
});
test('Sender adapter creates new subscribers in the correct group and enables automation',async()=>{
  const calls=[],sender=createSender({env:{EMAIL_ENABLED:'true',SENDER_API_KEY:'test-only-token',SENDER_GUIDE_GROUP_ID:'guide-group'},fetchImpl:async(url,options)=>{calls.push({url,options});return options.method==='GET'?Response.json({success:false},{status:404}):Response.json({success:true});}});
  await sender.subscribe({email:'test@example.test',name:'Ada'},'guide');assert.equal(calls.length,2);assert.equal(calls[1].url,'https://api.sender.net/v2/subscribers');assert.deepEqual(JSON.parse(calls[1].options.body),{email:'test@example.test',firstname:'Ada',groups:['guide-group'],trigger_automation:true});
});
test('Sender preserves provider suppression and sends unsubscribe changes upstream',async()=>{
  const calls=[],sender=createSender({env:{EMAIL_ENABLED:'true',SENDER_API_KEY:'test-token',SENDER_NEWSLETTER_GROUP_ID:'newsletter'},fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json({success:true,data:{subscriber_status:'UNSUBSCRIBED'}});}});
  await sender.subscribe({email:'existing@example.test',name:'Ada'},'newsletter');
  const patch=JSON.parse(calls.find(c=>c.options.method==='PATCH').options.body);assert.equal(patch.subscriber_status,undefined);
  await sender.unsubscribe('existing@example.test');const last=calls.at(-1);assert.equal(last.options.method,'PATCH');assert.equal(JSON.parse(last.options.body).subscriber_status,'UNSUBSCRIBED');
});
test('Sender is offline by default and provider errors never report delivery success',async()=>{
  let calls=0;const off=createSender({env:{},fetchImpl:()=>{calls++;throw new Error('No network expected');}});assert.equal(off.enabled,false);await off.subscribe({email:'a@example.test'},'guide');assert.equal(calls,0);
  const sender=createSender({env:{EMAIL_ENABLED:'true',SENDER_API_KEY:'test',SENDER_FROM_EMAIL:'store@example.test'},fetchImpl:async()=>Response.json({success:false},{status:500})});await assert.rejects(sender.send({to:'a@example.test',subject:'Test',body:'Test'}),/Sender request failed/);
});
test('Netlify wrapper fails safely without credentials and supports secured admin setup',async()=>{
  const missing=createNetlifyHandler({env:{}});assert.equal((await missing(new Request('https://preview.example.test/api/store'),{ip:'127.0.0.1'})).status,503);
  const mock=remoteDriverDouble(),previous=process.env.ADMIN_SETUP_TOKEN;process.env.ADMIN_SETUP_TOKEN='test-private-setup-token-only';
  const app=await createApplication({hosted:true,databaseOptions:{client:mock.client},sender:{enabled:false}});
  try{
    const handler=createNetlifyHandler({env:{TURSO_DATABASE_URL:'test-only',TURSO_AUTH_TOKEN:'test-only'},createApp:async()=>app}),origin='https://preview.example.test';
    const session=await handler(new Request(origin+'/api/session'),{ip:'203.0.113.1'});assert.equal((await session.json()).setupTokenRequired,true);
    const makeRequest=token=>new Request(origin+'/api/setup',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Owner',email:'owner@example.test',password:'a long test password',setupToken:token})});
    assert.equal((await handler(makeRequest('wrong'),{ip:'203.0.113.1'})).status,403);
    const response=await handler(makeRequest(process.env.ADMIN_SETUP_TOKEN),{ip:'203.0.113.1'});assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/Secure/);assert.equal((await response.json()).user.role,'admin');
  }finally{app.store.db.close();if(previous===undefined)delete process.env.ADMIN_SETUP_TOKEN;else process.env.ADMIN_SETUP_TOKEN=previous;}
});

test('hosted checkout needs owner push but not Gmail',async()=>{
  const mock=remoteDriverDouble();
  const app=await createApplication({hosted:true,databaseOptions:{client:mock.client},sender:{enabled:false},mailer:{canSend:false},cloudinary:{configured:true},push:{configured:true,publicKey:'test',validateEndpoint:value=>value,send:async()=>({expired:false})},paymentEnv:{BANK_NAME:'Example Bank',BANK_ACCOUNT_NAME:'DrealSkinhub Limited',BANK_ACCOUNT_NUMBER:'1234567890'},adminCredentialsEnv:{ADMIN_EMAIL:'owner@example.test',ADMIN_PASSWORD:'a secure admin password'}});
  try{
    const origin='https://preview.example.test',handler=createNetlifyHandler({env:{TURSO_DATABASE_URL:'test-only',TURSO_AUTH_TOKEN:'test-only'},createApp:async()=>app});
    const before=await handler(new Request(origin+'/api/store'),{ip:'203.0.113.1'});
    assert.equal((await before.json()).checkoutAvailable,false);
    const login=await handler(new Request(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'owner@example.test',password:'a secure admin password'})}),{ip:'203.0.113.1'});
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const setup=await handler(new Request(origin+'/api/admin/dashboard',{headers:{Cookie:cookie}}),{ip:'203.0.113.1'});
    const setupStatus=(await setup.json()).integrationStatus;
    assert.equal(setupStatus.checkoutReady,false);
    assert.equal(setupStatus.payments,'Enable push on an admin device');
    assert.match(setupStatus.cloudinary,/Configured/);
    const subscribe=await handler(new Request(origin+'/api/admin/push/subscribe',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({endpoint:'https://fcm.googleapis.com/fcm/send/admin-device'})}),{ip:'203.0.113.1'});
    assert.equal(subscribe.status,200);
    const after=await handler(new Request(origin+'/api/store'),{ip:'203.0.113.1'});
    assert.equal((await after.json()).checkoutAvailable,true);
    const connected=await handler(new Request(origin+'/api/admin/dashboard',{headers:{Cookie:cookie}}),{ip:'203.0.113.1'});
    assert.equal((await connected.json()).integrationStatus.checkoutReady,true);
  }finally{app.store.db.close();}
});
