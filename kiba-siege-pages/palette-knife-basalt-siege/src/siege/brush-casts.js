import * as THREE from 'three';
import {art} from '../bloodglass/art-direction.js';

const forward=new THREE.Vector3(0,0,1);
const heading=new THREE.Vector3();
const lifetime=art.woodcut?.34:.30;

function strokeGeometry(across) {
  const xyz=[],uv=[],indices=[];
  const segments=26;
  for(let i=0;i<=segments;i++) {
    const t=i/segments;
    const envelope=Math.pow(Math.sin(Math.PI*t),art.woodcut?.92:.56);
    const center=Math.sin(Math.PI*t)*(art.woodcut?.66:.31);
    const bevel=(art.woodcut?1:.82)+.11*Math.sin(i*2.8)+.07*Math.sin(i*1.54);
    const width=envelope*(art.woodcut?.29:.25)*bevel;
    for(const side of [-1,1]) {
      const edge=center+side*width;
      xyz.push(across?edge:edge*.21,across?center*.63:edge,t);
      uv.push(t,(side+1)*.5);
    }
    if(i>0) {
      const n=i*2;
      indices.push(n-2,n-1,n,n,n-1,n+1);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);
  return geometry;
}

export function makeBrushCasts() {
  const group=new THREE.Group();
  const panels=[strokeGeometry(false),strokeGeometry(true)];
  const slots=Array.from({length:5},()=>{
    const root=new THREE.Group();
    const progress={value:1};
    const material=new THREE.ShaderMaterial({
      side:THREE.DoubleSide,
      uniforms:{progress},
      vertexShader:`
        varying vec2 stroke;
        void main(){
          stroke=uv;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        }`,
      fragmentShader:`
        varying vec2 stroke;
        uniform float progress;
        void main() {
          float x=stroke.x, y=stroke.y;
          float bristle=sin(y*121.+sin(x*9.)*1.3)*.59+sin(y*57.+x*6.)*.41;
          float fray=sin(x*207.)*.043+sin(x*91.4)*.033;
          float head=min(1.06,.07+progress*9.6);
          float tail=max(0.,(progress-.26)*1.39);
          float width=abs(y-.5)+fray;
          if(x>head || x<tail || width>.478-progress*.133)discard;
          ${art.woodcut?`
            if(bristle>.59 && width>.13 && sin(x*32.+y*16.)>.14)discard;
            float incision=smoothstep(.72,.94,bristle)*smoothstep(.25,.69,x);
            vec3 red=mix(vec3(.37,.004,.025),vec3(1.05,.016,.063),smoothstep(.10,.48,y));
            vec3 pigment=mix(red,vec3(2.4,1.39,1.08),incision*.89);
          `:`
            float ridge=smoothstep(.53,.69,y+sin(x*41.)*.045);
            float glint=ridge*(1.-smoothstep(.81,.95,y))*max(.36,1.-progress);
            vec3 red=mix(vec3(.26,.007,.025),vec3(1.51,.043,.084),ridge*.68+.16);
            vec3 pigment=mix(red,vec3(3.9,1.78,1.16),glint*.78);
          `}
          gl_FragColor=vec4(pigment,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    for(const panel of panels)root.add(new THREE.Mesh(panel,material));
    root.visible=false;
    group.add(root);
    return {root,progress,age:lifetime};
  });
  let cursor=0;

  function cast(from,to) {
    const slot=slots[cursor++%slots.length];
    const distance=heading.subVectors(to,from).length();
    if(distance<.01)return;
    slot.root.position.copy(from);
    slot.root.quaternion.setFromUnitVectors(forward,heading.multiplyScalar(1/distance));
    slot.root.scale.set(1,1,distance);
    slot.root.visible=true;
    slot.age=slot.progress.value=0;
  }

  function update(dt) {
    for(const slot of slots) {
      if(!slot.root.visible)continue;
      slot.age+=dt;
      slot.progress.value=slot.age/lifetime;
      if(slot.age>=lifetime)slot.root.visible=false;
    }
  }

  function reset() {
    for(const slot of slots)slot.root.visible=false;
    cursor=0;
  }
  return {group,cast,update,reset};
}
