import * as THREE from 'three';
import {MasonryBatch,seeded,choose,leafMaterial} from './kit.js';

const ivy=[0x354935,0x47603c,0x546546,0x60734a,0x705f45,0x493943];
const bark=[0x322935,0x3c3435,0x50423c];
const petals=[0x8b1231,0xbd1737,0xf04456,0xd92442,0xf55b67];
const petal=new THREE.IcosahedronGeometry(1,0);
const ivyLeaf=new THREE.BufferGeometry();
const leafOutline=[
  [0,.72,.015],[-.22,.37,0],[-.51,.25,-.054],[-.27,-.03,-.033],
  [-.29,-.34,0],[0,-.52,.033],[.29,-.34,-.024],[.25,-.05,.023],
  [.50,.23,-.053],[.22,.35,.04]
];
ivyLeaf.setAttribute('position',new THREE.Float32BufferAttribute(
  leafOutline.flatMap((point,i)=>[0,.09,.16,...point,...leafOutline[(i+1)%leafOutline.length]]),3));
ivyLeaf.computeVertexNormals();
const mantlePaint=[0x435635,0x466746,0x536947,0x657344,0x344f3e,0x627653,0x75835a,0x3c5745,0x625744];

export function growIvyMantle(kit,at,turn,width,height,windows,seed) {
  const random=seeded(seed);
  const open=(u,y,margin)=>windows.every(([x,b,w,h])=>
    Math.abs(u-x)>w*.5+margin||y<b-margin||y>b+h+margin);
  const candidates=[];
  const phase=random()*6.28;
  // Rank patches with broad and small wavelengths so holes collect in
  // irregular channels. The bottom is thicker and the tips break apart.
  const cols=Math.ceil(width/.148), rows=Math.ceil(height/.151);
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const u=((col+.5)/cols-.5)*width+(random()-.5)*.036;
    const y=(row+.5)/rows*height+(random()-.5)*.036;
    if(!open(u,y,.14))continue;
    const channel=Math.sin(u*3.51+y*1.57+phase)+.59*Math.cos(y*1.75-u*2.18+phase);
    const notch=.38*Math.sin(u*8.56-y*5.27)+.26*Math.sin(y*4.1+u*5.17);
    const score=channel+notch+.79*(1-y/height)+random()*.40;
    candidates.push({u,y,score});
  }
  candidates.sort((a,b)=>b.score-a.score);
  for(const {u,y,score} of candidates.slice(0,Math.round(candidates.length*.80))){
    const lush=1-y/height;
    const size=.135+random()*.086+lush*.048;
    const q=new THREE.Quaternion().setFromEuler(
      new THREE.Euler((random()-.5)*.61,turn,(random()-.5)*2.86,'YXZ'));
    kit.instance(ivyLeaf,leafMaterial,at(u,y,.172+random()*.060),
      [size,size*(.90+random()*.19),size*.88],choose(random,mantlePaint),q,false);
    if(score>1.05&&random()<.38){
      const v=u+(random()-.5)*.122, h=y+(random()-.45)*.143;
      if(open(v,h,.15))kit.instance(ivyLeaf,leafMaterial,at(v,h,.228+random()*.079),
        [size*.83,size*.87,size],choose(random,mantlePaint),q,false);
    }
  }
}

