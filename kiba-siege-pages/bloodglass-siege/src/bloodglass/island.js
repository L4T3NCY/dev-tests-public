import * as THREE from 'three';
import {MasonryBatch,basalt,stone,seeded,choose} from './kit.js';

const turf = [0x261f2e,0x523041,0x623446,0x48334a,0x382c3e,0x74394a];
const flora = [0x8e263d,0xb72c3f,0xca4953,0xa33a55,0x723653,0x6d394e,0x963247];
const bark = [0x422c42,0x503040,0x342537];
export const falls = [
  {x:-3.82,y:.183,z:6.70,width:.94,length:9.6,direction:.18},
  {x:6.36,y:.16,z:5.69,width:.72,length:8.4,direction:-.30},
  {x:-8.15,y:.12,z:3.72,width:.38,length:6.4,direction:.56}
];

function footprint(x,z) {
  const angle=Math.atan2(z/7.0,(x+.25)/10.65);
  const lobe=1+.077*Math.sin(angle*3+.1)+.050*Math.cos(angle*7-.42);
  return Math.hypot((x+.25)/10.65,z/7.0)/lobe;
}

export function makeIsland() {
  const group = new THREE.Group();
  const kit = new MasonryBatch();
  const random=seeded(0x6a4b5c31);
  const pick=list=>choose(random,list);
  const cell=.52;
  for(let x=-11.3;x<11.4;x+=cell)for(let z=-7.7;z<7.7;z+=cell){
    const radius=footprint(x,z);
    if(radius>1)continue;
    const outer=radius>.87;
    const top=outer?.095+random()*.075:.107+random()*.055;
    const falloff=Math.pow(Math.max(.015,1-radius),.76);
    const seam=Math.sin(x*.78+z*1.17)*.65+Math.sin(x*.28-z*1.42)*.31;
    const spike=Math.exp(-((x-1.6)**2*.09+(z+.43)**2*.19))*2.7;
    const depth=.83+10.1*falloff+seam*.94+spike+random()*.59;
    kit.block([x,top-.44,z],[cell+.022,.88,cell+.021],pick(outer?basalt:turf),0,outer);
    if(outer || random()<.24) {
      kit.block([x+(random()-.5)*.094,top+.045,z+(random()-.5)*.094],
        [cell*(.77+random()*.23),.10,cell*(.73+random()*.28)],pick(outer?turf:stone));
    }
    // Vary the layer breaks across neighboring columns to suggest fractured strata.
    for(let lower=.87;lower<depth;){
      const size=Math.min(.42+random()*.94,depth-lower);
      const setback=(random()-.32)*.14;
      kit.block([x+setback,top-lower-size*.5,z+setback*.6],
        [cell+.025+random()*.11,size+.02,cell+.027+random()*.11],pick(basalt),
        (random()-.5)*.084,outer||size>.98,outer);
      lower+=size;
    }
  }

  for(const fall of falls){
    for(let i=0;i<19;i++){
      const angle=random()*Math.PI*2,r=.19+random()*.56;
      kit.block([fall.x+Math.cos(angle)*r*fall.width*1.26,.085+random()*.07,fall.z-.42+Math.sin(angle)*r*.96],
        [.13+random()*.18,.09+random()*.08,.20+random()*.22],pick(basalt),angle);
    }
  }

  const vines=[
    [-4.98,5.74,-2.51,.18],[-2.5,6.06,-2.72,.10],[6.92,5.13,-1.70,.13],
    [8.78,.62,-2.30,.17]
  ];
  for(const [x,z,lo,hi] of vines){
    const phase=random()*Math.PI*2;
    const strand=y=>[x+Math.sin(y*2.7+phase)*.17+Math.sin(y*6.3+phase)*.08,y,
      z+Math.max(0,-y)*.11];
    for(let y=lo;y+.13<=hi;y+=.13){
      const a=strand(y),b=strand(y+.13);
      kit.beam(a,b,.039,pick(bark));
      if(random()>.11){
        const twig=[b[0]+(random()-.5)*.31,b[1]+(random()-.32)*.17,b[2]+.04+random()*.12];
        kit.beam(b,twig,.018,pick(bark));
        kit.leaf(twig,[.098+random()*.075,.074,.109],pick(flora),random()*Math.PI);
      }
    }
  }
  kit.attach(group);

  const trees=[];
  for(const [x,z,height,lean] of [[-7.38,3.97,2.24,.66],[8.25,2.85,2.70,.76],[-4.65,-3.32,1.64,.52],[1.1,5.3,1.07,.36],[7.81,-3.9,1.73,.49]]){
    const tree=new THREE.Group();
    const timber=new MasonryBatch();
    const sway=new THREE.Group();
    tree.position.set(x,.15,z);
    const elbow=[-lean*.20,height*.44,.10];
    const upper=[-lean*.57,height*.75,.12];
    const top=[-lean,height,.19];
    timber.beam([0,0,0],elbow,height*.086,pick(bark));
    timber.beam(elbow,upper,height*.062,pick(bark));
    timber.beam(upper,top,height*.038,pick(bark));
    timber.attach(tree);
    sway.position.fromArray(elbow);
    const crown=new MasonryBatch();
    for(let i=0;i<9;i++){
      const a=i*2.39996,yy=height*(.03+i*.060),spread=height*(.55-i*.034);
      const a0=[-yy*.44,yy,0];
      const b=[-lean*.47+Math.cos(a)*spread*.49,yy+.13,Math.sin(a)*spread*.56];
      const c=[b[0]-lean*.36+Math.cos(a)*spread*.45,b[1]+.19+random()*.15,b[2]+Math.sin(a)*spread*.47];
      crown.beam(a0,b,height*.029,pick(bark)); crown.beam(b,c,height*.018,pick(bark));
      if(i===0||i===4||i===8)continue;
      for(let j=0;j<25;j++){
        const u=(random()-.5),v=(random()-.5),w=(random()-.5),size=.063+random()*.105;
        crown.leaf([c[0]+u*spread*.95,c[1]+v*spread*.51,c[2]+w*spread*.73],
          [size*1.45,size*.64,size],pick(flora),random()*Math.PI);
      }
    }
    crown.attach(sway);
    tree.add(sway);
    group.add(tree);
    trees.push(sway);
  }
  const grass=makeGrass(random);
  group.add(grass);
  return {group,update(t) {
    grass.material.uniforms.time.value=t;
    trees.forEach((tree,i)=>{
      tree.rotation.z=Math.sin(t*(1.21+i*.107)+i*1.76)*.037+Math.sin(t*(3.23+i*.21)+i*.63)*.014;
      tree.rotation.x=Math.sin(t*(1.09+i*.081)+i*1.37)*.028;
    });
  }};
}

