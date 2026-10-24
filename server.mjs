import http from 'node:http';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, extname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './lib/database.mjs';
import { createMedia } from './lib/media.mjs';
import { createCloudinary } from './lib/cloudinary.mjs';
import { createGmail } from './lib/gmail.mjs';
import { createPush } from './lib/push.mjs';
import { bankDetails, tokenMatches, proofImage } from './lib/bank-payment.mjs';
import { receiptPdf } from './lib/receipt.mjs';
import { siteSectionKeys } from './public/site-sections.js';

const root=fileURLToPath(new URL('.',import.meta.url));
const hash=value=>createHash('sha256').update(value).digest('hex');
const passwordHash=password=>{const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;};
const passwordMatches=(password,stored)=>{const [salt,key]=stored.split(':');return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(key,'hex'));};
const fail=(message,status=400)=>{const error=new Error(message);error.status=status;throw error;};
const str=(v,max=300)=>String(v??'').trim().slice(0,max);
const email=v=>{const s=str(v,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))fail('Enter a valid email address.');return s;};
const required=(v,label,max=300)=>{const s=str(v,max);if(!s)fail(`${label} is required.`);return s;};
const number=(v,label,min=0,max=100000000)=>{const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)fail(`${label} must be between ${min} and ${max}.`);return Math.round(n*100)/100;};
const whole=(v,label,min=0,max=100000)=>{const n=number(v,label,min,max);if(!Number.isInteger(n))fail(`${label} must be a whole number.`);return n;};
const strongPassword=v=>{if(typeof v!=='string'||v.length<12||v.length>256)fail('Use a password between 12 and 256 characters.');return v;};
const money=n=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(n);
const safeUrl=(v,{localOnly=false,cloudinary}={})=>{const s=str(v,1000);if(!s)return '';if(/^\/uploads\/[a-f0-9-]+\.(jpg|png|webp|pdf)$/.test(s))return s;if(cloudinary?.ownsPublicUrl(s))return s;if(!localOnly&&/^https:\/\/[^\s]+$/.test(s))return s;fail('Use an uploaded image or an HTTPS URL.');};
const publicUser=u=>u?{id:u.id,name:u.name,email:u.email,role:u.role}:null;
const now=()=>new Date().toISOString();
const overlaps=(slot,duration,booking)=>booking.status!=='cancelled'&&Date.parse(slot)<Date.parse(booking.slot)+booking.duration*60000&&Date.parse(booking.slot)<Date.parse(slot)+duration*60000;
const phoneKey=value=>{let digits=str(value,40).replace(/\D/g,'');if(digits.startsWith('0'))digits='234'+digits.slice(1);return digits;};
const contactMatches=(order,value)=>{
  const supplied=order.contactChannel==='whatsapp'?phoneKey(value):str(value,254).toLowerCase();
  const expected=order.contactChannel==='whatsapp'?phoneKey(order.customer.phone):order.customer.email;
  return !!supplied&&timingSafeEqual(Buffer.from(hash(supplied)),Buffer.from(hash(expected)));
};

