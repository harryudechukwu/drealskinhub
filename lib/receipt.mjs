const ascii=value=>String(value??'').normalize('NFKD').replace(/[^\x20-\x7e]/g,'?');
const escapePdf=value=>ascii(value).replace(/[\\()]/g,'\\$&');
const wrap=(value,width=76)=>{
  const words=ascii(value).split(/\s+/);const lines=[];let line='';
  for(const word of words){if((line+' '+word).trim().length>width&&line){lines.push(line);line='';}line+=(line?' ':'')+word;}
  if(line)lines.push(line);return lines;
};
const naira=value=>`NGN ${Number(value||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export function receiptPdf(order) {
  if(order.paymentStatus!=='verified'||!order.receipt)throw new Error('This receipt has not been issued.');
  const r=order.receipt,lines=[
    'DREALSKINHUB  |  PAYMENT RECEIPT','',
    `Receipt: ${r.id}`,`Issued: ${new Date(r.issuedAt).toUTCString()}`,
    `Order: ${order.id}`,`Customer: ${order.customer.name}`,
    `Email: ${order.customer.email}`,'',
    'ITEMS',
    ...order.items.map(item=>`${item.name} (${item.size})  x${item.quantity}  ${naira(item.price*item.quantity)}`),
    '',`Subtotal: ${naira(order.subtotal)}`,`Discount: ${naira(order.discount)}`,
    `Delivery: ${naira(order.shipping)}`,`TOTAL PAID: ${naira(order.total)}`,'',
    `Bank reference: ${r.bankReference||'Verified by bank statement'}`,
    'Payment: manually verified bank transfer','',
    'Thank you for shopping with DrealSkinhub.'
  ].flatMap(line=>wrap(line));
  const pages=[];for(let i=0;i<lines.length;i+=48)pages.push(lines.slice(i,i+48));
  const objects=['','<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  for(const page of pages){
    const pageId=objects.length,streamId=pageId+1;
    const content=['BT','/F1 11 Tf','48 790 Td',...page.flatMap((line,i)=>[i?'0 -15 Td':'',`(${escapePdf(line)}) Tj`]).filter(Boolean),'ET'].join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content,'ascii')} >>\nstream\n${content}\nendstream`);
  }
  objects[2]=`<< /Type /Pages /Kids [${pages.map((_,i)=>`${4+i*2} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  let pdf='%PDF-1.4\n';const offsets=[0];
  for(let i=1;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf,'ascii'));pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
  const start=Buffer.byteLength(pdf,'ascii');pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for(const offset of offsets.slice(1))pdf+=`${String(offset).padStart(10,'0')} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(pdf,'ascii');
}
