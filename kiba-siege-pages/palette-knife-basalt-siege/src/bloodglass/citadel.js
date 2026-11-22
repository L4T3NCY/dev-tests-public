import * as THREE from 'three';
import {MasonryBatch,stone,trim,roof,iron,seeded,choose,glassMaterial,metalMaterial} from './kit.js';
import {growWallVines,growIvyMantle} from './garden.js';

const halfTurn = Math.PI * .5;
const basaltAccent = [0x302d45,0x3b344d,0x514157];
const garnet = [0x89384c,0x773648,0x68293e];
const archShape = new THREE.Shape();
archShape.moveTo(-.5,0);
archShape.lineTo(.5,0);
archShape.lineTo(.5,.62);
archShape.quadraticCurveTo(.48,.80,0,1);
archShape.quadraticCurveTo(-.48,.80,-.5,.62);
archShape.closePath();
const lancet = new THREE.ShapeGeometry(archShape,14);
const positions = lancet.attributes.position;
for (let i=0;i<positions.count;i++) lancet.attributes.uv.setXY(i,positions.getX(i)+.5,positions.getY(i));
const roundGlass = new THREE.CircleGeometry(.5,72);
const glassShade = glassMaterial.clone();
const roseShade = glassMaterial.clone();
const brassRing = new THREE.TorusGeometry(.5,.024,6,56);

