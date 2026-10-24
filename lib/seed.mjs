export const categories = ['Cleansers', 'Moisturisers', 'Sunscreens', 'Serums', 'Acne care', 'Dark spot care', 'Body care', 'Accessories'];
export const categoryTree = [
  {label:'Face',children:['Cleansers','Moisturisers','Sunscreens','Serums','Acne care','Dark spot care']},
  {label:'Body',children:['Body care']},
  {label:'Accessories',children:[]}
];
export const concerns = ['Dry skin', 'Oily skin', 'Sensitive skin', 'Acne & breakouts', 'Dark spots', 'Uneven tone'];
export const settings = {
  storeName: 'DrealSkinhub', tagline: 'Your skin matters here.',
  announcement: '',
  heroEyebrow: 'GOOD SKINCARE. REAL SUPPORT.',
  heroTitle: 'A little care.\nA lot of confidence.',
  heroText: 'Your skin is uniquely yours. Find authentic skincare and thoughtful guidance for every step of your journey.',
  heroImage: '', heroPrimary: 'Find your favourites', heroSecondary: 'Let’s talk about your skin',
  aboutTitle: 'Less confusion. More confidence.',
  aboutText: 'We believe skincare should feel like care. DrealSkinhub brings together authentic products, honest guidance, and a listening ear — so you can make informed choices, at your own pace and within your budget.',
  consultationTitle: 'Let’s get to know your skin.',
  consultationText: 'Too many products, too much advice? Let’s take a step back. Our one-to-one consultation helps you make sense of your routine and find a way forward that feels right for you.',
  consultationPrice: 15000, consultationDuration: 45,
  consultationIncludes: 'A conversation about your skin goals\nA review of your current routine\nPersonalised product guidance\nAgreed follow-up support',
  consultationSlots: [], guideTitle: 'Your skincare journey, made simpler.',
  guideText: 'A little clarity for your everyday routine. Sign up for our free skincare guide and thoughtful notes from DrealSkinhub.',
  guideUrl: '', supportEmail: '', supportPhone: '', whatsapp: '', instagram: '', address: '', hours: '',
  categories, categoryTree, concerns, brands: ['The Daily Edit', 'Skin Ritual', 'Kind Essentials'],
  deliveryZones: [{id:'lagos', name:'Lagos — sample rate', fee:3000}, {id:'nigeria', name:'Other Nigerian states — sample rate', fee:5500}],
  freeDeliveryThreshold: 60000, lowStockThreshold: 5,
  sections: {categories:true, featured:true, concerns:true, consultation:true, brands:true, guide:true, journal:true, reviews:true},
  sectionVisibility: {},
  heroProductOne: '/assets/photos/hero-illiyoon-cutout.png', heroProductTwo: '/assets/photos/hero-korean-skin-cutout.png',
  heroProductThree: '/assets/photos/hero-cosrx-cutout.png', heroProductFour: '/assets/photos/hero-dove-cutout.png',
  homeCollections: [{id:'best-sellers',title:'Best sellers',productIds:['clarifying-serum','body-lotion','soft-headband','even-tone'],enabled:true}],
  sectionOrder: ['categories','featured','best-sellers','consultation','concerns','brands','guide','reviews','journal'],
  seoDescription: 'Authentic skincare, honest guidance, and exceptional care. Discover DrealSkinhub and find your everyday skincare ritual.',
};
const rows = [
  ['daily-cleanser','The Everyday Cleanser','The Daily Edit','Cleansers',12500,15000,150,18,'cleanser','sage','Sensitive skin','A gentle start to your daily ritual.'],
  ['barrier-cream','Comfort Barrier Cream','Kind Essentials','Moisturisers',16500,0,50,12,'jar','peach','Dry skin','A little comfort for your everyday routine.'],
  ['daily-sunscreen','Your Daily SPF','Skin Ritual','Sunscreens',18000,0,50,20,'tube','butter','Uneven tone','Make a little room for your daily sun care.'],
  ['hydration-serum','The Hydration Serum','The Daily Edit','Serums',14500,0,30,7,'dropper','rose','Dry skin','Meet the hydrating step in your ritual.'],
  ['clarifying-serum','Balance & Clarity Serum','Skin Ritual','Acne care',17500,0,30,4,'dropper','sage','Acne & breakouts','A thoughtful addition to a balanced routine.'],
  ['body-lotion','Everyday Body Lotion','Kind Essentials','Body care',19000,0,250,10,'cleanser','peach','Dry skin','A care ritual from head to toe.'],
  ['even-tone','Even Tone Essence','Skin Ritual','Dark spot care',21000,0,100,0,'bottle','rose','Dark spots','Explore a more considered skincare routine.'],
  ['soft-headband','The Ritual Headband','Kind Essentials','Accessories',4500,0,1,25,'accessory','sage','Sensitive skin','A soft finishing touch for your shelf.'],
];
export const products = rows.map((r,i)=>({
  id:r[0], name:r[1], brand:r[2], category:r[3], price:r[4], compareAt:r[5], size:r[3]==='Accessories'?'One size':`${r[6]} ml`,
  stock:r[7], art:r[8], tone:r[9], concerns:[r[10]], description:r[11]+' This is an illustrative sample product for reviewing the store. Replace it with your verified catalogue before launch.',
  ingredients:'Add the verified ingredient list from the product packaging.', directions:'Add the manufacturer’s verified directions before publishing.',
  precautions:'Add the manufacturer’s precautions before publishing.', images:[], featured:i<4, isNew:i===2||i===3||i===5,
  active:true, sample:true, popularity:100-i*8, createdAt:new Date(Date.UTC(2026,9,20-i)).toISOString(),
}));
export const pages = [
  {id:'about', title:'A little more about us', body:settings.aboutText, published:true},
  {id:'delivery', title:'Shipping & delivery', body:'Delivery details are being finalised. The rates shown in this local preview are examples and are not live delivery quotes.\n\nThe store owner can update delivery areas and fees in Settings, and publish the approved policy here.', published:true, draft:true},
  {id:'returns', title:'Returns & refunds', body:'Our returns, refunds, and cancellation policy will be published before the store opens. Please contact us before returning a product.', published:true, draft:true},
  {id:'privacy', title:'Your privacy matters', body:'This is a local website preview. Please use fictional information when testing accounts, orders, and consultations.\n\nThe store owner must approve the privacy notice, retention periods, service providers, and consultation data handling before launch.', published:true, draft:true},
  {id:'terms', title:'Terms & conditions', body:'This store is currently a local preview. Sample products, prices, orders, and consultation fees are for review only. No payments are collected.\n\nApproved terms will be published before the live store opens.', published:true, draft:true},
];
export const faqs = [
  {id:'choosing', question:'Not sure where to start?', answer:'You don’t have to figure it all out alone. Explore our categories or book a consultation to talk through your routine and skincare goals.', published:true},
  {id:'delivery', question:'Where do you deliver?', answer:'You can see the available delivery areas and fees in your bag before placing an order. Delivery coverage will be confirmed before launch.', published:true},
  {id:'consultation', question:'What happens in a consultation?', answer:'We talk about your goals, review your current routine, and offer practical product guidance. You’ll also agree on the follow-up support included in your session.', published:true},
  {id:'account', question:'Do I need an account to shop?', answer:'You can check out as a guest. An account helps you keep your saved products and see your order history.', published:true},
];
export const articles = [
  {id:'a-routine-that-fits', title:'A routine that fits into real life', category:'THE EVERYDAY EDIT', excerpt:'Less pressure. More intention. A place to start your skincare journey.', body:'A skincare routine should fit into your life, your budget, and the time you actually have.\n\nStart by writing down what you already use and the questions you have. Bring the list to a consultation so you can talk through your options.\n\nThe goal is to feel more informed about your choices. You don’t need to follow every trend or fill your shelf all at once.', published:true, art:'routine'},
  {id:'your-consultation', title:'Your questions deserve a little space', category:'LET’S TALK SKIN', excerpt:'What to bring to your first skincare conversation.', body:'Your concerns, questions, and budget all matter. Before a consultation, make a note of what you hope to discuss.\n\nKeep the names of your current products handy. Think about what you enjoy about your routine and what feels confusing.\n\nTogether, you can agree on practical next steps and the follow-up support that is right for you.', published:true, art:'consult'},
  {id:'mindful-shelf', title:'Make room for a more mindful shelf', category:'SKINCARE, SIMPLIFIED', excerpt:'A thoughtful approach to your next skincare purchase.', body:'A well-considered purchase starts with a question: what role will this product play in my routine?\n\nRead the product information, size, directions, and precautions. If you are unsure, ask for guidance before making a purchase.\n\nYour skincare journey is your own. Take the time you need to make choices you feel comfortable with.', published:true, art:'shelf'},
];