export async function createApplication({databasePath=process.env.DATABASE_PATH||join(root,'data','store.sqlite'), databaseOptions,uploadDir=join(root,'data','uploads'),hosted=process.env.NETLIFY==='true',secureCookies=hosted||process.env.SECURE_COOKIES==='true',sender={enabled:false},mailer=createGmail(),push=createPush(),media=createMedia({directory:uploadDir,hosted}),proofMedia=createMedia({directory:join(root,'data','payment-proofs'),hosted,storeName:'dreal-payment-proofs'}),cloudinary=createCloudinary(),paymentEnv=process.env,adminCredentialsEnv=process.env}={}) {
  if(hosted&&!process.env.TURSO_DATABASE_URL&&!databaseOptions?.client)throw new Error('TURSO_DATABASE_URL is required on Netlify.');
  const store=await openDatabase(databasePath,databaseOptions), {db,get,all,put,remove,transaction}=store;
  const limits=new Map();
  const dummyPassword=passwordHash(randomBytes(24).toString('hex'));
  const adminEnv=adminCredentialsEnv.ADMIN_EMAIL||adminCredentialsEnv.ADMIN_PASSWORD?{email:email(adminCredentialsEnv.ADMIN_EMAIL),password:strongPassword(adminCredentialsEnv.ADMIN_PASSWORD),name:str(adminCredentialsEnv.ADMIN_NAME||'Administrator',100)}:null;
  if(adminEnv){
    await db.prepare('INSERT OR IGNORE INTO users VALUES(?,?,?,?,?,?)').run(randomUUID(),adminEnv.email,adminEnv.name,passwordHash(adminEnv.password),'admin',now());
    const existing=await db.prepare('SELECT * FROM users WHERE email=?').get(adminEnv.email);
    if(existing.role!=='admin'||existing.name!==adminEnv.name||!passwordMatches(adminEnv.password,existing.password)){
      await db.prepare('DELETE FROM sessions WHERE user_id=?').run(existing.id);
      await db.prepare("UPDATE users SET name=?,password=?,role='admin' WHERE id=?").run(adminEnv.name,passwordHash(adminEnv.password),existing.id);
    }
  }
  const paymentBank=bankDetails(paymentEnv);
  const paymentConfigured=!!paymentBank&&(!hosted||(cloudinary.configured&&push.configured));
  const paymentReady=async()=>paymentConfigured&&(!hosted||(await all('pushSubscriptions')).length>0);
  const publicOrder=o=>({id:o.id,customer:o.customer,items:o.items,subtotal:o.subtotal,discount:o.discount,shipping:o.shipping,total:o.total,zone:o.zone,status:o.status,paymentStatus:o.paymentStatus,contactChannel:o.contactChannel,tracking:o.tracking,createdAt:o.createdAt,proofSubmittedAt:o.proof?.submittedAt||null,reviewDueAt:o.reviewDueAt||null,proofRejection:o.paymentStatus==='proof_rejected'?o.proofRejection||'':undefined,receipt:o.receipt?{id:o.receipt.id,issuedAt:o.receipt.issuedAt}:null});
  async function queuePush(kind,orderId) {
    if(!push.configured)return;
    return put('pushAlerts',{id:randomUUID(),kind,orderId,title:kind==='test'?'Test store alert':kind==='proof'?'Payment receipt submitted':'New order placed',body:kind==='test'?'Push is connected on this device.':`Order ${orderId} needs your attention.`,createdAt:now(),status:'queued'});
  }
  async function deliverPush(limit=2) {
    if(!push.configured)return;
    const subscriptions=await all('pushSubscriptions');if(!subscriptions.length)return;
    const pending=(await all('pushAlerts')).filter(a=>a.status==='queued').sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).slice(0,limit);
    for(const alert of pending){
      const delivered=await Promise.all(subscriptions.map(async sub=>{
        const id=`${alert.id}:${sub.id}`,previous=await get('pushDeliveries',id);
        if(previous?.status==='sent')return true;
        if(previous?.attemptAt&&Date.now()-Date.parse(previous.attemptAt)<30000)return false;
        try{const result=await push.send(sub.endpoint);if(result.expired)await remove('pushSubscriptions',sub.id);await put('pushDeliveries',{id,status:'sent',attemptAt:now()});return true;}
        catch(error){await put('pushDeliveries',{id,status:'retry',attemptAt:now(),error:error.message});return false;}
      }));
      if(delivered.every(Boolean))await put('pushAlerts',{...alert,status:'sent',sentAt:now()});
    }
  }
  async function orderAccess(req,order,token){
    if(!order)fail('Order not found.',404);
    if([order.accessHash,...(order.accessHashes||[])].some(stored=>tokenMatches(token,stored)))return;
    const u=await session(req);
    if(u&&order.userId===u.id)return;
    fail('Your private order link is required.',403);
  }
  async function limited(req,kind,max=15) {
    if(store.remote){
      const key=hash(`${req.socket.remoteAddress}:${kind}`),time=Date.now();
      await db.prepare('INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<? THEN ? ELSE expires END').run(key,time+600000,time,time,time+600000);
      if((await db.prepare('SELECT count FROM rate_limits WHERE key=?').get(key)).count>max)fail('Too many attempts. Please try again in ten minutes.',429);
      return;
    }
    const key=`${req.socket.remoteAddress}:${kind}`, time=Date.now(), current=limits.get(key);
    if(!current||current.until<time)limits.set(key,{count:1,until:time+600000});
    else if(++current.count>max)fail('Too many attempts. Please try again in ten minutes.',429);
    if(limits.size>5000)for(const [k,v] of limits)if(v.until<time)limits.delete(k);
  }
  async function session(req) {
    const token=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('dreal_session='))?.slice(14);
    if(!token)return null;
    const u=(await db.prepare('SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>?').get(hash(token),Date.now()))||null;
    if(adminEnv&&u?.role==='admin'&&(u.email!==adminEnv.email||!passwordMatches(adminEnv.password,u.password)))return null;
    return u;
  }
  async function auth(req,admin=false) {const u=(await session(req));if(!u)fail('Please sign in to continue.',401);if(admin&&u.role!=='admin')fail('Administrator access is required.',403);return u;}
  async function setSession(res,user) {
    const token=randomBytes(32).toString('hex');
    (await db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now()));
    (await db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),user.id,Date.now()+43200000));
    res.setHeader('Set-Cookie',`dreal_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secureCookies?'; Secure':''}`);
  }
  async function queueMail(to,subject,body,kind='transactional') {
    const base=(process.env.SITE_URL||'http://127.0.0.1:3000').replace(/\/$/,'');
    const text=body.replace(/(^|\s)(\/(?:reset|unsubscribe|uploads|payment|receipt)[^\s]*)/g,(_,space,path)=>space+base+path);
    return put('outbox',{id:randomUUID(),to,subject,body:text,kind,status:mailer.canSend&&kind!=='welcome'?'queued':'preview — not sent',createdAt:now()});
  }
  async function deliverOutbox(limit=2) {
    if(!mailer.canSend)return;
    const queued=(await all('outbox')).filter(m=>m.status==='queued');
    const oldOrderMail=queued.filter(m=>/^(?:Order DS-[A-F0-9]{10}:|Payment (?:receipt received|confirmed|receipt needs attention): DS-[A-F0-9]{10})/.test(m.subject));
    for(const mail of oldOrderMail)await put('outbox',{...mail,status:'manual — not sent'});
    const pending=queued.filter(m=>m.kind!=='order-alert'&&!oldOrderMail.some(old=>old.id===m.id)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).slice(0,limit);
    const claimedMail=[];
    for(const mail of pending){
      const claimed=await transaction(async()=>{const current=await get('outbox',mail.id);if(current?.status!=='queued')return false;await put('outbox',{...current,status:'sending',attemptAt:now()});return true;});
      if(claimed)claimedMail.push(mail);
    }
    await Promise.all(claimedMail.map(async mail=>{
      try{const result=await mailer.send(mail);await put('outbox',{...mail,status:'sent',sentAt:now(),providerId:result.emailId||'',body:mail.kind==='password-reset'?'Password reset link sent. Content redacted after delivery.':mail.body});}
      catch(error){await put('outbox',{...mail,status:'delivery uncertain — review before retry',error:error.message,attemptAt:now()});}
    }));
  }
  async function audit(user,action,record) {(await put('audit',{id:randomUUID(),actor:user.email,action,record,createdAt:now()}));}
  async function body(req,max=200000) {
    let size=0;const chunks=[];
    for await(const chunk of req){size+=chunk.length;if(size>max)fail('The request is too large.',413);chunks.push(chunk);}
    try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{fail('Invalid JSON.');}
  }
  async function quote(input) {
    if(!Array.isArray(input.items)||!input.items.length||input.items.length>100)fail('Add a product to your bag first.');
    const config=(await get('settings','main')), quantities=new Map();
    for(const item of input.items){const qty=whole(item.quantity,'Quantity',1,99);quantities.set(str(item.id), (quantities.get(str(item.id))||0)+qty);}
    const catalogue=new Map((await all('products')).map(p=>[p.id,p]));
    const items=[...quantities].map(([id,quantity])=>{
      const product=catalogue.get(id);if(!product?.active)fail('An item in your bag is no longer available.',409);
      if(quantity>99)fail('A product quantity cannot exceed 99.');
      if(product.stock<quantity)fail(`${product.name}: only ${product.stock} available. Please update your bag.`,409);
      return {id,name:product.name,price:product.price,quantity,size:product.size,image:product.images[0]||'',art:product.art,tone:product.tone};
    });
    const subtotal=Math.round(items.reduce((s,i)=>s+i.price*i.quantity,0)*100)/100;
    let discount=0,coupon=null;
    if(str(input.coupon)) {
      coupon=(await all('coupons')).find(c=>c.code===str(input.coupon).toUpperCase()&&c.active);
      if(!coupon||(coupon.expires&&coupon.expires<now().slice(0,10))||(coupon.limit&&coupon.used>=coupon.limit))fail('This discount code is not available.');
      if(subtotal<coupon.minimum)fail(`This code needs a minimum order of ${money(coupon.minimum)}.`);
      discount=Math.round(Math.min(subtotal,coupon.type==='percent'?subtotal*coupon.value/100:coupon.value)*100)/100;
    }
    const zone=config.deliveryZones.find(z=>z.id===input.zone);
    if(!zone)fail('Choose a delivery area.');
    const shipping=config.freeDeliveryThreshold>0&&subtotal-discount>=config.freeDeliveryThreshold?0:zone.fee;
    return {items,subtotal,discount,shipping,total:Math.round((subtotal-discount+shipping)*100)/100,zone:zone.name,coupon:coupon?.code||'',couponId:coupon?.id||null};
  }
  async function validateProduct(b,id) {
    const previous=id?(await get('products',id)):null;
    return {id:id||randomUUID(),name:required(b.name,'Product name',160),brand:required(b.brand,'Brand',100),category:required(b.category,'Category',100),
      price:number(b.price,'Price',1),compareAt:number(b.compareAt||0,'Original price'),size:required(b.size,'Size',80),stock:whole(b.stock,'Stock'),
      description:required(b.description,'Description',8000),ingredients:str(b.ingredients,8000),directions:str(b.directions,8000),precautions:str(b.precautions,8000),
      concerns:(Array.isArray(b.concerns)?b.concerns:[]).slice(0,20).map(x=>str(x,100)),
      images:(Array.isArray(b.images)?b.images:[]).slice(0,6).map(x=>safeUrl(x,{localOnly:true,cloudinary})),
      art:['cleanser','jar','tube','dropper','bottle','accessory'].includes(b.art)?b.art:'bottle',tone:['sage','peach','butter','rose'].includes(b.tone)?b.tone:'sage',
      active:!!b.active,featured:!!b.featured,isNew:!!b.isNew,sample:!!b.sample,popularity:previous?.popularity||0,createdAt:previous?.createdAt||now()};
  }
  async function validateSettings(b) {
    const current=(await get('settings','main')), next={...current};
    for(const k of ['storeName','tagline','announcement','heroEyebrow','heroTitle','heroText','heroPrimary','heroSecondary','aboutTitle','aboutText','consultationTitle','consultationText','consultationIncludes','guideTitle','guideText','supportEmail','supportPhone','whatsapp','address','hours','seoDescription'])if(k in b)next[k]=str(b[k],k.endsWith('Text')||k==='consultationIncludes'?8000:1000);
    for(const k of ['heroImage','consultationImage','guideUrl'])if(k in b)next[k]=safeUrl(b[k],{localOnly:true,cloudinary});
    const bundledHeroAssets={heroProductOne:'/assets/photos/hero-illiyoon-cutout.png',heroProductTwo:'/assets/photos/hero-korean-skin-cutout.png',heroProductThree:'/assets/photos/hero-cosrx-cutout.png',heroProductFour:'/assets/photos/hero-dove-cutout.png'};
    for(const [key,asset] of Object.entries(bundledHeroAssets))if(key in b)next[key]=b[key]===asset?asset:safeUrl(b[key],{localOnly:true,cloudinary});
    if('instagram' in b)next.instagram=safeUrl(b.instagram);
    if('supportEmail' in b&&b.supportEmail)next.supportEmail=email(b.supportEmail);
    for(const k of ['consultationPrice','freeDeliveryThreshold'])if(k in b)next[k]=number(b[k],k);
    for(const k of ['consultationDuration','lowStockThreshold'])if(k in b)next[k]=whole(b[k],k,1,1000);
    for(const k of ['categories','concerns','brands'])if(k in b){if(!Array.isArray(b[k])||b[k].length>100)fail('Invalid collection list.');next[k]=[...new Set(b[k].map(x=>str(x,100)).filter(Boolean))];}
    if('categoryTree' in b){
      if(!Array.isArray(b.categoryTree)||!b.categoryTree.length||b.categoryTree.length>30)fail('Add between 1 and 30 category groups.');
      const roots=new Set(),leaves=new Set();
      next.categoryTree=b.categoryTree.map(group=>{
        const label=required(group?.label,'Category group',100),children=group?.children;
        if(roots.has(label.toLowerCase())||!Array.isArray(children)||children.length>50)fail('Category groups must be unique and have up to 50 subcategories.');
        roots.add(label.toLowerCase());
        const clean=children.map(child=>required(child,'Subcategory',100));
        for(const leaf of clean.length?clean:[label]){if(leaves.has(leaf.toLowerCase()))fail('Each product category must appear only once in the menu.');leaves.add(leaf.toLowerCase());}
        return {label,children:clean};
      });
      next.categories=next.categoryTree.flatMap(group=>group.children.length?group.children:[group.label]);
    }
    if('sections' in b)for(const k of Object.keys(current.sections))if(k in b.sections)next.sections={...next.sections,[k]:!!b.sections[k]};
    if('sectionVisibility' in b){
      const visibility=b.sectionVisibility;
      if(!visibility||typeof visibility!=='object'||Array.isArray(visibility)||Object.keys(visibility).some(key=>!siteSectionKeys.includes(key)||typeof visibility[key]!=='boolean'))fail('Invalid section visibility settings.');
      next.sectionVisibility={...current.sectionVisibility,...visibility};
    }
    if('homeCollections' in b){
      if(!Array.isArray(b.homeCollections)||b.homeCollections.length>12)fail('Add up to 12 homepage collections.');
      const productIds=new Set((await all('products')).map(p=>p.id));
      next.homeCollections=b.homeCollections.map(c=>{
        const id=str(c.id,80),title=required(c.title,'Collection title',100);
        if(!/^[a-z0-9-]+$/.test(id)||!Array.isArray(c.productIds)||c.productIds.length>12)fail('Invalid homepage collection.');
        const chosen=[...new Set(c.productIds.map(x=>str(x,100)))];
        if(chosen.some(id=>!productIds.has(id)))fail('A selected collection product no longer exists.');
        return {id,title,productIds:chosen,enabled:!!c.enabled};
      });
      if(new Set(next.homeCollections.map(c=>c.id)).size!==next.homeCollections.length||next.homeCollections.some(c=>c.id in next.sections))fail('Homepage collection names must be unique.');
    }
    if('sectionOrder' in b){
      const allowed=[...Object.keys(next.sections),...(next.homeCollections||[]).map(c=>c.id)];
      if(!Array.isArray(b.sectionOrder)||b.sectionOrder.length!==allowed.length||new Set(b.sectionOrder).size!==allowed.length||b.sectionOrder.some(id=>!allowed.includes(id)))fail('Invalid homepage section order.');
      next.sectionOrder=b.sectionOrder;
    }
    if('deliveryZones' in b){if(!Array.isArray(b.deliveryZones)||!b.deliveryZones.length||b.deliveryZones.length>50)fail('Add between 1 and 50 delivery areas.');next.deliveryZones=b.deliveryZones.map(z=>({id:str(z.id)||randomUUID(),name:required(z.name,'Delivery area'),fee:number(z.fee,'Delivery fee')}));if(new Set(next.deliveryZones.map(z=>z.id)).size!==next.deliveryZones.length)fail('Delivery areas must have unique IDs.');}
    if('consultationSlots' in b){if(!Array.isArray(b.consultationSlots)||b.consultationSlots.length>500)fail('Invalid appointment slots.');next.consultationSlots=[...new Set(b.consultationSlots.map(s=>{const d=new Date(s);if(Number.isNaN(+d))fail('Invalid appointment date.');return d.toISOString();}))].sort();}
    if('consultationSlots' in b||'consultationDuration' in b)for(let i=1;i<next.consultationSlots.length;i++)if(Date.parse(next.consultationSlots[i])-Date.parse(next.consultationSlots[i-1])<next.consultationDuration*60000)fail('Appointments must be spaced at least one consultation duration apart.');
    return next;
  }
  async function api(req,res,url) {
    const path=url.pathname,method=req.method;
    if(!['GET','HEAD','OPTIONS'].includes(method)) {
      const origin=req.headers.origin;
      if(!origin||!['http:','https:'].some(protocol=>origin===`${protocol}//${req.headers.host}`))fail('This request must come from this website.',403);
      if(req.headers['sec-fetch-site']==='cross-site')fail('Cross-site requests are blocked.',403);
    }
    if(path==='/api/store'&&method==='GET'){const ready=await paymentReady();return {settings:(await get('settings','main')),products:(await all('products')).filter(p=>p.active),pages:(await all('pages')).filter(p=>p.published),faqs:(await all('faqs')).filter(p=>p.published),articles:(await all('articles')).filter(p=>p.published),reviews:(await all('reviews')).filter(p=>p.published),checkoutAvailable:ready,mode:ready?'bank-transfer':'preview'};}
    if(path==='/api/session'&&method==='GET')return {user:publicUser((await session(req))),adminManaged:!!adminEnv,setupRequired:!adminEnv&&!(await db.prepare("SELECT 1 FROM users WHERE role='admin'").get()),setupTokenRequired:hosted&&!adminEnv};
    if(path==='/api/setup'&&method==='POST') {
      (await limited(req,'setup',5));if(adminEnv||(await db.prepare("SELECT 1 FROM users WHERE role='admin'").get()))fail('The administrator account is already set up.',409);
      const b=await body(req);
      if(hosted){if(!process.env.ADMIN_SETUP_TOKEN||!timingSafeEqual(Buffer.from(hash(str(b.setupToken,300))),Buffer.from(hash(process.env.ADMIN_SETUP_TOKEN))))fail('Enter the private setup token configured in Netlify.',403);}
      else if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))fail('Set up the administrator on this computer.',403);
      const u={id:randomUUID(),email:email(b.email),name:required(b.name,'Name'),password:passwordHash(strongPassword(b.password)),role:'admin',created:now()};
      (await db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(u.id,u.email,u.name,u.password,u.role,u.created));(await setSession(res,u));return {user:publicUser(u)};
    }
    if(path==='/api/auth/register'&&method==='POST') {
      (await limited(req,'register',10));const b=await body(req),u={id:randomUUID(),email:email(b.email),name:required(b.name,'Name'),password:passwordHash(strongPassword(b.password)),role:'customer',created:now()};
      if((await db.prepare('SELECT 1 FROM users WHERE email=?').get(u.email)))fail('An account already uses this email address.',409);
      (await db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(u.id,u.email,u.name,u.password,u.role,u.created));(await setSession(res,u));return {user:publicUser(u)};
    }
    if(path==='/api/auth/login'&&method==='POST') {
      (await limited(req,'login'));const b=await body(req),address=email(b.email);
      if(adminEnv&&address===adminEnv.email){
        const submitted=typeof b.password==='string'?b.password.slice(0,256):'';
        if(!timingSafeEqual(Buffer.from(hash(submitted)),Buffer.from(hash(adminEnv.password))))fail('The email or password is incorrect.',401);
        const admin=await db.prepare('SELECT * FROM users WHERE email=?').get(address);
        if(!admin||admin.role!=='admin'||!passwordMatches(adminEnv.password,admin.password))fail('The email or password is incorrect.',401);
        await setSession(res,admin);return {user:publicUser(admin)};
      }
      const u=(await db.prepare('SELECT * FROM users WHERE email=?').get(address));
      if(adminEnv&&u?.role==='admin')fail('The email or password is incorrect.',401);
      if(!passwordMatches(typeof b.password==='string'?b.password.slice(0,256):'',u?.password||dummyPassword)||!u)fail('The email or password is incorrect.',401);
      (await setSession(res,u));return {user:publicUser(u)};
    }
    if(path==='/api/auth/logout'&&method==='POST') {
      const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('dreal_session='))?.slice(14);
      if(token)(await db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token)));
      res.setHeader('Set-Cookie','dreal_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return {ok:true};
    }
    if(path==='/api/auth/forgot'&&method==='POST') {
      (await limited(req,'reset',5));const b=await body(req),u=(await db.prepare('SELECT * FROM users WHERE email=?').get(email(b.email)));
      if(u&&!(adminEnv&&u.email===adminEnv.email)){const token=randomBytes(32).toString('hex');(await db.prepare('DELETE FROM resets WHERE user_id=? OR expires<?').run(u.id,Date.now()));(await db.prepare('INSERT INTO resets VALUES(?,?,?)').run(hash(token),u.id,Date.now()+1800000));(await queueMail(u.email,'Reset your DrealSkinhub password',`Open /reset?token=${token} to reset your password. This single-use link expires in 30 minutes.`,'password-reset'));}
      return {message:mailer.canSend?'If an account exists, a reset email has been queued. Check your inbox shortly.':'If an account exists, a reset message has been added to the preview outbox. Email delivery is not connected yet.'};
    }
    if(path==='/api/auth/reset'&&method==='POST') {
      (await limited(req,'reset-complete',10));const b=await body(req),password=passwordHash(strongPassword(b.password));
      await transaction(async()=>{const reset=(await db.prepare('SELECT * FROM resets WHERE token=? AND expires>?').get(hash(str(b.token)),Date.now()));if(!reset)fail('This reset link is invalid or expired.');const account=await db.prepare('SELECT email FROM users WHERE id=?').get(reset.user_id);if(adminEnv&&account?.email===adminEnv.email)fail('Change the administrator password in environment variables.',403);(await db.prepare('UPDATE users SET password=? WHERE id=?').run(password,reset.user_id));(await db.prepare('DELETE FROM resets WHERE user_id=?').run(reset.user_id));(await db.prepare('DELETE FROM sessions WHERE user_id=?').run(reset.user_id));});return {ok:true};
    }
    if(path==='/api/account'&&method==='GET') {const u=(await auth(req));return {user:publicUser(u),orders:(await all('orders')).filter(o=>o.userId===u.id).map(publicOrder),bookings:(await all('bookings')).filter(o=>o.userId===u.id),wishlist:(await get('wishlists',u.id))?.items||[]};}
    if(path==='/api/account'&&method==='PUT') {
      const u=await auth(req),b=await body(req),name=required(b.name,'Name');let nextPassword;
      if(adminEnv&&u.email===adminEnv.email)fail('Change administrator details in environment variables.',403);
      if(b.password){if(adminEnv&&u.email===adminEnv.email)fail('Change the administrator password in environment variables.',403);if(!passwordMatches(typeof b.currentPassword==='string'?b.currentPassword.slice(0,256):'',u.password))fail('Your current password is incorrect.');nextPassword=passwordHash(strongPassword(b.password));}
      await transaction(async()=>{await db.prepare('UPDATE users SET name=? WHERE id=?').run(name,u.id);if(nextPassword){await db.prepare('UPDATE users SET password=? WHERE id=?').run(nextPassword,u.id);await db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);await setSession(res,u);}});
      return {user:publicUser({...u,name})};
    }
    if(path==='/api/wishlist'&&method==='PUT') {const u=(await auth(req)),b=await body(req);const available=new Set((await all('products')).map(p=>p.id));const items=[...new Set((Array.isArray(b.items)?b.items:[]).map(x=>str(x)))].filter(id=>available.has(id)).slice(0,200);(await put('wishlists',{id:u.id,items}));return {items};}
    if(path==='/api/quote'&&method==='POST')return (await quote(await body(req)));
    if(path==='/api/orders'&&method==='POST') {
      (await limited(req,'orders',30));const b=await body(req),u=(await session(req)),key=required(b.idempotencyKey,'Order key',100);
      if(!await paymentReady())fail('Bank-transfer checkout is not configured yet. Please contact the store.',503);
      if(['bank','bankName','accountName','accountNumber','bankAccountNumber','paymentAccount'].some(field=>field in b))fail('Bank details are provided by the store server only.');
      if(!['email','whatsapp'].includes(b.contactChannel))fail('Choose how you would like to receive your confirmation.');
      if(b.transferAcknowledged!==true)fail('Confirm that you understand payment is verified manually.');
      const customer={name:required(b.name,'Full name'),email:email(b.email),phone:required(b.phone,'Phone number',40),address:required(b.address,'Delivery address',1000),city:required(b.city,'City',100)};
      if(b.contactChannel==='whatsapp'){
        const digits=phoneKey(customer.phone);
        if(!/^\d{10,15}$/.test(digits))fail('Enter a WhatsApp number with its country code, or a valid Nigerian mobile number.');
      }
      const fingerprint=hash(JSON.stringify({...b,idempotencyKey:undefined,userId:u?.id||null}));
      return transaction(async()=>{
        const existing=(await db.prepare('SELECT * FROM idempotency WHERE key=?').get(key));
        if(existing){if(existing.fingerprint!==fingerprint)fail('This order key has already been used.',409);return JSON.parse(existing.response);}
        const q=(await quote(b));if(number(b.expectedTotal,'Total')!==q.total)fail('Your order total changed. Please review it before continuing.',409);
        const accessToken=randomBytes(32).toString('hex');
        const order={...q,id:`DS-${randomBytes(5).toString('hex').toUpperCase()}`,customer,userId:u?.id||null,note:str(b.note,1000),contactChannel:b.contactChannel,accessHash:hash(accessToken),bankFingerprint:hash(JSON.stringify(paymentBank)),status:'awaiting_payment',paymentStatus:'awaiting_transfer',tracking:'',createdAt:now(),preview:false,stockRestored:false};
        for(const item of q.items){const p=(await get('products',item.id));(await put('products',{...p,stock:p.stock-item.quantity,popularity:p.popularity+item.quantity}));}
        if(q.couponId){const c=(await get('coupons',q.couponId));(await put('coupons',{...c,used:c.used+1}));}
        (await put('orders',order));
        await queuePush('order',order.id);
        const response={order:publicOrder(order),accessToken};(await db.prepare('INSERT INTO idempotency VALUES(?,?,?)').run(key,fingerprint,JSON.stringify(response)));return response;
      });
    }
    const customerOrderPath=path.match(/^\/api\/orders\/(DS-[A-F0-9]{10})\/(payment|proof|receipt)$/);
    if(customerOrderPath&&method==='POST'){
      await limited(req,'order-access',40);
      const [,id,action]=customerOrderPath,b=await body(req,action==='proof'?4200000:200000),order=await get('orders',id);
      if(action==='receipt'&&[order.receiptAccessHash,...(order.receiptAccessHashes||[])].some(stored=>tokenMatches(b.accessToken,stored))){}
      else await orderAccess(req,order,b.accessToken);
      if(action==='payment'){
        if(order.status==='cancelled')return {order:publicOrder(order),bank:null};
        const accountMatches=!!paymentBank&&order.bankFingerprint===hash(JSON.stringify(paymentBank));
        if(['awaiting_transfer','proof_rejected'].includes(order.paymentStatus)&&!accountMatches)fail('Payment details for this order are unavailable or have changed. Please contact the store before making a transfer.',409);
        const pending=['awaiting_transfer','proof_rejected'].includes(order.paymentStatus);
        const verified=!pending||contactMatches(order,b.contact);
        return {order:verified?publicOrder(order):{...publicOrder(order),customer:undefined},bank:pending&&verified?paymentBank:null,contactRequired:pending&&!verified};
      }
      if(action==='receipt'){
        if(order.paymentStatus!=='verified')fail('Your payment has not been verified yet.',409);
        return {filename:`${order.receipt.id}.pdf`,type:'application/pdf',data:receiptPdf(order).toString('base64')};
      }
      if(!['awaiting_transfer','proof_rejected'].includes(order.paymentStatus)||order.status==='cancelled')fail('A payment receipt has already been submitted or this order is closed.',409);
      if(!contactMatches(order,b.contact))fail('Verify your preferred contact before uploading a receipt.',403);
      let image;try{image=proofImage(b.data,b.type);}catch(error){fail(error.message);}
      const filename=`${randomUUID()}.${image.ext}`;
      const privateAsset=cloudinary.configured?await cloudinary.upload(image.bytes,b.type,{privateAsset:true}):null;
      if(!privateAsset){if(hosted)fail('Private image storage is not configured.',503);await proofMedia.put(filename,image.bytes,b.type);}
      const updated=await transaction(async()=>{
        const current=await get('orders',id);
        if(!['awaiting_transfer','proof_rejected'].includes(current.paymentStatus)||current.status==='cancelled')fail('A payment receipt has already been submitted or this order is closed.',409);
        const submittedAt=now(),reviewDueAt=new Date(Date.now()+24*60*60*1000).toISOString();
        const next=await put('orders',{...current,paymentStatus:'proof_submitted',proof:{filename,type:b.type,submittedAt,...(privateAsset?{provider:'cloudinary',assetId:privateAsset.assetId}:{})},reviewDueAt,updatedAt:submittedAt});
        await queuePush('proof',id);
        return next;
      });
      return {order:publicOrder(updated)};
    }
    if(path==='/api/orders/track'&&method==='POST') {(await limited(req,'track',20));const b=await body(req),order=(await get('orders',str(b.id).toUpperCase()));if(!order||order.customer.email!==email(b.email))fail('We couldn’t find an order with those details.',404);return {order:{id:order.id,status:order.status,paymentStatus:order.paymentStatus,tracking:order.tracking,createdAt:order.createdAt,preview:order.preview}};}
    if(path==='/api/slots'&&method==='GET') {const bookings=await all('bookings'),settings=await get('settings','main');return {slots:settings.consultationSlots.filter(s=>s>now()&&!bookings.some(b=>overlaps(s,settings.consultationDuration,b)))};}
    if(path==='/api/bookings'&&method==='POST') {
      (await limited(req,'bookings',15));const b=await body(req),u=(await session(req));
      if(b.consent!==true||b.previewAcknowledged!==true)fail('Please confirm the consent and preview checkboxes.');
      const booking={id:`BK-${randomBytes(5).toString('hex').toUpperCase()}`,name:required(b.name,'Name'),email:email(b.email),phone:required(b.phone,'Phone',40),slot:required(b.slot,'Appointment'),goals:str(b.goals,2000),userId:u?.id||null,status:'confirmed',paymentStatus:'demo — no payment',preview:true,createdAt:now()};
      return transaction(async()=>{const s=(await get('settings','main'));if(!s.consultationSlots.includes(booking.slot)||booking.slot<=now())fail('Choose an available future appointment.');if((await all('bookings')).some(x=>overlaps(booking.slot,s.consultationDuration,x)))fail('That appointment has just been booked. Choose another time.',409);booking.price=s.consultationPrice;booking.duration=s.consultationDuration;(await put('bookings',booking));(await queueMail(booking.email,'Your preview consultation',`Reference ${booking.id}. Appointment ${new Date(booking.slot).toLocaleString('en-GB',{timeZone:'Africa/Lagos'})} (Lagos time). No payment was collected.`));return {booking};});
    }
    if(path==='/api/subscribe'&&method==='POST') {
      (await limited(req,'subscribe',25));const b=await body(req);if(b.consent!==true)fail('Please agree to receive emails.');
      const address=email(b.email),source=b.source==='guide'?'guide':'newsletter',id=hash(address),name=required(b.name,'First name',100),config=await get('settings','main');
      const {subscriber,shouldSync}=await transaction(async()=>{
        const existing=await get('subscribers',id),token=existing?.token||randomBytes(24).toString('hex'),fresh=!existing||existing.status!=='subscribed'||!existing.sources.includes(source);
        const subscriber={...existing,id,email:address,name,sources:[...new Set([...(existing?.sources||[]),source])],status:'subscribed',token,consentAt:now(),createdAt:existing?.createdAt||now(),senderStatus:existing?.senderStatus||'not connected'};
        await put('subscribers',subscriber);
        if(fresh)await queueMail(address,source==='guide'?'A little clarity for your skincare journey':'Welcome to DrealSkinhub',`Hello ${name}. ${source==='guide'?(config.guideUrl?`Your guide: ${config.guideUrl}`:'The free guide has not been uploaded yet.'):'Thank you for joining our community.'}\nUnsubscribe: /unsubscribe?token=${token}`,'welcome');
        return {subscriber,shouldSync:fresh||subscriber.senderStatus==='failed'};
      });
      let synced=subscriber.senderStatus==='synced';
      if(sender.enabled&&shouldSync){try{await sender.subscribe(subscriber,source);synced=true;await transaction(async()=>{const current=await get('subscribers',id);if(current)await put('subscribers',{...current,senderStatus:'synced',syncedAt:now(),senderError:''});});}catch(error){await transaction(async()=>{const current=await get('subscribers',id);if(current)await put('subscribers',{...current,senderStatus:'failed',senderError:error.message});});}}
      return {message:synced?'You’re on the list. Look out for a little note from DrealSkinhub.':'You’re on the preview list. Email delivery will begin once the store’s email platform is connected.',guideUrl:source==='guide'?config.guideUrl:''};
    }
    if(path==='/api/unsubscribe'&&method==='POST') {const b=await body(req),s=(await all('subscribers')).find(s=>s.token===str(b.token));if(s){await put('subscribers',{...s,status:'unsubscribed',unsubscribedAt:now(),senderStatus:sender.enabled?'unsubscribe pending':'not connected'});if(sender.enabled){try{await sender.unsubscribe(s.email);await put('subscribers',{...s,status:'unsubscribed',unsubscribedAt:now(),senderStatus:'synced'});}catch{fail('Your local preference is saved, but the email service is temporarily unavailable. Please retry to complete the unsubscribe.',503);}}}return {ok:true};}
    if(path==='/api/contact'&&method==='POST') {(await limited(req,'contact',10));const b=await body(req);(await put('messages',{id:randomUUID(),name:required(b.name,'Name'),email:email(b.email),subject:required(b.subject,'Subject'),message:required(b.message,'Message',5000),status:'new',createdAt:now()}));return {message:'Your message is saved in this local preview for the store owner.'};}
    if(path.startsWith('/api/admin')) {
      const u=(await auth(req,true));
      if(path==='/api/admin/push/config'&&method==='GET')return {configured:push.configured,publicKey:push.publicKey,deviceCount:(await all('pushSubscriptions')).filter(s=>s.userId===u.id).length};
      if(path==='/api/admin/push/subscribe'&&method==='POST'){
        if(!push.configured)fail('Set up push keys in Netlify first.',503);
        await limited(req,'push-subscribe',10);
        const b=await body(req),endpoint=push.validateEndpoint(required(b.endpoint,'Push endpoint',2048)),id=hash(endpoint);
        const own=(await all('pushSubscriptions')).filter(s=>s.userId===u.id);
        if(!own.some(s=>s.id===id)&&own.length>=5)fail('Remove a device before adding another.',409);
        await put('pushSubscriptions',{id,userId:u.id,endpoint,cursor:(await get('pushSubscriptions',id))?.cursor||`${now()}|`,createdAt:now()});
        return {ok:true};
      }
      if(path==='/api/admin/push/unsubscribe'&&method==='POST'){
        const b=await body(req),id=hash(push.validateEndpoint(required(b.endpoint,'Push endpoint',2048))),subscription=await get('pushSubscriptions',id);
        if(subscription?.userId===u.id)await remove('pushSubscriptions',id);
        return {ok:true};
      }
      if(path==='/api/admin/push/retry'&&method==='POST')return {ok:true};
      if(path==='/api/admin/push/test'&&method==='POST'){await limited(req,'push-test',5);if(!push.configured||(await all('pushSubscriptions')).filter(s=>s.userId===u.id).length===0)fail('Enable notifications on an admin device first.',409);await queuePush('test','');return {ok:true};}
      if(path==='/api/admin/push/alerts'&&method==='POST'){
        const b=await body(req),id=hash(push.validateEndpoint(required(b.endpoint,'Push endpoint',2048))),subscription=await get('pushSubscriptions',id);
        if(subscription?.userId!==u.id)fail('This device is not registered for store alerts.',403);
        const alerts=(await all('pushAlerts')).filter(a=>`${a.createdAt}|${a.id}`>subscription.cursor).sort((a,b)=>`${a.createdAt}|${a.id}`.localeCompare(`${b.createdAt}|${b.id}`)).slice(0,6);
        if(alerts.length){const last=alerts.at(-1);await put('pushSubscriptions',{...subscription,cursor:`${last.createdAt}|${last.id}`});}
        return {alerts:alerts.map(a=>({id:a.id,title:a.title,body:a.body,url:'/admin#orders'}))};
      }
      if(path==='/api/admin/dashboard'&&method==='GET'){
        const ready=await paymentReady(),devices=(await all('pushSubscriptions')).filter(s=>s.userId===u.id).length;
        const next=!paymentBank?'Set bank account environment variables':hosted&&!cloudinary.configured?'Set up Cloudinary image storage':!push.configured?'Set up push keys':!devices?'Enable push on an admin device':'Bank transfer configured — manual verification';
        return {orders:(await all('orders')),bookings:(await all('bookings')),products:(await all('products')),subscribers:(await all('subscribers')),settings:(await get('settings','main')),integrationStatus:{checkoutReady:ready,payments:ready?'Bank transfer configured — manual verification':next,email:'Order messages prepared for manual sending',push:push.configured?`${devices} admin device${devices===1?'':'s'} enabled`:'Push keys not configured',cloudinary:cloudinary.configured?'Configured; verify with a test upload':'Not configured',database:store.remote?'Turso connected':'Local SQLite',hosting:hosted?'Netlify':'Local preview'}};
      }
      const paymentAction=path.match(/^\/api\/admin\/orders\/(DS-[A-F0-9]{10})\/(proof|confirm-payment|reject-proof|receipt|share-receipt|share-payment)$/);
      if(paymentAction){
        const [,id,action]=paymentAction,order=await get('orders',id);
        if(!order)fail('Order not found.',404);
        if(action==='proof'&&method==='GET'){
          if(!order.proof)fail('No payment receipt has been submitted.',404);
          const file=order.proof.provider==='cloudinary'?{body:await cloudinary.download(order.proof.assetId)}:await proofMedia.get(order.proof.filename);
          if(!file)fail('Payment receipt file is unavailable.',404);
          return {filename:`${id}-payment-proof.${order.proof.filename.split('.').pop()}`,type:'application/octet-stream',data:file.body.toString('base64')};
        }
        if(action==='receipt'&&method==='GET'){
          if(order.paymentStatus!=='verified')fail('Verify the bank transfer before generating a receipt.',409);
          return {filename:`${order.receipt.id}.pdf`,type:'application/pdf',data:receiptPdf(order).toString('base64')};
        }
        if(action==='confirm-payment'&&method==='POST'){
          const b=await body(req);
          if(b.verified!==true)fail('Confirm that the transfer appears in your bank account.');
          const bankReference=required(b.bankReference,'Bank statement reference',120);
          return transaction(async()=>{
            const current=await get('orders',id);
            if(current.paymentStatus!=='proof_submitted'||current.status==='cancelled')fail('Only an open order with a submitted payment receipt can be verified.',409);
            if(number(b.verifiedAmount,'Amount received')!==current.total)fail('The bank amount does not match this order total.',409);
            const receiptToken=randomBytes(32).toString('hex');
            const receipt={id:`RC-${randomBytes(6).toString('hex').toUpperCase()}`,issuedAt:now(),bankReference,verifiedBy:u.id};
            const updated=await put('orders',{...current,status:'confirmed',paymentStatus:'verified',receipt,receiptAccessHash:hash(receiptToken),verifiedAt:receipt.issuedAt,updatedAt:now()});
            const receiptLink=`/receipt/${id}#access=${receiptToken}`;
            await audit(u,'Verified bank transfer and issued receipt',id);
            return {order:publicOrder(updated),receiptLink};
          });
        }
        if(action==='reject-proof'&&method==='POST'){
          const b=await body(req),reason=required(b.reason,'Reason',500);
          return transaction(async()=>{
            const current=await get('orders',id);
            if(current.paymentStatus!=='proof_submitted')fail('There is no submitted payment receipt to reject.',409);
            const updated=await put('orders',{...current,paymentStatus:'proof_rejected',proofRejection:reason,updatedAt:now()});
            await audit(u,'Rejected payment receipt',id);
            return {order:publicOrder(updated)};
          });
        }
        if(action==='share-receipt'&&method==='POST'){
          return transaction(async()=>{
            const current=await get('orders',id);
            if(current.paymentStatus!=='verified')fail('Verify the bank transfer before sharing a receipt.',409);
            const receiptToken=randomBytes(32).toString('hex');
            await put('orders',{...current,receiptAccessHashes:[...(current.receiptAccessHashes||[]),hash(receiptToken)]});
            await audit(u,'Created private receipt link',id);
            return {receiptLink:`/receipt/${id}#access=${receiptToken}`};
          });
        }
        if(action==='share-payment'&&method==='POST'){
          return transaction(async()=>{
            const current=await get('orders',id);
            if(!['awaiting_transfer','proof_rejected'].includes(current.paymentStatus)||current.status==='cancelled')fail('This order no longer needs a payment link.',409);
            const token=randomBytes(32).toString('hex');
            await put('orders',{...current,accessHashes:[...(current.accessHashes||[]),hash(token)].slice(-50)});
            await audit(u,'Created private payment link',id);
            return {paymentLink:`/payment/${id}#access=${token}`};
          });
        }
      }
      if(path==='/api/admin/settings'&&method==='PUT'){const input=await body(req);return transaction(async()=>{const next=await validateSettings(input);await put('settings',next);if('aboutTitle' in input||'aboutText' in input){const about=await get('pages','about');if(about)await put('pages',{...about,title:next.aboutTitle,body:next.aboutText});}await audit(u,'Updated store settings','main');return next;});}
      if(path==='/api/admin/sync-subscribers'&&method==='POST'){
        if(!sender.enabled)fail('Configure Sender credentials and EMAIL_ENABLED first.');
        const pending=(await all('subscribers')).filter(s=>s.senderStatus!=='synced').slice(0,10);let synced=0;
        for(const item of pending){try{if(item.status==='unsubscribed')await sender.unsubscribe(item.email);else for(const source of item.sources)await sender.subscribe(item,source);await put('subscribers',{...item,senderStatus:'synced',senderError:'',syncedAt:now()});synced++;}catch(error){await put('subscribers',{...item,senderStatus:'failed',senderError:error.message});}}
        await audit(u,'Synced Sender subscribers',String(synced));return {message:`${synced} of ${pending.length} pending subscribers synced. Run again for the next batch.`};
      }
      if(path==='/api/admin/customers'&&method==='GET')return (await db.prepare('SELECT id,name,email,role,created FROM users ORDER BY created DESC').all());
      if(path==='/api/admin/upload'&&method==='POST') {
        const b=await body(req,4200000),types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'},extension=types[b.type];
        if(!extension)fail('Upload a JPG, PNG, WebP, or PDF file.');
        const buffer=Buffer.from(str(b.data,4100000),'base64');if(!buffer.length||buffer.length>3000000)fail('Files must be smaller than 3 MB.');
        const valid=extension==='jpg'?buffer[0]===255&&buffer[1]===216&&buffer[2]===255:extension==='png'?buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):extension==='webp'?buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP':buffer.toString('ascii',0,5)==='%PDF-';
        if(!valid)fail('The file contents do not match the selected file type.');
        const filename=`${randomUUID()}.${extension}`;
        if(extension!=='pdf'&&cloudinary.configured){const asset=await cloudinary.upload(buffer,b.type);await audit(u,'Uploaded media',asset.assetId);return {url:asset.url};}
        if(hosted&&extension!=='pdf')fail('Cloudinary image storage is not configured.',503);
        await media.put(filename,buffer,b.type);await audit(u,'Uploaded media',filename);return {url:`/uploads/${filename}`};
      }
      if(path==='/api/admin/export'&&method==='GET')return {exportedAt:now(),settings:(await get('settings','main')),...Object.fromEntries(await Promise.all(['products','orders','bookings','subscribers','pages','articles','faqs','reviews','coupons','messages'].map(async k=>[k,(await all(k)).map(({token,...record})=>record)])))};
      const match=path.match(/^\/api\/admin\/(products|orders|bookings|subscribers|pages|articles|faqs|reviews|coupons|outbox|messages|audit)(?:\/([a-zA-Z0-9_-]+))?$/);
      if(match) {
        const [,kind,id]=match;
        if(method==='GET')return id?(await get(kind,id))||fail('Record not found.',404):(await all(kind));
        if(method==='DELETE') {
          if(!id||!(await get(kind,id)))fail('Record not found.',404);
          if(['orders','bookings','audit','outbox'].includes(kind))fail('This record cannot be deleted.');
          if(kind==='products'){await put(kind,{...await get(kind,id),active:false});await audit(u,'Archived product',id);}
          else{if(kind==='subscribers'&&sender.enabled)await sender.unsubscribe((await get(kind,id)).email);await remove(kind,id);await audit(u,`Deleted ${kind}`,id);}return {ok:true};
        }
        if(!['POST','PUT'].includes(method))fail('Method not allowed.',405);
        if(method==='PUT'&&(!id||!(await get(kind,id))))fail('Record not found.',404);
        const b=await body(req);let record;
        if(kind==='products')record=(await validateProduct(b,id));
        else if(kind==='orders') {
          if(!id)fail('Orders must be placed through checkout.');
          return transaction(async()=>{const order=(await get(kind,id));if(!['awaiting_payment','confirmed','processing','shipped','delivered','cancelled'].includes(b.status))fail('Choose a valid order status.');if(order.status==='cancelled'&&b.status!=='cancelled')fail('Cancelled orders cannot be reopened.');if(order.status==='delivered'&&b.status==='cancelled')fail('A delivered order requires a separate return process.');if(!order.preview&&order.paymentStatus!=='verified'&&b.status!=='cancelled'&&b.status!==order.status)fail('Verify the bank transfer before fulfilling this order.',409);if(!order.preview&&order.paymentStatus==='verified'&&b.status==='cancelled')fail('A verified payment requires a separate refund process.',409);if(order.paymentStatus==='proof_submitted'&&b.status==='cancelled')fail('Review the submitted payment receipt before cancelling this order.',409);if(order.paymentStatus==='verified'&&b.status==='awaiting_payment')fail('A verified order cannot return to awaiting payment.',409);if(b.status==='cancelled'&&!order.stockRestored){for(const item of order.items){const p=(await get('products',item.id));if(p)(await put('products',{...p,stock:p.stock+item.quantity}));}if(order.couponId){const c=(await get('coupons',order.couponId));if(c)(await put('coupons',{...c,used:Math.max(0,c.used-1)}));}order.stockRestored=true;}record=(await put(kind,{...order,status:b.status,tracking:str(b.tracking,1000),updatedAt:now()}));(await audit(u,'Updated order',id));return record;});
        }
        else if(kind==='bookings') {
          if(!id||!['confirmed','completed','cancelled'].includes(b.status))fail('Choose a valid booking status.');
          return transaction(async()=>{const existing=(await get(kind,id));if(b.status!=='cancelled'&&(await all(kind)).some(x=>x.id!==id&&overlaps(existing.slot,existing.duration,x)))fail('This appointment is already booked.',409);record=(await put(kind,{...existing,status:b.status,adminNotes:str(b.adminNotes,2000)}));(await audit(u,'Updated booking',id));return record;});
        }
        else if(kind==='coupons') {
          const code=required(b.code,'Code',40).toUpperCase();if((await all(kind)).some(c=>c.code===code&&c.id!==id))fail('This code already exists.');if(!['percent','fixed'].includes(b.type))fail('Invalid discount type.');
          record={id:id||randomUUID(),code,type:b.type,value:number(b.value,'Discount',1,b.type==='percent'?100:100000000),minimum:number(b.minimum||0,'Minimum order'),limit:whole(b.limit||0,'Usage limit'),expires:str(b.expires,10),active:!!b.active,used:(await get(kind,id||''))?.used||0};
          if(record.expires&&!/^\d{4}-\d{2}-\d{2}$/.test(record.expires))fail('Invalid expiry date.');
        }
        else if(['pages','articles'].includes(kind))record={id:id||randomUUID(),title:required(b.title,'Title'),body:required(b.body,'Content',30000),published:!!b.published,draft:!!b.draft,excerpt:str(b.excerpt,600),category:str(b.category,100),art:['routine','consult','shelf'].includes(b.art)?b.art:'routine'};
        else if(kind==='faqs')record={id:id||randomUUID(),question:required(b.question,'Question'),answer:required(b.answer,'Answer',5000),published:!!b.published};
        else if(kind==='reviews'){if(b.published&&!b.verified)fail('Only verified, genuine customer reviews can be published.');record={id:id||randomUUID(),name:required(b.name,'Customer name',100),quote:required(b.quote,'Review',2000),rating:whole(b.rating,'Rating',1,5),verified:!!b.verified,published:!!b.published};}
        else if(kind==='messages'){if(!id)fail('Use the contact form to create messages.');record={...await get(kind,id),status:b.status==='resolved'?'resolved':'new'};}
        else if(kind==='subscribers'){if(!id)fail('Subscribers must sign up with consent.');record={...await get(kind,id),tags:str(b.tags,500).split(',').map(t=>t.trim()).filter(Boolean),status:b.status==='unsubscribed'?'unsubscribed':(await get(kind,id)).status};if(record.status==='unsubscribed'&&sender.enabled)await sender.unsubscribe(record.email);}
        else fail('This collection is read-only.');
        (await put(kind,record));(await audit(u,`Saved ${kind}`,record.id));return record;
      }
    }
    fail('Page not found.',404);
  }
  const requestHandler=async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/api/')) {res.setHeader('Cache-Control','no-store');const result=await api(req,res,url);const deliveries=[];if(req.method!=='GET')deliveries.push(deliverOutbox().catch(error=>console.error('Outbox processing failed:',error.message)));if(req.method==='POST'&&(url.pathname.startsWith('/api/orders')||['/api/admin/push/subscribe','/api/admin/push/retry','/api/admin/push/test'].includes(url.pathname)))deliveries.push(deliverPush().catch(error=>console.error('Push delivery failed:',error.message)));await Promise.all(deliveries);res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(result));return;}
      if(!['GET','HEAD'].includes(req.method))fail('Method not allowed.',405);
      if(url.pathname.startsWith('/uploads/')){
        const name=url.pathname.slice(9),file=await media.get(name);if(!file)fail('File not found.',404);
        res.setHeader('Content-Type',file.type);res.setHeader('Cache-Control','public, max-age=31536000, immutable');
        if(file.type==='application/pdf')res.setHeader('Content-Disposition','attachment; filename="DrealSkinhub-guide.pdf"');
        res.end(req.method==='HEAD'?undefined:file.body);return;
      }
      const isUpload=url.pathname.startsWith('/uploads/'),base=isUpload?uploadDir:join(root,'public');
      let path=resolve(base,'.'+decodeURIComponent(isUpload?url.pathname.slice(8):url.pathname));
      if(path!==resolve(base)&&!path.startsWith(resolve(base)+sep))fail('Not found.',404);
      if(!extname(path))path=join(root,'public',url.pathname.startsWith('/admin')?'admin.html':'index.html');
      const info=await stat(path).catch(()=>null);if(!info?.isFile())fail('Not found.',404);
      const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/manifest+json','.svg':'image/svg+xml','.jpeg':'image/jpeg','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.pdf':'application/pdf','.ico':'image/x-icon'};
      res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');res.setHeader('Cache-Control',extname(path)==='.html'?'no-cache':'public, max-age=300');
      if(extname(path)==='.pdf')res.setHeader('Content-Disposition','attachment; filename="DrealSkinhub-guide.pdf"');
      res.end(req.method==='HEAD'?undefined:await readFile(path));
    }catch(error){const status=error.status||500;if(status===500)console.error('Request failed:',error.message);res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify({error:status===500?'Something went wrong. Please try again.':error.message}));}
  };
  const handle=(req,res)=>store.withRequest(()=>requestHandler(req,res));
  const server=http.createServer(handle);
  server.requestTimeout=15000;server.headersTimeout=10000;
  return {server,store,handle,deliverOutbox,deliverPush,close:()=>new Promise(resolve=>server.close(()=>{db.close();resolve();}))};
}
if(process.env.NETLIFY!=='true'&&process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const app=await createApplication();const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
  if(!['127.0.0.1','localhost','::1'].includes(host)){console.error('This preview is restricted to localhost. Complete the production integration checklist before exposing it publicly.');process.exit(1);}
  app.server.listen(port,host,()=>console.log(`DrealSkinhub: http://${host}:${port}\nAdmin setup: http://${host}:${port}/admin\nLocal preview. Payments and email sending are not connected.`));
  process.on('SIGINT',()=>app.close().then(()=>process.exit(0)));
  process.on('SIGTERM',()=>app.close().then(()=>process.exit(0)));
}
