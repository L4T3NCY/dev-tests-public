import * as THREE from 'three';
import {makeSpellOrbs} from './spell-orbs.js';
import {makeBrushCasts} from './brush-casts.js';
import {art} from '../bloodglass/art-direction.js';

const capacity=1500;
const point=new THREE.Vector3(),axis=new THREE.Vector3(),normal=new THREE.Vector3(0,1,0);

export function makeSiegeEffects() {
  const group=new THREE.Group(), dots=new THREE.BufferGeometry();
  const positions=new Float32Array(capacity*3),velocities=new Float32Array(capacity*3);
  const tints=new Float32Array(capacity*3),style=new Float32Array(capacity*3),maxLife=new Float32Array(capacity);
  for(const [key,data] of [['position',positions],['tint',tints],['style',style]]){
    dots.setAttribute(key,new THREE.BufferAttribute(data,3).setUsage(THREE.DynamicDrawUsage));
  }
  dots.setDrawRange(0,0);
  const viewport={value:720};
  const points=new THREE.Points(dots,new THREE.ShaderMaterial({
    depthWrite:false,transparent:true,blending:art.woodcut?THREE.NormalBlending:THREE.AdditiveBlending,uniforms:{viewport},
    vertexShader:`
      uniform float viewport;attribute vec3 tint;attribute vec3 style;
      varying vec3 color;varying vec2 life;
      void main(){
        color=tint;life=style.yz;
        vec4 p=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*p;
        gl_PointSize=clamp(viewport*style.x*projectionMatrix[1][1]/max(1.,-p.z),1.,22.);
      }`,
    fragmentShader:`
      varying vec3 color;varying vec2 life;
      void main(){
        vec2 p=(gl_PointCoord-.5)*2.;
        float orb=exp(-dot(p,p)*4.4);
        float chip=1.-smoothstep(.48,.72,abs(p.x)+abs(p.y)*.8);
        float alpha=mix(orb,chip,life.y)*life.x;
        if(alpha<.016)discard;
        gl_FragColor=vec4(color,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  points.frustumCulled=false;
  group.add(points);

  const orbs=makeSpellOrbs(), brush=makeBrushCasts();
  group.add(orbs.group,brush.group);
  let cursor=0,visualSeed=0x93ef008,drawCount=0,wallBudget=100;
  const wallTint=[.59,.50,.46],sparkTint=[1.43,1.17,.97],bloodTint=[1.23,.014,.064];
  const random=()=>(visualSeed=(Math.imul(1664525,visualSeed)+1013904223)>>>0)/4294967296;
  function spark(at,vx,vy,vz,tint,size,life,chip=0){
    const i=cursor++%capacity,p=i*3;
    at.toArray(positions,p);
    velocities[p]=vx;velocities[p+1]=vy;velocities[p+2]=vz;
    tints.set(tint,p);
    style[p]=size;style[p+1]=1;style[p+2]=chip;
    maxLife[i]=life;
    drawCount=Math.max(drawCount,i+1);
  }
  function burst(position,count,power,kind) {
    if(kind==='wall'){
      count=Math.min(count,wallBudget);
      wallBudget-=count;
    }
    for(let i=0;i<count;i++){
      const a=random()*6.28318, y=random()*2-1, r=Math.sqrt(1-y*y);
      const v=(.39+random()*.61)*power;
      const tint=kind==='wall'?wallTint:i%4===0?sparkTint:bloodTint;
      spark(position,Math.cos(a)*r*v,y*v+.43,Math.sin(a)*r*v,tint,.025+random()*.079,.25+random()*.64,
        kind==='wall'||i%4===0?1:0);
    }
  }
  function lash(from,to,impact=true){
    brush.cast(from,to);
    axis.subVectors(to,from).normalize();
    const right=new THREE.Vector3().crossVectors(axis,normal).normalize();
    if(right.lengthSq()<.01)right.set(1,0,0);
    const up=new THREE.Vector3().crossVectors(axis,right);
    for(let strand=0;strand<2;strand++)for(let i=0;i<17;i++){
      const t=i/16*(impact?1:.91),helix=t*14+strand*2.093;
      const r=Math.sin(Math.PI*t)*(.19+.25*t);
      point.lerpVectors(from,to,t).addScaledVector(right,Math.cos(helix)*r)
        .addScaledVector(up,Math.sin(helix)*r+.31*Math.sin(Math.PI*t));
      const speed=.3+random()*.5;
      spark(point,-Math.cos(helix)*speed,(random()-.26)*.8,-Math.sin(helix)*speed,
        strand===0?[1.18,.56,.40]:[.94,.012,.062],.029+random()*.033,.16+t*.21+random()*.13,1);
    }
    orbs.release(from,true);
    if(impact){
      orbs.release(to);
      burst(to,38,3.25,'blood');
    }
  }
  function update(dt,time){
    wallBudget=100;
    let visible=0;
    for(let i=0;i<drawCount;i++){
      const p=i*3;
      if(style[p+1]<=0)continue;
      style[p+1]=Math.max(0,style[p+1]-dt/maxLife[i]);
      if(style[p+1]>0)visible=i+1;
      positions[p]+=velocities[p]*dt;
      positions[p+1]+=velocities[p+1]*dt;
      positions[p+2]+=velocities[p+2]*dt;
      velocities[p+1]-=dt*(style[p+2]>.5?4.0:.65);
    }
    orbs.update(dt,time);
    brush.update(dt);
    dots.setDrawRange(0,visible);
    if(drawCount)for(const attr of Object.values(dots.attributes))attr.needsUpdate=true;
    drawCount=visible;
  }
  function reset(){
    style.fill(0);
    orbs.reset();
    brush.reset();
    dots.setDrawRange(0,0);
    cursor=drawCount=0;
    wallBudget=100;
    visualSeed=0x93ef008;
  }
  return {group,lash,burst,channel:orbs.channel,update,reset,resize:h=>{viewport.value=h;}};
}