function prepareGlass(material,radial) {
  material.defines={USE_UV:'', ...(radial?{ROSE_GLASS:1}:{})};
  material.customProgramCacheKey = () => radial?'bloodglass-rose':'bloodglass-lancet';
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 p=vUv-.5;
      #ifdef ROSE_GLASS
        float angle=atan(p.y,p.x)*1.9098593;
        float radius=length(p);
        vec2 panes=vec2(angle, radius*7.1+.25*sin(angle*6.2832));
      #else
        vec2 panes=vUv*vec2(4.,9.);
        panes.x+=mod(floor(panes.y),2.)*.5;
      #endif
      vec2 cell=floor(panes), edge=min(fract(panes),1.-fract(panes));
      float gain=fract(sin(dot(cell,vec2(19.4,33.2)))*4175.41);
      float lead=smoothstep(.018,.090,min(edge.x,edge.y));
      vec3 ruby=mix(vec3(.56,.32,.90),vec3(1.40,2.8,1.50),gain*gain);
      float shimmer=.86+.14*sin(vUv.x*83.+sin(vUv.y*71.));
      diffuseColor.rgb*=mix(vec3(.027),ruby*shimmer,lead);
    `);
  };
}
prepareGlass(glassShade,false);
prepareGlass(roseShade,true);

function facade(x,z,y,turn) {
  const c=Math.cos(turn),s=Math.sin(turn);
  return (u,v,d=0)=>[x+u*c+d*s,y+v,z-u*s+d*c];
}

export function makeCitadel() {
  const group = new THREE.Group();
  const kit = new MasonryBatch();
  const random = seeded(0x8c7e1e);
  const pick = palette => choose(random,palette);
  const lightAnchors = [];
  function window(at,turn,x,y,w,h,hero=false) {
    const glow = new THREE.Color(0xff382e).multiplyScalar((hero?2.85:1.75)+random()*.8);
    kit.instance(lancet,glassMaterial,at(x,y-.045,.114),[w+.125,h+.12,1],0x130b20,turn,false);
    kit.instance(lancet,glassShade,at(x,y,.122),[w,h,1],glow,turn,false);
    const jamb = hero?.115:.078;
    for (const sign of [-1,1]) {
      for(let row=0;row<Math.ceil(h*.62/.26);row++){
        const step=h*.62/Math.ceil(h*.62/.26);
        kit.block(at(x+sign*(w*.5+.045),y+(row+.5)*step,.155),
          [jamb,step*.96,jamb],pick(trim),turn);
      }
      for (let i=0;i<6;i++) {
        const t=i/6, next=(i+1)/6;
        const point = v => at(x+sign*(w*.5+.06)*(1-v*v),y+h*(.62+.38*v),.168);
        kit.beam(point(t),point(next),jamb,pick(trim),true);
      }
    }
    kit.block(at(x,y-.025,.158),[w+.31,.10,.28],pick(trim),turn);
    kit.beam(at(x,y,.151),at(x,y+h*.91,.151),hero?.042:.026,pick(iron),true);
    kit.beam(at(x-w*.48,y+h*.37,.151),at(x+w*.48,y+h*.37,.151),.027,pick(iron),true);
    if(hero)lightAnchors.push(at(x,y+h*.44,.49));
  }

  function roseWindow(at,turn,x,y,size) {
    const glow=new THREE.Color(0xff292f).multiplyScalar(3.55);
    kit.instance(roundGlass,glassMaterial,at(x,y,.134),[size*1.17,size*1.17,1],0x221124,turn,false);
    kit.instance(roundGlass,roseShade,at(x,y,.149),[size,size,1],glow,turn,false);
    for(const s of [1.12, .94, .31])kit.instance(brassRing,metalMaterial,at(x,y,.192),[size*s,size*s,size*.50],0xa76b70,turn);
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6,b=a+.27;
      const u=Math.cos(a),v=Math.sin(a);
      kit.beam(at(x+u*size*.13,y+v*size*.13,.20),at(x+u*size*.49,y+v*size*.49,.20),.033,0x5e3544);
      kit.beam(at(x+u*size*.13,y+v*size*.13,.21),at(x+Math.cos(b)*size*.39,y+Math.sin(b)*size*.39,.21),.025,0x663646);
    }
    lightAnchors.push(at(x,y,.58));
  }

  function wall(x,y,z,w,d,h,windows,options={}) {
    const palette=options.palette??stone;
    const rowHeight=options.row??.30;
    kit.block([x,y+h*.5,z],[w-.13,h,d-.13],palette[2],0,false);
    const sides=[
      [facade(x,z+d*.5,y,0),0,w], [facade(x+w*.5,z,y,halfTurn),halfTurn,d],
      [facade(x,z-d*.5,y,Math.PI),Math.PI,w], [facade(x-w*.5,z,y,-halfTurn),-halfTurn,d]
    ];
    for(const [at,turn,length] of sides){
      for(let cy=rowHeight*.5;cy<h;cy+=rowHeight){
        let x0=-length*.5;
        while (x0<length*.5-.05) {
          const requested=.38+random()*.63;
          const bw=Math.min(length*.5-x0,requested);
          const ledge=random()<.18;
          const color=pick(palette);
          kit.block(at(x0+bw*.5,cy+(random()-.5)*.026,ledge?.006:-.024),
            [bw-.022,rowHeight-.022,ledge?.178:.13],color,turn,false,false);
          x0+=bw;
        }
      }
      for (let y0=.09;y0<h;y0+=1.90) {
        if(y0>0.11 && !options.bands) continue;
        kit.block(at(0,y0,.045),[length+.12,.13,.29],pick(trim),turn);
      }
      const openings=windows(length,turn);
      for(const [u,v,width,height,hero] of openings){
        if(v+height>=h+.015)continue;
        window(at,turn,u,v,width,height,hero);
      }
      for(const x0 of [-length*.5+.13,length*.5-.13]){
        for(let y0=.19;y0<h;y0+=.41) {
          kit.block(at(x0,y0,.058),[.24+(Math.round(y0/.41)%2)*.11,.37,.20],pick(trim),turn,false,false);
        }
      }
      const vineFace=options.vines?.find(([angle])=>angle===turn);
      if(vineFace){
        const clearances=turn===0&&options.roseClearance?[...openings,[0,3,.92*2,1.8]]:openings;
        const vineSeed=Math.floor(1e8*random());
        growWallVines(kit,at,turn,length,h,clearances,vineFace[1],vineSeed);
        if(options.ivyMantles?.includes(turn))growIvyMantle(kit,at,turn,length,h,clearances,vineSeed^0x2a9168);
      }
    }
    return sides;
  }

  function parapet(x,z,y,w,d,spikes=false) {
    kit.block([x,y,z],[w+.48,.17,d+.48],pick(trim));
    kit.block([x,y+.17,z],[w+.35,.18,d+.35],pick(basaltAccent));
    for (const [turn,width,depth] of [[0,w,d],[halfTurn,d,w],[Math.PI,w,d],[-halfTurn,d,w]]) {
      const at=facade(x+Math.sin(turn)*(depth*.5+.08),z+Math.cos(turn)*(depth*.5+.08),y+.25,turn);
      kit.block(at(0,.05),[width+.27,.28,.22],pick(stone),turn);
      for (let u=-width*.5+.15;u<width*.5;u+=.54) {
        kit.block(at(u,.27),[.27,.38,.25],pick(trim),turn);
        kit.block(at(u,.47),[.34,.073,.28],pick(basaltAccent),turn);
      }
    }
    if(spikes)for(const dx of [-1,1])for(const dz of [-1,1]){
      const pos=[x+dx*(w*.5-.03),y+.50,z+dz*(d*.5-.03)];
      kit.block(pos,[.58,.78,.58],pick(trim),Math.PI*.25);
      kit.block([pos[0],y+.91,pos[2]],[.69,.14,.69],pick(roof),Math.PI*.25);
      kit.spike([pos[0],y+1.57,pos[2]],[.57,1.30,.57],pick(roof),Math.PI*.25);
      kit.beam([pos[0],y+2.16,pos[2]],[pos[0],y+2.51,pos[2]],.045,pick(iron));
    }
  }

  function tower(x,y,z,w,d,h,spireHeight,options={}) {
    const count=options.rows??Math.max(1,Math.floor((h-1.1)/1.68));
    const floors=[];
    for(let level=0;level<count;level++)floors.push(.64+level*1.62);
    wall(x,y,z,w,d,h,(length,turn)=>{
      if (options.unlit) return [];
      if (length>2.8) return floors.flatMap(v=>[-.62,.62].map(u=>[u,v,.47,.96,turn===0&&v>2.7]));
      return floors.map(v=>[0,v,Math.min(.44,length*.40),.96,false]);
    },options);
    let top=y+h;
    parapet(x,z,top,w,d,options.cornerSpikes);
    if (spireHeight>0) {
      kit.block([x,top+.37,z],[w*.74,.15,d*.74],pick(trim));
      kit.spike([x,top+.41+spireHeight*.5,z],[w*.94,spireHeight,d*.94],pick(roof),Math.PI*.25);
      for(let i=0;i<6;i++){
        const fraction=i/7, radius=(1-fraction)*.65;
        const yy=top+.48+fraction*spireHeight;
        kit.block([x,yy,z],[w*radius,.065,d*radius],pick(roof),0,false);
      }
      const tip=top+spireHeight+.46;
      kit.beam([x,tip-.13,z],[x,tip+.49,z],.052,pick(iron));
      kit.beam([x-.14,tip+.28,z],[x+.14,tip+.28,z],.034,pick(iron),true);
    }
  }

  // West gatehouse, elevated bridge, and lower watch court.
  tower(-7.25,.18,-.38,2.15,2.05,3.02,0,{bands:true,palette:[...stone,...garnet],
    vines:[[0,[-.80,.79]],[-halfTurn,[.65]]],ivyMantles:[0]});
  tower(-7.43,2.87,-1.12,1.15,1.11,1.72,1.50,{row:.23});
  tower(-6.35,.20,-4.72,1.90,1.80,5.85,2.21,{bands:true});
  tower(-3.37,.20,-4.18,2.31,2.49,7.37,2.42,{bands:true,cornerSpikes:true,
    vines:[[Math.PI,[-.78,.79]]],ivyMantles:[Math.PI]});
  tower(-1.18,.18,-5.48,1.46,1.60,5.74,2.18,{row:.24});
  tower(4.02,.19,-4.94,2.10,1.78,7.69,2.66,{cornerSpikes:true});
  tower(7.37,.18,-2.54,1.33,1.39,4.84,1.88,{row:.23});
  tower(7.62,.18,2.77,1.29,1.30,4.23,1.81,{row:.23});

  function bridge(x1,x2,z,y,bays) {
    const length=x2-x1,bay=length/bays;
    kit.block([(x1+x2)*.5,y,z],[length,.32,1.33],pick(stone));
    for(let i=0;i<=bays;i++){
      const x=x1+bay*i;
      kit.block([x,y-1.43,z],[.22,2.58,1.03],pick(stone));
      kit.block([x,y-.88,z],[.41,.14,1.28],pick(trim));
    }
    for(let i=0;i<bays;i++)for(const side of [-1,1]){
      const cx=x1+bay*(i+.5);
      const arch=t=>[cx+t*bay*.50,y-.21-(Math.abs(t)**1.4)*1.42,z+.47*side];
      for(let j=0;j<14;j++)kit.beam(arch(-1+j/7),arch(-1+(j+1)/7),.18,pick(trim),true);
    }
    for(const side of [-1,1]){
      const zz=z+side*.61;
      kit.block([(x1+x2)*.5,y+.49,zz],[length,.093,.12],pick(trim));
      for(let x=x1+.22;x<x2;x+=.39)kit.block([x,y+.31,zz],[.15,.29,.12],pick(stone));
    }
  }
  bridge(-7.2,-1.4,-.65,3.03,3);
  bridge(-7.0,-2.7,-3.87,4.42,2);
  bridge(.1,4.4,-4.32,6.21,2);

  // Tall square belfry with stacked lancets, crown, and flying ribs.
  tower(.0,.20,-2.13,3.77,3.32,7.37,0,{bands:true,palette:[...stone,...garnet],vines:[[0,[-1.50,1.50]]]});
  const belfry=wall(.12,7.71,-2.11,3.03,2.69,4.45,
    (width,turn)=>[[-.54,.62,.52,2.94,turn===0],[.54,.62,.52,2.94,turn===0]],
    {palette:[...stone,0x81515d,0x593b4e],row:.27});
  for(const [at,turn,width] of belfry){
    kit.block(at(0,3.78,.1),[width+.16,.18,.28],pick(trim),turn);
    for(const u of [-width*.42,0,width*.42]) {
      kit.block(at(u,2.04,.13),[.175,3.30,.22],pick(trim),turn);
      kit.spike(at(u,4.03,.12),[.31,.92,.33],pick(roof),turn);
    }
  }
  parapet(.12,-2.11,12.23,3.08,2.73,true);
  kit.spike([.12,13.09,-2.11],[1.51,1.65,1.35],pick(roof),Math.PI*.25);
  kit.beam([.12,13.86,-2.11],[.12,14.64,-2.11],.054,pick(iron));

  // The nave has a distinct high gable and a large hand-built rose window.
  const x=4.33,z=.23,w=4.51,d=5.64,y=.21,h=4.90;
  const [front]=wall(x,y,z,w,d,h,(width,turn)=>{
    if(turn===0)return [[-1.51,.51,.58,2.1,true],[1.51,.51,.58,2.1,true],[0,.28,1.18,2.50,true]];
    return [-1.74,-.56,.62,1.80].filter(u=>Math.abs(u)<width*.5-.3).map(u=>[u,.82,.62,2.79,false]);
  },{palette:[...stone,0x684254],row:.275,roseClearance:true,ivyMantles:[halfTurn],
    vines:[[0,[-2.11,-1.90,1.92,2.12]],[halfTurn,[-2.58,-1.10,.04,1.15,2.59]],[Math.PI,[-1.11,1.21]]]});

  function gableRoof(cx,cy,cz,width,depth,rise) {
    const slope=Math.atan2(rise,width*.5);
    const shape=new THREE.Shape();
    shape.moveTo(-width*.5,0); shape.lineTo(width*.5,0); shape.lineTo(0,rise); shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});
    geometry.translate(0,0,-depth*.5);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x51384a,roughness:.9}));
    mesh.position.set(cx,cy,cz);
    mesh.castShadow=mesh.receiveShadow=true;
    group.add(mesh);
    const slopeLength=Math.hypot(width*.5,rise);
    for(const side of [-1,1]){
      const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-side*slope);
      for(let a=.08;a<slopeLength;a+=.23){
        const run=a/slopeLength;
        const offset=Math.floor(a/.23)%2*.11;
        for(let b=-depth*.5+.04;b<depth*.5;b+=.32){
          kit.block([cx+side*run*width*.5,cy+rise*(1-run)+.048,cz+b+offset],
            [.274,.074,.328],pick(roof),q,false,false);
        }
      }
      for(const zz of [cz-depth*.5-.09,cz+depth*.5+.095]){
        kit.beam([cx,cy+rise+.06,zz],[cx+side*(width*.5+.08),cy+.0,zz],.16,pick(trim),true);
        for(let j=0;j<9;j++){
          const u=j/9;
          kit.spike([cx+side*u*width*.5,cy+rise*(1-u)+.17,zz],[.18,.36,.17],pick(trim));
        }
      }
    }
    kit.beam([cx,cy+rise+.15,cz-depth*.5-.12],[cx,cy+rise+.15,cz+depth*.5+.12],.16,pick(roof),true);
  }
  gableRoof(x,y+h,z,w+.40,d+.28,2.38);
  roseWindow(front[0],front[1],0,3.88,1.57);
  for (const sign of [-1,1]) {
    const zz=z+sign*(d+.28)*.5;
    const turn=sign===1?0:Math.PI;
    const face=facade(x,zz,y+h,turn);
    // Carved blind arcades and a smaller upper window dress both gables.
    for (const u of [-1.39,-.92,.92,1.39]) {
      const rise=Math.abs(u)>1.1?.42:.85;
      const sill=.13;
      const leg=.084;
      for(const s of [-1,1]){
        kit.beam(face(u+s*.108,sill,.05),face(u+s*.108,sill+rise*.68,.05),leg,pick(trim),true);
        kit.beam(face(u+s*.108,sill+rise*.68,.05),face(u,sill+rise,.05),leg,pick(trim),true);
      }
      kit.block(face(u,sill,.07),[.31,.075,.18],pick(roof),turn);
    }
    window(face,turn,0,.25,.39,1.34,false);
    kit.block(face(0,1.91,.04),[.27,.27,.16],0x7d6476,turn);
    for(let row=0;row<5;row++){
      const v=.11+row*.30, half=widthOfGable(v);
      for(let u=-half+.12;u<half-.10;u+=.29) {
        if(Math.abs(u)<.32)continue;
        kit.block(face(u,v,.012),[.265,.071,.07],pick(stone),turn,false,false);
      }
    }
  }
  function widthOfGable(v) {
    return (w+.40)*.5*(1-v/2.38)-.13;
  }
  for(const side of [-1,1]){
    for(let bay=-1.85;bay<=1.95;bay+=1.20){
      const xx=x+side*(w*.5+.16);
      kit.block([xx,1.48,z+bay],[.37,2.56,.27],pick(trim));
      kit.spike([xx,2.98,z+bay],[.50,.96,.46],pick(trim),Math.PI*.25);
      kit.beam([xx+side*.63,1.57,z+bay],[xx,3.38,z+bay],.19,pick(trim),true);
      kit.block([xx+side*.61,.92,z+bay],[.29,1.73,.34],pick(stone));
      kit.spike([xx+side*.62,1.94,z+bay],[.40,.7,.38],pick(roof),Math.PI*.25);
    }
  }

  // Broad stairs to the chapel entry, two landings, and lower hanging parapet.
  for(let i=0;i<14;i++){
    const zz=3.22+i*.205,yy=.79-i*.047, breadth=2.0+.047*i;
    for(let j=0;j<6;j++){
      kit.block([x+(j-2.5)*breadth/6,yy*.5,zz],[breadth/6-.019,yy,.38],pick(stone));
    }
    for(const sign of [-1,1]){
      kit.block([x+sign*(breadth*.5+.11),yy+.16,zz],[.22,.32,.25],pick(trim));
    }
  }
  for(const xx of [2.0,6.80]) {
    kit.block([xx,.31,5.96],[.22,.48,.28],pick(trim));
    kit.spike([xx,.68,5.96],[.27,.32,.27],pick(roof));
  }
  for(let i=0;i<17;i++){
    const xx=-6.6+i*.48,zz=3.12+Math.sin(i*.34)*.43;
    kit.block([xx,.1,zz],[.46,.16,.83],pick(stone),.1*(random()-.5));
    if(i%3===0)kit.block([xx,.42,zz+.62],[.36,.52,.33],pick(trim));
  }
  for(const sign of [-1,1]){
    const dx=sign*.27;
    kit.beam([-7.03+dx,3.67,.67],[-7.03+dx,2.81,.67],.042,pick(iron));
    kit.beam([-7.30,3.68,.67],[-6.76,3.68,.67],.065,pick(iron));
  }
  kit.attach(group);
  return {group,lightAnchors};
}
