import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createECDH, createPublicKey, verify } from 'node:crypto';
import { createGmail } from '../lib/gmail.mjs';
import { createPush } from '../lib/push.mjs';

class SmtpSocket extends EventEmitter {
  sent=[];
  constructor(){super();queueMicrotask(()=>{this.emit('secureConnect');this.emit('data',Buffer.from('220 smtp.gmail.com ready\r\n'));});}
  setTimeout(){}
  write(value){
    this.sent.push(value);
    const line=value.trim();
    let reply='250 accepted\r\n';
    if(line.startsWith('EHLO'))reply='250-smtp.gmail.com\r\n250 AUTH PLAIN\r\n';
    else if(line.startsWith('AUTH PLAIN'))reply='235 authenticated\r\n';
    else if(line==='DATA')reply='354 continue\r\n';
    else if(line==='QUIT')return;
    queueMicrotask(()=>this.emit('data',Buffer.from(reply)));
  }
  destroy(){this.emit('close');}
}

test('Gmail sends a plain-text transactional message over authenticated TLS SMTP',async()=>{
  let options,socket;
  const gmail=createGmail({env:{EMAIL_ENABLED:'true',GMAIL_ADDRESS:'store@gmail.com',GMAIL_APP_PASSWORD:'app test secret',GMAIL_FROM_NAME:'DrealSkinhub'},connect:value=>{options=value;socket=new SmtpSocket();return socket;}});
  assert.equal(gmail.canSend,true);
  await gmail.send({to:'buyer@example.com',subject:'Payment received: DS-123',body:'Your receipt is ready.'});
  assert.equal(options.host,'smtp.gmail.com');assert.equal(options.port,465);assert.equal(options.rejectUnauthorized,true);
  assert.ok(socket.sent.some(value=>value.startsWith('AUTH PLAIN ')));
  const message=socket.sent.find(value=>value.includes('Content-Transfer-Encoding: base64'));
  assert.match(message,/To: <buyer@example.com>/);
  assert.match(message,/WW91ciByZWNlaXB0IGlzIHJlYWR5Lg==/);
  assert.ok(!message.includes('app test secret'));
  await assert.rejects(()=>gmail.send({to:'buyer@example.com\r\nBcc: attacker@example.com',subject:'Hello',body:'Body'}),/valid email address/);
  assert.equal(createGmail({env:{EMAIL_ENABLED:'false',GMAIL_ADDRESS:'store@gmail.com',GMAIL_APP_PASSWORD:'secret'}}).canSend,false);
});

test('web push signs a VAPID request and refuses untrusted endpoints',async()=>{
  const ecdh=createECDH('prime256v1');ecdh.generateKeys();
  const scalar=ecdh.getPrivateKey().toString('base64url');
  let request;
  const push=createPush({env:{PUSH_VAPID_PRIVATE_KEY:scalar,PUSH_CONTACT_EMAIL:'owner@example.com'},fetchImpl:async(url,options)=>{request={url,options};return {ok:true,status:201};}});
  assert.equal(push.configured,true);
  assert.equal(push.publicKey,ecdh.getPublicKey().toString('base64url'));
  assert.throws(()=>push.validateEndpoint('http://127.0.0.1/private'),/not supported/);
  assert.throws(()=>push.validateEndpoint('https://fcm.googleapis.com.attacker.test/x'),/not supported/);
  assert.throws(()=>push.validateEndpoint('https://user@fcm.googleapis.com/x'),/not supported/);
  await push.send('https://fcm.googleapis.com/fcm/send/example');
  assert.equal(request.options.method,'POST');assert.equal(request.options.redirect,'error');
  assert.equal(request.options.headers.TTL,'86400');
  const [,jwt,publicKey]=/^vapid t=([^,]+), k=(.+)$/.exec(request.options.headers.Authorization);
  const [header,payload,signature]=jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header,'base64url')), {typ:'JWT',alg:'ES256'});
  assert.equal(JSON.parse(Buffer.from(payload,'base64url')).aud,'https://fcm.googleapis.com');
  const point=Buffer.from(publicKey,'base64url');
  const key=createPublicKey({key:{kty:'EC',crv:'P-256',x:point.subarray(1,33).toString('base64url'),y:point.subarray(33).toString('base64url')},format:'jwk'});
  assert.equal(verify('sha256',Buffer.from(`${header}.${payload}`),{key,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')),true);
  assert.equal(push.validateEndpoint('https://push.services.mozilla.com/path'),'https://push.services.mozilla.com/path');
});
