// Sender requests only run when EMAIL_ENABLED=true and server-side credentials exist.
export function createSender({env=process.env,fetchImpl=fetch}={}) {
  const enabled=env.EMAIL_ENABLED==='true'&&!!env.SENDER_API_KEY;
  const groups={guide:env.SENDER_GUIDE_GROUP_ID,newsletter:env.SENDER_NEWSLETTER_GROUP_ID};
  async function request(path,method='GET',body) {
    const response=await fetchImpl('https://api.sender.net/v2'+path,{method,headers:{Authorization:`Bearer ${env.SENDER_API_KEY}`,'Content-Type':'application/json',Accept:'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result.success===false){const error=new Error(`Sender request failed (${response.status}). Check your Sender account and configuration.`);error.statusCode=response.status;throw error;}
    return result;
  }
  return {
    enabled,
    canSend:enabled&&!!env.SENDER_FROM_EMAIL,
    async subscribe(subscriber,source) {
      if(!enabled)return {status:'not connected'};
      const group=groups[source];if(!group)throw new Error(`The Sender ${source} group has not been configured.`);
      let existing;
      try{existing=await request('/subscribers/'+encodeURIComponent(subscriber.email));}catch(error){if(error.statusCode!==404)throw error;}
      if(!existing)await request('/subscribers','POST',{email:subscriber.email,firstname:subscriber.name,groups:[group],trigger_automation:true});
      else {
        // Do not overwrite provider suppression flags or silently reactivate unsubscribed contacts.
        await request('/subscribers/'+encodeURIComponent(subscriber.email),'PATCH',{firstname:subscriber.name,trigger_automation:false});
        await request('/subscribers/groups/'+encodeURIComponent(group),'POST',{subscribers:[subscriber.email],trigger_automation:true});
      }
      return {status:'synced'};
    },
    async unsubscribe(address) {
      if(!enabled)return;
      try{await request('/subscribers/'+encodeURIComponent(address),'PATCH',{subscriber_status:'UNSUBSCRIBED',trigger_automation:false});}catch(error){if(error.statusCode!==404)throw error;}
    },
    async send(mail) {
      if(!enabled||!env.SENDER_FROM_EMAIL)throw new Error('Transactional email is not configured.');
      return request('/message/send','POST',{from:{email:env.SENDER_FROM_EMAIL,name:env.SENDER_FROM_NAME||'DrealSkinhub'},to:{email:mail.to},subject:mail.subject,text:mail.body});
    }
  };
}
