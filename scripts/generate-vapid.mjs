import { createECDH } from 'node:crypto';

const key=createECDH('prime256v1');key.generateKeys();
console.log('PUSH_VAPID_PRIVATE_KEY='+Buffer.from(key.getPrivateKey().toString('hex').padStart(64,'0'),'hex').toString('base64url'));
console.log('Keep this private in Netlify environment variables. Do not commit it.');
