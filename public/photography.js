// Locally hosted Pexels photography. Source links and credits: /assets/photos/CREDITS.md.
export const photos={
  hero:{src:'/assets/photos/hero-care.jpg',alt:'Woman applying an under-eye patch while looking in a mirror'},
  routine:{src:'/assets/photos/daily-ritual.jpg',alt:'Applying moisturiser as part of a daily skincare routine'},
  care:{src:'/assets/photos/hand-care.jpg',alt:'Hands gently applying moisturising cream'},
  cleanser:{src:'/assets/photos/cleanser.jpg',alt:'Unlabelled pump bottle and reusable cotton pads in warm sunlight'},
  cream:{src:'/assets/photos/cream.jpg',alt:'An open moisturiser jar and cream texture on marble'},
  sunscreen:{src:'/assets/photos/sunscreen.jpg',alt:'Unlabelled skincare tube resting in a ceramic dish'},
  serum:{src:'/assets/photos/serum.jpg',alt:'Hands holding an unlabelled serum dropper bottle'},
  dropper:{src:'/assets/photos/dropper.jpg',alt:'Hand holding an unlabelled amber glass dropper bottle'},
  texture:{src:'/assets/photos/serum-texture.jpg',alt:'A close view of a drop falling from a skincare pipette'},
  body:{src:'/assets/photos/body-care.jpg',alt:'Applying lotion to a shoulder'},
};
export const categoryPhotos={'Cleansers':'cleanser','Moisturisers':'cream','Sunscreens':'sunscreen','Serums':'serum','Acne care':'dropper','Dark spot care':'texture','Body care':'body'};
export const samplePhotos={'daily-cleanser':'cleanser','barrier-cream':'cream','daily-sunscreen':'sunscreen','hydration-serum':'serum','clarifying-serum':'dropper','body-lotion':'body','even-tone':'texture'};
export function photograph(key,cls='',priority=false){
  const p=photos[key]||photos.care;
  return `<img class="${cls}" src="${p.src}" alt="${p.alt}" width="800" height="1000" ${priority?'fetchpriority="high"':'loading="lazy"'} decoding="async">`;
}
