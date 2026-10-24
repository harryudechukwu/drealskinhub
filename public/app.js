import {$,$$,escape as e,money,date,paragraphs,api,icon,art,toast,empty,submitForm,field,errorBox} from './shared.js';
import {photos,categoryPhotos,photograph} from './photography.js';
import {siteSectionGroups} from './site-sections.js';

let data,user=null,adminManaged=false,routeVersion=0;
const compactShop=matchMedia('(max-width: 640px)');
compactShop.addEventListener('change',event=>{const filters=$('.filter-details');if(filters)filters.open=!event.matches;});
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let revealObserver;
function revealContent(root=document){
  if(reducedMotion.matches||!('IntersectionObserver' in window))return;
  revealObserver??=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-visible');revealObserver.unobserve(entry.target);}
  },{threshold:.06,rootMargin:'0px 0px -24px 0px'});
  const selector='.hero-copy, .hero-stage, .values-inner, .section-heading, .category-card, .product-card, .consultation-banner, .concern-section h2, .concern-pill, .brand-strip, .guide-section, .journal-art, .newsletter-inner, .page-heading, .contact-story, .contact-form, .consult-intro, .booking-form, .consultation-faq details, .brands-grid > a, .auth-wrap, .article-page, .shop-sidebar';
  for(const item of root.querySelectorAll(selector))if(!item.classList.contains('is-visible')){item.classList.add('reveal-ready');revealObserver.observe(item);}
}
const readStorage=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}};
let cart=readStorage('dreal-cart',[]),wishlist=readStorage('dreal-wishlist',[]);
if(!Array.isArray(cart))cart=[];if(!Array.isArray(wishlist))wishlist=[];
cart=cart.filter(x=>x&&typeof x.id==='string'&&Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<100);
const save=()=>{try{localStorage.setItem('dreal-cart',JSON.stringify(cart));localStorage.setItem('dreal-wishlist',JSON.stringify(wishlist));}catch{toast('Your browser cannot save this bag between visits.');}updateCounts();};
const linkShop=(key,value)=>`/shop?${key}=${encodeURIComponent(value)}`;
const product=id=>data.products.find(p=>p.id===id);
const button=(label,href,secondary=false)=>`<a class="button ${secondary?'button-outline':''}" href="${href}">${label} ${icon('arrow')}</a>`;
const crumb=label=>`<nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li class="breadcrumb-separator" aria-hidden="true">${icon('chevron')}</li><li class="breadcrumb-current" aria-current="page">${e(label)}</li></ol></nav>`;
function header() {
  const s=data.settings;
  $('#site-header').innerHTML=`${s.announcement && s.announcement !== 'A little care, every day. Discover your next skincare ritual.' ? `<div class="announcement">${e(s.announcement)}</div>` : ''}
  <header class="header"><div class="header-inner"><a href="/" class="brand" aria-label="DrealSkinhub home"><img src="/assets/logo.jpeg" width="78" height="78" alt="DrealSkinhub logo"><span>Dreal<span class="brand-light">Skinhub</span><small>YOUR SKIN MATTERS HERE</small></span></a>
  <nav class="desktop-nav" aria-label="Main navigation"><a href="/">Home</a><a href="/shop">Shop ${icon('chevron')}</a><a href="/brands">Brands</a><a href="/consultations">Consultations</a><a href="/guide">The skin guide</a></nav>
  <div class="header-actions"><button class="icon-button" data-action="search" aria-label="Search the store">${icon('search')}</button><a class="icon-button account-icon" href="/account" aria-label="Your account">${icon('user')}</a><a class="icon-button wishlist-icon" href="/wishlist" aria-label="Wishlist">${icon('heart')}<span class="count wishlist-count" hidden></span></a><button class="icon-button" data-action="cart" aria-label="Open shopping bag">${icon('bag')}<span class="count cart-count" hidden></span></button><button class="icon-button mobile-only" data-action="menu" aria-label="Open navigation" aria-expanded="false">${icon('menu')}</button></div></div>
  <nav class="mobile-nav" id="mobile-nav" aria-label="Mobile navigation" hidden><a href="/">Home</a><a href="/shop">Shop all</a><a href="/brands">Brands</a><a href="/consultations">Consultations</a><a href="/guide">Free skincare guide</a><a href="/journal">The skin journal</a><a href="/wishlist">Wishlist</a><a href="/account">Your account</a></nav></header>`;
  updateCounts();
}
function footer() {
  const s=data.settings;
  $('#site-footer').innerHTML=`<section class="newsletter-strip"><div class="newsletter-inner"><div><h2>Good things, in your inbox.</h2><p>Skincare notes, new favourites, and a little inspiration.</p></div><form data-form="subscribe" class="newsletter-form"><input type="hidden" name="source" value="newsletter"><div class="inline-fields"><input name="name" aria-label="First name" placeholder="First name" required autocomplete="given-name"><input name="email" type="email" aria-label="Email address" placeholder="Your email address" required autocomplete="email"><button type="submit" class="icon-button" aria-label="Subscribe">${icon('arrow')}</button></div><label class="check"><input type="checkbox" name="consent" required><span>I agree to receive emails. Unsubscribe anytime.</span></label>${errorBox}</form></div></section>
  <footer class="footer"><div class="footer-top"><div class="footer-brand"><a href="/" class="footer-wordmark">Dreal<span>Skinhub</span></a><p class="footer-tagline">Your skin matters here.</p>${s.instagram?`<a href="${e(s.instagram)}" target="_blank" rel="noopener noreferrer">Instagram ↗</a>`:''}</div><div><h3>Find your ritual</h3><a href="/shop">Shop all products</a><a href="/brands">Shop by brand</a><a href="/consultations">Book a consultation</a></div><div><h3>A little guidance</h3><a href="/about">Our story</a><a href="/guide">Free skincare guide</a><a href="/journal">The skin journal</a><a href="/faqs">FAQs</a><a href="/contact">Get in touch</a></div><div><h3>Here to help</h3><a href="/track">Track your order</a><a href="/delivery">Shipping & delivery</a><a href="/returns">Returns & refunds</a><a href="/account">My account</a>${s.supportEmail?`<a href="mailto:${e(s.supportEmail)}">${e(s.supportEmail)}</a>`:''}</div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} ${e(s.storeName)}. Made with care.</span><div><a href="/privacy">Privacy policy</a><a href="/terms">Terms & conditions</a><a href="/admin">Store admin ${icon('external')}</a></div><span>NGN ₦ · Nigeria</span></div></footer>`;
}
function updateCounts() {
  $$('.cart-count').forEach(el=>{el.textContent=cart.reduce((s,p)=>s+p.quantity,0);el.hidden=!cart.length;});
  $$('.wishlist-count').forEach(el=>{el.textContent=wishlist.length;el.hidden=!wishlist.length;});
}
let scrollChromeFrame=0,lastChromeY=0;
function updateScrollChrome(){
  scrollChromeFrame=0;
  const shell=$('#site-header'),nav=$('.header'),floating=$('#floating-cart');if(!nav||!floating)return;
  const utilityHeight=shell.offsetHeight-nav.offsetHeight;
  shell.style.setProperty('--utility-height',`${utilityHeight}px`);
  shell.style.setProperty('--nav-height',`${nav.offsetHeight}px`);
  const y=Math.max(0,window.scrollY),direction=y-lastChromeY;
  const menuOpen=!$('#mobile-nav').hidden;
  if(!menuOpen)document.documentElement.style.setProperty('--site-header-height',`${shell.offsetHeight}px`);
  if(y<=utilityHeight+24||menuOpen){shell.classList.remove('nav-hidden');lastChromeY=y;}
  else if(direction>6){shell.classList.add('nav-hidden');lastChromeY=y;}
  else if(direction< -6){shell.classList.remove('nav-hidden');lastChromeY=y;}
  floating.hidden=y<280;
}
function scheduleScrollChrome(){if(!scrollChromeFrame)scrollChromeFrame=requestAnimationFrame(updateScrollChrome);}
function initScrollChrome(){lastChromeY=Math.max(0,window.scrollY);window.addEventListener('scroll',scheduleScrollChrome,{passive:true});window.addEventListener('resize',scheduleScrollChrome);updateScrollChrome();}
function productCard(p) {
  const saved=wishlist.includes(p.id);
  return `<article class="product-card"><div class="product-visual"><a href="/product/${e(p.id)}" aria-label="View ${e(p.name)}">${art(p)}</a><div class="product-badges">${!p.stock?'<span class="badge">Out of stock</span>':p.compareAt>p.price?'<span class="badge sale">Sale</span>':p.isNew?'<span class="badge">New</span>':''}</div><button class="save-product ${saved?'saved':''}" data-action="wishlist" data-id="${e(p.id)}" aria-label="${saved?'Remove from':'Add to'} wishlist" aria-pressed="${saved}">${icon('heart')}</button><button class="quick-add" data-action="add" data-id="${e(p.id)}" ${!p.stock?'disabled':''}>${p.stock?'Add to bag':'Out of stock'} ${icon('plus')}</button></div><div class="product-info"><span class="product-brand">${e(p.brand)}</span><h3><a href="/product/${e(p.id)}">${e(p.name)}</a></h3><p class="product-size">${e(p.size)}</p><div class="product-price">${money(p.price)} ${p.compareAt>p.price?`<s>${money(p.compareAt)}</s>`:''}</div></div></article>`;
}
const grid=products=>`<div class="product-grid">${products.map(productCard).join('')}</div>`;
function sectionHeading(title,href,label='Explore the collection') {return `<div class="section-heading"><div><h2>${title}</h2></div>${href?`<a href="${href}" class="text-link">${label} ${icon('arrow')}</a>`:''}</div>`;}
function articleCard(a){const photo={routine:'care',consult:'routine',shelf:'serum'}[a.art]||'care';return `<article class="journal-card"><a class="journal-art" href="/journal/${e(a.id)}" aria-label="Read ${e(a.title)}">${photograph(photo,'journal-photo')}<div class="journal-overlay"><h3>${e(a.title)}</h3><div class="journal-meta"><span class="journal-category">${e(a.category)}</span><span class="journal-action">Read story ${icon('arrow')}</span></div></div></a></article>`;}
function guideBlock(){const s=data.settings;return `<section class="guide-section"><div class="guide-cover"><span>DrealSkinhub</span><span class="guide-cover-title">A little guide.<br>A little clarity.</span></div><div class="guide-copy"><h2>${e(s.guideTitle)}</h2><p>${e(s.guideText)}</p><form data-form="subscribe"><input type="hidden" name="source" value="guide"><div class="form-row">${field('First name','name','','text','required autocomplete="given-name"')}${field('Email address','email','','email','required autocomplete="email"')}</div><label class="check"><input type="checkbox" name="consent" required> Show me the guide link and save my interest in skincare updates. I can unsubscribe anytime.</label><button class="button" type="submit">A little clarity, please ${icon('arrow')}</button>${errorBox}<div class="form-success" role="status"></div></form></div></section>`;}
function legacyHome() {
  const s=data.settings;
  return `<section class="hero"><div class="hero-inner"><div class="hero-copy"><h1>${e(s.heroTitle).split('\n').map((line,i)=>i?`<span class="hero-title-second">${line}</span>`:line).join('<br>')}</h1><p>${e(s.heroText)}</p><div class="hero-buttons">${button(e(s.heroPrimary),'/shop')}</div></div>
  <div class="hero-stage hero-product-stage"></div></div></section>
  <div class="values-strip"><div class="values-inner"><span>${icon('shield')} Authentic products</span><span>${icon('chat')} Honest guidance</span><span>${icon('leaf')} Care for every skin</span><span>${icon('bag')} Curated essentials</span></div></div>
  ${s.sections.categories?`<section class="section categories-section">${sectionHeading('Good care starts here.','/shop','Shop all skincare')}<div class="category-grid">${s.categories.slice(0,6).map((c,i)=>{const p=data.products.find(p=>p.category===c)||{name:c,brand:'Everyday care',art:['cleanser','jar','tube','dropper','bottle','jar'][i],tone:['sage','peach','butter','rose','sage','peach'][i]};return `<a href="${linkShop('category',c)}" class="category-card"><div class="category-image">${categoryPhotos[c]&&!p.images?.length?photograph(categoryPhotos[c]):art(p)}</div><span>${e(c)} ${icon('arrow')}</span></a>`;}).join('')}</div></section>`:''}
  ${s.sections.featured?`<section class="section featured-section">${sectionHeading('Meet your everyday essentials.','/shop?featured=true','Shop the favourites')}<div class="collection-tabs" role="group" aria-label="Featured collection"><button class="active" data-action="collection" data-collection="featured" aria-pressed="true">The favourites</button><button data-action="collection" data-collection="new" aria-pressed="false">Fresh on the shelf</button></div><div id="home-products">${grid(data.products.filter(p=>p.featured).slice(0,4))}</div></section>`:''}
  ${s.sections.consultation?`<section class="consultation-banner"><div class="consultation-art consultation-photo">${s.consultationImage?`<img src="${e(s.consultationImage)}" alt="A moment of skincare and self-care" width="1000" height="800" loading="lazy">`:photograph('body')}</div><div class="consultation-copy"><h2>${e(s.consultationTitle)}</h2><p>${e(s.consultationText)}</p><ul class="check-list">${s.consultationIncludes.split('\n').filter(Boolean).slice(0,3).map(x=>`<li>${icon('checkCircle')}${e(x)}</li>`).join('')}</ul>${button('Find your way forward','/consultations')}</div></section>`:''}
  ${s.sections.concerns?`<section class="section concern-section"><h2>Find care for your skin.</h2><div class="concern-pills">${s.concerns.map(c=>`<a class="concern-pill" href="${linkShop('concern',c)}">${e(c)} ${icon('arrow')}</a>`).join('')}</div></section>`:''}
  ${s.sections.brands&&s.brands.length?`<section class="brand-strip"><h2 class="brand-heading">Shop by brand</h2><div>${s.brands.map(b=>`<a href="${linkShop('brand',b)}">${e(b)}</a>`).join('')}</div></section>`:''}
  ${s.sections.guide?guideBlock():''}
  ${s.sections.reviews&&data.reviews.length?`<section class="section">${sectionHeading('Care that feels personal.')}<div class="review-grid">${data.reviews.map(r=>`<blockquote><span aria-label="${r.rating} out of 5">${r.rating}/5</span><p>“${e(r.quote)}”</p><cite>${e(r.name)}</cite></blockquote>`).join('')}</div></section>`:''}
  ${s.sections.journal?`<section class="section">${sectionHeading('Notes from the skin journal.','/journal','Read the journal')}<div class="journal-grid">${data.articles.slice(0,3).map(a=>articleCard(a)).join('')}</div></section>`:''}`;
}
const starterHomeCollections=[{id:'best-sellers',title:'Best sellers',productIds:['clarifying-serum','body-lotion','soft-headband','even-tone'],enabled:true}];
const starterSectionOrder=['categories','featured','best-sellers','consultation','concerns','brands','guide','reviews','journal'];
function home() {
  const s=data.settings,frame=document.createElement('div');
  frame.innerHTML=legacyHome();
  const hero=frame.querySelector('.hero'),stage=hero.querySelector('.hero-stage');
  const title=['Your skin.\nYour kind of care.','Glow essentials,\ncurated for you.'].includes(s.heroTitle)?'A little care.\nA lot of confidence.':s.heroTitle;
  const intro=['Discover skincare and guidance that fit your skin, your routine, and your everyday life.','Thoughtfully chosen skincare for every step of your routine.'].includes(s.heroText)?'Your skin is uniquely yours. Find authentic skincare and thoughtful guidance for every step of your journey.':s.heroText;
  hero.classList.add('hero-editorial');
  hero.classList.toggle('hero-two-line',title==='A little care.\nA lot of confidence.');
  hero.querySelector('h1').innerHTML=title.split('\n').map((line,i)=>`<span class="hero-title-line ${i?'hero-title-second':''}">${e(line)}</span>`).join('');
  hero.querySelector('.hero-copy > p').textContent=intro;
  if(s.sectionVisibility?.homeHero!==false)stage.innerHTML=`${s.heroImage?`<img class="hero-backdrop" src="${e(s.heroImage)}" alt="" width="1280" height="1920">`:''}<svg class="hero-quatrefoil-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs><clipPath id="hero-quatrefoil-clip" clipPathUnits="objectBoundingBox"><path d="M .5 0 C .638 0 .75 .112 .75 .25 C .888 .25 1 .362 1 .5 C 1 .638 .888 .75 .75 .75 C .75 .888 .638 1 .5 1 C .362 1 .25 .888 .25 .75 C .112 .75 0 .638 0 .5 C 0 .362 .112 .25 .25 .25 C .25 .112 .362 0 .5 0 Z"/></clipPath></defs></svg><div class="hero-quatrefoil" role="img" aria-label="Four skincare essentials, shown one at a time"><img class="hero-quatrefoil-product" src="${e(s.heroProductFour||'/assets/photos/hero-dove-cutout.png')}" alt="" width="969" height="1624" fetchpriority="high"><img class="hero-quatrefoil-product" src="${e(s.heroProductThree||'/assets/photos/hero-cosrx-cutout.png')}" alt="" width="1024" height="1536"><img class="hero-quatrefoil-product" src="${e(s.heroProductTwo||'/assets/photos/hero-korean-skin-cutout.png')}" alt="" width="1254" height="1254"><img class="hero-quatrefoil-product" src="${e(s.heroProductOne||'/assets/photos/hero-illiyoon-cutout.png')}" alt="" width="1075" height="1463"></div>`;
  const builtins={categories:frame.querySelector('.categories-section'),featured:frame.querySelector('.featured-section'),consultation:frame.querySelector('.consultation-banner'),concerns:frame.querySelector('.concern-section'),brands:frame.querySelector('.brand-strip'),guide:frame.querySelector('.guide-section'),reviews:frame.querySelector('.review-grid')?.closest('section'),journal:frame.querySelector('.journal-grid')?.closest('section')};
  const collections=s.homeCollections||starterHomeCollections,order=s.sectionOrder||starterSectionOrder;
  const section=key=>{
    if(builtins[key])return builtins[key].outerHTML;
    const collection=collections.find(c=>c.id===key);
    if(!collection?.enabled)return '';
    const selected=(collection.productIds||[]).map(id=>product(id)).filter(Boolean);
    return selected.length?`<section class="section home-collection-section">${sectionHeading(e(collection.title),'/shop','Shop all products')}${grid(selected)}</section>`:'';
  };
  return (s.sectionVisibility?.homeHero===false?'':hero.outerHTML)+(s.sectionVisibility?.homeValues===false?'':frame.querySelector('.values-strip').outerHTML)+order.filter((key,i)=>order.indexOf(key)===i).map(section).join('');
}
function shopCategoryTree(settings){
  return settings.categoryTree?.length?settings.categoryTree:settings.categories.map(label=>({label,children:[]}));
}
function shopMenu(q,settings){
  const tree=shopCategoryTree(settings);
  const href=(kind,value)=>{const next=new URLSearchParams(q);for(const key of ['category','categoryGroup','brand','concern'])next.delete(key);if(kind&&value)next.set(kind,value);return '/shop'+(next.size?'?'+next:'');};
  const menuLink=(label,kind,value)=>`<a class="shop-menu-row ${kind&&q.get(kind)===value?'is-current':''}" ${kind&&q.get(kind)===value?'aria-current="page"':''} href="${e(href(kind,value))}"><span>${e(label)}</span>${icon('arrow')}</a>`;
  const menuButton=(label,panel)=>`<button type="button" class="shop-menu-row" data-action="shop-panel" data-panel="${panel}"><span>${e(label)}</span>${icon('arrow')}</button>`;
  const panel=(name,heading,parent,items)=>`<div class="shop-menu-panel" data-shop-panel="${name}" ${name==='root'?'':'hidden'}>${heading?`<button type="button" class="shop-menu-back" data-action="shop-panel" data-panel="${parent}">${icon('arrow')} <span>${e(heading)}</span></button>`:''}${items}</div>`;
  const root=panel('root','', '',menuLink('Shop all','','')+menuButton('Brands','brands')+tree.map((group,i)=>group.children?.length?menuButton(group.label,`group-${i}`):menuLink(group.label,'category',group.label)).join('')+menuButton('Skin concerns','concerns'));
  const groups=tree.map((group,i)=>group.children?.length?panel(`group-${i}`,group.label,'root',menuLink(`All ${group.label}`,'categoryGroup',group.label)+group.children.map(child=>menuLink(child,'category',child)).join('')):'').join('');
  const brands=panel('brands','Brands','root',menuLink('All brands','','')+settings.brands.map(value=>menuLink(value,'brand',value)).join(''));
  const concerns=panel('concerns','Skin concerns','root',menuLink('All skin concerns','','')+settings.concerns.map(value=>menuLink(value,'concern',value)).join(''));
  const groupIndex=tree.findIndex(group=>group.label===q.get('categoryGroup')||group.children?.includes(q.get('category')));
  const initial=groupIndex>=0&&tree[groupIndex].children?.length?`group-${groupIndex}`:q.get('brand')?'brands':q.get('concern')?'concerns':'root';
  return `<nav class="shop-menu" aria-label="Browse the shop" data-initial-panel="${initial}">${root+groups+brands+concerns}</nav>`;
}
function shop() {
  const q=new URLSearchParams(location.search),s=data.settings,search=q.get('search')||'',group=shopCategoryTree(s).find(item=>item.label===q.get('categoryGroup'));
  let list=data.products.filter(p=>(!search||[p.name,p.brand,p.category,p.ingredients,...p.concerns].join(' ').toLowerCase().includes(search.toLowerCase()))&&(!q.get('category')||p.category===q.get('category'))&&(!q.get('categoryGroup')||(group?group.children.length?group.children.includes(p.category):p.category===group.label:false))&&(!q.get('brand')||p.brand===q.get('brand'))&&(!q.get('concern')||p.concerns.includes(q.get('concern')))&&(!q.get('stock')||p.stock>0)&&(!q.get('max')||p.price<=Number(q.get('max')))&&(!q.get('new')||p.isNew)&&(!q.get('featured')||p.featured));
  const sort=q.get('sort')||'popular';list.sort(sort==='low'?(a,b)=>a.price-b.price:sort==='high'?(a,b)=>b.price-a.price:sort==='new'?(a,b)=>b.createdAt.localeCompare(a.createdAt):(a,b)=>b.popularity-a.popularity);
  const selected=['category','categoryGroup','brand','concern'].map(key=>q.get(key)?`<input type="hidden" name="${key}" value="${e(q.get(key))}">`:'').join('');
  const heading=q.get('category')||q.get('categoryGroup')||q.get('brand')||q.get('concern')||'Find your everyday favourites.';
  return `<div class="page-wrap">${crumb('The shop')}<div class="page-heading"><h1>${e(heading)}</h1><p>Thoughtfully chosen care, for a routine that feels like you.</p></div><div class="shop-layout"><aside class="shop-sidebar"><details open class="filter-details"><summary>Explore the collection ${icon('chevron')}</summary>${shopMenu(q,s)}<form id="filters" data-form="filters">${selected}${field('Search','search',search,'search','placeholder="Product, brand, ingredient"')}${field('Maximum price (NGN)','max',q.get('max')||'','number','min="0" step="500" placeholder="Any price"')}<label class="check"><input name="stock" type="checkbox" ${q.get('stock')?'checked':''}> In stock only</label><label class="check"><input name="new" type="checkbox" ${q.get('new')?'checked':''}> New arrivals</label><label class="check"><input name="featured" type="checkbox" ${q.get('featured')?'checked':''}> Featured favourites</label><button class="button" type="submit">Apply filters ${icon('arrow')}</button><a class="text-link" href="/shop">Clear all filters</a></form></details><div class="sidebar-note"><h3>A little help?</h3><p>Let's find a routine that makes sense for you.</p><a href="/consultations" class="text-link">Talk to us ${icon('arrow')}</a></div></aside><div class="shop-results"><div class="shop-toolbar"><p>${list.length} ${list.length===1?'favourite':'favourites'} to explore</p><label>Sort by <select id="sort-products">${[['popular','Most popular'],['new','Newest arrivals'],['low','Price: low to high'],['high','Price: high to low']].map(([v,t])=>`<option value="${v}" ${sort===v?'selected':''}>${t}</option>`).join('')}</select></label></div>${list.length?grid(list):empty('A fresh start?','No products match these filters. Try a different search.','/shop','Clear the filters')}</div></div></div>`;
}
function detail(id) {
  const p=product(id);if(!p)return empty('This shelf is empty.','That product is no longer available.');
  return `<div class="page-wrap">${crumb(p.name)}<div class="product-detail"><div class="detail-media">${art(p)}${p.images.length>1?`<div class="image-thumbs">${p.images.map(src=>`<button data-action="product-image" data-src="${e(src)}" aria-label="View product image"><img src="${e(src)}" alt="${e(p.name)}" loading="lazy"></button>`).join('')}</div>`:''}</div><div class="detail-copy"><span class="eyebrow">${e(p.brand)}</span><h1>${e(p.name)}</h1><p class="detail-size">${e(p.size)} · ${e(p.category)}</p><div class="detail-price">${money(p.price)} ${p.compareAt>p.price?`<s>${money(p.compareAt)}</s>`:''}</div>${p.sample?'<p class="preview-note">Sample product and price · For preview only</p>':''}<div class="prose">${paragraphs(p.description)}</div><div class="stock-status ${p.stock?'':'unavailable'}">${p.stock?'● In stock':'○ Currently out of stock'}</div><div class="detail-add"><label class="quantity-input">Qty<input id="detail-quantity" type="number" min="1" max="${Math.min(p.stock,99)}" value="1" aria-label="Quantity" ${!p.stock?'disabled':''}></label><button class="button" data-action="add-detail" data-id="${e(p.id)}" ${!p.stock?'disabled':''}>${p.stock?'Add to bag':'Out of stock'} ${icon('bag')}</button><button class="icon-button ${wishlist.includes(p.id)?'saved':''}" data-action="wishlist" data-id="${e(p.id)}" aria-label="Save to wishlist" aria-pressed="${wishlist.includes(p.id)}">${icon('heart')}</button></div><div class="detail-trust"><span>${icon('shield')} Authenticity matters</span><span>${icon('truck')} Delivery calculated in your bag</span></div>${[['Ingredients',p.ingredients],['How to use',p.directions],['A little care & caution',p.precautions],['Delivery & returns','Choose your delivery area at checkout to see your fee. Visit our delivery and returns pages for the store’s current policies.']].map(([t,v])=>`<details class="accordion"><summary>${t}${icon('plus')}</summary><div class="prose">${paragraphs(v||'Details will be added soon.')}</div></details>`).join('')}</div></div><section class="section related-section">${sectionHeading('A few more to explore.','/shop')}${grid(data.products.filter(x=>x.id!==id).sort((a,b)=>Number(b.category===p.category)-Number(a.category===p.category)).slice(0,4))}</section></div>`;
}
function cartItems() {return cart.map(i=>({product:product(i.id),quantity:i.quantity})).filter(i=>i.product);}
function openCart() {
  const items=cartItems(),subtotal=items.reduce((s,x)=>s+x.product.price*x.quantity,0),threshold=data.settings.freeDeliveryThreshold;
  const dialog=$('#cart-dialog');
  dialog.innerHTML=`<div class="drawer-header"><h2 id="cart-title">Your little bag <span>(${cart.reduce((s,i)=>s+i.quantity,0)})</span></h2><button class="icon-button" data-action="close" aria-label="Close bag">${icon('close')}</button></div>${items.length?`<div class="drawer-body">${threshold?`<div class="delivery-note">${subtotal>=threshold?'Your bag qualifies for sample free delivery.':`You’re ${money(threshold-subtotal)} away from sample free delivery.`}<progress value="${Math.min(subtotal,threshold)}" max="${threshold}"></progress></div>`:''}${items.map(({product:p,quantity})=>`<div class="cart-item"><a href="/product/${e(p.id)}" class="cart-art">${art(p)}</a><div class="cart-item-copy"><span class="eyebrow">${e(p.brand)}</span><a href="/product/${e(p.id)}">${e(p.name)}</a><small>${e(p.size)}</small><div class="quantity-control"><button data-action="quantity" data-id="${e(p.id)}" data-step="-1" aria-label="Reduce ${e(p.name)} quantity">${icon('minus')}</button><span>${quantity}</span><button data-action="quantity" data-id="${e(p.id)}" data-step="1" aria-label="Increase ${e(p.name)} quantity">${icon('plus')}</button></div></div><div class="cart-item-end"><strong>${money(p.price*quantity)}</strong><button class="text-button" data-action="remove" data-id="${e(p.id)}">Remove</button></div></div>`).join('')}</div><div class="drawer-footer"><div class="total-line"><span>Subtotal</span><strong>${money(subtotal)}</strong></div><p>Delivery and discounts are calculated at checkout.</p>${button('Continue to checkout','/checkout')}<button class="text-button" data-action="close">A little more browsing</button></div>`:empty('A little room for care.','Your bag is waiting for its first favourite.')}`;
  if(!dialog.open)dialog.showModal();
}
function addToCart(id,quantity=1) {
  const p=product(id),existing=cart.find(x=>x.id===id),next=(existing?.quantity||0)+quantity;
  if(!p||!Number.isInteger(quantity)||quantity<1||next>p.stock||next>99){toast(`Only ${p?.stock||0} available. Please check your quantity.`);return;}
  if(existing)existing.quantity=next;else cart.push({id,quantity});save();toast(`${p.name} added to your bag.`);
}
async function toggleWishlist(id) {
  wishlist=wishlist.includes(id)?wishlist.filter(x=>x!==id):[...wishlist,id];save();
  $$(`[data-action="wishlist"][data-id="${CSS.escape(id)}"]`).forEach(b=>{b.classList.toggle('saved',wishlist.includes(id));b.setAttribute('aria-pressed',wishlist.includes(id));b.setAttribute('aria-label',wishlist.includes(id)?'Remove from wishlist':'Add to wishlist');});
  if(user)try{await api('/api/wishlist',{items:wishlist},'PUT');}catch(err){toast(err.message);}
  if(location.pathname==='/wishlist')render();
}
function checkout() {
  if(!cartItems().length)return empty('Your bag needs a little care.','Add a few favourites before checking out.');
  return `<div class="page-wrap">${crumb('Checkout')}<div class="page-heading"><h1>A little care, on its way.</h1><p>Review your details, then we’ll give you a private payment page.</p></div>${!data.checkoutAvailable?'<div class="notice">Bank-transfer checkout is being set up. Please contact us before placing an order.</div>':''}<form id="checkout-form" data-form="checkout" class="checkout-layout"><div class="panel"><h2>Your details</h2>${!user?'<p>Already part of the community? <a class="text-link" href="/account?next=checkout">Sign in</a> or continue as a guest.</p>':''}<div class="form-row">${field('Full name','name',user?.name||'','text','required autocomplete="name"')}${field('Email address','email',user?.email||'','email','required autocomplete="email"')}</div>${field('Phone number','phone','','tel','required autocomplete="tel"')}<h2>Your delivery</h2>${field('Street address','address','','text','required autocomplete="street-address"')}<div class="form-row">${field('City','city','','text','required autocomplete="address-level2"')}<label class="field"><span>Delivery area</span><select name="zone" id="checkout-zone" required>${data.settings.deliveryZones.map(z=>`<option value="${e(z.id)}">${e(z.name)}</option>`).join('')}</select></label></div><label class="field"><span>A note for us (optional)</span><textarea name="note" rows="3" maxlength="1000" placeholder="Anything that would help with your delivery?"></textarea></label><h2>How should we reach you?</h2><p>Choose where you’d like your payment confirmation and receipt.</p><label class="field"><span>Preferred channel</span><select name="contactChannel" required><option value="">Choose a channel</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select></label><p class="small-note">For WhatsApp, we’ll use the phone number above. We’ll give you a private receipt link after bank verification.</p><div class="preview-payment">${icon('shield')}<div><strong>Bank transfer</strong><p>Your order will wait for payment. Upload your transfer receipt on the next screen; we’ll review it within 24 hours.</p></div></div><label class="check"><input name="transferAcknowledged" type="checkbox" required> I understand that my order is confirmed only after the transfer appears in the store’s bank account.</label>${errorBox}<button class="button" type="submit" ${data.checkoutAvailable?'':'disabled'}>Continue to payment ${icon('arrow')}</button></div><aside class="order-summary panel"><h2>A look inside your bag</h2>${cartItems().map(({product:p,quantity})=>`<div class="summary-item"><div class="summary-art">${art(p)}</div><div><strong>${e(p.name)}</strong><small>${e(p.size)} · Qty ${quantity}</small></div><span>${money(p.price*quantity)}</span></div>`).join('')}<label class="field"><span>A little treat? Add a discount code</span><div class="inline-fields"><input name="coupon" id="coupon-input" placeholder="Discount code"><button type="button" class="text-button" data-action="apply-coupon">Apply</button></div></label><div id="checkout-totals" aria-live="polite"><p>Calculating your total…</p></div></aside></form></div>`;
}
const paymentId=path=>/^\/(?:payment|receipt)\/(DS-[A-F0-9]{10})$/.exec(path)?.[1]||null;
function accessToken(id){
  const fromLink=new URLSearchParams(location.hash.slice(1)).get('access');
  if(fromLink&&/^[a-f0-9]{64}$/.test(fromLink)){
    try{sessionStorage.setItem(`dreal-order-${id}`,fromLink);}catch{}
    history.replaceState({},'',location.pathname+location.search);
    return fromLink;
  }
  try{return sessionStorage.getItem(`dreal-order-${id}`)||'';}catch{return '';}
}
function paymentContact(id){try{return sessionStorage.getItem(`dreal-payment-contact-${id}`)||'';}catch{return '';}}
function rememberPaymentContact(id,value){try{sessionStorage.setItem(`dreal-payment-contact-${id}`,value);}catch{}}
const paymentScreen=()=>`<div class="page-wrap payment-page">${crumb('Payment')}<div class="page-heading"><h1>Just one more step.</h1><p>We’ll check your transfer and confirm your order within 24 hours after you submit a receipt.</p></div><div id="payment-details" aria-live="polite"><p>Loading your private order…</p></div></div>`;
const receiptScreen=()=>`<div class="page-wrap payment-page">${crumb('Receipt')}<div class="page-heading"><h1>Your receipt.</h1><p>Thank you for caring for your skin with us.</p></div><div class="panel payment-receipt"><p>Use your private link to download your verified payment receipt.</p><button class="button" type="button" data-action="customer-receipt" data-id="${e(paymentId(location.pathname)||'')}">Download receipt ${icon('download')}</button></div></div>`;
async function loadPayment(){
  const id=paymentId(location.pathname),slot=$('#payment-details');if(!id||!slot)return;
  const token=accessToken(id);
  try{
    const {order:o,bank,contactRequired}=await api(`/api/orders/${id}/payment`,{accessToken:token,contact:paymentContact(id)});
    if(!$('#payment-details'))return;
    if(contactRequired){
      const isWhatsApp=o.contactChannel==='whatsapp';
      slot.innerHTML=`<div class="payment-grid"><section class="panel payment-instructions"><span class="payment-kicker">ORDER ${e(o.id)}</span><h2>First, how can we reach you?</h2><p class="payment-total">${money(o.total)}</p><p>Confirm the ${isWhatsApp?'WhatsApp number':'email address'} you gave at checkout. Then we’ll show the bank details for this order.</p><form data-form="payment-contact" class="payment-contact-form">${field(isWhatsApp?'WhatsApp number':'Email address','contact','',isWhatsApp?'tel':'email',`required autocomplete="${isWhatsApp?'tel':'email'}"`)}${errorBox}<button type="submit" class="button">Show payment details ${icon('arrow')}</button></form></section><section class="panel payment-next"><h2>Your next step.</h2><p>Once your contact is confirmed, you can see the account number and upload your transfer receipt here.</p><div class="payment-summary"><div><span>Order reference</span><strong>${e(o.id)}</strong></div><div><span>Preferred contact</span><strong>${isWhatsApp?'WhatsApp':'Email'}</strong></div><div><span>Status</span><strong>Awaiting transfer</strong></div></div></section></div>`;
      return;
    }
    const pending=o.status!=='cancelled'&&['awaiting_transfer','proof_rejected'].includes(o.paymentStatus);
    slot.innerHTML=`<div class="payment-grid"><section class="panel payment-instructions"><span class="payment-kicker">ORDER ${e(o.id)}</span><h2>${o.paymentStatus==='proof_rejected'?'Check your transfer.':pending?'Transfer the exact amount.':o.paymentStatus==='proof_submitted'?'We’re reviewing your transfer.':o.paymentStatus==='verified'?'Your payment is confirmed.':'Order closed.'}</h2><p class="payment-total">${money(o.total)}</p>${pending?`<div class="bank-card"><div><span>Bank</span><strong>${e(bank.bank)}</strong></div><div><span>Account name</span><strong>${e(bank.name)}</strong></div><div><span>Account number</span><strong class="account-number">${e(bank.number)}</strong></div><button type="button" class="button button-outline" data-action="copy-account" data-number="${e(bank.number)}">Copy account number ${icon('file')}</button></div><p class="small-note">Pay only to the account shown here. Include <strong>${e(o.id)}</strong> as your transfer reference if your bank allows it.</p>`:o.paymentStatus==='proof_submitted'?'<p>We received your payment receipt. A submitted image is not proof of cleared funds; we’ll check the bank account before confirming your order.</p>':o.paymentStatus==='verified'?`<p>Receipt <strong>${e(o.receipt?.id||'')}</strong> is ready.</p><button class="button" type="button" data-action="customer-receipt" data-id="${e(id)}">Download receipt ${icon('download')}</button>`:'<p>Please contact us if you need help with this order.</p>'}</section><section class="panel payment-next"><h2>${pending?'Upload your transfer receipt.':'Your order'}</h2>${o.paymentStatus==='proof_rejected'?`<p class="notice">Your previous receipt could not be confirmed${o.proofRejection?`: ${e(o.proofRejection)}`:'.'} Check your bank activity before uploading a new image. Please do not transfer again until you have checked.</p>`:''}${pending?`<form data-form="payment-proof"><label class="field"><span>Receipt image · JPG, PNG, or WebP · up to 3 MB</span><input type="file" name="proofFile" accept="image/jpeg,image/png,image/webp" required></label>${errorBox}<button class="button" type="submit">Submit receipt for review ${icon('arrow')}</button></form><p class="small-note">We will review the image and bank transfer. We will contact you through your preferred channel after verification.</p>`:''}<div class="payment-summary"><div><span>Order reference</span><strong>${e(o.id)}</strong></div><div><span>Preferred contact</span><strong>${e(o.contactChannel==='whatsapp'?'WhatsApp':'Email')}</strong></div><div><span>Delivery</span><strong>${e(o.zone)}</strong></div><div><span>Status</span><strong>${e(o.paymentStatus.replaceAll('_',' '))}</strong></div></div></section></div>`;
  }catch(error){if($('#payment-details'))$('#payment-details').innerHTML=empty('We couldn’t open this order.',error.message,'/track','Track an order');}
}
function downloadEncoded(file){const bytes=Uint8Array.from(atob(file.data),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:file.type})),link=document.createElement('a');link.href=url;link.download=file.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function imageBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('We couldn’t read that image.'));reader.readAsDataURL(file);});}
const checkoutDraftKey='dreal-checkout-draft',checkoutAttemptKey='dreal-checkout-attempt';
const checkoutDraftFields=['name','email','phone','address','city','zone','note','contactChannel','coupon'];
function saveCheckoutDraft(){
  const form=$('#checkout-form');if(!form)return;
  const fields=Object.fromEntries(checkoutDraftFields.map(name=>[name,form.elements[name]?.value||'']));
  try{sessionStorage.setItem(checkoutDraftKey,JSON.stringify({...fields,transferAcknowledged:form.elements.transferAcknowledged.checked}));}catch{}
}
function restoreCheckoutDraft(){
  const form=$('#checkout-form');if(!form)return;
  let draft;try{draft=JSON.parse(sessionStorage.getItem(checkoutDraftKey)||'null');}catch{return;}
  if(!draft||typeof draft!=='object')return;
  for(const name of checkoutDraftFields){const input=form.elements[name],value=draft[name];if(!input||typeof value!=='string')continue;if(input.tagName==='SELECT'&&![...input.options].some(option=>option.value===value))continue;input.value=value.slice(0,1000);}
  form.elements.transferAcknowledged.checked=draft.transferAcknowledged===true;
}
function checkoutOrderKey(fingerprint){
  let attempt;try{attempt=JSON.parse(sessionStorage.getItem(checkoutAttemptKey)||'null');}catch{}
  if(attempt?.fingerprint===fingerprint&&/^[a-f0-9-]{36}$/.test(attempt.key||''))return attempt.key;
  const key=crypto.randomUUID();try{sessionStorage.setItem(checkoutAttemptKey,JSON.stringify({fingerprint,key}));}catch{}
  return key;
}
let checkoutQuote=null;
async function updateQuote() {
  const form=$('#checkout-form');if(!form)return;const request=++quoteVersion;
  try{const q=await api('/api/quote',{items:cart,zone:form.elements.zone.value,coupon:form.elements.coupon.value});if(request!==quoteVersion||!$('#checkout-totals'))return;checkoutQuote=q;$('#checkout-totals').innerHTML=`<div class="total-line"><span>Subtotal</span><span>${money(q.subtotal)}</span></div>${q.discount?`<div class="total-line"><span>Discount (${e(q.coupon)})</span><span>−${money(q.discount)}</span></div>`:''}<div class="total-line"><span>Delivery</span><span>${q.shipping?money(q.shipping):'Complimentary'}</span></div><div class="total-line grand-total"><strong>Total</strong><strong>${money(q.total)}</strong></div><small>All prices are in Nigerian naira (NGN).</small>`;}catch(err){checkoutQuote=null;if($('#checkout-totals'))$('#checkout-totals').innerHTML=`<p class="form-error">${e(err.message)}</p>`;}
}
let quoteVersion=0;
function consultation() {
  const s=data.settings;
  const consultationImage=s.consultationImage||photos.routine.src;
  const includes=s.consultationIncludes.split('\n').filter(Boolean);
  return `<div class="page-wrap consultation-wrap">${crumb('Consultations')}
    <div class="consultation-page">
      <section class="consult-intro" aria-labelledby="consultation-title">
        <h1 id="consultation-title">${e(s.consultationTitle)}</h1>
        <p class="lead">${e(s.consultationText)}</p>
        <div class="consultation-price"><strong>${money(s.consultationPrice)}</strong><span>${e(s.consultationDuration)} minutes · Online consultation<small>Sample fee · No payment collected</small></span></div>
        <div class="consult-intro-image"><img src="${e(consultationImage)}" alt="" width="1000" height="800" loading="eager" decoding="async"></div>
      </section>
      <form class="panel booking-form" id="booking-form" data-form="booking">
        <div class="booking-heading"><h2>Book a time to talk.</h2><p>Preview booking · Please use fictional details.</p></div>
        <div class="booking-fields">
          ${field('Your name','name',user?.name||'','text','required autocomplete="name"')}
          ${field('Email address','email',user?.email||'','email','required autocomplete="email"')}
          ${field('Phone number','phone','','tel','required autocomplete="tel"')}
          <label class="field"><span>Available time · Lagos (WAT)</span><select name="slot" id="booking-slots" required><option value="">Loading availability…</option></select></label>
        </div>
        <p id="slot-note" class="small-note" role="status"></p>
        <label class="field"><span>What would you like to talk about? <small>(optional)</small></span><textarea name="goals" rows="3" maxlength="2000" placeholder="Your routine, questions, or goals"></textarea></label>
        <div class="booking-consents"><label class="check"><input name="consent" type="checkbox" required><span>I agree to my details being used to arrange this consultation. <a href="/privacy">Privacy notice</a></span></label><label class="check"><input name="previewAcknowledged" type="checkbox" required><span>I understand this is a sample booking and no payment is taken.</span></label></div>
        ${errorBox}<button type="submit" class="button">Reserve preview appointment ${icon('arrow')}</button><div class="form-success" role="status"></div>
      </form>
    </div>
    <section class="consultation-faq" aria-label="Consultation questions">
      <details><summary><span>What’s included in a consultation?</span><span class="consultation-faq-toggle" aria-hidden="true">${icon('plus')}</span></summary><div class="consultation-faq-answer"><ul class="check-list">${includes.map(x=>`<li>${icon('check')}${e(x)}</li>`).join('')}</ul></div></details>
      <details><summary><span>How does it work?</span><span class="consultation-faq-toggle" aria-hidden="true">${icon('plus')}</span></summary><div class="consultation-faq-answer"><p>Choose an available time, talk through your routine and goals, then leave with guidance and clear next steps.</p></div></details>
    </section>
  </div>`;
}
async function loadSlots(){if(!$('#booking-slots'))return;try{const {slots}=await api('/api/slots');if(!$('#booking-slots'))return;$('#booking-slots').innerHTML='<option value="">Choose an appointment</option>'+slots.map(s=>`<option value="${e(s)}">${date(s)}</option>`).join('');$('#slot-note').innerHTML=slots.length?'Times are shown in West Africa Time.':'No times are available right now. <a href="/contact">Get in touch</a> about the next opening.';$('.booking-form [type="submit"]').disabled=!slots.length;}catch(err){toast(err.message);}}
function account() {
  if(!user)return `<div class="auth-wrap"><a href="/" class="auth-wordmark">DrealSkinhub</a><h1>A little space for you.</h1><p>Keep your favourites and your skincare journey in one place.</p><div class="auth-tabs"><button class="active" data-action="auth-tab" data-tab="login">Sign in</button><button data-action="auth-tab" data-tab="register">Create an account</button></div><div id="auth-form-wrap">${authForm('login')}</div></div>`;
  return `<div class="page-wrap">${crumb('Your account')}<div class="section-heading"><div><h1>Hello, ${e(user.name.split(' ')[0])}.</h1><p>Good to have you here.</p></div><button class="text-button" data-action="logout">Sign out ${icon('logout')}</button></div><div class="account-layout"><div><section class="panel"><h2>Your orders</h2><div id="account-orders">Loading your orders…</div></section><section class="panel"><h2>Your consultations</h2><div id="account-bookings">Loading your appointments…</div></section></div><div><section class="panel"><h2>The little details</h2><form data-form="profile">${field('Your name','name',user.name,'text','required')}<p>${e(user.email)}</p>${field('Current password (to change password)','currentPassword','','password','autocomplete="current-password"')}${field('New password (optional, at least 12 characters)','password','','password','minlength="12" autocomplete="new-password"')}${errorBox}<button class="button" type="submit">Save details</button></form></section><a href="/wishlist" class="wishlist-prompt">${icon('heart')} Your saved favourites ${icon('arrow')}</a>${user.role==='admin'?'<a href="/admin" class="button button-outline">Open your store admin →</a>':''}</div></div></div>`;
}
function authForm(tab) {
  return `<form data-form="${tab}">${tab==='register'?field('Your name','name','','text','required autocomplete="name"'):''}${field('Email address','email','','email','required autocomplete="email"')}${tab!=='forgot'?field(tab==='register'?'Password · at least 12 characters':'Password','password','','password',`required ${tab==='register'?'minlength="12" autocomplete="new-password"':'autocomplete="current-password"'}`):''}${tab==='register'?'<p class="small-note">By creating an account you agree to the <a href="/terms">terms</a> and <a href="/privacy">privacy notice</a>.</p>':''}${errorBox}<button type="submit" class="button">${tab==='login'?'Welcome back':tab==='register'?'Make yourself at home':'Request a reset link'} ${icon('arrow')}</button>${tab==='login'?'<button type="button" class="text-button" data-action="auth-tab" data-tab="forgot">Forgot your password?</button>':''}<div class="form-success" role="status"></div></form>`;
}
async function loadAccount(){if(!user||!$('#account-orders'))return;try{const a=await api('/api/account');if(!$('#account-orders'))return;$('#account-orders').innerHTML=a.orders.length?a.orders.map(o=>`<details class="accordion"><summary><span>${e(o.id)}<small>${date(o.createdAt)}</small></span><span>${money(o.total)} · ${e(o.status)}</span></summary><p>Payment: ${e(o.paymentStatus)}</p>${o.items.map(i=>`<p>${e(i.name)} × ${i.quantity} — ${money(i.price*i.quantity)}</p>`).join('')}<p>Delivery: ${money(o.shipping)} · Discount: ${money(o.discount)}</p>${o.tracking?`<p>Tracking: ${e(o.tracking)}</p>`:''}<p><a class="text-link" href="/payment/${e(o.id)}">View payment and receipt ${icon('arrow')}</a></p></details>`).join(''):'<p>Your first order will appear here. <a class="text-link" href="/shop">Find a favourite →</a></p>';$('#account-bookings').innerHTML=a.bookings.length?a.bookings.map(b=>`<div class="booking-item"><strong>${date(b.slot)} WAT</strong><p>${e(b.id)} · ${e(b.status)} · Preview booking</p></div>`).join(''):'<p>A little guidance goes a long way. <a class="text-link" href="/consultations">Explore consultations →</a></p>';}catch(err){toast(err.message);}}
function simplePage(path) {
  if(path==='/guide')return `<div class="page-wrap">${crumb('The skincare guide')}</div>${guideBlock()}`;
  if(path==='/wishlist')return `<div class="page-wrap">${crumb('Your wishlist')}<div class="page-heading"><h1>Your shelf of favourites.</h1><p>A little inspiration for your next ritual.</p></div>${wishlist.some(id=>product(id))?grid(wishlist.map(product).filter(Boolean)):empty('Something will catch your eye.','Save a favourite by tapping the heart on any product.')}</div>`;
  if(path==='/brands')return `<div class="page-wrap">${crumb('Brands')}<div class="page-heading"><h1>A considered collection.</h1><p>Explore our sample brands. Your verified, stocked brands will appear here before launch.</p></div><div class="brands-grid">${data.settings.brands.map((b,i)=>`<a href="${linkShop('brand',b)}" class="brand-tile tone-${i%3}"><span>${e(b)}</span>${icon('arrow')}</a>`).join('')}</div></div>`;
  if(path==='/journal')return `<div class="page-wrap">${crumb('The skin journal')}<div class="page-heading"><h1>The skin journal.</h1><p>Thoughtful notes for a more confident skincare journey.</p></div><div class="journal-grid">${data.articles.map(a=>articleCard(a)).join('')}</div></div>`;
  if(path.startsWith('/journal/')){const a=data.articles.find(a=>a.id===path.split('/')[2]);return a?`<article class="article-page">${crumb('The skin journal')}<span class="eyebrow">${e(a.category)}</span><h1>${e(a.title)}</h1><p class="lead">${e(a.excerpt)}</p><div class="prose">${paragraphs(a.body)}</div><a class="text-link" href="/journal">← Back to the journal</a></article>`:empty('A page waiting to be written.','This article is not available.','/journal','Explore the journal');}
  if(path==='/faqs')return `<div class="article-page">${crumb('FAQs')}<h1>Your questions matter.</h1><p class="lead">A few helpful answers, all in one place.</p>${data.faqs.map(f=>`<details class="accordion"><summary>${e(f.question)}${icon('plus')}</summary><div class="prose">${paragraphs(f.answer)}</div></details>`).join('')}<p>Still wondering? <a class="text-link" href="/contact">Let’s talk →</a></p></div>`;
  if(path==='/contact'){
    const s=data.settings;
    const channels=[
      s.supportEmail?`<a class="contact-channel" href="mailto:${e(s.supportEmail)}"><span class="contact-channel-icon">${icon('mail')}</span><span><strong>Email us</strong><small>${e(s.supportEmail)}</small></span>${icon('arrow')}</a>`:'',
      s.whatsapp?`<a class="contact-channel" href="https://wa.me/${e(s.whatsapp.replace(/\D/g,''))}" target="_blank" rel="noopener noreferrer"><span class="contact-channel-icon">${icon('chat')}</span><span><strong>Chat on WhatsApp</strong><small>${e(s.supportPhone||'Start a conversation')}</small></span>${icon('arrow')}</a>`:s.supportPhone?`<a class="contact-channel" href="tel:${e(s.supportPhone.replace(/[^\d+]/g,''))}"><span class="contact-channel-icon">${icon('chat')}</span><span><strong>Call us</strong><small>${e(s.supportPhone)}</small></span>${icon('arrow')}</a>`:''
    ].filter(Boolean).join('');
    const contactLinks=channels||`<a class="contact-channel" href="/faqs"><span class="contact-channel-icon">${icon('chat')}</span><span><strong>Browse the FAQs</strong><small>Answers to common questions</small></span>${icon('arrow')}</a><a class="contact-channel" href="/consultations"><span class="contact-channel-icon">${icon('calendar')}</span><span><strong>Explore consultations</strong><small>Get personal guidance</small></span>${icon('arrow')}</a>`;
    return `<div class="page-wrap contact-wrap">${crumb('Get in touch')}<div class="contact-layout"><div class="contact-story"><h1>There’s room for your questions here.</h1><p class="lead">Tell us about your skin, a product, or an order. We’ll listen and help you find a way forward.</p><div class="contact-channels">${contactLinks}</div>${s.address||s.hours?`<p class="contact-details">${[s.address,s.hours].filter(Boolean).map(e).join(' · ')}</p>`:''}</div><form class="panel contact-form" data-form="contact"><div class="contact-form-heading"><h2>Send us a note.</h2><p>Share a few details and we’ll take it from there.</p></div><div class="form-row">${field('Your name','name','','text','required autocomplete="name"')}${field('Email address','email','','email','required autocomplete="email"')}</div><label class="field"><span>What can we help with?</span><select name="subject" required><option value="">Choose a topic</option><option>Skincare advice</option><option>Product question</option><option>Order or delivery</option><option>Consultation</option><option>Something else</option></select></label><label class="field"><span>Your message</span><textarea name="message" rows="6" required maxlength="5000" placeholder="Tell us what’s on your mind…"></textarea></label>${errorBox}<button class="button" type="submit">Send your message ${icon('arrow')}</button><div class="form-success" role="status"></div></form></div></div>`;
  }
  if(path==='/track')return `<div class="auth-wrap"><h1>Follow your favourites.</h1><p>Enter your order reference and the email used at checkout.</p><form data-form="track">${field('Order reference','id','','text','required placeholder="DS-…"')}${field('Email address','email','','email','required')}${errorBox}<button class="button" type="submit">Find my order ${icon('arrow')}</button><div class="form-success" role="status"></div></form></div>`;
  if(path==='/reset')return `<div class="auth-wrap"><h1>A new password.</h1><form data-form="reset">${field('New password · at least 12 characters','password','','password','required minlength="12" autocomplete="new-password"')}${errorBox}<button class="button" type="submit">Save new password</button></form></div>`;
  if(path==='/unsubscribe')return `<div class="auth-wrap"><h1>A little less in your inbox.</h1><p>Confirm below to unsubscribe from DrealSkinhub updates.</p><form data-form="unsubscribe">${errorBox}<button class="button" type="submit">Unsubscribe</button><div class="form-success" role="status"></div></form></div>`;
  const p=data.pages.find(p=>'/'+p.id===path);if(p)return `<div class="article-page">${crumb(p.title)}<h1>${e(p.title)}</h1>${p.draft?'<p class="notice">Draft information — final policy pending owner approval.</p>':''}${path==='/about'?'<img class="about-brand" src="/assets/brand-banner.jpeg" alt="DrealSkinhub — Your skin matters here" width="1280" height="1280">':''}<div class="prose">${paragraphs(p.body)}</div>${path==='/about'?button('Find your everyday favourites','/shop'):''}</div>`;
  return empty('A little off the path.','We couldn’t find that page. Let’s take you back to the shop.');
}
function applySectionVisibility(path){
  const visibility=data.settings.sectionVisibility||{};
  for(const group of siteSectionGroups){
    if(group.path!=='*'&&group.path!==path&&!(group.path==='/product/'&&path.startsWith('/product/')))continue;
    for(const item of group.items){
      if(visibility[item.key]!==false)continue;
      const root=item.target==='footer'?$('#site-footer'):$('#main');
      root.querySelectorAll(item.selector).forEach(element=>element.remove());
    }
  }
  if(path==='/contact'&&$('.contact-layout')?.children.length===1)$('.contact-layout').classList.add('contact-layout-single');
  if(path==='/consultations'&&$('.consultation-page')?.children.length===1)$('.consultation-page').classList.add('consultation-page-single');
}
function render() {
  ++routeVersion;checkoutQuote=null;const path=location.pathname.replace(/\/$/,'')||'/';
  revealObserver?.disconnect();
  $$('dialog[open]').forEach(d=>d.close());$('#mobile-nav').hidden=true;$('.mobile-only[data-action="menu"]').setAttribute('aria-expanded','false');
  $('#main').innerHTML=path==='/'?home():path==='/shop'?shop():path.startsWith('/product/')?detail(decodeURIComponent(path.split('/')[2])):path==='/checkout'?checkout():path.startsWith('/payment/')&&paymentId(path)?paymentScreen():path.startsWith('/receipt/')&&paymentId(path)?receiptScreen():path==='/consultations'?consultation():path==='/account'?account():simplePage(path);
  applySectionVisibility(path);
  if(path==='/account'&&adminManaged&&user?.role==='admin'){
    const profile=$('[data-form="profile"]');
    if(profile){const note=document.createElement('p');note.textContent='Your administrator details are managed in the server environment.';profile.replaceWith(note);}
  }
  if(path==='/shop'){
    $('.filter-details').open=!compactShop.matches;
    const menu=$('.shop-menu');
    $$('[data-shop-panel]',menu).forEach(panel=>{panel.hidden=panel.dataset.shopPanel!==menu.dataset.initialPanel;});
  }
  $('meta[name="description"]').content=data.settings.seoDescription;
  const title=$('#main h1')?.textContent||'Your skin matters here';document.title=`${path==='/'?'Your skin matters here':title} | ${data.settings.storeName}`;
  $$('.desktop-nav a').forEach(a=>{if(new URL(a.href).pathname===path)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  if(path==='/checkout'){restoreCheckoutDraft();updateQuote();}if(path.startsWith('/payment/'))loadPayment();if(path==='/consultations')loadSlots();if(path==='/account')loadAccount();
  revealContent();
}
function navigate(path){history.pushState({},'',path);render();window.scrollTo({top:0,behavior:'instant'});$('#main').focus({preventScroll:true});}
window.addEventListener('popstate',render);
document.addEventListener('click',async event=>{
  const a=event.target.closest('a');if(a&&a.origin===location.origin&&!a.pathname.startsWith('/admin')&&!a.pathname.startsWith('/uploads')&&!a.target&&!a.download&&!a.hash&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&event.button===0){event.preventDefault();navigate(a.pathname+a.search);return;}
  const b=event.target.closest('[data-action]');if(!b)return;const action=b.dataset.action,id=b.dataset.id;
  if(action==='shop-panel'){
    const menu=b.closest('.shop-menu');
    $$('[data-shop-panel]',menu).forEach(panel=>{panel.hidden=panel.dataset.shopPanel!==b.dataset.panel;});
    menu.querySelector(`[data-shop-panel="${b.dataset.panel}"]`)?.querySelector('button, a')?.focus({preventScroll:true});
  }
  if(action==='add')addToCart(id);if(action==='add-detail')addToCart(id,Number($('#detail-quantity').value));if(action==='wishlist')toggleWishlist(id);
  if(action==='cart')openCart();if(action==='close')b.closest('dialog')?.close();
  if(action==='menu'){const nav=$('#mobile-nav');nav.hidden=!nav.hidden;b.setAttribute('aria-expanded',!nav.hidden);scheduleScrollChrome();}
  if(action==='remove'){cart=cart.filter(i=>i.id!==id);save();openCart();}
  if(action==='quantity'){const item=cart.find(i=>i.id===id);if(!item)return;const next=item.quantity+Number(b.dataset.step);if(next<1)cart=cart.filter(i=>i.id!==id);else if(next<=product(id).stock&&next<=99)item.quantity=next;else toast('That’s all the stock currently available.');save();openCart();}
  if(action==='search'){const dialog=$('#search-dialog');dialog.innerHTML=`<div class="drawer-header"><h2 id="search-title">Find a little something.</h2><button class="icon-button" data-action="close" aria-label="Close search">${icon('close')}</button></div><form data-form="search"><div class="search-input">${icon('search')}<input name="search" type="search" placeholder="A product, a brand, an ingredient…" aria-label="Search products" required autofocus><button class="button" type="submit">Search ${icon('arrow')}</button></div></form><p>Looking for a place to start?</p><div class="search-suggestions">${data.settings.categories.slice(0,4).map(c=>`<a href="${linkShop('category',c)}">${e(c)}</a>`).join('')}</div>`;dialog.showModal();}
  if(action==='collection'){const isNew=b.dataset.collection==='new';$('#home-products').innerHTML=grid(data.products.filter(p=>isNew?p.isNew:p.featured).slice(0,4));$$('[data-action="collection"]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b);});revealContent($('#home-products'));}
  if(action==='apply-coupon')updateQuote();
  if(action==='copy-account')try{await navigator.clipboard.writeText(b.dataset.number);toast('Account number copied.');}catch{toast('Please copy the account number shown on the page.');}
  if(action==='customer-receipt')try{const file=await api(`/api/orders/${id}/receipt`,{accessToken:accessToken(id)});downloadEncoded(file);}catch(error){toast(error.message);}
  if(action==='auth-tab'){$('#auth-form-wrap').innerHTML=authForm(b.dataset.tab);$$('.auth-tabs button').forEach(x=>x.classList.toggle('active',x.dataset.tab===b.dataset.tab));}
  if(action==='logout')try{await api('/api/auth/logout',{});user=null;wishlist=[];save();render();toast('You’re signed out. Take care.');}catch(err){toast(err.message);}
  if(action==='product-image')$('.detail-media > .product-photo').src=b.dataset.src;
});
document.addEventListener('input',event=>{if(event.target.closest?.('#checkout-form'))saveCheckoutDraft();});
document.addEventListener('change',event=>{if(event.target.id==='sort-products'){const q=new URLSearchParams(location.search);q.set('sort',event.target.value);navigate('/shop?'+q);}if(event.target.closest?.('#checkout-form'))saveCheckoutDraft();if(event.target.id==='checkout-zone')updateQuote();});
document.addEventListener('submit',event=>{
  const form=event.target,type=form.dataset.form;if(!type)return;event.preventDefault();
  submitForm(form,async b=>{
    if(type==='filters'){const q=new URLSearchParams();for(const [k,v]of Object.entries(b))if(v)q.set(k,v);navigate('/shop?'+q);}
    if(type==='search')navigate(linkShop('search',b.search));
    if(type==='subscribe'){const r=await api('/api/subscribe',{...b,consent:b.consent==='on'});toast(r.message);if($('.form-success',form))$('.form-success',form).innerHTML=e(r.message)+(r.guideUrl?` <a class="text-link" href="${e(r.guideUrl)}" download>Download the guide →</a>`:'');form.reset();}
    if(type==='contact'){const r=await api('/api/contact',b);$('.form-success',form).textContent=r.message;form.reset();}
    if(type==='login'||type==='register'){const r=await api('/api/auth/'+type,b);user=r.user;const account=await api('/api/account');wishlist=[...new Set([...wishlist,...account.wishlist])];await api('/api/wishlist',{items:wishlist},'PUT');save();navigate(new URLSearchParams(location.search).get('next')==='checkout'?'/checkout':'/account');toast(type==='login'?'Welcome back.':'A little space, just for you.');}
    if(type==='forgot'){const r=await api('/api/auth/forgot',b);$('.form-success',form).textContent=r.message;}
    if(type==='reset'){await api('/api/auth/reset',{...b,token:new URLSearchParams(location.search).get('token')});user=null;navigate('/account');toast('Your password has been changed. Please sign in.');}
    if(type==='profile'){const r=await api('/api/account',b,'PUT');user=r.user;render();toast('Your details are saved.');}
    if(type==='unsubscribe'){await api('/api/unsubscribe',{token:new URLSearchParams(location.search).get('token')});$('.form-success',form).textContent='You’re unsubscribed. You’re always welcome back.';form.querySelector('button').remove();}
    if(type==='track'){const {order:o}=await api('/api/orders/track',b);$('.form-success',form).innerHTML=`<h3>${e(o.id)}</h3><p>Status: <strong>${e(o.status)}</strong></p><p>${date(o.createdAt)} · ${e(o.paymentStatus||'Preview order')}</p>${o.tracking?`<p>Tracking: ${e(o.tracking)}</p>`:''}`;}
    if(type==='checkout'){
      const reviewedTotal=checkoutQuote?.total;await updateQuote();if(reviewedTotal!==undefined&&checkoutQuote?.total!==reviewedTotal)throw new Error('Your total changed. Please review it and place the order again.');if(!checkoutQuote)throw new Error('Please check your bag and delivery details.');
      const payload={...b,items:cart,expectedTotal:checkoutQuote.total,transferAcknowledged:b.transferAcknowledged==='on'};
      const key=checkoutOrderKey(JSON.stringify(payload));
      const {order,accessToken:token}=await api('/api/orders',{...payload,idempotencyKey:key});
      try{sessionStorage.removeItem(checkoutDraftKey);sessionStorage.removeItem(checkoutAttemptKey);}catch{}
      cart=[];save();data=await api('/api/store').catch(()=>data);navigate(`/payment/${order.id}#access=${token}`);
    }
    if(type==='payment-contact'){
      const id=paymentId(location.pathname),contact=String(b.contact||'').trim();
      if(!id||!contact)throw new Error('Enter your preferred contact details.');
      const result=await api(`/api/orders/${id}/payment`,{accessToken:accessToken(id),contact});
      if(result.contactRequired||!result.bank)throw new Error('That does not match the contact provided at checkout.');
      rememberPaymentContact(id,contact);await loadPayment();
    }
    if(type==='payment-proof'){
      const id=paymentId(location.pathname),file=b.proofFile;
      if(!id||!(file instanceof File)||!file.size)throw new Error('Choose a receipt image.');
      if(file.size>3000000||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Upload a JPG, PNG, or WebP image smaller than 3 MB.');
      await api(`/api/orders/${id}/proof`,{accessToken:accessToken(id),contact:paymentContact(id),type:file.type,data:await imageBase64(file)});
      toast('Receipt submitted. We’ll review the bank transfer within 24 hours.');await loadPayment();
    }
    if(type==='booking'){const {booking}=await api('/api/bookings',{...b,consent:b.consent==='on',previewAcknowledged:b.previewAcknowledged==='on'});$('.form-success',form).innerHTML=`<strong>Your preview appointment is reserved.</strong><p>${date(booking.slot)} WAT · ${e(booking.id)}</p><p>No payment was collected. The confirmation is in the local email outbox.</p>`;form.reset();loadSlots();}
  });
});
async function start(){try{const [s,session]=await Promise.all([api('/api/store'),api('/api/session')]);data=s;user=session.user;adminManaged=!!session.adminManaged;cart=cart.filter(i=>product(i.id));if(user){const account=await api('/api/account');wishlist=[...new Set([...wishlist,...account.wishlist])];await api('/api/wishlist',{items:wishlist},'PUT');}save();header();$('#floating-cart').innerHTML=`${icon('bag')}<span class="count cart-count" hidden></span>`;updateCounts();footer();render();initScrollChrome();}catch(err){const unconfigured=/store database has not been connected/i.test(err.message),local=['localhost','127.0.0.1'].includes(location.hostname);const title=unconfigured?'The demo needs its database.':'A little pause.';const message=unconfigured?'Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Netlify, then redeploy the site.':local?'The store could not load. Make sure the local server is running, then reload this page.':'The store could not load right now. Please try again shortly.';const main=$('#main');main.classList.add('startup-error');main.innerHTML=empty(title,message,location.pathname+location.search,'Try again');console.error(err);}}
start();
