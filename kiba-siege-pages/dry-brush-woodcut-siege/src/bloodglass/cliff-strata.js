import * as THREE from 'three';
import {art,paintStone} from './art-direction.js';
import {rockMaterial,seeded,choose,basalt} from './kit.js';

function makeRockFace() {
  const random=seeded(0xc0311);
  const strata=[
    {y:-.48,r:1.008,shift:0,jitter:.14},
    {y:-1.43,r:.965,shift:.04,jitter:.58},
    {y:-3.10,r:.80,shift:.11,jitter:.80},
    {y:-5.68,r:.595,shift:.14,jitter:1.03},
    {y:-7.90,r:.421,shift:.12,jitter:1.04},
    {y:-9.56,r:.245,shift:.13,jitter:1.11},
    {y:-11.88,r:.026,shift:.14,jitter:.31}
  ];
  const count=42;
  const spokes=Array.from({length:count},(_,i)=>({
    angle:i/count*Math.PI*2+(random()-.5)*.08,
    notch:(random()-.5)*.125,
    tint:choose(random,basalt)
  }));
  const rings=strata.map(({y,r,shift,jitter},ring)=>
    spokes.map(({angle,notch},i)=>{
      const a=angle+shift+(ring>0?(random()-.5)*.14:0);
      const silhouette=1+.077*Math.sin(angle*3+.1)+.050*Math.cos(angle*7-.42);
      const lip=ring===0?notch*.34:notch+(random()-.5)*.071;
      const cut=(i%3===0?-.07:.017)*Math.sin(ring*.58);
      const radius=r*(silhouette+lip+cut);
      const drift=(1-r)*1.55;
      return [-.25+Math.cos(a)*10.65*radius+drift,y+(random()-.5)*jitter*2,
        Math.sin(a)*7*radius-.62*(1-r)];
    })
  );
  const positions=[],colors=[],color=new THREE.Color();
  function triangle(a,b,c,tint,strength) {
    positions.push(...a,...b,...c);
    color.set(tint).multiplyScalar(strength);
    for(let i=0;i<3;i++)colors.push(color.r,color.g,color.b);
  }
  for(let ring=0;ring<rings.length-1;ring++){
    const upper=rings[ring],lower=rings[ring+1];
    for(let i=0;i<count;i++){
      const j=(i+1)%count;
      const tint=spokes[i].tint;
      const value=(.66+random()*.65)*(1-ring*.027);
      triangle(upper[i],upper[j],lower[i],tint,value);
      triangle(upper[j],lower[j],lower[i],tint,value*(.65+random()*.49));
    }
  }
  const tip=[1.34,-12.27,-.62];
  const base=rings.at(-1);
  for(let i=0;i<count;i++)triangle(base[i],base[(i+1)%count],tip,spokes[i].tint,.67);

  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  const material=paintStone(new THREE.MeshLambertMaterial({vertexColors:true}),true);
  const face=new THREE.Mesh(geometry,material);
  face.castShadow=face.receiveShadow=true;
  return face;
}

export function makeCliffStrata() {
  const random=seeded(0xac179d);
  const geometry=new THREE.CylinderGeometry(.54,.12,1,5,2, false, .36).toNonIndexed();
  const vertices=geometry.attributes.position;
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i), y=vertices.getY(i), z=vertices.getZ(i);
    const phase=Math.atan2(z,x);
    const shoulder=1+(1-Math.abs(y)*2)*.51;
    const margin=1+.17*Math.sin(phase*4.0+y*5.);
    const heightShift=Math.hypot(x,z)*.17*Math.cos(phase*2.8);
    vertices.setXYZ(i,x*shoulder*margin+(y-.5)*.13,y+heightShift,z*shoulder*margin);
  }
  geometry.computeVertexNormals();

  const count=32, cliffs=new THREE.InstancedMesh(geometry,rockMaterial,count);
  const transform=new THREE.Object3D(), top=new THREE.Vector3(),bottom=new THREE.Vector3();
  const up=new THREE.Vector3(0,1,0),axis=new THREE.Vector3(),tint=new THREE.Color();
  for(let i=0;i<count;i++){
    const angle=i/count*Math.PI*2+(random()-.5)*.072;
    const x=Math.cos(angle), z=Math.sin(angle);
    const lobe=1+.071*Math.sin(angle*3+.1)+.047*Math.cos(angle*7-.42);
    const major=i%3===0;
    const radius=lobe*(.86+random()*.094);
    top.set(-.25+x*10.65*radius,-.37-random()*.91,z*7*radius);
    const taper=(major?.47:.62)+random()*.13;
    bottom.set(-.25+x*10.65*taper,-(major?4.6:2.8)-random()*3.1,z*7*taper);
    const length=axis.subVectors(top,bottom).length();
    transform.position.copy(top).lerp(bottom,.5);
    transform.quaternion.setFromUnitVectors(up,axis.multiplyScalar(1/length));
    transform.rotateY(angle*.75+random()*.9);
    const breadth=(major?1.52:.65)+random()*.48;
    transform.scale.set(breadth,length,breadth*(.70+random()*.29));
    transform.updateMatrix();
    cliffs.setMatrixAt(i,transform.matrix);
    tint.set(choose(random,basalt));
    if(i%9===0)tint.lerp(new THREE.Color(art.woodcut?0x6a5a51:0x82645e),.42);
    cliffs.setColorAt(i,tint);
  }
  cliffs.castShadow=cliffs.receiveShadow=true;
  cliffs.computeBoundingSphere();
  const group=new THREE.Group();
  group.add(makeRockFace(),cliffs);
  return group;
}
