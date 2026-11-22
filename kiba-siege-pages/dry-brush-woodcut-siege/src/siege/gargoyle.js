import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {art} from '../bloodglass/art-direction.js';

const facets=new THREE.IcosahedronGeometry(1,0);
const cube=new THREE.BoxGeometry(1,1,1);
const horn=new THREE.ConeGeometry(1,1,4);
const [stone,slate,edge,claw,deep]=art.woodcut?
  [0x2e2b2b,0x222022,0x544b48,0xbeb6ae,0x171619]:
  [0x555158,0x413b45,0x777077,0xbeb0a2,0x302932];

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
  const color=new THREE.Color((art.woodcut?[0x282225,0x30292a,0x423635,0x221e20,0x302629]:
    [0x4d3d47,0x514048,0x695058,0x42383e,0x46393f])[i%5]);
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

// Build the same rig once, then animate its rigid parts in the vertex shader.
const pivots={
  torso:[0,0,0],head:[0,.346,.087],eye:[0,.346,.087],tail:[0,0,0],
  leftWing:[-.25,.19,-.155],rightWing:[.25,.19,-.155],
  leftArm:[-.298,.207,.009],rightArm:[.298,.207,.009],
  leftLeg:[-.13,-.203,-.011],rightLeg:[.13,-.203,-.011]
};
const parts=Object.keys(pivots);
const distantBody=sculpt([
  [facets,[0,.04,-.03],[.40,.39,.24],stone],
  [facets,[0,-.24,-.065],[.28,.19,.15],slate]
]);
const distantHead=sculpt([
  [facets,[0,0,.045],[.184,.18,.20],edge],
  ...[-1,1].map(sign=>[horn,[sign*.10,.19,-.063],[.073,.42,.06],deep,[-.63,0,-sign*.2]])
]);

function joint(geometry,name,mirror=false){
  const copy=geometry.clone();
  copy.deleteAttribute('uv');
  if(mirror){
    copy.scale(-1,1,1);
    // Mirroring the mesh flips its winding. Keep the front-face normals intact.
    for(const attribute of Object.values(copy.attributes)){
      for(let i=0;i<attribute.count;i+=3){
        for(let j=0;j<attribute.itemSize;j++){
          const a=(i+1)*attribute.itemSize+j,b=a+attribute.itemSize,tmp=attribute.array[a];
          attribute.array[a]=attribute.array[b];
          attribute.array[b]=tmp;
        }
      }
    }
  }
  copy.translate(...pivots[name]);
  copy.setAttribute('rigPart',new THREE.BufferAttribute(
    new Float32Array(copy.attributes.position.count).fill(parts.indexOf(name)),1
  ));
  return copy;
}

function makeRigGeometry(detailed){
  const sections=[
    joint(detailed?bodyGeo:distantBody,'torso'),
    joint(detailed?faceGeo:distantHead,'head'),
    joint(eyeGeo,'eye'),
    joint(wingGeo,'leftWing',true),
    joint(wingGeo,'rightWing')
  ];
  if(detailed)sections.push(
    joint(tailGeo,'tail'),
    joint(ribGeo,'leftWing',true),joint(ribGeo,'rightWing'),
    joint(armGeo,'leftArm',true),joint(armGeo,'rightArm'),
    joint(legGeo,'leftLeg',true),joint(legGeo,'rightLeg')
  );
  const geometry=mergeGeometries(sections);
  for(const section of sections)section.dispose();
  return geometry;
}

