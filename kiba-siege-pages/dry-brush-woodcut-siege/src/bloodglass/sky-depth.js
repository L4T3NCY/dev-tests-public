import * as THREE from 'three';
import {seeded} from './kit.js';

export function makeDistantIslands() {
  const group=new THREE.Group(),random=seeded(0x80ffc1);
  const dull=new THREE.MeshBasicMaterial();
  const crag=new THREE.CylinderGeometry(.61,.13,1,10,3).toNonIndexed();
  const vertices=crag.attributes.position;
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i);
    const a=Math.atan2(z,x);
    const splinter=1+.13*Math.sin(a*3+y*4)+.12*Math.sin(a*7-y*5);
    vertices.setXYZ(i,x*splinter,y+.071*Math.cos(a*6+y*11),z*splinter);
  }
  crag.computeVertexNormals();
  const masonry=new THREE.BoxGeometry(1,1,1);
  const pinnacle=new THREE.ConeGeometry(1,1,4);
  const rocks=[],walls=[],spires=[];
  for(const [range,count,level] of [[30,5,-9],[51,7,-14],[79,9,-19]]){
    for(let i=0;i<count;i++){
      const angle=i/count*Math.PI*2+.33+(random()-.5)*.17;
      const radius=range+(random()-.5)*16;
      const x=Math.sin(angle)*radius,z=Math.cos(angle)*radius;
      const y=level+(random()-.50)*19;
      const scale=1.48+random()*2.60;
      const shades=range>60?[0x726d68,0x807870,0x878179]:range>40?[0x4b4542,0x57514d,0x655b56]:[0x282324,0x353033,0x413a3a];
      const tint=shades[i%shades.length];
      rocks.push({x,y:y-scale*.64,z,w:scale*1.89,h:scale*1.71,d:scale*1.52,a:angle,c:tint});
      for(let j=0;j<9;j++){
        const dx=(random()-.5)*scale*2.41,dz=(random()-.5)*scale*1.49;
        const h=scale*(.27+random()*.84);
        const r=.32+random()*.59;
        rocks.push({x:x+dx,y:y-scale*(.39+random()*.49),z:z+dz,w:r*scale,h:h+scale*.51,d:r*scale*.85,a:angle+j*.22,c:shades[j%3]});
        if((i+j)%4===0){
          const px=x+dx*.71,pz=z+dz*.74;
          const w=.31+random()*.83;
          walls.push({x:px,y:y+h*.4,z:pz,w,h:h*.85,d:w*.89,a:angle,c:tint});
          spires.push({x:px,y:y+h*.94,z:pz,w:w*.75,h:h*.43,d:w*.75,a:angle,c:tint});
        }
      }
    }
  }
  function make(geometry,items) {
    const mesh=new THREE.InstancedMesh(geometry,dull,items.length),object=new THREE.Object3D();
    const color=new THREE.Color();
    items.forEach(({x,y,z,w,h,d,a,c},i)=>{
      object.position.set(x,y,z);object.scale.set(w,h,d);object.rotation.y=a;object.updateMatrix();
      mesh.setMatrixAt(i,object.matrix);mesh.setColorAt(i,color.setHex(c));
    });
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  make(crag,rocks); make(masonry,walls); make(pinnacle,spires);
  return group;
}