export function growWallVines(kit,at,turn,width,height,windows,anchors,seed) {
  const random=seeded(seed);
  const avoid=(x,y,margin)=>windows.some(([a,b,w,h])=>
    Math.abs(x-a)<w*.5+margin&&y>b-margin&&y<b+h+margin);
  for(const anchor of anchors){
    const length=Math.min(height-.32,1.9+random()*height*.67);
    const phase=random()*6.28;
    let last=null,x=anchor;
    for(let y=.025;y<length;y+=.115) {
      const fade=1-y/length;
      const sway=anchor+Math.sin(y*2.25+phase)*.13+Math.sin(y*5+phase)*.045;
      x=THREE.MathUtils.clamp(sway,x-.084,x+.084);
      for(const sign of [x<anchor?1:-1,x<anchor?-1:1]){
        if(!avoid(x,y,.091))break;
        const alt=x+sign*.085;
        if(!avoid(alt,y,.091)&&Math.abs(alt)<width*.5-.055)x=alt;
      }
      if(avoid(x,y,.091)||Math.abs(x)>width*.5+.025){last=null;continue;}
      const stem=at(x,y,.15);
      if(last)kit.beam(last,stem,.014+.029*fade,choose(random,bark));
      last=stem;
      for(const side of [-1,1]) {
        if(random()>.23+.75*fade)continue;
        const leafX=x+side*(.057+random()*(.085+.12*fade)),leafY=y+.035+random()*.069;
        const size=.053+random()*.119*fade;
        if(avoid(leafX,leafY,.10+size*.63))continue;
        const tip=at(leafX,leafY,.158+random()*.063);
        kit.beam(stem,tip,.015,choose(random,bark));
        const tilt=new THREE.Quaternion().setFromEuler(new THREE.Euler(.23,turn,(random()-.5)*1.37,'YXZ'));
        kit.leaf(tip,[size,size*1.24,.026],choose(random,ivy),tilt);
      }
    }
  }
}

export function makeRoseGarden() {
  const group=new THREE.Group(), shrubs=[];
  const random=seeded(0x31b172);
  for(const [x,z,size] of [
    [-6.16,2.01,.86],[-5.38,4.21,1.13],[-4.89,5.52,.82],[-2.54,5.43,1.02],
    [-2.03,3.69,.91],[-.34,4.83,.73],[2.14,5.72,.80],[6.18,5.02,1.01],
    [8.05,3.9,.87],[7.66,-1.42,1.05],[-5.97,-4.62,.87]
  ]){
    const bush=new THREE.Group(),kit=new MasonryBatch();
    bush.position.set(x,.21,z);
    bush.scale.setScalar(size);
    for(let i=0;i<20;i++){
      const a=2.39996*i;
      const radius=.12+Math.sqrt(random())*.40,h=.25+random()*.38-radius*.22;
      const tip=[Math.cos(a)*radius,h,Math.sin(a)*radius];
      kit.beam([tip[0]*.34,0,tip[2]*.34],tip,.025,choose(random,bark));
      for(let j=0;j<4;j++){
        const r=.10+random()*.085, phase=a+j*2.39996;
        const y=h-(.06+j*.055);
        const p=[tip[0]*(1-j*.10)+r*Math.cos(phase),y,tip[2]*(1-j*.1)+r*Math.sin(phase)];
        kit.leaf(p,[.15+random()*.08,.051,.12],choose(random,ivy),phase);
      }
      if(i%5===0)continue;
      const r=.059+random()*.048;
      const frame=new THREE.Quaternion().setFromEuler(new THREE.Euler(.41*Math.cos(a),a,.41*Math.sin(a)));
      for(let ring=0;ring<3;ring++)for(let j=0;j<(ring===0?5:ring===1?4:3);j++){
        const n=ring===0?5:ring===1?4:3, angle=j/n*Math.PI*2+ring*.76;
        const radius=r*(.70-ring*.22);
        const theta=new THREE.Quaternion().setFromEuler(new THREE.Euler(.33+ring*.195,angle,0,'YXZ')).premultiply(frame);
        const p=new THREE.Vector3(Math.sin(angle)*radius,ring*r*.20,Math.cos(angle)*radius).applyQuaternion(frame);
        kit.instance(petal,leafMaterial,[tip[0]+p.x,tip[1]+p.y,tip[2]+p.z],
          [r*(.72-ring*.14),r*(.39-ring*.055),r*.64],petals[(i+j+ring)%petals.length],theta,false);
      }
    }
    kit.attach(bush);
    group.add(bush);
    shrubs.push({bush,phase:random()*6.28,frequency:1.02+random()*.66});
  }
  return {group,update(time) {
    for(const {bush,phase,frequency} of shrubs) {
      bush.rotation.z=.019*Math.sin(time*frequency+phase)+.007*Math.sin(time*3.3-phase);
      bush.rotation.x=.012*Math.cos(time*(frequency+.19)+phase*.73);
    }
  }};
}