const pivotShader=parts.map(part=>'vec3('+pivots[part].map(n=>n.toFixed(3)).join(',')+')');
const flightClock={value:0};
const materials=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
materials.onBeforeCompile=shader=>{
  shader.uniforms.flightClock=flightClock;
  shader.vertexShader=`
    attribute float rigPart;
    attribute vec4 actorPose;
    uniform float flightClock;
    varying vec3 actorGlow;
    mat3 pivotX(float a){
      float c=cos(a),s=sin(a);
      return mat3(1.,0.,0., 0.,c,s, 0.,-s,c);
    }
    mat3 pivotY(float a){
      float c=cos(a),s=sin(a);
      return mat3(c,0.,-s, 0.,1.,0., s,0.,c);
    }
    mat3 pivotZ(float a){
      float c=cos(a),s=sin(a);
      return mat3(c,s,0., -s,c,0., 0.,0.,1.);
    }
  `+shader.vertexShader.replace('#include <beginnormal_vertex>',`
    #include <beginnormal_vertex>
    float warm=actorPose.x, age=actorPose.y, flags=actorPose.z, untilHit=actorPose.w;
    bool heavy=mod(flags,2.)>.5;
    bool latched=mod(flags,4.)>1.5;
    bool flashed=flags>3.5;
    float flap=(flightClock*(heavy?3.05:3.72)+warm)*6.2831853;
    mat3 pose=mat3(1.);
    vec3 joint=vec3(0.);
    actorGlow=flashed?vec3(1.18,.083,.174):vec3(0.);
    if(rigPart==1.||rigPart==2.){
      float brace=(untilHit-.12)*13.;
      float strike=latched?exp(-brace*brace):0.;
      joint=${pivotShader[1]};
      pose=pivotX(latched?.13+.23*sin(flightClock*12.5+warm)+.42*strike:.065*sin(flap));
      if(rigPart==2.)actorGlow=heavy?vec3(1.72,.26,.25):vec3(1.45,.87,.59);
    }else if(rigPart==3.){
      pose=pivotX(.21*sin(flightClock*5.6+warm));
    }else if(rigPart==4.||rigPart==5.){
      float sign=rigPart==4.?-1.:1.;
      joint=sign<0.?${pivotShader[4]}:${pivotShader[5]};
      float fold=sign*(latched?.95+.08*sin(flightClock*5.):.21+.22*cos(flap));
      float beat=sign*(latched?.44+.07*sin(flightClock*6.+warm):.33+.76*sin(flap+sign*.10));
      pose=pivotY(fold)*pivotZ(beat);
    }else if(rigPart==6.||rigPart==7.){
      float sign=rigPart==6.?-1.:1.;
      joint=sign<0.?${pivotShader[6]}:${pivotShader[7]};
      float off=sign*sin(age*2.65+warm);
      float brace=(untilHit-.12)*13.;
      float rebound=(untilHit-(heavy?.93:1.17))*12.;
      float swing=latched?-.80-(.54+.29*off)*exp(-brace*brace)+.29*exp(-rebound*rebound):-.56+.16*sin(flap+.3);
      pose=pivotX(swing)*pivotZ(sign*(latched?.18+.14*off:.24));
    }else if(rigPart==8.||rigPart==9.){
      float sign=rigPart==8.?-1.:1.;
      joint=sign<0.?${pivotShader[8]}:${pivotShader[9]};
      pose=pivotX(latched?-.53:.43+.11*sin(flap))*pivotZ(sign*(latched?.47:.21));
    }
    objectNormal=pose*objectNormal;
  `).replace('#include <begin_vertex>',`
    #include <begin_vertex>
    transformed=joint+pose*(transformed-joint);
  `);
  shader.fragmentShader='varying vec3 actorGlow;\n'+shader.fragmentShader.replace(
    '#include <opaque_fragment>',
    'outgoingLight+=actorGlow;\n#include <opaque_fragment>'
  );
};

export function makeGargoyleCrowd(){
  const group=new THREE.Group();
  const bounds=new THREE.Frustum(),cameraTransform=new THREE.Matrix4(),actor=new THREE.Object3D();
  const sphere=new THREE.Sphere(new THREE.Vector3(),2.45);
  const batches=[true,false].map(detail=>({
    geometry:makeRigGeometry(detail),capacity:0,mesh:null,pose:null,count:0
  }));

  function reserve(batch,count){
    if(batch.capacity>=count)return;
    const capacity=Math.max(256,batch.capacity*2,count);
    if(batch.mesh){
      group.remove(batch.mesh);
      batch.mesh.dispose();
      batch.mesh.geometry.dispose();
    }
    const geometry=batch.geometry.clone();
    const pose=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('actorPose',pose);
    const mesh=new THREE.InstancedMesh(geometry,materials,capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled=false;
    mesh.count=0;
    group.add(mesh);
    Object.assign(batch,{mesh,pose,capacity});
  }

  for(const batch of batches)reserve(batch,256);

  function update(enemies,time,camera){
    flightClock.value=time;
    bounds.setFromProjectionMatrix(cameraTransform.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    for(const batch of batches){
      reserve(batch,enemies.length);
      batch.count=0;
    }
    for(const enemy of enemies){
      sphere.center.copy(enemy.position);
      if(!bounds.intersectsSphere(sphere))continue;
      const batch=batches[enemy.position.distanceToSquared(camera.position)<19**2?0:1];
      const latched=enemy.phase==='latched',heavy=enemy.heavy,normal=enemy.zone.normal;
      const untilHit=enemy.hitAt-enemy.age;
      const brace=(untilHit-.12)*13,rebound=(untilHit-(heavy?.93:1.17))*12;
      const strike=latched?Math.exp(-brace*brace):0,recoil=latched?Math.exp(-rebound*rebound):0;
      const flap=(time*(heavy?3.05:3.72)+enemy.warm)*Math.PI*2;
      actor.position.copy(enemy.position);
      if(latched)actor.position.addScaledVector(normal,.19-.13*strike+.06*recoil);
      actor.rotation.set(latched?.19+.21*strike:-.32+.18*Math.sin(flap),
        latched?Math.atan2(-normal.x,-normal.z):Math.atan2(enemy.target.x-enemy.position.x,enemy.target.z-enemy.position.z),
        latched?.10*Math.sin(time*4.3+enemy.warm):.16*Math.sin(time*3.7+enemy.warm));
      actor.scale.setScalar(heavy?1.11:.86);
      actor.updateMatrix();
      const i=batch.count++;
      batch.mesh.setMatrixAt(i,actor.matrix);
      batch.pose.setXYZW(i,enemy.warm,enemy.age,Number(heavy)+2*Number(latched)+4*Number(enemy.flash>.10),untilHit);
    }
    for(const {mesh,pose,count} of batches){
      mesh.count=count;
      if(count===0)continue;
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0,count*16);
      mesh.instanceMatrix.needsUpdate=true;
      pose.clearUpdateRanges();
      pose.addUpdateRange(0,count*4);
      pose.needsUpdate=true;
    }
  }

  function prepare(){
    for(const {mesh} of batches){
      mesh.count=1;
      mesh.setMatrixAt(0,actor.matrix);
      mesh.instanceMatrix.needsUpdate=true;
    }
  }

  return {group,update,prepare};
}
