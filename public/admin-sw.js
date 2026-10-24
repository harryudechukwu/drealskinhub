self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    let alerts=[];
    try{
      const subscription=await self.registration.pushManager.getSubscription();
      if(subscription){
        const response=await fetch('/api/admin/push/alerts',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint})});
        if(response.ok)alerts=(await response.json()).alerts||[];
      }
    }catch{}
    if(!alerts.length)alerts=[{id:crypto.randomUUID(),title:'DrealSkinhub needs your attention',body:'Open your store admin to review recent orders.',url:'/admin#orders'}];
    await Promise.all(alerts.map(alert=>self.registration.showNotification(alert.title,{body:alert.body,icon:'/assets/logo.jpeg',badge:'/assets/logo.jpeg',tag:alert.id,data:{url:'/admin#orders'}})));
  })());
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const destination='/admin#orders';
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=windows.find(client=>new URL(client.url).origin===self.location.origin&&new URL(client.url).pathname.startsWith('/admin'));
    if(existing){await existing.navigate(destination);await existing.focus();}
    else await clients.openWindow(destination);
  })());
});
