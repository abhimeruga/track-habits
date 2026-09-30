import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const crcTable = Array.from({length:256}, (_, n) => { let c=n; for(let i=0;i<8;i++) c = c&1 ? 0xedb88320^(c>>>1) : c>>>1; return c>>>0; });
function chunk(type, data) { const name=Buffer.from(type), length=Buffer.alloc(4), crc=Buffer.alloc(4); length.writeUInt32BE(data.length); let c=0xffffffff; for(const byte of Buffer.concat([name,data])) c=crcTable[(c^byte)&255]^(c>>>8); crc.writeUInt32BE((c^0xffffffff)>>>0); return Buffer.concat([length,name,data,crc]); }
function insideRoundRect(x,y,left,top,right,bottom,r) { const cx=Math.max(left+r,Math.min(x,right-r)), cy=Math.max(top+r,Math.min(y,bottom-r)); return (x-cx)**2+(y-cy)**2<=r*r; }
function nearSegment(x,y,x1,y1,x2,y2,width) { const dx=x2-x1,dy=y2-y1,t=Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy))); return Math.hypot(x-(x1+t*dx),y-(y1+t*dy))<=width/2; }
function pixel(x,y) {
  let color=[17,17,19,255];
  if(insideRoundRect(x,y,144,156,368,372,28)) color=[244,244,245,255];
  if(nearSegment(x,y,177,221,205,249,28)||nearSegment(x,y,205,249,259,191,28)) color=[17,17,19,255];
  if(nearSegment(x,y,276,230,331,230,23)||nearSegment(x,y,182,294,330,294,23)) color=[94,94,99,255];
  if(Math.hypot(x-367,y-150)<=53) color=[168,168,173,255];
  return color;
}
function render(size) {
  const raw=Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++) { const row=y*(size*4+1); raw[row]=0; for(let x=0;x<size;x++) { const sums=[0,0,0,0]; for(let sy=0;sy<2;sy++) for(let sx=0;sx<2;sx++) { const sample=pixel((x+(sx+.5)/2)*512/size,(y+(sy+.5)/2)*512/size); for(let i=0;i<4;i++) sums[i]+=sample[i]; } for(let i=0;i<4;i++) raw[row+1+x*4+i]=Math.round(sums[i]/4); } }
  const header=Buffer.alloc(13); header.writeUInt32BE(size,0); header.writeUInt32BE(size,4); header[8]=8; header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
for(const size of [192,512]) await writeFile(join(root,`icon-${size}.png`),render(size));
