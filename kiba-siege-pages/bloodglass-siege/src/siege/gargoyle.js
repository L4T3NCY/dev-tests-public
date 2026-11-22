import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const facets=new THREE.IcosahedronGeometry(1,0);
const cube=new THREE.BoxGeometry(1,1,1);
const horn=new THREE.ConeGeometry(1,1,4);
const gray=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,metalness:.06});
const membrane=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,side:THREE.DoubleSide});
const eyeLight=new THREE.MeshBasicMaterial({color:new THREE.Color(.22,1.22,1.68)});
const wardLight=new THREE.MeshBasicMaterial({color:new THREE.Color(.64,.72,1.95)});
const flinch=new THREE.MeshBasicMaterial({color:new THREE.Color(1.36,.12,.26),side:THREE.DoubleSide});
const stone=0x526575, slate=0x3f5062, edge=0x68798b, claw=0xa2a3aa, deep=0x2c3447;

function sculpt(parts) {
  const meshes=[];
  for(const [shape,p,s,color,rotation] of parts) {
    const geometry=shape.index?shape.toNonIndexed():shape.clone();
    geometry.scale(...s);
    if(rotation){
      geometry.rotateX(rotation[0]);
      geometry.rotateY(rotation[1]);
      geometry.rotateZ(rotation[2]);
    }
    geometry.translate(...p);
    const n=geometry.attributes.position.count,channels=new Float32Array(n*3);
    const tint=new THREE.Color(color);
    for(let i=0;i<n;i++)tint.toArray(channels,i*3);
    geometry.setAttribute('color',new THREE.BufferAttribute(channels,3));
    meshes.push(geometry);
  }
  const geometry=mergeGeometries(meshes);
  for(const mesh of meshes)mesh.dispose();
  return geometry;
}

const bodyGeo=sculpt([
  [facets,[0,.10,-.012],[.36,.38,.24],stone],
  [facets,[0,.166,.125],[.255,.29,.17],edge,[.20,0,0]],
  [facets,[0,-.199,-.055],[.265,.204,.178],slate],
  [facets,[0,.292,.007],[.16,.26,.157],stone],
  [facets,[0,.146,-.205],[.24,.32,.10],deep],
  ...[-1,1].flatMap(side=>[
    [facets,[side*.271,.212,-.028],[.140,.146,.148],edge],
    [facets,[side*.157,.095,.20],[.045,.169,.046],slate,[.2,0,-side*.23]],
    [horn,[side*.101,.386,-.124],[.066,.206,.054],deep,[-.51,0,side*.31]]
  ])
]);
const faceGeo=sculpt([
  [facets,[0,.014,.005],[.183,.183,.17],stone],
  [facets,[0,-.052,.123],[.118,.085,.133],slate],
  [facets,[0,-.079,.174],[.134,.034,.043],deep],
  [facets,[0,-.097,.114],[.102,.040,.110],edge],
  ...[-1,1].flatMap(side=>[
    [horn,[side*.106,.197,-.070],[.074,.423,.061],slate,[-.63,0,-side*.20]],
    [horn,[side*.156,.105,-.014],[.045,.169,.045],edge,[-.23,0,-side*.56]],
    [cube,[side*.083,.041,.113],[.112,.046,.058],deep,[0,side*.43,side*.24]],
    [facets,[side*.114,-.02,.09],[.076,.07,.093],edge],
    [horn,[side*.064,-.069,.198],[.022,.052,.023],claw,[Math.PI,0,0]]
  ])
]);
const eyeGeo=sculpt([-1,1].map(side=>[cube,[side*.078,.031,.148],[.061,.017,.024],0xffffff,[0,side*.38,side*.19]]));
const armGeo=sculpt([
  [facets,[.006,-.111,.062],[.108,.191,.108],stone,[-.35,0,.13]],
  [facets,[.003,-.263,.136],[.087,.153,.101],edge,[-.28,0,-.05]],
  [facets,[.005,-.357,.151],[.072,.073,.091],slate],
  ...[-1,0,1].map(i=>[horn,[i*.042,-.395,.199],[.023,.104,.027],claw,[2.54,0,i*.15]])
]);
const legGeo=sculpt([
  [facets,[.07,-.107,.085],[.14,.184,.147],stone,[-.50,0,.45]],
  [facets,[.05,-.267,.109],[.085,.143,.093],slate,[.49,0,-.28]],
  [facets,[.045,-.347,.127],[.087,.056,.115],deep],
  ...[-1,0,1].map(i=>[horn,[.043+i*.044,-.361,.216],[.023,.086,.025],claw,[Math.PI*.5,0,i*.17]])
]);
const tailGeo=sculpt([
  [horn,[0,-.103,-.267],[.092,.52,.084],slate,[-1.06,0,.12]],
  [horn,[.087,-.128,-.536],[.048,.312,.05],edge,[-1.82,0,.42]]
]);

const wingPoints=[
  [0,0,0],[.36,.58,-.07],[.93,.90,-.16],[1.71,1.12,-.24],
  [1.33,.52,-.49],[1.62,.21,-.55],[1.02,.04,-.54],
  [1.15,-.29,-.57],[.62,-.16,-.41],[.56,-.43,-.44],[.18,-.19,-.18],[.59,.33,-.20]
];
const wingFaces=[[0,1,11],[1,2,11],[2,3,11],[3,4,11],[4,5,6],[4,6,11],
  [6,7,8],[6,8,11],[8,9,10],[8,10,11],[10,0,11]];
