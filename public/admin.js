import {$,$$,escape as e,money,date,api,icon,art,toast,submitForm,field,errorBox,empty} from './shared.js';
import {siteSectionGroups,siteSectionKeys} from './site-sections.js';
let user,overview,records=[],currentTab='dashboard',settingsTab='general',contentTab='pages',editing=null,editorImages=[],setupTokenRequired=false;

const compactAdmin=matchMedia('(max-width: 1024px)');
function setAdminNavigation(open){
  const sidebar=$('.admin-sidebar');if(!sidebar)return;
  const wasOpen=sidebar.classList.contains('is-open'),visible=compactAdmin.matches&&open;
  sidebar.classList.toggle('is-open',visible);sidebar.inert=compactAdmin.matches&&!visible;
  sidebar.setAttribute('aria-hidden',String(compactAdmin.matches&&!visible));
  $('.admin-menu').setAttribute('aria-expanded',String(visible));
  $('.admin-nav-backdrop').hidden=!visible;$('.admin-workspace-main').inert=visible;
  document.body.classList.toggle('admin-nav-open',visible);
  if(visible)$('.admin-close').focus();else if(wasOpen&&compactAdmin.matches)$('.admin-menu').focus();
}
compactAdmin.addEventListener('change',()=>setAdminNavigation(false));
document.addEventListener('keydown',event=>{
  const sidebar=$('.admin-sidebar.is-open');if(!sidebar)return;
  if(event.key==='Escape'){event.preventDefault();setAdminNavigation(false);}
  if(event.key==='Tab'){
    const items=$$('a,button',sidebar).filter(el=>el.getClientRects().length&&!el.disabled),first=items[0],last=items.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});

const nav=[['dashboard','grid','Overview'],['products','box','Products'],['orders','bag','Orders'],['bookings','calendar','Consultations'],['customers','user','Customers'],['coupons','tag','Discounts'],['content','file','Website content'],['subscribers','mail','Subscribers'],['messages','chat','Messages'],['settings','settings','Settings']];
const labels={dashboard:'Your store, at a glance.',products:'A little care for your catalogue.',orders:'Every order matters.',bookings:'Make room for your customers.',customers:'Your growing community.',coupons:'A little treat for your customers.',content:'Make the website yours.',subscribers:'Good things start with a connection.',messages:'A listening ear, always.',settings:'The little details behind your store.'};
let pushRegistration,pushConfig;
const pushSupported=()=>isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const pushKey=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=')),character=>character.charCodeAt(0));
const pushPanel=()=>`<section class="admin-card push-card"><div class="card-heading"><h2>Order alerts on this device</h2></div><p>Get a notification when a customer places an order or uploads a payment receipt. On iPhone, add this admin page to your Home Screen first.</p><div class="push-controls"><button type="button" class="button" data-action="push-toggle" disabled>Checking notifications…</button><button type="button" class="button button-outline" data-action="push-test" disabled>Send test alert</button><button type="button" class="text-button" data-action="push-retry">Retry pending alerts</button></div><p class="small-note" id="push-status" role="status"></p></section>`;
async function refreshPushControls(){
  const button=$('[data-action="push-toggle"]'),test=$('[data-action="push-test"]'),label=$('#push-status');if(!button)return;
  if(!pushSupported()){button.textContent='Notifications unavailable';button.disabled=true;label.textContent='Use a supported browser over HTTPS. On iPhone, open the Home Screen app.';return;}
  if(!pushConfig?.configured){button.textContent='Push setup pending';button.disabled=true;label.textContent='Add the push key in Netlify environment variables first.';return;}
  if(!pushRegistration){button.textContent='Preparing notifications…';button.disabled=true;return;}
  const subscription=await pushRegistration.pushManager.getSubscription();
  button.disabled=Notification.permission==='denied';button.textContent=subscription?'Turn off notifications':'Enable notifications';
  test.disabled=!subscription;label.textContent=Notification.permission==='denied'?'Notifications are blocked in your browser settings.':subscription?'Alerts are enabled on this device.':'Tap Enable notifications to receive order alerts.';
}
async function preparePush(){
  if(!pushSupported())return refreshPushControls();
  try{[pushConfig,pushRegistration]=await Promise.all([api('/api/admin/push/config'),navigator.serviceWorker.register('/admin-sw.js',{scope:'/'})]);await navigator.serviceWorker.ready;await refreshPushControls();}
  catch(error){const label=$('#push-status');if(label)label.textContent=error.message;}
}
const pretty=s=>String(s||'').replace(/[-_]/g,' ').replace(/^./,c=>c.toUpperCase());
const status=s=>`<span class="status status-${e(String(s).split(' ')[0])}">${e(pretty(s))}</span>`;
const textarea=(label,name,value='',extra='')=>`<label class="field"><span>${e(label)}</span><textarea name="${name}" rows="4" ${extra}>${e(value)}</textarea></label>`;
const checkbox=(label,name,value)=>`<label class="check"><input type="checkbox" name="${name}" ${value?'checked':''}> ${e(label)}</label>`;
const select=(label,name,values,value)=>`<label class="field"><span>${e(label)}</span><select name="${name}">${values.map(v=>{const [key,text]=Array.isArray(v)?v:[v,v];return `<option value="${e(key)}" ${key===value?'selected':''}>${e(text)}</option>`;}).join('')}</select></label>`;
function shell() {
  $('#admin-root').innerHTML=`<aside class="admin-sidebar"><a class="admin-brand" href="/admin"><img src="/assets/logo.jpeg" width="48" height="48" alt="DrealSkinhub logo"><span>DrealSkinhub<small>YOUR STORE, WITH CARE.</small></span></a><div class="admin-workspace"><span class="workspace-dot"></span><div>Your store<small>Preview workspace</small></div><span class="workspace-badge">DS</span><button class="icon-button admin-close" data-action="admin-menu-close" aria-label="Close admin navigation">${icon('close')}</button></div><span class="sidebar-label">MANAGE YOUR STORE</span><nav aria-label="Store administration">${nav.map(([key,i,label])=>`<a href="/admin#${key}" data-tab="${key}">${icon(i)}<span>${label}</span>${key==='orders'?'<span id="nav-order-count"></span>':''}</a>`).join('')}</nav><div class="sidebar-bottom"><a href="/" target="_blank" rel="noopener">${icon('external')} View your storefront</a><div class="admin-user"><span class="avatar">${e(user.name.slice(0,1))}</span><div>${e(user.name)}<small>Store administrator</small></div><button class="icon-button" data-action="logout" aria-label="Sign out">${icon('logout')}</button></div></div></aside><button class="admin-nav-backdrop" data-action="admin-menu-close" aria-label="Close admin navigation" hidden></button><div class="admin-workspace-main"><header class="admin-topbar"><button class="icon-button admin-menu" data-action="admin-menu" aria-label="Open admin navigation" aria-expanded="false">${icon('menu')}</button><span>DrealSkinhub <span class="topbar-slash">/</span> <strong id="topbar-page">Overview</strong></span><div><span class="admin-preview">● Preview mode</span><a href="/" class="text-link" target="_blank" rel="noopener">View store ${icon('external')}</a></div></header><main id="admin-main" tabindex="-1"></main></div>`;
  setAdminNavigation(false);
}
function title(name,action='') {return `<div class="admin-page-heading"><div><h1>${name}</h1><p>${labels[currentTab]||''}</p></div>${action}</div>`;}
const addButton=(label,kind)=>`<button class="button" data-action="new" data-kind="${kind}">${icon('plus')}${label}</button>`;
const searchBar=(placeholder,extra='')=>`<div class="admin-toolbar"><label class="admin-search">${icon('search')}<input type="search" id="record-search" placeholder="${placeholder}" aria-label="${placeholder}"></label>${extra}</div>`;
const rowActions=(kind,id,remove=false)=>`<div class="row-actions"><button class="icon-button" data-action="edit" data-kind="${kind}" data-id="${e(id)}" aria-label="Edit ${kind}">${icon('edit')}</button>${remove?`<button class="icon-button" data-action="delete" data-kind="${kind}" data-id="${e(id)}" aria-label="${kind==='products'?'Archive product':'Delete record'}">${icon('trash')}</button>`:''}</div>`;
function table(headers,rows,emptyTitle='Nothing here just yet.') {return `<div class="table-wrap"><table class="admin-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${headers.length}"><div class="table-empty"><p>${emptyTitle}</p></div></td></tr>`}</tbody></table></div>`;}
function dashboard() {
  const o=overview,activeOrders=o.orders.filter(x=>x.paymentStatus==='verified'),sales=activeOrders.reduce((s,x)=>s+x.total,0),low=o.products.filter(x=>x.active&&x.stock<=o.settings.lowStockThreshold);
  return title(`Welcome back, ${e(user.name.split(' ')[0])}.`,`<a class="button button-outline" href="/" target="_blank" rel="noopener">Visit your store ${icon('external')}</a>`)+`<div class="admin-notice">${icon('leaf')}<div><strong>A good place to grow.</strong><p>Orders stay pending until you verify the transfer in your bank account. Replace sample products before accepting live orders.</p></div></div><div class="stats-grid">${[[money(sales),'Verified order value','bag','Bank verified only'],[o.orders.length,'Orders','box',`${o.orders.filter(x=>x.paymentStatus==='proof_submitted').length} receipt images to review`],[o.products.filter(x=>x.active).length,'Active products','leaf',`${low.length} need a stock check`],[o.subscribers.filter(x=>x.status==='subscribed').length,'Subscribers','mail','Your growing community']].map(([v,t,i,n])=>`<div class="stat-card"><div><span>${t}</span>${icon(i)}</div><strong>${v}</strong><small>${n}</small></div>`).join('')}</div><div class="dashboard-columns"><section class="admin-card"><div class="card-heading"><h2>Recent orders</h2><a href="/admin#orders" class="text-link">View all ${icon('arrow')}</a></div>${table(['Order','Customer','Total','Status'],o.orders.slice(0,5).map(order=>`<tr><td><button class="table-link" data-action="edit" data-kind="orders" data-id="${e(order.id)}">${e(order.id)}</button><small>${date(order.createdAt)}</small></td><td>${e(order.customer.name)}</td><td>${money(order.total)}</td><td>${status(order.status)}</td></tr>`),'Your first order will appear here.')}</section><section class="admin-card stock-card"><div class="card-heading"><h2>A little attention</h2><span class="count-pill">${low.length}</span></div><p class="card-subtitle">Keep your customers’ favourites in stock.</p>${low.length?low.slice(0,5).map(p=>`<button class="stock-row" data-action="edit" data-kind="products" data-id="${e(p.id)}"><div class="tiny-art">${art(p)}</div><div><strong>${e(p.name)}</strong><small>${e(p.brand)}</small></div>${status(p.stock?`${p.stock} left`:'out of stock')}</button>`).join(''):'<div class="table-empty"><p>Your shelves are looking good.</p></div>'}</section></div><div class="dashboard-columns"><section class="admin-card"><div class="card-heading"><h2>Make yourself at home.</h2></div><div class="quick-links">${[['products','box','Curate your catalogue','Add products, photos, and stock.'],['content','file','Tell your story','Edit pages, articles, and FAQs.'],['settings','settings','Make it your own','Update your homepage and store settings.']].map(([k,i,t,p])=>`<a href="/admin#${k}"><span class="quick-icon">${icon(i)}</span><div><strong>${t}</strong><p>${p}</p></div>${icon('arrow')}</a>`).join('')}</div></section><section class="admin-card integration-card"><div class="card-heading"><h2>Store connections</h2></div><div class="integration-row"><span>${icon('shield')} Payments</span>${status(overview.integrationStatus.payments)}</div><div class="integration-row"><span>${icon('mail')} Customer updates</span>${status(overview.integrationStatus.email)}</div><div class="integration-row"><span>${icon('external')} Hosting</span>${status(overview.integrationStatus.hosting)}</div><p>Set bank details and push alerts in Netlify before checkout opens. Send customer updates manually from each order. Replace sample products before taking orders. Credentials belong in server environment variables.</p><a class="text-link" href="/admin#settings">Store settings ${icon('arrow')}</a></section></div>`;
}
function renderRecords(query='') {
  const q=query.toLowerCase(),kind=currentTab==='content'?contentTab:currentTab,list=records.filter(r=>JSON.stringify(r).toLowerCase().includes(q));let html='';
  if(kind==='products')html=table(['Product','Price','Inventory','Visibility','',],list.map(p=>`<tr><td><div class="table-product"><div class="tiny-art">${art(p)}</div><div><button class="table-link" data-action="edit" data-kind="products" data-id="${e(p.id)}">${e(p.name)}</button><small>${e(p.brand)} · ${e(p.size)}${p.sample?' · Sample':''}</small></div></div></td><td><strong>${money(p.price)}</strong>${p.compareAt>p.price?`<small><s>${money(p.compareAt)}</s></small>`:''}</td><td>${status(p.stock===0?'out of stock':p.stock<=overview.settings.lowStockThreshold?'low stock':'in stock')}<small>${p.stock} available</small></td><td>${status(p.active?'active':'archived')}${p.featured?'<small>Featured favourite</small>':''}</td><td>${rowActions('products',p.id,true)}</td></tr>`),'Your catalogue is ready for its first product.');
  else if(kind==='orders')html=table(['Order','Customer','Total','Payment','Fulfilment',''],list.map(o=>`<tr><td><button class="table-link" data-action="edit" data-kind="orders" data-id="${e(o.id)}">${e(o.id)}</button><small>${date(o.createdAt)}</small></td><td>${e(o.customer.name)}<small>${e(o.customer.email)}</small></td><td>${money(o.total)}</td><td>${status(o.paymentStatus)}</td><td>${status(o.status)}</td><td>${rowActions(kind,o.id)}</td></tr>`),'Orders will appear here after checkout.');
  else if(kind==='bookings')html=table(['Appointment · WAT','Customer','Fee','Status',''],list.map(b=>`<tr><td><strong>${date(b.slot)}</strong><small>${e(b.id)}</small></td><td>${e(b.name)}<small>${e(b.email)}</small></td><td>${money(b.price)}<small>Preview · no payment</small></td><td>${status(b.status)}</td><td>${rowActions(kind,b.id)}</td></tr>`),'Your first consultation booking will appear here.');
  else if(kind==='customers')html=table(['Name','Email','Role','Joined'],list.map(c=>`<tr><td><strong>${e(c.name)}</strong></td><td>${e(c.email)}</td><td>${status(c.role)}</td><td>${date(c.created)}</td></tr>`));
  else if(kind==='coupons')html=table(['Discount code','Value','Minimum order','Usage','Status',''],list.map(c=>`<tr><td><strong>${e(c.code)}</strong><small>${c.expires?'Expires '+e(c.expires):'No expiry'}</small></td><td>${c.type==='percent'?c.value+'%':money(c.value)}</td><td>${money(c.minimum)}</td><td>${c.used}${c.limit?' / '+c.limit:''}</td><td>${status(c.active?'active':'inactive')}</td><td>${rowActions(kind,c.id,true)}</td></tr>`),'Add your first discount code.');
  else if(['pages','articles'].includes(kind))html=table(['Title',kind==='articles'?'Category':'Page address','Status',''],list.map(p=>`<tr><td><strong>${e(p.title)}</strong></td><td>${kind==='articles'?e(p.category):'/'+e(p.id)}</td><td>${status(p.published?'published':'hidden')}${p.draft?'<small>Policy draft</small>':''}</td><td>${rowActions(kind,p.id,kind==='articles')}</td></tr>`));
  else if(kind==='faqs')html=table(['Question','Answer','Status',''],list.map(f=>`<tr><td><strong>${e(f.question)}</strong></td><td class="truncate-cell">${e(f.answer)}</td><td>${status(f.published?'published':'hidden')}</td><td>${rowActions(kind,f.id,true)}</td></tr>`));
  else if(kind==='reviews')html=table(['Customer','Review','Rating','Status',''],list.map(r=>`<tr><td>${e(r.name)}</td><td class="truncate-cell">${e(r.quote)}</td><td>${r.rating}/5</td><td>${status(r.published?'published':'hidden')}</td><td>${rowActions(kind,r.id,true)}</td></tr>`),'No reviews yet. Add only genuine customer reviews with permission.');
  else if(kind==='subscribers')html=table(['Subscriber','Sources','Tags','Status',''],list.map(s=>`<tr><td><strong>${e(s.name)}</strong><small>${e(s.email)}</small></td><td>${s.sources.map(x=>status(x)).join(' ')}</td><td>${e((s.tags||[]).join(', '))||'—'}</td><td>${status(s.status)}<small>${e(s.senderStatus||'not connected')}</small>${s.senderError?'<small>'+e(s.senderError)+'</small>':''}</td><td>${rowActions(kind,s.id,true)}</td></tr>`),'Your first subscriber will appear here.');
  else if(kind==='messages')html=table(['From','Subject','Received','Status',''],list.map(m=>`<tr><td><strong>${e(m.name)}</strong><small>${e(m.email)}</small></td><td>${e(m.subject)}</td><td>${date(m.createdAt)}</td><td>${status(m.status)}</td><td>${rowActions(kind,m.id,true)}</td></tr>`),'No customer messages yet.');
  else if(kind==='outbox')html=table(['To','Subject','Type','Status',''],list.map(m=>`<tr><td>${e(m.to)}</td><td>${e(m.subject)}</td><td>${e(m.kind)}</td><td>${status(m.status)}</td><td><button class="text-button" data-action="view-mail" data-id="${e(m.id)}">View</button></td></tr>`),'Automated email previews appear here.');
  else if(kind==='audit')html=table(['Action','Record','Administrator','Time'],list.map(a=>`<tr><td>${e(a.action)}</td><td>${e(a.record)}</td><td>${e(a.actor)}</td><td>${date(a.createdAt)}</td></tr>`));
  $('#records-table').innerHTML=html;
}
async function renderTab() {
  currentTab=location.hash.slice(1)||'dashboard';if(![...nav.map(x=>x[0]),'outbox','audit'].includes(currentTab))currentTab='dashboard';
  const label=nav.find(x=>x[0]===currentTab)?.[2]||pretty(currentTab);$('#topbar-page').textContent=label;document.title=`${label} | DrealSkinhub Admin`;
  $$('.admin-sidebar nav a').forEach(a=>a.classList.toggle('active',a.dataset.tab===currentTab));setAdminNavigation(false);
  try {
    overview=await api('/api/admin/dashboard');
    if(currentTab==='dashboard'){$('#admin-main').innerHTML=dashboard()+pushPanel();await refreshPushControls();return;}
    if(currentTab==='settings'){$('#admin-main').innerHTML=title('Store settings.')+settingsView();return;}
    if(currentTab==='content'){
      records=await api('/api/admin/'+contentTab);$('#admin-main').innerHTML=title('Your website, your voice.',addButton('Add '+(contentTab==='faqs'?'FAQ':contentTab.slice(0,-1)),contentTab))+`<div class="admin-tabs">${['pages','articles','faqs','reviews'].map(x=>`<button class="${contentTab===x?'active':''}" data-action="content-tab" data-kind="${x}">${x==='faqs'?'FAQs':pretty(x)}</button>`).join('')}</div>`+searchBar('Search your content…')+'<section class="admin-card" id="records-table"></section>';renderRecords();return;
    }
    records=currentTab==='products'?overview.products:currentTab==='orders'?overview.orders:currentTab==='bookings'?overview.bookings:currentTab==='subscribers'?overview.subscribers:await api('/api/admin/'+currentTab);
    const action=['products','coupons'].includes(currentTab)?addButton(currentTab==='products'?'Add a product':'Create discount',currentTab):currentTab==='bookings'?'<button class="button" data-action="consult-settings">Manage availability '+icon('calendar')+'</button>':['orders','subscribers'].includes(currentTab)?`<button class="button button-outline" data-action="export-csv">${icon('download')} Export CSV</button>`:'';
    const extra=currentTab==='subscribers'?'<a class="text-link" href="/admin#outbox">Preview email outbox '+icon('arrow')+'</a>':'';
    $('#admin-main').innerHTML=title(label+'.',action)+(currentTab==='subscribers'?'<div class="admin-notice">'+icon('mail')+'<div><strong>Subscribers are saved in this preview.</strong><p>Signups are saved here. Newsletter delivery is not connected yet. Export subscribers only with their consent.</p></div></div>':'')+searchBar('Search '+label.toLowerCase()+'…',extra)+'<section class="admin-card" id="records-table"></section>';renderRecords();
  }catch(err){$('#admin-main').innerHTML=`<div class="panel"><h2>We couldn’t load this page.</h2><p>${e(err.message)}</p><button class="button" data-action="reload">Try again</button></div>`;}
}
const homepageSectionLabels={categories:'Shop by category',featured:'Everyday essentials',consultation:'Consultation',concerns:'Shop by skin concern',brands:'Shop by brand',guide:'Skincare guide',reviews:'Customer reviews',journal:'Skin journal'};
const starterHomepageCollections=[{id:'best-sellers',title:'Best sellers',productIds:['clarifying-serum','body-lotion','soft-headband','even-tone'],enabled:true}];
const starterHomepageOrder=['categories','featured','best-sellers','consultation','concerns','brands','guide','reviews','journal'];
function homepageSectionRow(key,settings,collections){
  const collection=collections.find(c=>c.id===key),label=collection?.title||homepageSectionLabels[key]||key;
  if(!collection&&!homepageSectionLabels[key])return '';
  return `<div class="homepage-section-row" data-home-section data-section-id="${e(key)}" ${collection?'data-home-collection':''}><div class="homepage-section-heading"><label class="check"><input type="checkbox" ${collection?'data-collection-enabled':`name="section_${e(key)}"`} ${collection?collection.enabled?'checked':'':settings.sections[key]?'checked':''}><span>${e(label)}</span></label><div class="homepage-order-actions"><button type="button" class="icon-button" data-action="move-home-section" data-direction="up" aria-label="Move ${e(label)} up">${icon('arrow')}</button><button type="button" class="icon-button" data-action="move-home-section" data-direction="down" aria-label="Move ${e(label)} down">${icon('arrow')}</button>${collection?`<button type="button" class="icon-button" data-action="remove-home-section" aria-label="Remove ${e(label)}">${icon('trash')}</button>`:''}</div></div>${collection?`<div class="homepage-collection-editor">${field('Section title','collectionTitle',collection.title,'text','required maxlength="100"')}<p class="form-help">Choose products to show in this section. Only products visible in the shop will appear.</p><div class="homepage-product-choices">${overview.products.map(p=>`<label class="check"><input type="checkbox" data-product-id="${e(p.id)}" ${(collection.productIds||[]).includes(p.id)?'checked':''}><span>${e(p.name)}${p.active?'':' (hidden)'}</span></label>`).join('')}</div></div>`:''}</div>`;
}
function homeSettings(s){
  const collections=s.homeCollections||starterHomepageCollections,order=s.sectionOrder||starterHomepageOrder;
  const allKeys=[...Object.keys(s.sections),...collections.map(c=>c.id)];
  const rows=[...new Set([...order,...allKeys])].filter(key=>allKeys.includes(key)).map(key=>homepageSectionRow(key,s,collections)).join('');
  const heroTitle=['Your skin.\nYour kind of care.','Glow essentials,\ncurated for you.'].includes(s.heroTitle)?'A little care.\nA lot of confidence.':s.heroTitle;
  const heroText=['Discover skincare and guidance that fit your skin, your routine, and your everyday life.','Thoughtfully chosen skincare for every step of your routine.'].includes(s.heroText)?'Your skin is uniquely yours. Find authentic skincare and thoughtful guidance for every step of your journey.':s.heroText;
  const heroMedia=[
    ['First product · Illiyoon','heroProductOne','/assets/photos/hero-illiyoon-cutout.png'],
    ['Second product · Korean Skin','heroProductTwo','/assets/photos/hero-korean-skin-cutout.png'],
    ['Third product · COSRX','heroProductThree','/assets/photos/hero-cosrx-cutout.png'],
    ['Fourth product · Dove','heroProductFour','/assets/photos/hero-dove-cutout.png'],
  ].map(([label,name,fallback])=>mediaField(label,name,s[name]||fallback,'image/jpeg,image/png,image/webp')).join('');
  return `<h2>Your first impression, with care.</h2>${field('Announcement bar','announcement',s.announcement)}${textarea('Hero headline · use a new line for the second line','heroTitle',heroTitle)}${textarea('Hero introduction','heroText',heroText)}${field('Shop button label','heroPrimary',s.heroPrimary)}<h3>Hero products</h3><p class="form-help">These four images appear one at a time inside the hero quatrefoil. Transparent PNG or WebP replacements work best.</p><div class="form-row">${heroMedia}</div>${mediaField('Optional background image','heroImage',s.heroImage,'image/jpeg,image/png,image/webp')}<p class="small-note">A background image appears behind the four products.</p><hr><div class="card-heading"><div><h3>Homepage sections</h3><p class="form-help">Move sections to set their display order. Add a product section for Best sellers, new arrivals, or any other edit.</p></div><button type="button" class="button button-outline" data-action="add-home-section">${icon('plus')} Add product section</button></div><div id="homepage-section-list" class="homepage-section-list">${rows}</div><hr>${field('About heading','aboutTitle',s.aboutTitle)}${textarea('About introduction','aboutText',s.aboutText)}`;
}
function visibilitySettings(s){
  const groups=siteSectionGroups.map(group=>{
    const items=group.items.map(item=>checkbox(item.label,`visibility_${item.key}`,s.sectionVisibility?.[item.key]!==false));
    if(group.path==='/'){
      items.push(...Object.entries(homepageSectionLabels).map(([key,label])=>checkbox(label,`visibility_home_${key}`,s.sections[key]!==false)));
      items.push(...(s.homeCollections||starterHomepageCollections).map(collection=>checkbox(collection.title,`visibility_collection_${collection.id}`,collection.enabled)));
    }
    return `<fieldset class="visibility-group"><legend>${e(group.label)}</legend><div class="visibility-options">${items.join('')}</div></fieldset>`;
  }).join('');
  return `<h2>Choose what visitors see.</h2><p class="form-help">Turn content sections on or off without deleting their text, products, or order. Hidden sections take up no space. Keep editing homepage section order and products in the Homepage tab.</p><div class="visibility-groups">${groups}</div><p class="small-note">Shopping, checkout, payment, account, and policy pages stay available so customer orders remain usable.</p>`;
}
function settingsView() {
  const s=overview.settings;
  const categoryPaths=(s.categoryTree?.length?s.categoryTree:s.categories.map(label=>({label,children:[]}))).flatMap(group=>group.children.length?group.children.map(child=>`${group.label} > ${child}`):[group.label]).join('\n');
  const tabs=[['general','Store details'],['homepage','Homepage'],['visibility','Visibility'],['collections','Collections'],['delivery','Delivery'],['consultation','Consultations'],['guide','Skincare guide'],['data','Data & integrations']];
  let body='';
  if(settingsTab==='general')body=`<h2>The details that make it yours.</h2><div class="form-row">${field('Store name','storeName',s.storeName,'text','required')}${field('Tagline','tagline',s.tagline)}</div><div class="form-row">${field('Customer support email','supportEmail',s.supportEmail,'email')}${field('Customer support phone','supportPhone',s.supportPhone,'tel')}</div><div class="form-row">${field('WhatsApp number · include country code','whatsapp',s.whatsapp)}${field('Instagram · full HTTPS link','instagram',s.instagram,'url')}</div>${field('Store address','address',s.address)}${field('Support hours','hours',s.hours)}${textarea('Search engine description','seoDescription',s.seoDescription)}${field('Low stock alert threshold','lowStockThreshold',s.lowStockThreshold,'number','min="1" max="1000" required')}`;
  if(settingsTab==='homepage')body=homeSettings(s);
  if(settingsTab==='visibility')body=visibilitySettings(s);
  if(settingsTab==='collections')body=`<h2>Build your shop menu.</h2><p class="form-help">Put one path per line: Face > Cleansers makes a Face submenu with a Cleansers link. A single name, such as Accessories, makes a direct category link. The final name must match the category assigned to its products.</p>${textarea('Category menu paths','categoryPaths',categoryPaths,'required')}${textarea('Brands you stock','brands',s.brands.join('\n'))}${textarea('Skin concerns','concerns',s.concerns.join('\n'))}`;
  if(settingsTab==='delivery')body=`<h2>A little care, delivered.</h2><p class="form-help">Set the areas customers can choose at checkout. All fees are in Nigerian naira.</p><div id="delivery-rows">${s.deliveryZones.map(z=>zoneRow(z)).join('')}</div><button type="button" class="text-link" data-action="add-zone">${icon('plus')} Add delivery area</button><hr>${field('Free delivery threshold (₦) · 0 disables free delivery','freeDeliveryThreshold',s.freeDeliveryThreshold,'number','min="0" step="100" required')}<p class="small-note">The threshold applies after discounts.</p>`;
  if(settingsTab==='consultation')body=`<h2>Make a little time for your customers.</h2>${field('Consultation heading','consultationTitle',s.consultationTitle)}${textarea('Consultation description','consultationText',s.consultationText)}${mediaField('Consultation photograph (optional)','consultationImage',s.consultationImage||'','image/jpeg,image/png,image/webp')}<p class="small-note">Leave empty to use the included skincare routine photograph.</p><div class="form-row">${field('Consultation fee (₦)','consultationPrice',s.consultationPrice,'number','min="0" step="100" required')}${field('Duration (minutes)','consultationDuration',s.consultationDuration,'number','min="1" max="1000" required')}</div>${textarea('What’s included · one item per line','consultationIncludes',s.consultationIncludes)}<hr><h3>Your available appointments</h3><p class="form-help">Enter appointments in Lagos time (WAT). Booked slots are automatically removed from customer availability.</p><div id="slot-rows">${s.consultationSlots.map(slotRow).join('')}</div><button type="button" class="text-link" data-action="add-slot">${icon('plus')} Add an appointment</button>`;
  if(settingsTab==='guide')body=`<h2>A little clarity for your community.</h2>${field('Guide signup heading','guideTitle',s.guideTitle)}${textarea('Guide introduction','guideText',s.guideText)}${mediaField('Free skincare guide PDF','guideUrl',s.guideUrl,'application/pdf')}<div class="admin-notice">${icon('mail')}<div><strong>Automatic guide delivery</strong><p>The uploaded guide link will be included in welcome messages. Welcome email delivery is not connected yet. The guide link remains available after signup.</p></div></div>`;
  if(settingsTab==='data')body=`<h2>Your store, connected.</h2><div class="integration-detail"><strong>Netlify</strong><span>Hosting target · deployment pending</span></div><div class="integration-detail"><strong>Push alerts</strong><span>Owner alerts are configured in Netlify; customer messages are manual</span></div><div class="integration-detail"><strong>Payments</strong><span>Bank transfer configured in Netlify environment variables</span></div><p class="form-help">Service secrets are configured on the server, never in the public website or this settings form.</p><hr><h3>Your data belongs to you.</h3><p class="form-help">Download a JSON copy of your catalogue, orders, content, bookings, and subscribers. Keep exports private.</p><button type="button" class="button button-outline" data-action="backup">${icon('download')} Export store data</button><div class="settings-links"><a class="text-link" href="/admin#outbox">Preview email outbox ${icon('arrow')}</a><a class="text-link" href="/admin#audit">Administrator activity ${icon('arrow')}</a></div>`;
  return `<div class="settings-layout"><nav class="settings-nav" aria-label="Settings sections">${tabs.map(([key,label])=>`<button class="${settingsTab===key?'active':''}" data-action="settings-tab" data-settings="${key}">${label}</button>`).join('')}</nav><form class="admin-card settings-form" data-form="settings">${body}${settingsTab!=='data'?`${errorBox}<div class="form-footer"><span>Changes appear on the storefront after saving.</span><button type="submit" class="button">Save changes ${icon('check')}</button></div>`:''}</form></div>`;
}
const mediaField=(label,name,value,accept)=>`<div class="media-field"><label class="field"><span>${label}</span><input name="${name}" value="${e(value)}" placeholder="Upload a file below" readonly></label><div class="media-actions"><label class="upload-button">${icon('plus')} Upload ${accept==='application/pdf'?'PDF':'image'}<input type="file" accept="${accept}" data-upload-target="${name}" hidden></label><button type="button" class="text-button clear-media" data-action="clear-media" data-target="${name}">Clear</button></div>${value&&accept!=='application/pdf'?`<img class="settings-image-preview" src="${e(value)}" alt="Current uploaded image">`:''}</div>`;
const zoneRow=z=>`<div class="dynamic-row zone-row" data-id="${e(z.id||crypto.randomUUID())}">${field('Delivery area','zoneName',z.name||'','text','required')}${field('Fee (₦)','zoneFee',z.fee||0,'number','min="0" required')}<button type="button" class="icon-button" data-action="remove-row" aria-label="Remove delivery area">${icon('trash')}</button></div>`;
const slotRow=value=>{let local='';if(value){const d=new Date(new Date(value).getTime()+3600000);local=d.toISOString().slice(0,16);}return `<div class="dynamic-row slot-row">${field('Appointment · Lagos time','slot',local,'datetime-local','required')}<button type="button" class="icon-button" data-action="remove-row" aria-label="Remove appointment">${icon('trash')}</button></div>`;};
function openEditor(kind,record={}) {
  editing={kind,id:record.id||null};editorImages=[...(record.images||[])];const r=record,newRecord=!r.id;let fields='';
  if(kind==='products')fields=`<div class="form-row">${field('Product name','name',r.name,'text','required')}${field('Brand','brand',r.brand,'text','required list="brand-list"')}</div><datalist id="brand-list">${overview.settings.brands.map(x=>`<option value="${e(x)}">`).join('')}</datalist><div class="form-row">${field('Category','category',r.category,'text','required list="category-list"')}${field('Size','size',r.size,'text','required placeholder="e.g. 50 ml"')}</div><datalist id="category-list">${overview.settings.categories.map(x=>`<option value="${e(x)}">`).join('')}</datalist><div class="form-row">${field('Selling price (₦)','price',r.price||'','number','min="1" step="0.01" required')}${field('Original price (₦) · optional sale price','compareAt',r.compareAt||0,'number','min="0" step="0.01"')}</div>${field('Stock quantity','stock',r.stock||0,'number','min="0" step="1" required')}<h3>Product photos</h3><p class="form-help">Upload up to 6 JPG, PNG, or WebP images. Maximum 3 MB each.</p><div id="editor-images" class="editor-images"></div><label class="upload-button">${icon('plus')} Add product images<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-upload-target="product" hidden></label><div class="form-row artwork-fields">${select('Fallback illustration','art',['bottle','cleanser','dropper','jar','tube','accessory'],r.art||'bottle')}${select('Illustration colour','tone',['sage','peach','butter','rose'],r.tone||'sage')}</div>${textarea('Description','description',r.description,'required')}${textarea('Ingredients','ingredients',r.ingredients)}${textarea('Directions','directions',r.directions)}${textarea('Precautions','precautions',r.precautions)}<h3>Skin concerns</h3><div class="checkbox-grid">${overview.settings.concerns.map(c=>checkbox(c,'concern:'+c,(r.concerns||[]).includes(c))).join('')}</div><hr><div class="checkbox-grid">${checkbox('Visible in the shop','active',newRecord||r.active)}${checkbox('Featured favourite','featured',r.featured)}${checkbox('New arrival','isNew',r.isNew)}${checkbox('Sample product (preview label)','sample',newRecord||r.sample)}</div>`;
  if(kind==='orders')fields=`<div class="record-meta">${status(r.status)}<span>${date(r.createdAt)}</span></div><h3>Customer & delivery</h3><div class="record-address"><strong>${e(r.customer.name)}</strong><p>${e(r.customer.email)} · ${e(r.customer.phone)}</p><p>${e(r.customer.address)}<br>${e(r.customer.city)} · ${e(r.zone)}</p>${r.note?`<p>Note: ${e(r.note)}</p>`:''}<p>Confirmation channel: <strong>${e(r.contactChannel||'Not recorded')}</strong></p></div>${table(['Product','Quantity','Amount'],r.items.map(i=>`<tr><td>${e(i.name)}<small>${e(i.size)}</small></td><td>${i.quantity}</td><td>${money(i.price*i.quantity)}</td></tr>`))}<div class="order-admin-totals"><div class="total-line"><span>Subtotal</span><span>${money(r.subtotal)}</span></div><div class="total-line"><span>Discount${r.coupon?' ('+e(r.coupon)+')':''}</span><span>−${money(r.discount)}</span></div><div class="total-line"><span>Delivery</span><span>${money(r.shipping)}</span></div><div class="total-line grand-total"><strong>Total</strong><strong>${money(r.total)}</strong></div></div><div class="admin-payment-controls"><h3>Bank transfer · ${e(r.paymentStatus)}</h3>${r.proof?`<p>Receipt image submitted ${date(r.proof.submittedAt)}. ${r.reviewDueAt?`Review by ${date(r.reviewDueAt)}.`:``}</p><button type="button" class="button button-outline" data-action="view-proof" data-id="${e(r.id)}">Download submitted image ${icon('download')}</button>`:'<p>No receipt image has been submitted yet.</p>'}${r.paymentStatus==='proof_submitted'?`${field('Bank statement reference','bankReference','','text','maxlength="120" placeholder="Reference shown in your bank account"')}${field('Amount received in bank (NGN)','verifiedAmount','','number','min="0" step="0.01" placeholder="Enter exact amount credited"')}<label class="check"><input type="checkbox" name="bankVerified"> I checked my bank account and verified the exact amount.</label><button type="button" class="button" data-action="confirm-payment" data-id="${e(r.id)}">Confirm payment & generate receipt ${icon('check')}</button><div class="admin-reject">${field('If rejecting, explain why','rejectionReason','','text','maxlength="500"')}<button type="button" class="text-button" data-action="reject-proof" data-id="${e(r.id)}">Request a new receipt image</button></div>`:''}${r.paymentStatus==='verified'?`<p>Receipt ${e(r.receipt?.id||'')} issued ${date(r.receipt?.issuedAt)}.</p><button type="button" class="button button-outline" data-action="download-receipt" data-id="${e(r.id)}">Download receipt PDF ${icon('download')}</button><button type="button" class="text-button" data-action="share-receipt" data-id="${e(r.id)}">${r.contactChannel==='whatsapp'?'Open WhatsApp with receipt link':'Copy private receipt link'}</button>`:''}</div>${select('Fulfilment status','status',r.paymentStatus==='verified'?['confirmed','processing','shipped','delivered']:r.preview?['confirmed','processing','shipped','delivered','cancelled']:r.status==='cancelled'?['cancelled']:r.paymentStatus==='proof_submitted'?['awaiting_payment']:['awaiting_payment','cancelled'],r.status)}${field('Delivery tracking information','tracking',r.tracking)}<p class="small-note">Fulfilment stays locked until the bank transfer is verified. A verified payment needs a separate refund process.</p>`;
  if(kind==='orders')fields+=`<div class="manual-message"><h3>Customer update</h3><p class="small-note">Order emails are manual. Prepare a message, review it, then send it yourself.</p><button type="button" class="button button-outline" data-action="prepare-order-message" data-id="${e(r.id)}">Prepare ${r.contactChannel==='whatsapp'?'WhatsApp message':'email draft'} ${icon('arrow')}</button></div>`;
  if(kind==='bookings')fields=`<div class="record-meta">${status(r.status)}<span>${e(r.id)}</span></div><h3>${date(r.slot)} · WAT</h3><div class="record-address"><strong>${e(r.name)}</strong><p>${e(r.email)} · ${e(r.phone)}</p><p>${r.duration} minutes · ${money(r.price)} · Preview booking</p></div><h3>Customer’s goals</h3><p class="record-text">${e(r.goals||'No additional notes.')}</p>${select('Booking status','status',['confirmed','completed','cancelled'],r.status)}${textarea('Private administrator notes','adminNotes',r.adminNotes)}<p class="small-note">Cancelling makes a future appointment available for another booking.</p>`;
  if(kind==='coupons')fields=`${field('Discount code','code',r.code,'text','required maxlength="40" placeholder="e.g. ALITTLECARE"')}<div class="form-row">${select('Discount type','type',[['percent','Percentage'],['fixed','Fixed amount (₦)']],r.type||'percent')}${field('Discount value','value',r.value||10,'number','min="1" step="0.01" required')}</div>${field('Minimum order amount (₦)','minimum',r.minimum||0,'number','min="0" required')}<div class="form-row">${field('Usage limit · 0 means unlimited','limit',r.limit||0,'number','min="0" step="1" required')}${field('Expiry date (optional)','expires',r.expires,'date')}</div>${checkbox('Active discount','active',newRecord||r.active)}`;
  if(['pages','articles'].includes(kind))fields=`${field('Title','title',r.title,'text','required')}${kind==='articles'?field('Category label','category',r.category)+textarea('Short introduction','excerpt',r.excerpt)+select('Article artwork','art',['routine','consult','shelf'],r.art||'routine'):''}${textarea('Page content · separate paragraphs with a blank line','body',r.body,'required rows="12"')}${checkbox('Published on the website','published',r.published)}${kind==='pages'?checkbox('Show policy draft notice','draft',r.draft):''}`;
  if(kind==='faqs')fields=`${field('Question','question',r.question,'text','required')}${textarea('Answer','answer',r.answer,'required')}${checkbox('Visible on the FAQ page','published',newRecord||r.published)}`;
  if(kind==='reviews')fields=`<p class="notice">Publish genuine reviews only, with the customer’s permission. Do not add example testimonials.</p>${field('Customer display name','name',r.name,'text','required')}${textarea('Customer’s review','quote',r.quote,'required')}${select('Rating','rating',['1','2','3','4','5'],String(r.rating||5))}${checkbox('I have verified this is a genuine customer review','verified',r.verified)}${checkbox('Show on the homepage','published',r.published)}`;
  if(kind==='subscribers')fields=`<h3>${e(r.name)}</h3><p class="record-text">${e(r.email)}</p><p class="small-note">Sources: ${e(r.sources.join(', '))}<br>Consent recorded: ${date(r.consentAt)}</p>${field('Tags · separate with commas','tags',(r.tags||[]).join(', '))}${select('Subscription status','status',r.status==='unsubscribed'?['unsubscribed']:['subscribed','unsubscribed'],r.status)}<p class="small-note">An unsubscribed customer must opt in again themselves.</p>`;
  if(kind==='messages')fields=`<h3>${e(r.subject)}</h3><div class="record-address"><strong>${e(r.name)}</strong><p>${e(r.email)} · ${date(r.createdAt)}</p></div><p class="record-text">${e(r.message)}</p>${select('Message status','status',['new','resolved'],r.status)}<p class="small-note">Reply through your business email. This panel records the message status.</p>`;
  $('#editor-dialog').innerHTML=`<div class="drawer-header"><div><h2 id="editor-title">${kind==='orders'?e(r.id):kind==='bookings'?'Consultation details':(newRecord?'Add ':'Edit ')+(kind==='faqs'?'FAQ':kind.slice(0,-1))}</h2></div><button class="icon-button" data-action="close" aria-label="Close editor">${icon('close')}</button></div><form data-form="record" class="editor-form"><div class="editor-body">${fields}${errorBox}</div><div class="editor-footer"><button type="button" class="button button-outline" data-action="close">Cancel</button><button type="submit" class="button">Save ${kind==='orders'?'order':'changes'} ${icon('check')}</button></div></form>`;
  if(kind==='products')renderImages();$('#editor-dialog').showModal();
}
function renderImages(){if(!$('#editor-images'))return;$('#editor-images').innerHTML=editorImages.map((src,i)=>`<div><img src="${e(src)}" alt="Product image ${i+1}"><button type="button" data-action="remove-image" data-index="${i}" aria-label="Remove image ${i+1}">${icon('close')}</button>${i===0?'<span>Cover image</span>':''}</div>`).join('');}
async function orderMessage(order){
  const greeting=`Hi ${order.customer.name.split(/\s+/)[0]},`,id=order.id;
  let subject,body;
  if(order.paymentStatus==='verified'){
    const {receiptLink}=await api(`/api/admin/orders/${id}/share-receipt`,{});
    subject=`Payment confirmed: ${id}`;
    body=`${greeting}\n\nWe have verified your payment for order ${id}. Your receipt is ready here:\n${location.origin+receiptLink}\n\nWe will contact you about delivery.\n\nDrealSkinhub`;
  }else if(order.paymentStatus==='proof_submitted'){
    subject=`Payment receipt received: ${id}`;
    body=`${greeting}\n\nWe received the transfer receipt for order ${id}. We will check our bank account and update you within 24 hours. This is not yet a payment confirmation.\n\nDrealSkinhub`;
  }else if(order.status==='cancelled'){
    subject=`Order ${id}: cancelled`;
    body=`${greeting}\n\nYour order ${id} has been cancelled. Please contact us if you have questions about this order.\n\nDrealSkinhub`;
  }else{
    const {paymentLink}=await api(`/api/admin/orders/${id}/share-payment`,{});
    subject=order.paymentStatus==='proof_rejected'?`Payment receipt needs attention: ${id}`:`Order ${id}: payment details`;
    body=order.paymentStatus==='proof_rejected'?`${greeting}\n\nWe could not confirm the transfer receipt for order ${id}. ${order.proofRejection||'Please check your transfer.'}\n\nCheck your bank activity before uploading another image, and do not transfer again until you have checked. Your private payment page is:\n${location.origin+paymentLink}\n\nDrealSkinhub`:`${greeting}\n\nThank you for your order ${id}. Your total is ${money(order.total)}. View the bank details and upload your transfer receipt through your private payment page:\n${location.origin+paymentLink}\n\nWe will review your payment within 24 hours after you submit the receipt.\n\nDrealSkinhub`;
  }
  return {subject,body};
}
async function upload(file){if(file.size>3000000)throw new Error('Each file must be smaller than 3 MB.');const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(new Error('We couldn’t read that file.'));r.readAsDataURL(file);});return (await api('/api/admin/upload',{type:file.type,data})).url;}
function authView(setup) {
  $('#admin-root').innerHTML=`<div class="admin-auth"><div class="admin-auth-art"><a href="/" class="footer-wordmark">Dreal<span>Skinhub</span></a><div><h1>A little care.<br>A lot of<br><em>possibility.</em></h1><p>Your store, your community, your vision.<br>All in one place.</p></div><small>YOUR SKIN MATTERS HERE.</small></div><div class="admin-auth-form"><a href="/" class="text-link">← Back to the storefront</a><div><h2>${setup?'Make yourself at home.':'Welcome back.'}</h2><p>${setup?'Create your private administrator account to start managing DrealSkinhub.':'Sign in to care for your store.'}</p><form data-form="${setup?'setup':'login'}">${setup?field('Your name','name','','text','required autocomplete="name"'):''}${setup&&setupTokenRequired?field('Private setup token - from Netlify settings','setupToken','','password','required autocomplete="off"'):''}${field('Email address','email','','email','required autocomplete="email"')}${field(setup?'Password · at least 12 characters':'Password','password','','password',`required ${setup?'minlength="12" autocomplete="new-password"':'autocomplete="current-password"'}`)}${errorBox}<button class="button" type="submit">${setup?'Create your admin account':'Open your store'} ${icon('arrow')}</button></form><p class="admin-auth-note">${icon('shield')} Your admin account is separate from your public storefront.</p></div></div></div>`;
}
document.addEventListener('input',event=>{if(event.target.id==='record-search')renderRecords(event.target.value);});
document.addEventListener('change',async event=>{
  const input=event.target;if(!input.dataset.uploadTarget||!input.files.length)return;const form=input.closest('form'),buttons=$$('button[type="submit"]',form);buttons.forEach(b=>b.disabled=true);input.disabled=true;
  try{const files=[...input.files];if(input.dataset.uploadTarget==='product'&&editorImages.length+files.length>6)throw new Error('A product can have up to 6 images.');for(const file of files){const url=await upload(file);if(input.dataset.uploadTarget==='product'){editorImages.push(url);renderImages();}else form.elements[input.dataset.uploadTarget].value=url;}toast('Upload saved. Save your changes to use it.');}catch(err){toast(err.message);}finally{input.disabled=false;input.value='';buttons.forEach(b=>b.disabled=false);}
});
document.addEventListener('click',async event=>{
  const b=event.target.closest('[data-action]');if(!b)return;const {action,kind,id}=b.dataset;
  try{
    if(action==='admin-menu')setAdminNavigation(!$('.admin-sidebar').classList.contains('is-open'));
    if(action==='admin-menu-close')setAdminNavigation(false);
    if(action==='logout'){await api('/api/auth/logout',{});location.reload();}
    if(action==='push-toggle'){
      if(!pushRegistration||!pushConfig?.configured)throw new Error('Push setup is not ready yet.');
      const current=await pushRegistration.pushManager.getSubscription();
      if(current){await api('/api/admin/push/unsubscribe',{endpoint:current.endpoint});await current.unsubscribe();toast('Notifications turned off on this device.');}
      else{
        const permission=await Notification.requestPermission();
        if(permission!=='granted')throw new Error('Allow notifications in your browser settings to receive order alerts.');
        const subscription=await pushRegistration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:pushKey(pushConfig.publicKey)});
        try{await api('/api/admin/push/subscribe',{endpoint:subscription.endpoint});}catch(error){await subscription.unsubscribe();throw error;}
        toast('Order alerts enabled on this device.');
      }
      await refreshPushControls();
    }
    if(action==='push-test'){await api('/api/admin/push/test',{});toast('Test alert sent. Check your browser notifications.');}
    if(action==='push-retry'){await api('/api/admin/push/retry',{});toast('Pending alerts retried.');}
    if(action==='reload')renderTab();if(action==='close')b.closest('dialog').close();
    if(action==='new')openEditor(kind);
    if(action==='edit'){const record=await api(`/api/admin/${kind}/${id}`);openEditor(kind,record);}
    if(action==='content-tab'){contentTab=kind;renderTab();}
    if(action==='settings-tab'){settingsTab=b.dataset.settings;$('#admin-main').innerHTML=title('Store settings.')+settingsView();}
    if(action==='consult-settings'){settingsTab='consultation';location.hash='settings';}
    if(action==='add-home-section'){
      const list=$('#homepage-section-list');
      if($$('[data-home-collection]',list).length>=12)throw new Error('You can add up to 12 product sections.');
      const collection={id:`custom-${crypto.randomUUID()}`,title:'New product section',productIds:[],enabled:true};
      list.insertAdjacentHTML('beforeend',homepageSectionRow(collection.id,overview.settings,[collection]));
      list.lastElementChild.querySelector('[name="collectionTitle"]').focus();
    }
    if(action==='remove-home-section')b.closest('[data-home-collection]').remove();
    if(action==='move-home-section'){
      const row=b.closest('[data-home-section]'),other=b.dataset.direction==='up'?row.previousElementSibling:row.nextElementSibling;
      if(other){if(b.dataset.direction==='up')other.before(row);else other.after(row);b.focus();}
    }
    if(action==='add-zone')$('#delivery-rows').insertAdjacentHTML('beforeend',zoneRow({}));
    if(action==='add-slot')$('#slot-rows').insertAdjacentHTML('beforeend',slotRow(''));
    if(action==='remove-row')b.closest('.dynamic-row').remove();
    if(action==='clear-media')b.closest('form').elements[b.dataset.target].value='';
    if(action==='remove-image'){editorImages.splice(Number(b.dataset.index),1);renderImages();}
    if(action==='delete'){$('#confirm-dialog').innerHTML=`<div class="confirm-body"><h2 id="confirm-title">${kind==='products'?'Archive this product?':'Delete this record?'}</h2><p>${kind==='products'?'It will be hidden from the shop. You can restore it by editing its visibility.':'This removes the record from your store. This action cannot be undone.'}</p><div class="confirm-actions"><button class="button button-outline" data-action="close">Keep it</button><button class="button" data-action="confirm-delete" data-kind="${kind}" data-id="${e(id)}">${kind==='products'?'Archive product':'Delete record'}</button></div></div>`;$('#confirm-dialog').showModal();}
    if(action==='confirm-delete'){b.disabled=true;await api(`/api/admin/${kind}/${id}`,{},'DELETE');$('#confirm-dialog').close();toast(kind==='products'?'Product archived.':'Record deleted.');renderTab();}
    if(action==='view-proof'||action==='download-receipt'){
      const file=await api(`/api/admin/orders/${id}/${action==='view-proof'?'proof':'receipt'}`);
      const bytes=Uint8Array.from(atob(file.data),char=>char.charCodeAt(0));download(bytes,file.filename,file.type);
    }
    if(action==='prepare-order-message'){
      b.disabled=true;
      try{
        const order=await api(`/api/admin/orders/${id}`),{subject,body}=await orderMessage(order);
        const target=b.closest('.manual-message'),phone=order.customer.phone.replace(/\D/g,'').replace(/^0/,'234');
        const channel=order.contactChannel==='whatsapp'&&/^\d{10,15}$/.test(phone)?'whatsapp':'email';
        const href=channel==='whatsapp'?`https://wa.me/${phone}?text=${encodeURIComponent(`${subject}\n\n${body}`)}`:`mailto:${order.customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        target.querySelector('.manual-message-draft')?.remove();
        target.insertAdjacentHTML('beforeend',`<div class="manual-message-draft"><p class="small-note">Nothing has been sent. Check the details before sending through ${channel==='whatsapp'?'WhatsApp':'your email app'}.</p><label class="field"><span>To</span><input value="${e(channel==='whatsapp'?order.customer.phone:order.customer.email)}" readonly></label><label class="field"><span>Subject</span><input value="${e(subject)}" readonly></label><label class="field"><span>Message</span><textarea rows="9" readonly>${e(body)}</textarea></label><div class="manual-message-actions"><a class="button" href="${e(href)}" ${channel==='whatsapp'?'target="_blank" rel="noopener noreferrer"':''}>Open ${channel==='whatsapp'?'WhatsApp':'email draft'} ${icon('arrow')}</a><button type="button" class="button button-outline" data-action="copy-order-message">Copy message</button></div></div>`);
      }finally{b.disabled=false;}
    }
    if(action==='copy-order-message'){
      const draft=b.closest('.manual-message-draft'),subject=draft.querySelectorAll('input')[1].value,body=draft.querySelector('textarea').value;
      if(!navigator.clipboard?.writeText){draft.querySelector('textarea').select();throw new Error('Select and copy the message shown above.');}
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);toast('Message copied. Send it through your preferred app.');
    }
    if(action==='confirm-payment'){
      const form=b.closest('form'),bankReference=form.elements.bankReference?.value.trim(),verifiedAmount=form.elements.verifiedAmount?.value;
      if(!bankReference||!form.elements.bankVerified?.checked)throw new Error('Check your bank account, enter its reference, and tick the verification box.');
      b.disabled=true;
      try{await api(`/api/admin/orders/${id}/confirm-payment`,{verified:true,bankReference,verifiedAmount});$('#editor-dialog').close();toast('Payment verified. Open the order to prepare and send the customer confirmation.');await renderTab();}
      finally{b.disabled=false;}
    }
    if(action==='reject-proof'){
      const reason=b.closest('form').elements.rejectionReason?.value.trim();if(!reason)throw new Error('Explain why the receipt cannot be confirmed.');
      b.disabled=true;try{await api(`/api/admin/orders/${id}/reject-proof`,{reason});$('#editor-dialog').close();toast('Receipt rejected. Open the order to prepare a customer message.');await renderTab();}finally{b.disabled=false;}
    }
    if(action==='share-receipt'){
      const result=await api(`/api/admin/orders/${id}/share-receipt`,{}),link=location.origin+result.receiptLink;
      const order=await api(`/api/admin/orders/${id}`);
      const existing=$('#receipt-share-link');if(existing)existing.remove();
      b.insertAdjacentHTML('afterend',`<label class="field" id="receipt-share-link"><span>Private receipt link · share only with this customer</span><input value="${e(link)}" readonly aria-label="Private receipt link"></label>`);
      if(order.contactChannel==='whatsapp'){
        let phone=order.customer.phone.replace(/\D/g,'');if(phone.startsWith('0'))phone='234'+phone.slice(1);
        if(!/^\d{10,15}$/.test(phone))throw new Error('The customer phone number needs a valid country code before opening WhatsApp.');
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Your DrealSkinhub payment is confirmed. Download your receipt: ${link}`)}`,'_blank','noopener,noreferrer');
      }else try{await navigator.clipboard.writeText(link);toast('Private receipt link copied.');}catch{toast('Select and copy the private link shown below.');}
    }
    if(action==='view-mail'){const mail=records.find(m=>m.id===id);$('#editor-dialog').innerHTML=`<div class="drawer-header"><h2 id="editor-title">${e(mail.subject)}</h2><button class="icon-button" data-action="close" aria-label="Close message">${icon('close')}</button></div><div class="editor-body"><p class="preview-note">${e(mail.status)} · ${e(mail.to)}</p><pre class="mail-body">${e(mail.body)}</pre></div>`;$('#editor-dialog').showModal();}
    if(action==='sync-subscribers'){b.disabled=true;try{const r=await api('/api/admin/sync-subscribers',{});toast(r.message);renderTab();}finally{b.disabled=false;}}
    if(action==='backup'){const backup=await api('/api/admin/export');download(JSON.stringify(backup,null,2),'drealskinhub-backup-'+new Date().toISOString().slice(0,10)+'.json','application/json');toast('Your store export is ready.');}
    if(action==='export-csv'){const rows=currentTab==='subscribers'?[['Name','Email','Sources','Tags','Status','Consent date'],...records.map(r=>[r.name,r.email,r.sources.join('; '),(r.tags||[]).join('; '),r.status,r.consentAt])]:[['Order','Name','Email','Total NGN','Status','Created'],...records.map(r=>[r.id,r.customer.name,r.customer.email,r.total,r.status,r.createdAt])];const csv=rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');download('\uFEFF'+csv,`drealskinhub-${currentTab}.csv`,'text/csv;charset=utf-8');}
  }catch(err){toast(err.message);if(action==='confirm-delete')b.disabled=false;}
});
function download(body,name,type){const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.addEventListener('submit',event=>{
  const form=event.target,type=form.dataset.form;if(!type)return;event.preventDefault();
  submitForm(form,async b=>{
    if(type==='setup'||type==='login'){const r=await api(type==='setup'?'/api/setup':'/api/auth/login',b);if(r.user.role!=='admin'){await api('/api/auth/logout',{});throw new Error('This account does not have administrator access.');}user=r.user;shell();await renderTab();preparePush();}
    if(type==='record'){
      const {kind,id}=editing;const payload={...b};
      for(const key of ['active','featured','isNew','sample','published','draft','verified'])payload[key]=!!form.elements[key]?.checked;
      if(kind==='products'){payload.images=editorImages;payload.concerns=overview.settings.concerns.filter(c=>form.elements['concern:'+c]?.checked);}
      await api(`/api/admin/${kind}${id?'/'+id:''}`,payload,id?'PUT':'POST');$('#editor-dialog').close();toast('Saved with care. Your changes are live in the preview.');renderTab();
    }
    if(type==='settings'){
      const payload={...b};
      if(settingsTab==='homepage'){
        payload.sections=Object.fromEntries(Object.keys(overview.settings.sections).map(k=>[k,!!form.elements['section_'+k]?.checked]));
        payload.homeCollections=$$('[data-home-collection]',form).map(row=>({id:row.dataset.sectionId,title:$('[name="collectionTitle"]',row).value.trim(),enabled:$('[data-collection-enabled]',row).checked,productIds:$$('[data-product-id]:checked',row).map(input=>input.dataset.productId)}));
        payload.sectionOrder=$$('[data-home-section]',form).map(row=>row.dataset.sectionId);
        for(const key of Object.keys(payload))if(key.startsWith('section_')||key==='collectionTitle')delete payload[key];
      }
      if(settingsTab==='visibility'){
        payload.sectionVisibility=Object.fromEntries(siteSectionKeys.map(key=>[key,!!form.elements[`visibility_${key}`]?.checked]));
        payload.sections=Object.fromEntries(Object.keys(overview.settings.sections).map(key=>[key,!!form.elements[`visibility_home_${key}`]?.checked]));
        payload.homeCollections=(overview.settings.homeCollections||starterHomepageCollections).map(collection=>({...collection,enabled:!!form.elements[`visibility_collection_${collection.id}`]?.checked}));
        for(const key of Object.keys(payload))if(key.startsWith('visibility_'))delete payload[key];
      }
      if(settingsTab==='collections'){
        const groups=new Map();
        for(const line of b.categoryPaths.split('\n').map(s=>s.trim()).filter(Boolean)){
          const parts=line.split('>').map(s=>s.trim());
          if(parts.length>2||parts.some(part=>!part))throw new Error('Use one category path per line, such as Face > Cleansers.');
          if(!groups.has(parts[0]))groups.set(parts[0],{label:parts[0],children:[]});
          if(parts[1])groups.get(parts[0]).children.push(parts[1]);
        }
        payload.categoryTree=[...groups.values()];delete payload.categoryPaths;
        for(const k of ['brands','concerns'])payload[k]=b[k].split('\n').map(s=>s.trim()).filter(Boolean);
      }
      if(settingsTab==='delivery'){payload.deliveryZones=$$('.zone-row').map(row=>({id:row.dataset.id,name:$('[name="zoneName"]',row).value,fee:$('[name="zoneFee"]',row).value}));delete payload.zoneName;delete payload.zoneFee;}
      if(settingsTab==='consultation'){payload.consultationSlots=$$('[name="slot"]').map(input=>new Date(input.value+':00+01:00').toISOString());delete payload.slot;}
      overview.settings=await api('/api/admin/settings',payload,'PUT');toast('Store settings saved.');
    }
  });
});
window.addEventListener('hashchange',()=>{if(user)renderTab();});
async function start(){try{const session=await api('/api/session');user=session.user;setupTokenRequired=!!session.setupTokenRequired;if(session.setupRequired){authView(true);return;}if(!user||user.role!=='admin'){authView(false);return;}shell();await renderTab();preparePush();}catch(err){const root=$('#admin-root');root.classList.add('startup-error');root.innerHTML=`<div class="auth-wrap"><h1>A little pause.</h1><p>${e(err.message)}</p><p>Start the local server and refresh this page.</p></div>`;}}
start();
