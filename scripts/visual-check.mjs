// Uses an installed Chrome/Edge, an isolated sample database, and localhost only.
import {spawn} from 'node:child_process';
import {access,mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createApplication} from '../server.mjs';

const output=resolve('.cache/visual');
await mkdir(output,{recursive:true});
const run=await mkdtemp(join(output,'run-'));
const candidates=[process.env.VISUAL_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
let executable;
for(const candidate of candidates){try{await access(candidate);executable=candidate;break;}catch{}}
if(!executable)throw new Error('Set VISUAL_BROWSER to an installed Chromium browser. No browser is downloaded.');
const app=await createApplication({databasePath:join(run,'test.sqlite'),uploadDir:join(run,'uploads'),databaseOptions:{url:null},sender:{enabled:false},paymentEnv:{BANK_NAME:'Visual Test Bank',BANK_ACCOUNT_NAME:'Isolated Visual Test',BANK_ACCOUNT_NUMBER:'1234567890'}});
await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
const origin=`http://127.0.0.1:${app.server.address().port}`;
const profile=join(run,'browser');
await mkdir(profile);
const browser=spawn(executable,[
  '--headless=new',`--user-data-dir=${profile}`,'--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',
  '--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-gpu',
  '--disable-sync','--disable-default-apps','--disable-extensions','--disable-features=MediaRouter,OptimizationHints',
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost','about:blank'
],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let launchError,browserLog='';
browser.on('error',error=>{launchError=error;});
browser.stderr.on('data',chunk=>{browserLog=(browserLog+chunk).slice(-3000);});
const delay=ms=>new Promise(done=>setTimeout(done,ms));
let socket,command,session;
const report={browser:executable,sizes:[],heroMetrics:[],interactions:[],consoleErrors:[],networkErrors:[],screenshots:[],blockedExternal:0};
try{
  let port;
  for(let attempt=0;attempt<80;attempt++){
    if(launchError)throw launchError;
    try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{await delay(100);}
  }
  if(!port)throw new Error('The installed browser did not expose its localhost debugging port.');
  const version=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  socket=new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((done,reject)=>{socket.onopen=done;socket.onerror=reject;});
  let counter=0;
  const pending=new Map();
  command=(method,params={},sessionId)=>new Promise((done,reject)=>{
    const id=++counter,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Timed out: ${method}`));},15000);
    pending.set(id,{done,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
  });
  socket.onmessage=({data})=>{
    const message=JSON.parse(data);
    if(message.id){const item=pending.get(message.id);if(item){clearTimeout(item.timer);pending.delete(message.id);message.error?item.reject(new Error(message.error.message)):item.done(message.result);}return;}
    if(message.method==='Fetch.requestPaused'){
      const allowed=message.params.request.url.startsWith(origin+'/');
      if(!allowed)report.blockedExternal++;
      command(allowed?'Fetch.continueRequest':'Fetch.failRequest',{requestId:message.params.requestId,...(!allowed?{errorReason:'BlockedByClient'}:{})},message.sessionId).catch(()=>{});
    }
    if(message.method==='Runtime.exceptionThrown')report.consoleErrors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
    if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')report.consoleErrors.push(message.params.args.map(x=>x.description||x.value).join(' '));
    if(message.method==='Network.responseReceived'&&message.params.response.status>=400)report.networkErrors.push({url:message.params.response.url,status:message.params.response.status});
  };
  const {targetId}=await command('Target.createTarget',{url:'about:blank'});
  session=(await command('Target.attachToTarget',{targetId,flatten:true})).sessionId;
  const cdp=(method,params)=>command(method,params,session);
  for(const domain of ['Page','Runtime','Network','Fetch'])await cdp(domain+'.enable',domain==='Fetch'?{patterns:[{urlPattern:'*'}]}:{});
  await cdp('Network.setCacheDisabled',{cacheDisabled:true});
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const evaluate=async expression=>{
    const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor=async expression=>{for(let i=0;i<80;i++){if(await evaluate(expression))return;await delay(75);}throw new Error('Page did not reach state: '+expression);};
  const navigate=async(path,ready)=>{
    await cdp('Page.navigate',{url:origin+path});
    await waitFor(`location.pathname===${JSON.stringify(path.split('#')[0].split('?')[0])} && ${ready}`);
    await delay(130);
  };
  const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await delay(120);};
  const viewport=async(width,height)=>{await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(100);};
  const screenshot=async name=>{
    const {data}=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    const file=join(output,name+'.png');await writeFile(file,Buffer.from(data,'base64'));report.screenshots.push(file);
  };
  const inspect=async(label,width,height)=>{
    await evaluate("document.fonts.ready.then(()=>true)");
    await evaluate("Promise.all([...document.images].map(img=>{img.loading='eager';return img.decode().catch(()=>{});})).then(()=>true)");
    const state=await evaluate(`(()=>{
      const w=innerWidth, visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.visibility!=='hidden'&&s.display!=='none'&&r.width>0&&r.height>0};
      const bounded=el=>{for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){if(/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowX))return true;}return false;};
      const outside=[...document.body.querySelectorAll('*')].filter(el=>visible(el)&&!bounded(el)&&!el.closest('.admin-sidebar:not(.is-open),.skip-link')).filter(el=>{const r=el.getBoundingClientRect();return r.right>w+1||r.left< -1;}).slice(0,12).map(el=>({tag:el.tagName,class:el.className,text:el.textContent?.trim().slice(0,80)}));
      return {pageWidth:document.documentElement.scrollWidth,viewportWidth:w,overflow:document.documentElement.scrollWidth>w+1,outside,heading:document.querySelector('h1')?.textContent,brokenImages:[...document.images].filter(img=>!img.complete||!img.naturalWidth).map(img=>img.src)};
    })()`);
    report.sizes.push({label,width,height,...state});
    console.log(JSON.stringify({label,width,overflow:state.overflow,outside:state.outside.length,heading:state.heading}));
    const controls=await evaluate(`(()=>{const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0};return [...document.querySelectorAll('.field > input, .field > select, .field > textarea, .inline-fields > input, .check input[type=checkbox], .shop-toolbar select')].filter(visible).map(el=>({tag:el.tagName,type:el.type,radius:parseFloat(getComputedStyle(el).borderRadius),appearance:getComputedStyle(el).appearance,arrow:getComputedStyle(el).backgroundImage,width:el.getBoundingClientRect().width}));})()`);
    if(controls.some(control=>(control.type==='checkbox'?control.radius<5||control.appearance!=='none'||control.width<20:control.radius<8)||(control.tag==='SELECT'&&(control.appearance!=='none'||control.arrow==='none'))))throw new Error(`Form controls are inconsistent on ${label} at ${width}px: ${JSON.stringify(controls)}`);
    const breadcrumb=await evaluate(`(()=>{const nav=document.querySelector('.breadcrumb');if(!nav)return null;return {label:nav.getAttribute('aria-label'),current:nav.querySelector('[aria-current="page"]')?.textContent,homeRadius:parseFloat(getComputedStyle(nav.querySelector('a')).borderRadius),separator:!!nav.querySelector('.breadcrumb-separator .icon')};})()`);
    if(breadcrumb&&(!breadcrumb.current||breadcrumb.label!=='Breadcrumb'||breadcrumb.homeRadius<15||!breadcrumb.separator))throw new Error(`Breadcrumb is inconsistent on ${label} at ${width}px: ${JSON.stringify(breadcrumb)}`);
  };
  const sizes=[[1900,900],[1440,900],[1024,768],[768,1024],[390,844],[320,740]];
  const heroMetricsOnly=process.argv.includes('--hero-metrics');
  const heroOnly=process.argv.includes('--hero')||heroMetricsOnly;
  const reviewSizes=heroMetricsOnly?[...sizes,[390,667],[320,568],[667,375],[844,390]]:sizes;
  for(const [width,height]of process.argv.includes('--focused')?[]:reviewSizes){
    await viewport(width,height);
    for(const [label,path,ready]of heroOnly?[['home','/',"!!document.querySelector('.hero')"]]:[
      ['home','/',"!!document.querySelector('.hero')"],
      ['shop','/shop',"!!document.querySelector('.shop-layout')"],
      ['product','/product/daily-cleanser',"!!document.querySelector('.product-detail')"],
      ['consultations','/consultations',"!!document.querySelector('#booking-slots') && !document.querySelector('#booking-slots').textContent.includes('Loading')"],
      ['contact','/contact',"!!document.querySelector('.contact-form')"],
      ['wishlist','/wishlist',"!!document.querySelector('.breadcrumb')"],
      ['account','/account',"!!document.querySelector('.auth-wrap')"],
      ['guide','/guide',"!!document.querySelector('.guide-section')"],
      ['admin-setup','/admin',"!!document.querySelector('.admin-auth')"]
    ]){
      await navigate(path,ready);
      if(heroMetricsOnly){
        await evaluate('document.fonts.ready.then(()=>true)');
        const metrics=await evaluate(`(()=>{const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}};return {header:box('#site-header'),hero:box('.hero'),inner:box('.hero-inner'),copy:box('.hero-copy'),stage:box('.hero-stage'),shape:box('.hero-quatrefoil'),heading:document.querySelector('.hero-copy h1').textContent.trim(),heroActions:document.querySelector('.hero-copy .hero-buttons').children.length};})()`);
        report.heroMetrics.push({width,height,...metrics});
        console.log(JSON.stringify({width,height,header:metrics.header.height,hero:metrics.hero.height,heroBottom:metrics.hero.bottom,copyBottom:metrics.copy.bottom,stageBottom:metrics.stage.bottom,shape:metrics.shape.height}));
        if(Math.abs(metrics.header.height+metrics.hero.height-height)>1||Math.abs(metrics.inner.height-metrics.hero.height)>1||Math.abs(metrics.hero.top-metrics.header.bottom)>1||Math.abs(metrics.hero.bottom-height)>1||metrics.copy.bottom>metrics.hero.bottom+1||metrics.stage.bottom>metrics.hero.bottom+1||metrics.shape.top<metrics.stage.top-1||metrics.shape.bottom>metrics.stage.bottom+1||metrics.shape.height<200||metrics.heading!=='A little care. A lot of confidence.'||metrics.heroActions!==1)throw new Error(`Header and hero do not fit the ${width}×${height} viewport: ${JSON.stringify(metrics)}`);
        continue;
      }
      await inspect(label,width,height);
      if(label==='product'){
        const alignment=await evaluate(`(()=>{const page=document.querySelector('.page-wrap'),style=getComputedStyle(page),bounds=selector=>document.querySelector(selector).getBoundingClientRect();return {expectedLeft:page.getBoundingClientRect().left+parseFloat(style.paddingLeft),expectedRight:page.getBoundingClientRect().right-parseFloat(style.paddingRight),headingLeft:bounds('.related-section h2').left,gridLeft:bounds('.related-section .product-grid').left,gridRight:bounds('.related-section .product-grid').right};})()`);
        if(Math.abs(alignment.headingLeft-alignment.expectedLeft)>2||Math.abs(alignment.gridLeft-alignment.expectedLeft)>2||Math.abs(alignment.gridRight-alignment.expectedRight)>2)throw new Error(`Related products do not share the product page gutters at ${width}px: ${JSON.stringify(alignment)}`);
        if([1440,390].includes(width)){await evaluate("document.querySelector('.related-section h2').scrollIntoView({block:'start'})");await screenshot(`related-products-${width}`);}
      }
      if(label==='wishlist'&&[1440,390].includes(width))await screenshot(`wishlist-${width}`);
      if(label==='shop'){
        const selects=await evaluate(`[...document.querySelectorAll('.shop-layout select')].map(select=>({appearance:getComputedStyle(select).appearance,arrow:getComputedStyle(select).backgroundImage}))`);
        if(selects.some(select=>select.appearance!=='none'||select.arrow==='none'))throw new Error(`Shop dropdown styling is missing at ${width}px: ${JSON.stringify(selects)}`);
      }
      if(label==='consultations'){
        const layout=await evaluate(`(()=>{const intro=document.querySelector('.consult-intro').getBoundingClientRect(),form=document.querySelector('.booking-form').getBoundingClientRect(),note=document.querySelector('#slot-note').textContent,faq=[...document.querySelectorAll('.consultation-faq details')],dividers=['.consultation-price','.booking-form','.booking-consents','.consultation-faq'].map(selector=>{const style=getComputedStyle(document.querySelector(selector));return {selector,top:style.borderTopWidth,bottom:style.borderBottomWidth};});return {intro:{right:intro.right,bottom:intro.bottom},form:{left:form.left,top:form.top,bottom:form.bottom},note,faqCount:faq.length,faqReady:faq.every(item=>!item.open&&item.querySelector('summary').getBoundingClientRect().height>=44),dividers};})()`);
        if(width>900?layout.form.left<=layout.intro.right:layout.form.top<=layout.intro.bottom)throw new Error(`Consultation layout overlaps at ${width}px: ${JSON.stringify(layout)}`);
        if(width>900&&Math.abs(layout.form.bottom-layout.intro.bottom)>2)throw new Error(`Consultation photo and form do not end evenly at ${width}px: ${JSON.stringify(layout)}`);
        if(layout.dividers.some(item=>item.top!=='0px'||item.bottom!=='0px'))throw new Error(`Consultation page still has decorative divider lines: ${JSON.stringify(layout.dividers)}`);
        if(layout.faqCount!==2||!layout.faqReady)throw new Error(`Consultation FAQ is not ready to use at ${width}px: ${JSON.stringify(layout)}`);
        if(layout.note.includes('Admin'))throw new Error('Customer consultation page exposes an admin instruction.');
      }
      if(label==='contact'){
        const contact=await evaluate(`(()=>{const story=document.querySelector('.contact-story').getBoundingClientRect(),form=document.querySelector('.contact-form').getBoundingClientRect();return {storyRight:story.right,storyBottom:story.bottom,formLeft:form.left,formTop:form.top,topicCount:document.querySelectorAll('.contact-form select[name=subject] option').length,channelCount:document.querySelectorAll('.contact-channel').length,hasImage:!!document.querySelector('.contact-layout img')};})()`);
        if(contact.hasImage||contact.topicCount<5||contact.channelCount<1||(width>900?contact.formLeft<=contact.storyRight:contact.formTop<=contact.storyBottom))throw new Error(`Contact layout is not ready at ${width}px: ${JSON.stringify(contact)}`);
        if([1440,390,320].includes(width)){await screenshot(`contact-${width}`);if(width===390){await evaluate("document.querySelector('.contact-form').scrollIntoView({block:'start'})");await screenshot('contact-form-390');}}
        if(width===390){await evaluate(`(()=>{const f=document.querySelector('.contact-form');for(const [key,value]of Object.entries({name:'Visual Example',email:'visual@example.test',subject:'Skincare advice',message:'I would like help building a simple skincare routine.'}))f.elements.namedItem(key).value=value;f.requestSubmit();})()`);await waitFor("!!document.querySelector('.contact-form .form-success')?.textContent.trim()");report.interactions.push('Contact form accepts a topic and saves a sample message.');}
      }
      if(label==='consultations'&&[1440,768,390,320].includes(width)){
        await screenshot(`consultation-page-${width}`);
        if(width===1440){await evaluate("document.querySelector('.consultation-page').scrollIntoView({block:'end'})");await screenshot('consultation-bottom-1440');}
        if(width===390){
          await evaluate("document.querySelector('.booking-form').scrollIntoView({block:'start'})");await screenshot('consultation-form-390');
          await evaluate("document.querySelector('.booking-consents').scrollIntoView({block:'center'})");await screenshot('consultation-consents-390');
          await click('.booking-form input[name="consent"]');await click('.booking-form input[name="previewAcknowledged"]');
          const controls=await evaluate(`(()=>{const form=document.querySelector('.booking-form'),field=form.querySelector('.field input'),select=form.querySelector('select'),checks=[...form.querySelectorAll('.booking-consents input')];return {fieldRadius:parseFloat(getComputedStyle(field).borderRadius),selectAppearance:getComputedStyle(select).appearance,checks:checks.map(input=>({checked:input.checked,appearance:getComputedStyle(input).appearance,background:getComputedStyle(input).backgroundColor}))};})()`);
          if(controls.fieldRadius<8||controls.selectAppearance!=='none'||controls.checks.some(check=>!check.checked||check.appearance!=='none'||check.background==='rgb(255, 255, 255)'))throw new Error(`Consultation form controls are not fully styled and operable at 390px: ${JSON.stringify(controls)}`);
          await screenshot('consultation-consents-checked-390');
        }
        await evaluate("document.querySelector('.consultation-faq').scrollIntoView({block:'start'})");
        await screenshot(`consultation-faq-${width}`);
        if(width===1440||width===390){
          await click('.consultation-faq details:first-child summary');
          if(!await evaluate("document.querySelector('.consultation-faq details:first-child').open && document.querySelectorAll('.consultation-faq details:first-child li').length>0"))throw new Error(`Consultation inclusions did not expand at ${width}px.`);
          await screenshot(`consultation-faq-open-${width}`);
          await click('.consultation-faq details:last-child summary');
          if(!await evaluate("document.querySelector('.consultation-faq details:last-child').open"))throw new Error(`Consultation process did not expand at ${width}px.`);
        }
      }
      if(label==='home'){
        if(width<=640){
          const mobileGrids=await evaluate(`(()=>{const pair=selector=>{const items=[...document.querySelectorAll(selector)].slice(0,2).map(item=>item.getBoundingClientRect());return {sameRow:items.length===2&&Math.abs(items[0].top-items[1].top)<2,firstWidth:items[0]?.width,secondWidth:items[1]?.width};};return {products:pair('#home-products .product-card'),journal:pair('.journal-grid .journal-card')};})()`);
          if(Object.values(mobileGrids).some(pair=>!pair.sameRow||pair.firstWidth<120||pair.secondWidth<120))throw new Error(`Product and journal cards should remain two per row at ${width}px: ${JSON.stringify(mobileGrids)}`);
          if(width<=380){const action=await evaluate(`(()=>{const button=document.querySelector('#home-products .quick-add');return {height:button.getBoundingClientRect().height,scrollWidth:button.scrollWidth,clientWidth:button.clientWidth};})()`);if(action.height>48||action.scrollWidth>action.clientWidth+1)throw new Error(`Narrow product action does not fit on one line at ${width}px: ${JSON.stringify(action)}`);}
        }
        const productText=await evaluate(`(()=>{const card=document.querySelector('#home-products .product-card'),box=selector=>card.querySelector(selector).getBoundingClientRect();return {brandToTitle:box('h3').top-box('.product-brand').bottom,titleToSize:box('.product-size').top-box('h3').bottom,sizeToPrice:box('.product-price').top-box('.product-size').bottom,fontLoaded:document.fonts.check('400 16px "DM Sans"')};})()`);
        if(!productText.fontLoaded||productText.brandToTitle>10||productText.titleToSize>10||productText.sizeToPrice>16)throw new Error(`Product card text is too spread out or DM Sans did not load at ${width}px: ${JSON.stringify(productText)}`);
        const hero=await evaluate(`(()=>{const r=document.querySelector('.hero').getBoundingClientRect(),t=document.querySelector('.hero-copy h1').getBoundingClientRect(),copy=document.querySelector('.consultation-copy'),cta=copy.querySelector('.button'),style=getComputedStyle(copy);return {left:r.left,right:r.right,height:r.height,headerHeight:document.querySelector('#site-header').offsetHeight,contentWidth:document.documentElement.clientWidth,textLeft:t.left,heading:document.querySelector('.hero-copy h1').textContent.trim(),secondStyle:getComputedStyle(document.querySelector('.hero-title-second')).fontStyle,heroActions:document.querySelector('.hero-copy .hero-buttons').children.length,consultationButton:cta.getBoundingClientRect().width,consultationContent:copy.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),consultationIcons:copy.querySelectorAll('.check-list .icon circle').length,previewStrip:!!document.querySelector('.preview-strip')};})()`);
        if(Math.abs(hero.left)>1||Math.abs(hero.right-hero.contentWidth)>1||Math.abs(hero.height+hero.headerHeight-height)>1||hero.heading!=='A little care. A lot of confidence.'||hero.secondStyle!=='normal'||hero.heroActions!==1||hero.previewStrip)throw new Error(`Hero sizing, copy, or actions are inconsistent at ${width}px: ${JSON.stringify(hero)}`);
        if(hero.consultationIcons<3||hero.consultationButton<hero.consultationContent-2)throw new Error(`Consultation list or full-width action is inconsistent at ${width}px: ${JSON.stringify(hero)}`);
        const spacing=await evaluate(`(()=>{
          const bounds=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right};};
          const section=document.querySelector('.categories-section'),r=section.getBoundingClientRect(),style=getComputedStyle(section);
          const newsletter=document.querySelector('.newsletter-inner'),n=newsletter.getBoundingClientRect(),ns=getComputedStyle(newsletter);
          return {contentLeft:r.left+parseFloat(style.paddingLeft),contentRight:r.right-parseFloat(style.paddingRight),stage:bounds('.hero-stage'),values:bounds('.values-inner'),consultation:bounds('.consultation-banner'),guide:bounds('.guide-section'),newsletter:{left:n.left+parseFloat(ns.paddingLeft),right:n.right-parseFloat(ns.paddingRight)},footer:bounds('.footer-top'),caption:document.querySelector('.hero-photo-caption')?.textContent.trim()};
        })()`);
        if(!await evaluate("[...document.querySelectorAll('.hero-quatrefoil-product')].length===4 && [...document.querySelectorAll('.hero-quatrefoil-product')].every(img=>img.complete&&img.naturalWidth>0)"))throw new Error('The four hero product cutouts did not load.');
        if(Math.abs(hero.textLeft-spacing.contentLeft)>2)throw new Error(`Hero text does not align with section content: ${JSON.stringify({hero,spacing})}`);
        for(const name of ['stage','values','consultation','guide','newsletter','footer']){
          const edges=spacing[name];
          if((name!=='stage'||width<=640)&&Math.abs(edges.left-spacing.contentLeft)>2||Math.abs(edges.right-spacing.contentRight)>2)
            throw new Error(`${name} does not share the page gutters at ${width}px: ${JSON.stringify(spacing)}`);
        }
        const sectionGaps=await evaluate(`(()=>{const top=selector=>document.querySelector(selector).getBoundingClientRect().top,bottom=selector=>document.querySelector(selector).getBoundingClientRect().bottom;return {categoriesToFeatured:top('.featured-section h2')-bottom('.categories-section .category-card:last-child'),featuredToConsultation:top('.consultation-banner')-bottom('.featured-section .product-card:last-child'),consultationToConcerns:top('.concern-section h2')-bottom('.consultation-banner'),concernsToBrands:top('.brand-heading')-bottom('.concern-pill:last-child'),brandsToGuide:top('.guide-section')-bottom('.brand-strip a:last-child')};})()`);
        const minimumGap=width<=640?56:76;
        for(const [name,gap]of Object.entries(sectionGaps))if(gap<minimumGap)throw new Error(`${name} is too close at ${width}px: ${JSON.stringify(sectionGaps)}`);
        const journal=await evaluate(`(()=>{
          const cards=[...document.querySelectorAll('.journal-grid .journal-card')];
          if(!cards.length)return {error:'No journal cards'};
          const title=cards[0].querySelector('h3'),original=title.textContent;
          title.textContent='A thoughtful skincare routine that fits into every day and leaves room for a more confident you';
          const titleStyle=getComputedStyle(title),lineHeight=parseFloat(titleStyle.lineHeight);
          const result={clamp:titleStyle.webkitLineClamp,titleHeight:title.clientHeight,maxHeight:lineHeight*3,portrait:cards.every(card=>{const art=card.querySelector('.journal-art'),r=art.getBoundingClientRect(),h=card.querySelector('h3').getBoundingClientRect(),m=card.querySelector('.journal-meta').getBoundingClientRect(),categoryStyle=getComputedStyle(card.querySelector('.journal-category'));return r.height>r.width&&h.left>=r.left&&h.right<=r.right&&m.bottom<=r.bottom&&categoryStyle.whiteSpace==='nowrap'&&categoryStyle.textOverflow==='ellipsis'&&!card.querySelector('p');})};
          title.textContent=original;
          return result;
        })()`);
        if(journal.error||journal.clamp!=='3'||journal.titleHeight>journal.maxHeight+2||!journal.portrait)throw new Error(`Journal cards do not keep text inside portrait images at ${width}px: ${JSON.stringify(journal)}`);
        await screenshot(`home-${width}`);
        if(heroOnly&&width===390){
          await evaluate("document.querySelector('.hero-stage').scrollIntoView({block:'start'})");
          await screenshot('hero-image-390');
        }
        if(width===390){
          for(const [selector,name]of [['.concern-section','concerns'],['.brand-strip','brands']]){
            await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start'})`);
            await screenshot(`review-${name}-390`);
          }
        }
        if(!heroOnly&&width===1440){
          for(const [selector,name]of [['.categories-section','categories'],['.featured-section','featured'],['.consultation-banner','consultation'],['.concern-section','concerns'],['.brand-strip','brands'],['.guide-section','guide'],['.journal-grid','journal'],['.newsletter-strip','newsletter']]){
            await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start'})`);
            await screenshot(`review-${name}-1440`);
          }
        }
        if(!heroOnly&&(width===390||width===320)){
          await evaluate("document.querySelector('.newsletter-strip').scrollIntoView({block:'start'})");
          const newsletter=await evaluate(`(()=>{const form=document.querySelector('.newsletter-form'),name=form.elements.name.getBoundingClientRect(),email=form.elements.email.getBoundingClientRect(),button=form.querySelector('button').getBoundingClientRect(),check=form.elements.consent;return {nameBottom:name.bottom,emailTop:email.top,emailRight:email.right,buttonLeft:button.left,checkboxAppearance:getComputedStyle(check).appearance,checkboxWidth:check.getBoundingClientRect().width};})()`);
          if(newsletter.nameBottom>newsletter.emailTop||newsletter.emailRight>newsletter.buttonLeft||newsletter.checkboxAppearance!=='none'||newsletter.checkboxWidth<20)throw new Error(`Newsletter controls do not fit or are not custom styled at ${width}px: ${JSON.stringify(newsletter)}`);
          await screenshot(`newsletter-${width}`);
          if(width===390){await click('.newsletter-form input[name="consent"]');if(!await evaluate("document.querySelector('.newsletter-form input[name=consent]').checked"))throw new Error('Newsletter consent did not toggle.');await screenshot('newsletter-checked-390');}
        }
        if(!heroOnly&&(width===768||width===320)){
          await evaluate("document.querySelector('.journal-grid').scrollIntoView({block:'start'})");
          await screenshot(`review-journal-${width}`);
        }
        if(!heroOnly&&width===320){await evaluate("document.querySelector('.featured-section').scrollIntoView({block:'start'})");await screenshot('featured-320');}
      }
      if(label==='shop'&&[390,320].includes(width))await screenshot(`shop-${width}`);
    }
  }
  if(heroOnly&&!heroMetricsOnly){
    await viewport(390,844);
    await navigate('/admin',"!!document.querySelector('.admin-auth')");
    const setup=await evaluate(`fetch('/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Visual Reviewer',email:'visual-admin@example.test',password:'Isolated visual check only 2026'})}).then(r=>r.json())`);
    if(!setup.user)throw new Error('Isolated admin setup failed: '+JSON.stringify(setup));
    const sessionCheck=await evaluate("fetch('/api/session').then(r=>r.json())");
    if(sessionCheck.user?.role!=='admin')throw new Error('Isolated admin session was not retained: '+JSON.stringify(sessionCheck));
    await navigate('/admin?visual=1#settings',"!!document.querySelector('.settings-form')");
    await click('[data-settings="homepage"]');
    await inspect('homepage-admin',390,844);
    await screenshot('homepage-admin-390');
    await click('[data-action="add-home-section"]');
    await evaluate(`(()=>{const row=document.querySelector('#homepage-section-list [data-home-collection]:last-child');row.querySelector('[name="collectionTitle"]').value='New arrivals';row.querySelector('[data-product-id="daily-cleanser"]').checked=true;row.querySelector('[data-action="move-home-section"][data-direction="up"]').click();document.querySelector('.settings-form').requestSubmit();})()`);
    await waitFor("document.querySelector('#toast')?.textContent.includes('Store settings saved')");
    await navigate('/',"!!document.querySelector('.home-collection-section h2')");
    if(!await evaluate("[...document.querySelectorAll('.home-collection-section h2')].some(h=>h.textContent==='New arrivals')"))throw new Error('The new homepage collection did not appear after saving.');
    report.interactions.push('Phone admin added a product section, moved it, saved it, and it appeared on the storefront.');
  }
  if(!heroOnly){
  await viewport(320,740);await navigate('/shop',"!!document.querySelector('.filter-details')");
  await click('.filter-details>summary');
  await inspect('expanded-filters',320,740);
  await screenshot('filters-320');
  await viewport(768,1024);
  if(!await evaluate("document.querySelector('.filter-details').open"))throw new Error('Filters must remain available when resizing to desktop.');
  report.interactions.push('Phone filters expand and remain accessible after resizing.');
  await viewport(390,844);await navigate('/',"!!document.querySelector('.hero')");
  await click('[data-action=menu]');
  if(!await evaluate("!document.querySelector('#mobile-nav').hidden"))throw new Error('Phone navigation failed to open.');
  await click('#mobile-nav a[href="/shop"]');await waitFor("!!document.querySelector('.shop-layout')");
  report.interactions.push('Phone navigation opens and changes pages.');
  for(const [width,height]of [[1440,900],[390,844]]){
    await viewport(width,height);await navigate('/',"!!document.querySelector('.hero')");
    await evaluate("scrollTo({top:900,behavior:'instant'})");await delay(320);
    if(!await evaluate("document.querySelector('#site-header').classList.contains('nav-hidden') && !document.querySelector('#floating-cart').hidden && document.querySelector('.header').getBoundingClientRect().bottom<3"))throw new Error(`Navigation did not hide on downward scroll at ${width}px.`);
    await evaluate("scrollTo({top:700,behavior:'instant'})");await delay(320);
    if(!await evaluate("!document.querySelector('#site-header').classList.contains('nav-hidden') && Math.abs(document.querySelector('.header').getBoundingClientRect().top)<3"))throw new Error(`Navigation did not return on upward scroll at ${width}px.`);
    await evaluate("scrollTo({top:820,behavior:'instant'})");await delay(320);
    if(!await evaluate("document.querySelector('#site-header').classList.contains('nav-hidden') && !document.querySelector('#floating-cart').hidden"))throw new Error(`Navigation did not hide again on downward scroll at ${width}px.`);
    await evaluate("(async()=>{for(let y=818;y>=810;y-=2){scrollTo({top:y,behavior:'instant'});await new Promise(done=>setTimeout(done,40));}return true;})()");await delay(280);
    if(!await evaluate("!document.querySelector('#site-header').classList.contains('nav-hidden')"))throw new Error(`Navigation did not respond to small upward scroll steps at ${width}px.`);
    await evaluate("scrollTo({top:820,behavior:'instant'})");await delay(320);
    await screenshot(`floating-cart-${width}`);
    await click('#floating-cart');await waitFor("document.querySelector('#cart-dialog').open");
    await click('#cart-dialog [data-action=close]');
    await evaluate("scrollTo({top:0,behavior:'instant'})");await delay(320);
    if(!await evaluate("document.querySelector('#floating-cart').hidden && !document.querySelector('#site-header').classList.contains('nav-hidden')"))throw new Error(`Navigation did not reset at the page top at ${width}px.`);
  }
  report.interactions.push('Desktop and phone navigation hides on downward scroll, returns on upward scroll, and the floating cart opens the bag.');
  await navigate('/',"!!document.querySelector('.guide-section')");
  await evaluate("document.querySelector('#home-products').scrollIntoView({block:'start'});Promise.all([...document.images].map(img=>{img.loading='eager';return img.decode().catch(()=>{});})).then(()=>true)");await delay(120);await screenshot('favourites-390');
  await evaluate("document.querySelector('.journal-grid').scrollIntoView({block:'start'})");await delay(120);await screenshot('journal-390');
  await evaluate("document.querySelector('.guide-section').scrollIntoView({block:'start'})");await delay(120);await screenshot('guide-390');
  await evaluate("document.querySelector('.consultation-banner').scrollIntoView({block:'start'})");await delay(120);await screenshot('consultation-390');
  await evaluate("scrollTo(0,document.body.scrollHeight)");await delay(120);await screenshot('footer-390');
  await viewport(390,844);
  await navigate('/product/daily-cleanser',"!!document.querySelector('[data-action=add-detail]')");
  await click('[data-action=add-detail]');await click('[data-action=cart]');await waitFor("!!document.querySelector('#cart-dialog[open]')");
  await inspect('cart',390,844);await screenshot('cart-390');
  await viewport(320,740);await inspect('cart',320,740);await viewport(390,844);
  const setup=await evaluate(`fetch('/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Visual Reviewer',email:'visual-admin@example.test',password:'Isolated visual check only 2026'})}).then(r=>r.json())`);
  if(!setup.user)throw new Error('Isolated admin setup failed: '+JSON.stringify(setup));
  await click('#cart-dialog a[href="/checkout"]');await waitFor("!!document.querySelector('#checkout-totals .grand-total')");
  await inspect('checkout',390,844);await evaluate("document.querySelector('#toast').classList.remove('show')");await screenshot('checkout-390');
  await evaluate(`(()=>{const f=document.querySelector('#checkout-form');for(const [key,value]of Object.entries({name:'Visual Test',email:'visual@example.test',phone:'08000000000',address:'Fictional address',city:'Lagos'}))f.elements.namedItem(key).value=value;f.elements.namedItem('contactChannel').value='email';f.elements.namedItem('transferAcknowledged').checked=true;f.requestSubmit();})()`);
  await waitFor("!!document.querySelector('.bank-card')");
  report.interactions.push('Mobile add-to-bag and bank-transfer instructions completed through the UI.');
  await navigate('/admin',"!!document.querySelector('.stats-grid')");
  for(const [width,height]of sizes){
    await viewport(width,height);
    for(const [label,path,ready]of [
      ['admin-dashboard','/admin',"!!document.querySelector('.stats-grid')"],
      ['admin-products','/admin#products',"!!document.querySelector('#records-table .table-product')"],
      ['admin-settings','/admin#settings',"!!document.querySelector('.settings-form')"]
    ]){
      await navigate(path,ready);await inspect(label,width,height);
      if(label==='admin-dashboard'&&[1440,768,390].includes(width))await screenshot(`admin-${width}`);
    }
  }
  await viewport(390,844);await navigate('/admin#products',"!!document.querySelector('#records-table .table-product')");
  await click('[data-action=admin-menu]');
  await waitFor("!!document.querySelector('.admin-sidebar.is-open') && !document.querySelector('.admin-sidebar').inert");
  await inspect('admin-navigation',390,844);
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await waitFor("!document.querySelector('.admin-sidebar.is-open') && !document.querySelector('.admin-workspace-main').inert");
  await click('[data-action=admin-menu]');await click('[data-action=admin-menu-close]');
  await waitFor("!document.querySelector('.admin-sidebar.is-open')");
  report.interactions.push('Admin phone navigation supports Tab, Escape, and its close button.');
  await click('[data-action=edit][data-kind=products]');await waitFor("!!document.querySelector('#editor-dialog[open]')");
  const editorSelects=await evaluate(`[...document.querySelectorAll('.editor-form select')].map(select=>({appearance:getComputedStyle(select).appearance,arrow:getComputedStyle(select).backgroundImage,paddingRight:getComputedStyle(select).paddingRight}))`);
  if(editorSelects.some(select=>select.appearance!=='none'||select.arrow==='none'||parseFloat(select.paddingRight)<35))throw new Error(`Admin editor dropdown styling is missing: ${JSON.stringify(editorSelects)}`);
  await inspect('product-editor',390,844);await screenshot('product-editor-390');
  await viewport(320,740);await inspect('product-editor',320,740);
  await evaluate(`(()=>{const f=document.querySelector('.editor-form');f.elements.namedItem('name').value='Visual Review Cleanser';f.requestSubmit();})()`);
  await waitFor("!document.querySelector('#editor-dialog').open && document.querySelector('#records-table').textContent.includes('Visual Review Cleanser')");
  await navigate('/product/daily-cleanser',"document.querySelector('h1')?.textContent==='Visual Review Cleanser'");
  report.interactions.push('Product edits saved from the phone admin appear on the storefront.');
  await navigate('/admin#settings',"!!document.querySelector('.settings-form')");
  for(const [width,height]of [[768,1024],[320,740]]){
    await viewport(width,height);
    for(const tab of ['homepage','delivery','consultation','guide','data']){
      await click(`[data-settings="${tab}"]`);
      if(tab==='consultation')await click('[data-action=add-slot]');
      await inspect('settings-'+tab,width,height);
    }
  }
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await viewport(390,844);await navigate('/contact',"!!document.querySelector('.contact-story')");
  await waitFor("document.querySelector('.contact-story').classList.contains('is-visible')");
  if(!await evaluate("parseFloat(getComputedStyle(document.querySelector('.contact-story')).transitionDuration)>0"))throw new Error('Contact reveal motion did not activate when motion is allowed.');
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await navigate('/contact',"!!document.querySelector('.contact-story')");
  if(await evaluate("document.querySelector('.contact-story').classList.contains('reveal-ready')"))throw new Error('Scroll reveal was applied despite reduced-motion preference.');
  report.interactions.push('Subtle scroll reveal runs only when motion is allowed.');
  }
  const problems=report.sizes.filter(s=>s.overflow||s.outside.length||s.brokenImages.length);
  if(problems.length||report.consoleErrors.length||report.networkErrors.length)throw new Error('Visual checks found problems. Read report.json for details.');
}catch(error){report.failure=error.stack;console.error(error.stack);if(!report.sizes.length)console.error(browserLog);process.exitCode=1;}
finally{
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
  if(command){try{await command('Browser.close');}catch{}}
  socket?.close();
  if(browser.exitCode===null)browser.kill();
  await app.close();
  console.log('Visual report: '+join(output,'report.json'));
}