const wingGeo=new THREE.BufferGeometry();
const wingVertices=[],tints=[];
for(let i=0;i<wingFaces.length;i++){
  const color=new THREE.Color([0x41445c,0x454c67,0x535975,0x3d455c,0x41455e][i%5]);
  for(const j of wingFaces[i]){
    wingVertices.push(...wingPoints[j]);
    tints.push(color.r,color.g,color.b);
  }
}
wingGeo.setAttribute('position',new THREE.Float32BufferAttribute(wingVertices,3));
wingGeo.setAttribute('color',new THREE.Float32BufferAttribute(tints,3));
wingGeo.computeVertexNormals();

const up=new THREE.Vector3(0,1,0);
const struts=[];
for(const [a,b,radius] of [[0,1,.066],[1,2,.052],[2,3,.044],[1,11,.057],
  [11,5,.043],[11,7,.042],[11,9,.039],[11,10,.055]]){
  const start=new THREE.Vector3(...wingPoints[a]),end=new THREE.Vector3(...wingPoints[b]);
  const axis=end.clone().sub(start);
  const turn=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up,axis.clone().normalize()),'ZYX');
  struts.push([horn,start.lerp(end,.5).toArray(),[radius,axis.length(),radius],a%2?slate:edge,[turn.x,turn.y,turn.z]]);
}
const ribGeo=sculpt(struts);

function part(group,geometry,mat=gray) {
  const mesh=new THREE.Mesh(geometry,mat);
  group.add(mesh);
  return mesh;
}

export function makeGargoyle(heavy) {
  const body=new THREE.Group(),stoneParts=[];
  stoneParts.push(part(body,bodyGeo));
  const head=new THREE.Group();
  head.position.set(0,.346,.087);
  body.add(head);
  stoneParts.push(part(head,faceGeo));
  part(head,eyeGeo,heavy?wardLight:eyeLight);
  const tail=part(body,tailGeo);
  stoneParts.push(tail);
  const wings=[],arms=[],legs=[];
  for(const sign of [-1,1]){
    const wing=new THREE.Group();
    wing.position.set(sign*.25,.19,-.155);wing.scale.x=sign;
    stoneParts.push(part(wing,wingGeo,membrane),part(wing,ribGeo));
    body.add(wing);wings.push({wing,sign});
    const arm=part(body,armGeo);
    arm.position.set(sign*.298,.207,.009);arm.scale.x=sign;
    stoneParts.push(arm);arms.push({arm,sign});
    const leg=part(body,legGeo);
    leg.position.set(sign*.13,-.203,-.011);leg.scale.x=sign;
    stoneParts.push(leg);legs.push({leg,sign});
  }
  body.scale.setScalar(heavy?1.11:.86);
  const normalMats=stoneParts.map(mesh=>mesh.material);
  return {body,update(enemy,time) {
    const latched=enemy.phase==='latched',n=enemy.zone.normal;
    const flap=(time*(heavy?3.05:3.72)+enemy.warm)*Math.PI*2;
    const strike=latched?Math.exp(-Math.pow((enemy.hitAt-enemy.age-.12)*13,2)):0;
    const recoil=latched?Math.exp(-Math.pow((enemy.hitAt-enemy.age-(heavy?.93:1.17))*12,2)):0;
    body.position.copy(enemy.position);
    if(latched)body.position.addScaledVector(n,.19-.13*strike+.06*recoil);
    const dx=enemy.target.x-enemy.position.x,dz=enemy.target.z-enemy.position.z;
    body.rotation.y=latched?Math.atan2(-n.x,-n.z):Math.atan2(dx,dz);
    body.rotation.x=latched?.19+.21*strike:-.32+.18*Math.sin(flap);
    body.rotation.z=latched?.10*Math.sin(time*4.3+enemy.warm):.16*Math.sin(time*3.7+enemy.warm);
    head.rotation.x=latched?.13+.23*Math.sin(time*12.5+enemy.warm)+.42*strike:.065*Math.sin(flap);
    tail.rotation.x=.21*Math.sin(time*5.6+enemy.warm);
    for(const {wing,sign} of wings){
      wing.rotation.z=sign*(latched?.44+.07*Math.sin(time*6+enemy.warm):.33+.76*Math.sin(flap+sign*.10));
      wing.rotation.y=sign*(latched?.95+.08*Math.sin(time*5):.21+.22*Math.cos(flap));
    }
    for(const {arm,sign} of arms){
      const off=sign*Math.sin(enemy.age*2.65+enemy.warm);
      arm.rotation.x=latched?-.80-(.54+.29*off)*strike+.29*recoil:-.56+.16*Math.sin(flap+.3);
      arm.rotation.z=sign*(latched?.18+.14*off:.24);
    }
    for(const {leg,sign} of legs){
      leg.rotation.z=sign*(latched?.47:.21);
      leg.rotation.x=latched?-.53:.43+.11*Math.sin(flap);
    }
    for(let i=0;i<stoneParts.length;i++)stoneParts[i].material=enemy.flash>.10?flinch:normalMats[i];
  }};
}
