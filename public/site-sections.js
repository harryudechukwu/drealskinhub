// Public content blocks the store owner can show or hide. Essential shopping,
// payment, account, and policy controls are intentionally kept available.
export const siteSectionGroups = [
  {label:'Homepage',path:'/',items:[
    {key:'homeHero',label:'Hero',selector:'.hero'},
    {key:'homeValues',label:'Care promises',selector:'.values-strip'}
  ]},
  {label:'Shop',path:'/shop',items:[
    {key:'shopIntro',label:'Shop introduction',selector:'.page-heading'},
    {key:'shopHelp',label:'Sidebar consultation prompt',selector:'.sidebar-note'}
  ]},
  {label:'Product pages',path:'/product/',items:[
    {key:'productTrust',label:'Shopping reassurance',selector:'.detail-trust'},
    {key:'productInfo',label:'Product information panels',selector:'.detail-copy > .accordion'},
    {key:'productRelated',label:'More products to explore',selector:'.related-section'}
  ]},
  {label:'Consultations',path:'/consultations',items:[
    {key:'consultImage',label:'Consultation photograph',selector:'.consult-intro-image'},
    {key:'consultBooking',label:'Appointment form',selector:'.booking-form'},
    {key:'consultFaq',label:'Consultation questions',selector:'.consultation-faq'}
  ]},
  {label:'Contact',path:'/contact',items:[
    {key:'contactIntro',label:'Contact introduction',selector:'.contact-story > h1, .contact-story > .lead'},
    {key:'contactChannels',label:'Contact methods',selector:'.contact-channels, .contact-details'},
    {key:'contactForm',label:'Contact form',selector:'.contact-form'}
  ]},
  {label:'About',path:'/about',items:[
    {key:'aboutImage',label:'Brand image',selector:'.about-brand'},
    {key:'aboutStory',label:'Our story',selector:'.article-page > .prose'},
    {key:'aboutCta',label:'Shop button',selector:'.article-page > .button'}
  ]},
  {label:'Skincare guide',path:'/guide',items:[
    {key:'guideSignup',label:'Guide signup',selector:'.guide-section'}
  ]},
  {label:'Brands',path:'/brands',items:[
    {key:'brandsIntro',label:'Brand introduction',selector:'.page-heading'},
    {key:'brandsDirectory',label:'Brand directory',selector:'.brands-grid'}
  ]},
  {label:'Skin journal',path:'/journal',items:[
    {key:'journalIntro',label:'Journal introduction',selector:'.page-heading'},
    {key:'journalArticles',label:'Article cards',selector:'.journal-grid'}
  ]},
  {label:'FAQs',path:'/faqs',items:[
    {key:'faqIntro',label:'FAQ introduction',selector:'.article-page > h1, .article-page > .lead'},
    {key:'faqQuestions',label:'Questions and answers',selector:'.article-page > .accordion'}
  ]},
  {label:'Sitewide',path:'*',items:[
    {key:'newsletter',label:'Newsletter signup',selector:'.newsletter-strip',target:'footer'}
  ]}
];

export const siteSectionKeys=siteSectionGroups.flatMap(group=>group.items.map(item=>item.key));
