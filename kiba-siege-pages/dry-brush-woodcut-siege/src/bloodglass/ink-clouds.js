import * as THREE from 'three';
import {seeded} from './kit.js';

const variants=5;
const clamp=THREE.MathUtils.clamp;
const mix=THREE.MathUtils.lerp;

function smooth(low,high,value) {
  const t=clamp((value-low)/(high-low),0,1);
  return t*t*(3-2*t);
}

function makeCloudAtlas() {
  const width=384,height=128;
  const data=new Uint8Array(width*height*variants*4);
  const random=seeded(0xfa3c52);
  const grid=Float32Array.from({length:64*64},()=>random());
  const value=(x,y)=>grid[(x&63)+64*(y&63)];
  function noise(x,y) {
    const i=Math.floor(x),j=Math.floor(y);
    const s=smooth(0,1,x-i),t=smooth(0,1,y-j);
    return mix(mix(value(i,j),value(i+1,j),s),mix(value(i,j+1),value(i+1,j+1),s),t);
  }

  for(let frame=0;frame<variants;frame++){
    const offset=frame*10.17;
    for(let j=0;j<height;j++)for(let i=0;i<width;i++){
      const u=(i+.5)/width,v=(j+.5)/height;
      const x=u*2-1;
      const side=Math.max(0,1-x*x);
      const flow=noise(u*4.8+offset,v*3+7);
      const broken=noise(u*21+offset,v*9+flow*.8);
      const hair=noise(u*12+offset+5,v*41+flow*2);
      const lifted=noise(u*6.9+offset,.9)*.25+noise(u*13.5+offset,1.5)*.18;
      const crown=.51+lifted+broken*.12+(flow-.5)*.13;
      const bed=.35+(flow-.5)*.15+(hair-.5)*.12;
      const envelope=Math.pow(side,.65);
      const top=.49+(crown-.49)*envelope;
      const base=.49+(bed-.49)*envelope;

      const shape=smooth(base-.080,base+.075,v)*smooth(top+.035,top-.018,v);
      const fringe=smooth(base-.19,base+.075,v)*smooth(top+.13,top-.025,v)*broken*.23;
      const bristles=smooth(.38,.78,noise(u*13+offset,v*78+flow*4));
      const fibers=smooth(.40,.69,hair*.68+bristles*.32);
      const texture=.63+.37*smooth(.26,.60,broken*.54+flow*.46);
      const alpha=(shape*texture*.98+fringe)*smooth(0,.23,side)*smooth(0,.13,v)*smooth(1,.89,v);
      const cap=smooth(.09,.26,v-base)*.29+smooth(top-.23,top-.025,v)*.57;
      const shading=clamp(.10+cap+fibers*.19+(broken-.5)*.19,0,1);

      const index=((frame*height+j)*width+i)*4;
      data[index]=Math.round(shading*255);
      data[index+3]=Math.round(clamp(alpha,0,1)*255);
    }
  }
  const atlas=new THREE.DataTexture(data,width,height*variants);
  atlas.minFilter=THREE.LinearMipmapLinearFilter;
  atlas.magFilter=THREE.LinearFilter;
  atlas.generateMipmaps=true;
  atlas.needsUpdate=true;
  return atlas;
}

export function makeInkClouds() {
  const group=new THREE.Group();
  const atlas=makeCloudAtlas();
  const random=seeded(0x67bd435);
  const quad=new THREE.PlaneGeometry(1,1);
  const materials=[];
  const cards=[];
  const layers=[
    {count:10,radius:59,height:-8,width:45,depth:11,rate:.010,alpha:.68,shadow:.27},
    {count:9,radius:34,height:-6,width:31,depth:9,rate:.016,alpha:.76,shadow:.16},
    {count:6,radius:24,height:1.8,width:18,depth:5.6,rate:.025,alpha:.66,shadow:.20},
    {count:5,radius:15,height:4.6,width:11,depth:3.1,rate:.046,alpha:.40,shadow:.34}
  ];
  for(const [layerIndex,layer] of layers.entries()){ 
    for(let i=0;i<layer.count;i++){
      const angle=i/layer.count*Math.PI*2+random()*.34;
      const phase=random()*Math.PI*2;
      const variant=Math.floor(random()*variants);
      const key=layerIndex*variants+variant;
      materials[key]??=new THREE.ShaderMaterial({
        depthWrite:false,transparent:true,
        uniforms:{atlas:{value:atlas},variant:{value:variant},alpha:{value:layer.alpha},shadow:{value:layer.shadow}},
        vertexShader:`
          varying vec2 texcoord;
          varying float viewDepth;
          void main() {
            texcoord=uv;
            vec4 p=modelViewMatrix*vec4(position,1.);
            viewDepth=-p.z;
            gl_Position=projectionMatrix*p;
          }`,
        fragmentShader:`
          uniform sampler2D atlas;
          uniform float variant;
          uniform float alpha;
          uniform float shadow;
          varying vec2 texcoord;
          varying float viewDepth;
          void main() {
            vec2 uv=vec2(texcoord.x,(variant+.018+texcoord.y*.964)/${variants}.);
            vec4 print=texture2D(atlas,uv);
            float opacity=print.a*alpha*smoothstep(2.,10.,viewDepth);
            if(opacity<.012)discard;
            vec3 tone=mix(vec3(shadow)*vec3(.86,.82,.80),vec3(1.05,.98,.87),print.r);
            gl_FragColor=vec4(tone,opacity);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`
      });
      const mesh=new THREE.Mesh(quad,materials[key]);
      mesh.scale.set(layer.width*(.81+random()*.40),layer.depth*(.84+random()*.44),1);
      group.add(mesh);
      cards.push({mesh,angle,phase,layer,height:layer.height+(random()-.5)*2.8});
    }
  }

  return {group,update(time){
    for(const {mesh,angle,phase,layer,height} of cards){
      const heading=angle-time*layer.rate;
      const distance=layer.radius+Math.sin(time*.18+phase)*1.08;
      mesh.position.set(Math.cos(heading)*distance,height+Math.sin(time*.29+phase)*.57,Math.sin(heading)*distance);
    }
  },view(camera){
    for(const {mesh} of cards)mesh.quaternion.copy(camera.quaternion);
  }};
}
