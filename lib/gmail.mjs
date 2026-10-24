import tls from 'node:tls';
import { randomUUID } from 'node:crypto';

const address=value=>{
  const text=String(value||'').trim();
  if(!/^[^\s<>@\x00-\x1f]+@[^\s<>@\x00-\x1f]+\.[^\s<>@\x00-\x1f]+$/.test(text)||!Buffer.from(text).equals(Buffer.from(text,'ascii')))throw new Error('Gmail requires a valid email address.');
  return text;
};
const encoded=value=>`=?UTF-8?B?${Buffer.from(String(value).replace(/[\r\n]/g,' ')).toString('base64')}?=`;
const mime=({from,to,name,subject,body})=>{
  const bytes=Buffer.from(String(body||''),'utf8').toString('base64');
  const content=bytes.match(/.{1,76}/g)?.join('\r\n')||'';
  return [`From: ${encoded(name)} <${from}>`,`To: <${to}>`,`Subject: ${encoded(subject)}`,`Date: ${new Date().toUTCString()}`,`Message-ID: <${randomUUID()}@${from.split('@')[1]}>`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',content].join('\r\n');
};

export function createGmail({env=process.env,connect=tls.connect}={}) {
  const from=env.GMAIL_ADDRESS?.trim(),password=env.GMAIL_APP_PASSWORD?.replace(/\s/g,''),enabled=env.EMAIL_ENABLED==='true'&&!!from&&!!password;
  return {
    canSend:enabled,
    async send(mail) {
      if(!enabled)throw new Error('Gmail delivery is not configured.');
      const sender=address(from),to=address(mail.to),socket=connect({host:'smtp.gmail.com',port:465,servername:'smtp.gmail.com',rejectUnauthorized:true});
      socket.setTimeout(4000,()=>socket.destroy(new Error('Gmail connection timed out.')));
      const deadline=setTimeout(()=>socket.destroy(new Error('Gmail did not confirm the message in time.')),6000);
      let buffer='',replyLines=[],waiting=null,ended=null;const replies=[];
      const fail=error=>{ended=error;waiting?.reject(error);waiting=null;};
      socket.on('data',chunk=>{
        buffer+=chunk.toString('utf8');
        let newline;
        while((newline=buffer.indexOf('\n'))!==-1){
          const line=buffer.slice(0,newline).replace(/\r$/,'');buffer=buffer.slice(newline+1);
          replyLines.push(line);
          if(/^\d{3} /.test(line)){
            const reply={code:Number(line.slice(0,3)),lines:replyLines};replyLines=[];
            if(waiting){waiting.resolve(reply);waiting=null;}else replies.push(reply);
          }
        }
      });
      socket.on('error',fail);
      socket.on('close',()=>fail(new Error('Gmail closed the connection before confirming the message.')));
      const connected=new Promise((resolve,reject)=>{
        const cleanup=()=>{socket.off('secureConnect',ready);socket.off('error',failed);socket.off('close',closed);};
        const ready=()=>{cleanup();resolve();},failed=error=>{cleanup();reject(error);},closed=()=>failed(new Error('Gmail closed the connection before TLS was ready.'));
        socket.once('secureConnect',ready);socket.once('error',failed);socket.once('close',closed);
      });
      const next=()=>replies.length?Promise.resolve(replies.shift()):ended?Promise.reject(ended):new Promise((resolve,reject)=>{waiting={resolve,reject};});
      const expect=async(codes)=>{const reply=await next();if(!codes.includes(reply.code))throw new Error(`Gmail rejected the message (${reply.code}).`);return reply;};
      const command=async(line,codes)=>{socket.write(line+'\r\n');return expect(codes);};
      try{
        await connected;
        await expect([220]);
        await command('EHLO drealskinhub',[250]);
        await command(`AUTH PLAIN ${Buffer.from(`\0${sender}\0${password}`).toString('base64')}`,[235]);
        await command(`MAIL FROM:<${sender}>`,[250]);
        await command(`RCPT TO:<${to}>`,[250,251]);
        await command('DATA',[354]);
        socket.write(mime({from:sender,to,name:env.GMAIL_FROM_NAME||'DrealSkinhub',subject:mail.subject,body:mail.body})+'\r\n.\r\n');
        await expect([250]);
        socket.write('QUIT\r\n');
        return {emailId:''};
      }finally{clearTimeout(deadline);socket.destroy();}
    }
  };
}
