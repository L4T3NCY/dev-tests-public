import * as THREE from 'three';
import {seeded,choose} from '../bloodglass/kit.js';
import {stepDebris} from './debris-physics.js';

const capacity=86;
const palette=[0x394c61,0x4d5f76,0x536981,0x596578,0x354455,0x64768c,0x776f79];
const wingPalette=[0x394155,0x485871,0x4e5973,0x5f6d83];
const materials=new THREE.MeshStandardMaterial({roughness:.91,metalness:.05,transparent:true,depthWrite:false});
materials.onBeforeCompile=shader=>{
  shader.vertexShader='attribute float chunkFade; varying float fading;\n'+shader.vertexShader.replace(
    '#include <begin_vertex>','#include <begin_vertex>\nfading=chunkFade;');
  shader.fragmentShader='varying float fading;\n'+shader.fragmentShader.replace(
    '#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=fading;');
};

export function makeGargoyleDebris(field) {
  const group=new THREE.Group();
  let random=seeded(0x2ca76be);
  const kinds=[
    {geometry:new THREE.DodecahedronGeometry(1,0),colors:palette},
    {geometry:new THREE.TetrahedronGeometry(1,0),colors:wingPalette},
    {geometry:new THREE.ConeGeometry(.38,1.45,4),colors:palette}
  ].map(({geometry,colors})=>{
    const opacity=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('chunkFade',opacity);
    const mesh=new THREE.InstancedMesh(geometry,materials,capacity);
    mesh.count=0;
    mesh.receiveShadow=true;mesh.frustumCulled=false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh);
    return {mesh,opacity,colors,items:[]};
  });
  const object=new THREE.Object3D(), color=new THREE.Color(), impulse=new THREE.Vector3(), heading=new THREE.Vector3();
  let remainder=0;

  function shatter(enemy) {
    const latched=enemy.phase==='latched';
    const origin=enemy.position.clone();
    if(latched)origin.addScaledVector(enemy.zone.normal,.34);
    heading.subVectors(enemy.target,enemy.position);
    heading.y=0;
    heading.normalize();
    for(let i=0;i<(enemy.heavy?42:33);i++){
      const type=i<2?2:i%4===0?1:0;
      const kind=kinds[type];
      const theta=random()*Math.PI*2;
      const y=(random()-.44)*1.35;
      impulse.set(Math.cos(theta),y,Math.sin(theta)).normalize();
      const big=i<8;
      const size=(big?.148+random()*.113:.032+random()*.085)*(enemy.heavy?1.16:1);
      const varied=type===1?[size*1.35,size*.34,size*.93]:type===2?[size*.76,size*1.78,size]:[size*1.14,size*.83,size];
      const position=origin.clone().addScaledVector(impulse,random()*(big?.34:.25));
      const velocity=impulse.clone().multiplyScalar((big?.90:1.65)+random()*(big?1.9:3.1));
      if(latched)velocity.addScaledVector(enemy.zone.normal,random()*.85);
      else velocity.addScaledVector(heading,.82+random()*1.40);
      velocity.y+=.35+random()*1.8;
      if(kind.items.length===capacity)kind.items.shift();
      kind.items.push({position,velocity,size:varied,radius:size*(type===2?.82:.73),
        rotation:new THREE.Euler(random()*6,random()*6,random()*6),
        spin:new THREE.Vector3((random()-.5)*11,(random()-.5)*9,(random()-.5)*10),
        paint:i===0?0x78a7bd:choose(random,kind.colors),age:0,rest:-1,voidTime:0});
    }
  }

  function update(delta) {
    if(kinds.every(kind=>kind.items.length===0))return;
    remainder+=delta;
    const dt=1/90;
    while(remainder>=dt){
      remainder-=dt;
      for(const {items} of kinds)for(const chunk of items){
        chunk.age+=dt;
        stepDebris(chunk,field,dt);
        if(chunk.position.y<-16)chunk.voidTime+=dt;
      }
    }
    for(const kind of kinds){
      const {mesh,opacity,items}=kind;
      if(!mesh.count&&!items.length)continue;
      for(let i=items.length-1;i>=0;i--)if(items[i].rest>1.60||items[i].voidTime>.67||items[i].age>12)items.splice(i,1);
      mesh.count=items.length;
      items.forEach((chunk,i)=>{
        object.position.copy(chunk.position);object.rotation.copy(chunk.rotation);
        object.scale.fromArray(chunk.size);object.updateMatrix();
        mesh.setMatrixAt(i,object.matrix);
        mesh.setColorAt(i,color.setHex(chunk.paint));
        const landed=chunk.rest<.66?1:1-THREE.MathUtils.smoothstep(chunk.rest,.66,1.60);
        opacity.setX(i,Math.min(landed,1-THREE.MathUtils.smoothstep(chunk.voidTime,0,.67)));
      });
      mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      opacity.needsUpdate=true;
    }
  }

  function reset() {
    for(const kind of kinds){kind.items.length=0;kind.mesh.count=0;}
    remainder=0;
    random=seeded(0x2ca76be);
  }
  return {group,shatter,update,reset};
}
