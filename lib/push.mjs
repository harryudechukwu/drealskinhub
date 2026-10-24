import { createECDH, createPrivateKey, sign } from 'node:crypto';

const json=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const endpointUrl=value=>{
  const url=new URL(value);
  const host=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||url.port||url.username||url.password||!(host==='fcm.googleapis.com'||host==='push.services.mozilla.com'||host.endsWith('.push.services.mozilla.com')||host==='web.push.apple.com'||host.endsWith('.notify.windows.com')))throw new Error('This browser push endpoint is not supported.');
  return url.toString();
};

export function createPush({env=process.env,fetchImpl=fetch}={}) {
  const contact=env.PUSH_CONTACT_EMAIL||env.ADMIN_EMAIL;
  let privateKey,publicKey;
  if(env.PUSH_VAPID_PRIVATE_KEY&&contact){
    try{
      const scalar=Buffer.from(env.PUSH_VAPID_PRIVATE_KEY,'base64url');
      if(scalar.length!==32||!contact.includes('@'))throw new Error('Invalid VAPID settings.');
      const ecdh=createECDH('prime256v1');ecdh.setPrivateKey(scalar);
      const point=ecdh.getPublicKey();
      const x=point.subarray(1,33).toString('base64url'),y=point.subarray(33).toString('base64url');
      privateKey=createPrivateKey({key:{kty:'EC',crv:'P-256',x,y,d:scalar.toString('base64url')},format:'jwk'});
      publicKey=point.toString('base64url');
    }catch(error){throw new Error('PUSH_VAPID_PRIVATE_KEY or PUSH_CONTACT_EMAIL is invalid.');}
  }
  return {
    configured:!!privateKey,
    publicKey:publicKey||'',
    validateEndpoint:endpointUrl,
    async send(endpoint) {
      if(!privateKey)throw new Error('Push notifications are not configured.');
      const url=endpointUrl(endpoint),audience=new URL(url).origin;
      const token=`${json({typ:'JWT',alg:'ES256'})}.${json({aud:audience,exp:Math.floor(Date.now()/1000)+3600,sub:`mailto:${contact}`})}`;
      const signature=sign('sha256',Buffer.from(token),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
      const response=await fetchImpl(url,{method:'POST',redirect:'error',headers:{Authorization:`vapid t=${token}.${signature}, k=${publicKey}`,TTL:'86400'},signal:AbortSignal.timeout(4000)});
      if(response.status===404||response.status===410)return {expired:true};
      if(!response.ok)throw new Error(`Push service rejected the notification (${response.status}).`);
      return {expired:false};
    }
  };
}
