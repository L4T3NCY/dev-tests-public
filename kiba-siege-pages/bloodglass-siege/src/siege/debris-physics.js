import * as THREE from 'three';

const width=2.4;
const axes=['x','y','z'];
const key=(x,z)=>x+z*4096;
const cell=value=>Math.floor(value/width);

export function collisionBounds(...groups) {
  const boxes=[];
  const instance=new THREE.Matrix4(),matrix=new THREE.Matrix4();
  for(const group of groups){
    group.updateMatrixWorld(true);
    group.traverse(mesh=>{
      if(!mesh.isMesh||!mesh.castShadow)return;
      const geometry=mesh.geometry;
      if(!geometry.boundingBox)geometry.computeBoundingBox();
      for(let i=0;i<(mesh.isInstancedMesh?mesh.count:1);i++){
        matrix.copy(mesh.matrixWorld);
        if(mesh.isInstancedMesh){mesh.getMatrixAt(i,instance);matrix.multiply(instance);}
        const world=geometry.boundingBox.clone().applyMatrix4(matrix);
        if(world.max.x-world.min.x<.065||world.max.y-world.min.y<.053||world.max.z-world.min.z<.065)continue;
        boxes.push(world);
      }
    });
  }
  return boxes;
}

// The sweep is against box bounds expanded by the chunk radius. Its slab
// intersection also supplies the surface normal without a separate raycast.
function hitBox(from,step,radius,box) {
  let enter=-Infinity,exit=Infinity,axis='y',sign=1;
  let depth=Infinity,insideAxis='y',insideSign=1,inside=true;
  for(const a of axes){
    const low=box.min[a]-radius,high=box.max[a]+radius,start=from[a],velocity=step[a];
    if(start<low||start>high)inside=false;
    if(start-low<depth){depth=start-low;insideAxis=a;insideSign=-1;}
    if(high-start<depth){depth=high-start;insideAxis=a;insideSign=1;}
    if(Math.abs(velocity)<1e-9){
      if(start<low||start>high)return null;
      continue;
    }
    const t0=(low-start)/velocity,t1=(high-start)/velocity;
    const entry=Math.min(t0,t1);
    if(entry>enter){enter=entry;axis=a;sign=velocity>0?-1:1;}
    exit=Math.min(exit,Math.max(t0,t1));
    if(enter>exit||exit<0||enter>1)return null;
  }
  if(inside)return {t:0,axis:insideAxis,sign:insideSign,push:depth};
  if(enter<0||enter>1)return null;
  return {t:enter,axis,sign,push:0};
}

export function makeDebrisField(boxes) {
  const cells=new Map();
  let serial=0;
  for(const box of boxes){
    const record={box,stamp:-1};
    for(let x=cell(box.min.x);x<=cell(box.max.x);x++)
      for(let z=cell(box.min.z);z<=cell(box.max.z);z++){
        const id=key(x,z);
        if(!cells.has(id))cells.set(id,[]);
        cells.get(id).push(record);
      }
  }
  return {sweep(from,step,radius) {
    let collision=null;
    serial++;
    const lowerY=Math.min(from.y,from.y+step.y)-radius,upperY=Math.max(from.y,from.y+step.y)+radius;
    for(let x=cell(Math.min(from.x,from.x+step.x)-radius);x<=cell(Math.max(from.x,from.x+step.x)+radius);x++)
      for(let z=cell(Math.min(from.z,from.z+step.z)-radius);z<=cell(Math.max(from.z,from.z+step.z)+radius);z++){
        const nearby=cells.get(key(x,z));
        if(!nearby)continue;
        for(const record of nearby){
          if(record.stamp===serial)continue;
          record.stamp=serial;
          if(lowerY>record.box.max.y||upperY<record.box.min.y)continue;
          const hit=hitBox(from,step,radius,record.box);
          if(hit&&(!collision||hit.t<collision.t||hit.t===0&&collision.t===0&&hit.push<collision.push))collision=hit;
        }
      }
    return collision;
  }};
}

const step=new THREE.Vector3();
export function stepDebris(piece,field,dt) {
  if(piece.rest>=0){piece.rest+=dt;return;}
  const {position,velocity,spin,radius}=piece;
  velocity.y-=14.8*dt;
  piece.rotation.x+=spin.x*dt;
  piece.rotation.y+=spin.y*dt;
  piece.rotation.z+=spin.z*dt;
  let remaining=dt;
  for(let pass=0;pass<3&&remaining>1e-5;pass++){
    step.copy(velocity).multiplyScalar(remaining);
    const hit=field.sweep(position,step,radius);
    if(!hit){position.add(step);return;}
    position.addScaledVector(step,hit.t);
    position[hit.axis]+=(hit.push+.007)*hit.sign;
    remaining*=1-hit.t;
    const closing=velocity[hit.axis]*hit.sign;
    if(closing>=0)continue;
    const floor=hit.axis==='y'&&hit.sign>0;
    velocity[hit.axis]*=floor?-.24:-.43;
    for(const axis of axes)if(axis!==hit.axis)velocity[axis]*=floor?.64:.86;
    spin.multiplyScalar(floor?.51:.77);
    if(floor&&velocity.y<.51&&Math.hypot(velocity.x,velocity.z)<.69){
      velocity.set(0,0,0);
      piece.rest=0;
      return;
    }
  }
}
