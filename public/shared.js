import {photos,samplePhotos} from './photography.js';
export const $=(selector,root=document)=>root.querySelector(selector);
export const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=value=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(value||0);
export const date=value=>new Date(value).toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Lagos'});
export const paragraphs=value=>String(value||'').split('\n\n').map(p=>`<p>${escape(p).replace(/\n/g,'<br>')}</p>`).join('');
export async function api(path,body,method=body===undefined?'GET':'POST') {
  const response=await fetch(path,{method,credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Something went wrong. Please try again.');return data;
}
const icons={
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  bag:'<path d="M5 7.5h14l1 14H4l1-14Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>',
  check:'<path d="m5 12 4 4L19 6"/>', checkCircle:'<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="m7.5 12 3 3 6-6" stroke="#fff" stroke-width="1.9"/>', chevron:'<path d="m6 9 6 6 6-6"/>',
  shield:'<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z"/><path d="m8 12 3 3 5-6"/>',
  leaf:'<path d="M20 3C9 2 2 7 4 15c2 8 15 6 16-12Z"/><path d="M3 22 15 9"/>',
  truck:'<path d="M1 4h13v13H1zM14 9h4l4 5v3h-8"/><circle cx="5" cy="18" r="3"/><circle cx="18" cy="18" r="3"/>',
  chat:'<path d="M21 11a9 9 0 0 1-9 9H3l1.5-4A9 9 0 1 1 21 11Z"/><path d="M8 10h8M8 14h5"/>',
  mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 5 10 8L22 5"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  box:'<path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 10 9-5M12 12 3 7m9 5v10M7 4.8l10 5.5"/>',
  calendar:'<rect x="3" y="5" width="18" height="17" rx="2"/><path d="M7 2v6m10-6v6M3 11h18"/>',
  file:'<path d="M14 2H4v20h16V8l-6-6Zm0 0v6h6M8 12h8m-8 4h8"/>',
  settings:'<circle cx="12" cy="12" r="4"/><path d="m9 2-1 3-3 1-3 4 2 2-1 4 3 2 2 3 4-1 4 1 2-3 3-2-1-4 2-2-3-4-3-1-1-3H9Z"/>',
  logout:'<path d="M9 3H3v18h6m-1-9h14m-5-5 5 5-5 5"/>',
  edit:'<path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 16h12l1-16M10 10v8m4-8v8"/>',
  download:'<path d="M12 2v14m-5-5 5 5 5-5M3 16v6h18v-6"/>',
  tag:'<path d="m2 3 9-1 11 11-9 9L2 11V3Z"/><circle cx="7" cy="7" r="1"/>',
  external:'<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
};
export const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.leaf}</svg>`;
export function art(product,extra='') {
  if(product.images?.length)return `<img class="product-photo ${extra}" src="${escape(product.images[0])}" alt="${escape(product.name)}" loading="lazy" width="480" height="540">`;
  const sample=product.sample&&photos[samplePhotos[product.id]];
  if(sample)return `<img class="product-photo sample-photo ${extra}" src="${sample.src}" alt="${sample.alt} — representative sample photograph" loading="lazy" decoding="async" width="800" height="1000">`;
  return `<div class="product-art ${escape(product.tone||'sage')} ${extra}" aria-label="Illustrative sample packaging" role="img"><div class="product-object ${escape(product.art||'bottle')}"><div class="product-pump"></div><div class="product-cap"></div><div class="product-body"><div class="product-label"><span class="art-brand">${escape(product.brand||'DrealSkinhub')}</span><span class="art-name">${escape(product.name||'Everyday care')}</span><span class="art-size">${escape(product.size||'made for your ritual')}</span></div></div></div></div>`;
}
let toastTimer;
export function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4500);}
export const empty=(title,text,link='/shop',label='Explore the shop')=>`<div class="empty-state"><h2>${escape(title)}</h2><p>${escape(text)}</p>${link?`<a class="button" href="${escape(link)}">${escape(label)} ${icon('arrow')}</a>`:''}</div>`;
export async function submitForm(form,work) {
  const button=form.querySelector('[type="submit"]'),error=form.querySelector('.form-error');
  if(form.dataset.busy)return;form.dataset.busy='true';if(button)button.disabled=true;if(error)error.textContent='';
  try{await work(Object.fromEntries(new FormData(form)));}catch(e){if(error){error.textContent=e.message;error.focus();}else toast(e.message);}finally{delete form.dataset.busy;if(button)button.disabled=false;}
}
export function field(label,name,value='',type='text',extra='') {return `<label class="field"><span>${escape(label)}</span><input type="${type}" name="${escape(name)}" value="${escape(value)}" ${extra}></label>`;}
export const errorBox='<p class="form-error" role="alert" tabindex="-1"></p>';