function makeGrass(random) {
  const pos=[],colors=[],bend=[];
  const spots=[[-8.6,2],[-7.2,4.9],[-5.1,4.4],[-3.9,5.1],[-2.7,5.5],[-1.4,4.3],[.7,4.7],
    [2.1,5.8],[6.3,4.5],[7.3,4.9],[8.8,2.8],[8.9,.2],[7.8,-3.6],[4.7,-5.6],[1.3,-5.7],[-3.2,-5.6],[-7.2,-4.5]];
  function vertex(x,y,z,weight,col,shade) {
    pos.push(x,y,z); colors.push(col.r*shade,col.g*shade,col.b*shade); bend.push(weight);
  }
  for(const [cx,cz] of spots){
    for(let k=0;k<148;k++){
      const x=cx+(random()-.5)*2.41,z=cz+(random()-.5)*1.32;
      if(footprint(x,z)>.975)continue;
      const a=random()*Math.PI*2,h=.095+random()**1.75*.45,w=.008+random()*.021;
      const y=.146;
      const px=Math.cos(a)*w,pz=Math.sin(a)*w;
      const col=new THREE.Color(choose(random,flora));
      vertex(x-px,y,z-pz,0,col,.32);
      vertex(x+px,y,z+pz,0,col,.44);
      vertex(x-h*.36+px*.62,y+h*.62,z+pz,.48,col,.88);
      vertex(x-px,y,z-pz,0,col,.32);
      vertex(x-h*.36+px*.62,y+h*.62,z+pz,.48,col,.88);
      vertex(x-h*.52,y+h,z+pz*2,1,col,1.22);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));
  g.setAttribute('bend', new THREE.Float32BufferAttribute(bend,1));
  return new THREE.Mesh(g,new THREE.ShaderMaterial({
    side:THREE.DoubleSide,vertexColors:true,uniforms:{time:{value:0}},
    vertexShader:`attribute float bend;
      uniform float time; varying vec3 grassTint; varying float viewDepth;
      void main(){
        vec3 p=position;
        float wind=.5+.5*sin(p.x*.89+p.z*.63+time*2.2+.6*sin(time*.7+p.z));
        p.x-=bend*(wind*.23+.055*sin(p.z*3.+time*5.1));
        p.z+=bend*.051*sin(p.x*.77+time*2.0);
        grassTint=color*(.85+wind*.20);
        vec4 mv=modelViewMatrix*vec4(p,1.);
        viewDepth=-mv.z;
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:`varying vec3 grassTint; varying float viewDepth;
      void main(){
        gl_FragColor=vec4(mix(grassTint,vec3(.036,.025,.057),smoothstep(42.,118.,viewDepth)*.66),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
}
