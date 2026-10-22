import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve,sep } from 'node:path';
import { createApplication } from '../server.mjs';

let app,origin,adminCookie='',customerCookie='',folder;
async function request(path,body,method=body===undefined?'GET':'POST',cookie='',extra={}){
  const response=await fetch(origin+path,{method,headers:{Origin:origin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],headers:response.headers};
}
before(async()=>{folder=await mkdtemp(join(tmpdir(),'dreal-tests-'));app=await createApplication({databasePath:join(folder,'test.sqlite'),uploadDir:join(folder,'uploads'),databaseOptions:{url:null},sender:{enabled:false}});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${app.server.address().port}`;});
after(async()=>{await app.close();assert.ok(resolve(folder).startsWith(resolve(tmpdir())+sep+'dreal-tests-'));await rm(folder,{recursive:true,force:true});});
test('store exposes sample catalogue without private records',async()=>{const r=await request('/api/store');assert.equal(r.status,200);assert.equal(r.data.products.length,8);assert.equal(r.data.mode,'preview');assert.equal(r.data.users,undefined);assert.equal(r.data.orders,undefined);});
test('admin setup is one-time, protected, and uses HttpOnly session cookies',async()=>{
  assert.equal((await request('/api/admin/dashboard')).status,401);
  const r=await request('/api/setup',{name:'Store Owner',email:'owner@example.test',password:'a secure owner password'});assert.equal(r.status,200);adminCookie=r.cookie;assert.equal(r.data.user.role,'admin');assert.match(r.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  assert.equal((await request('/api/setup',{name:'Intruder',email:'intruder@example.test',password:'a secure intruder password'})).status,409);
  const row=await app.store.db.prepare('SELECT password FROM users WHERE email=?').get('owner@example.test');assert.notEqual(row.password,'a secure owner password');assert.equal(row.password.split(':')[1].length,128);
});
test('cross-origin writes and customer admin access are blocked',async()=>{
  assert.equal((await request('/api/admin/settings',{storeName:'Hijacked'},'PUT',adminCookie,{Origin:'https://example.org'})).status,403);
  const r=await request('/api/auth/register',{name:'Ada',email:'ada@example.test',password:'a secure customer password',role:'admin'});assert.equal(r.status,200);customerCookie=r.cookie;assert.equal(r.data.user.role,'customer');assert.equal((await request('/api/admin/products',undefined,'GET',customerCookie)).status,403);
});
test('admin can curate and reorder homepage product sections',async()=>{
  const keys=Object.keys((await request('/api/store')).data.settings.sections);
  const homeCollections=[{id:'best-sellers',title:'Best sellers',productIds:['body-lotion','daily-cleanser'],enabled:true}];
  const sectionOrder=['best-sellers',...keys];
  const heroProductOne='/assets/photos/hero-illiyoon-cutout.png',heroProductTwo='/assets/photos/hero-korean-skin-cutout.png';
  const heroProductThree='/assets/photos/hero-cosrx-cutout.png',heroProductFour='/assets/photos/hero-dove-cutout.png';
  const saved=await request('/api/admin/settings',{homeCollections,sectionOrder,heroProductOne,heroProductTwo,heroProductThree,heroProductFour},'PUT',adminCookie);
  assert.equal(saved.status,200);
  assert.deepEqual(saved.data.homeCollections,homeCollections);
  assert.deepEqual(saved.data.sectionOrder,sectionOrder);
  assert.equal(saved.data.heroProductOne,heroProductOne);
  assert.equal(saved.data.heroProductTwo,heroProductTwo);
  assert.equal(saved.data.heroProductThree,heroProductThree);
  assert.equal(saved.data.heroProductFour,heroProductFour);
  const storefront=(await request('/api/store')).data.settings;
  assert.deepEqual(storefront.homeCollections,homeCollections);
  assert.deepEqual(storefront.sectionOrder,sectionOrder);
  assert.equal((await request('/api/admin/settings',{homeCollections,sectionOrder:['best-sellers','best-sellers',...keys.slice(1)]},'PUT',adminCookie)).status,400);
  assert.equal((await request('/api/admin/settings',{homeCollections:[{...homeCollections[0],productIds:['unknown-product']}],sectionOrder},'PUT',adminCookie)).status,400);
});
test('pricing is server-authoritative, inventory is atomic, and retries are idempotent',async()=>{
  const items=[{id:'daily-cleanser',quantity:2,price:1}],quote=await request('/api/quote',{items,zone:'lagos'});assert.equal(quote.data.subtotal,25000);assert.equal(quote.data.total,28000);
  const body={items,zone:'lagos',name:'Preview Customer',email:'guest@example.test',phone:'08000000000',address:'Preview street',city:'Lagos',previewAcknowledged:true,idempotencyKey:'test-checkout-one',expectedTotal:28000};
  const [first,retry]=await Promise.all([request('/api/orders',body),request('/api/orders',body)]);assert.equal(first.status,200);assert.equal(retry.status,200);assert.equal(first.data.order.id,retry.data.order.id);assert.equal((await app.store.get('products','daily-cleanser')).stock,16);
  assert.equal((await request('/api/orders',{...body,expectedTotal:1,idempotencyKey:'price-tamper'})).status,409);assert.equal((await app.store.get('products','daily-cleanser')).stock,16);
  assert.equal((await request('/api/orders',{...body,name:'Someone else'})).status,409);
  const id=first.data.order.id;assert.equal((await request(`/api/admin/orders/${id}`,{status:'cancelled'},'PUT',adminCookie)).status,200);assert.equal((await request(`/api/admin/orders/${id}`,{status:'cancelled'},'PUT',adminCookie)).status,200);assert.equal((await app.store.get('products','daily-cleanser')).stock,18);
  assert.equal((await request(`/api/admin/orders/${id}`,{status:'confirmed'},'PUT',adminCookie)).status,400);
});
test('out-of-stock items and duplicate item quantity over stock cannot be ordered',async()=>{
  assert.equal((await request('/api/quote',{items:[{id:'even-tone',quantity:1}],zone:'lagos'})).status,409);
  assert.equal((await request('/api/quote',{items:[{id:'clarifying-serum',quantity:3},{id:'clarifying-serum',quantity:3}],zone:'lagos'})).status,409);
});
test('discounts apply before free-delivery thresholds and usage limits',async()=>{
  const c=await request('/api/admin/coupons',{code:'CARE10',type:'percent',value:10,minimum:1000,limit:1,expires:'',active:true},'POST',adminCookie);assert.equal(c.status,200);
  const q=await request('/api/quote',{items:[{id:'daily-cleanser',quantity:5}],zone:'lagos',coupon:'care10'});assert.equal(q.data.subtotal,62500);assert.equal(q.data.discount,6250);assert.equal(q.data.shipping,3000);
  const o=await request('/api/orders',{items:[{id:'daily-cleanser',quantity:1}],zone:'lagos',coupon:'CARE10',name:'Ada',email:'ada@example.test',phone:'08000000000',address:'Test',city:'Lagos',previewAcknowledged:true,idempotencyKey:'discount-order',expectedTotal:14250},'POST',customerCookie);assert.equal(o.status,200);
  assert.equal((await request('/api/quote',{items:[{id:'daily-cleanser',quantity:1}],zone:'lagos',coupon:'CARE10'})).status,400);
});
test('customer history is private and wishlists persist to the account',async()=>{
  const account=await request('/api/account',undefined,'GET',customerCookie);assert.equal(account.data.orders.length,1);assert.equal(account.data.orders[0].customer.email,'ada@example.test');
  await request('/api/wishlist',{items:['daily-cleanser','daily-cleanser','unknown']},'PUT',customerCookie);assert.deepEqual((await request('/api/account',undefined,'GET',customerCookie)).data.wishlist,['daily-cleanser']);
  const failed=await request('/api/account',{name:'Should not save',currentPassword:'incorrect',password:'a different long password'},'PUT',customerCookie);assert.equal(failed.status,400);assert.equal((await request('/api/account',undefined,'GET',customerCookie)).data.user.name,'Ada');
});
test('concurrent consultation attempts cannot take the same slot',async()=>{
  const slot=new Date(Date.now()+86400000).toISOString();await request('/api/admin/settings',{consultationSlots:[slot]},'PUT',adminCookie);
  const b={slot,name:'Ada',email:'ada@example.test',phone:'08000000000',goals:'Preview only',consent:true,previewAcknowledged:true};
  const results=await Promise.all([request('/api/bookings',b),request('/api/bookings',b)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await request('/api/slots')).data.slots.length,0);
  const booking=results.find(r=>r.status===200).data.booking;await request('/api/admin/bookings/'+booking.id,{status:'cancelled'},'PUT',adminCookie);assert.equal((await request('/api/slots')).data.slots.length,1);
});
test('subscribers require consent, deduplicate emails, preserve sources, and unsubscribe',async()=>{
  assert.equal((await request('/api/subscribe',{name:'Ada',email:'subscriber@example.test',source:'guide'})).status,400);
  for(const source of ['guide','guide','newsletter'])assert.equal((await request('/api/subscribe',{name:'Ada',email:'SUBSCRIBER@example.test',source,consent:true})).status,200);
  const subscribers=await app.store.all('subscribers');assert.equal(subscribers.length,1);assert.deepEqual(subscribers[0].sources,['guide','newsletter']);assert.equal((await app.store.all('outbox')).filter(m=>m.to==='subscriber@example.test').length,2);
  await request('/api/unsubscribe',{token:subscribers[0].token});assert.equal((await app.store.get('subscribers',subscribers[0].id)).status,'unsubscribed');
});
test('admin CRUD persists product updates, archives safely, and keeps contact messages intact',async()=>{
  const p=await app.store.get('products','body-lotion');const updated=await request('/api/admin/products/'+p.id,{...p,price:20000,stock:3},'PUT',adminCookie);assert.equal(updated.status,200);assert.equal(updated.data.price,20000);
  await request('/api/admin/products/'+p.id,{},'DELETE',adminCookie);const archived=await app.store.get('products',p.id);assert.equal(archived.active,false);assert.equal(archived.name,p.name);assert.equal(archived.id,p.id);
  await request('/api/contact',{name:'Ada',email:'ada@example.test',subject:'A question',message:'Please help with my preview order.'});const message=(await app.store.all('messages'))[0];const r=await request('/api/admin/messages/'+message.id,{status:'resolved'},'PUT',adminCookie);assert.equal(r.data.message,message.message);assert.equal(r.data.status,'resolved');
});
test('invalid uploads are blocked, valid uploaded files are retrievable',async()=>{
  assert.equal((await request('/api/admin/upload',{type:'image/jpeg',data:Buffer.from('<script>alert(1)</script>').toString('base64')},'POST',adminCookie)).status,400);
  const bytes=Buffer.from('%PDF-1.4\nPreview test document');const result=await request('/api/admin/upload',{type:'application/pdf',data:bytes.toString('base64')},'POST',adminCookie);assert.equal(result.status,200);
  const file=await fetch(origin+result.data.url);assert.equal(file.status,200);assert.equal(file.headers.get('content-type'),'application/pdf');assert.match(file.headers.get('content-disposition'),/attachment/);assert.equal(await file.text(),bytes.toString());
});
test('password reset tokens are single-use and invalidate prior sessions',async()=>{
  await request('/api/auth/forgot',{email:'ada@example.test'});const mail=(await app.store.all('outbox')).find(m=>m.kind==='password-reset');const token=mail.body.match(/token=([a-f0-9]+)/)[1];
  assert.equal((await request('/api/auth/reset',{token,password:'new long customer password'})).status,200);assert.equal((await request('/api/account',undefined,'GET',customerCookie)).status,401);assert.equal((await request('/api/auth/reset',{token,password:'another long password'})).status,400);
});
