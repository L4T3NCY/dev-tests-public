import * as THREE from 'three';

const columns=35, rows=29;
const count=columns*rows;
const fixedStep=1/100;
const index=(x,y)=>y*columns+x;
const edgeProfile=[1.51,1.05,1.46,1.13,1.62,1.12,1.47,.99,1.53];

export function capeShoulder(u) {
  const angle=u*2.42;
  return [Math.sin(angle)*.223,.290+Math.abs(u)*.041,-.162*Math.cos(angle)-.029];
}

function hemLength(u) {
  const t=(u*.5+.5)*(edgeProfile.length-1),i=Math.floor(t);
  return THREE.MathUtils.lerp(edgeProfile[i],edgeProfile[Math.min(i+1,edgeProfile.length-1)],t-i);
}

export function makeCape() {
  const particles=new Float32Array(count*3);
  const previous=new Float32Array(count*3);
  const rest=new Float32Array(count*3);
  const uv=new Float32Array(count*2);
  const anchors=new Float32Array(columns*3);
  const lengths=new Float32Array(columns);
  const colors=new Float32Array(count*3),liningColors=new Float32Array(count*3);
  const triangles=[],links=[];
  const matrix=new THREE.Matrix4();
  const point=new THREE.Vector3(),local=new THREE.Vector3();
  const lastPosition=new THREE.Vector3(),nextPosition=new THREE.Vector3(),smoothPosition=new THREE.Vector3();
  const lastRotation=new THREE.Quaternion(),nextRotation=new THREE.Quaternion(),smoothRotation=new THREE.Quaternion();
  const poseScale=new THREE.Vector3(1,1,1),interpolatedPose=new THREE.Matrix4();
  const dark=new THREE.Color(0x1d1b2a),edge=new THREE.Color(0x4d293e);
  const red=new THREE.Color(0xbd1937),border=new THREE.Color(0x501c32);
  const tint=new THREE.Color();
  for(let x=0;x<columns;x++) {
    const u=x/(columns-1)*2-1;
    anchors.set(capeShoulder(u),x*3);
    lengths[x]=hemLength(u);
  }
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
    const i=index(x,y),u=x/(columns-1)*2-1,v=y/(rows-1);
    const a=x*3;
    rest.set([anchors[a]+u*.60*v,anchors[a+1]-lengths[x]*v,anchors[a+2]*(1-v*.52)-.15*v],i*3);
    uv.set([x/(columns-1),v],i*2);
    const rim=Math.max(Math.pow(Math.abs(u),10),Math.pow(v,8));
    tint.copy(dark).lerp(edge,rim*.74).multiplyScalar(.86+.19*Math.cos(u*19.7));
    colors.set(tint.toArray(),i*3);
    tint.copy(red).lerp(border,rim*.86).multiplyScalar(.92+.12*Math.cos(u*24.+v*4));
    liningColors.set(tint.toArray(),i*3);
    if(x===columns-1||y===rows-1)continue;
    const b=i+1,c=i+columns,d=c+1;
    // Narrow tears cut through the hem and reveal the lining at the folds.
    if (!(y>=rows-3 && (x===7||x===26)))triangles.push(i,b,c);
    if (!(y>=rows-5 && (x===6||x===27)))triangles.push(b,d,c);
  }

  function link(x,y,dx,dy,stiffness) {
    const a=index(x,y)*3,b=index(x+dx,y+dy)*3;
    const distance=Math.hypot(rest[a]-rest[b],rest[a+1]-rest[b+1],rest[a+2]-rest[b+2]);
    links.push({a,b,distance,stiffness,freeA:y>0,freeB:y+dy>0});
  }
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
    if(x+1<columns)link(x,y,1,0,.91);
    if(y+1<rows)link(x,y,0,1,.98);
    if(y+1<rows&&x+1<columns)link(x,y,1,1,.51);
    if(y+1<rows&&x>0)link(x,y,-1,1,.51);
    if(x+2<columns)link(x,y,2,0,.13);
    if(y+2<rows)link(x,y,0,2,.14);
  }

  const group=new THREE.Group();
  group.name='Shoulder-pinned black cape with red lining';
  const positions=new THREE.BufferAttribute(particles,3).setUsage(THREE.DynamicDrawUsage);
  const normals=new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage);
  const faces=new THREE.BufferAttribute(new Uint16Array(triangles),1);
  const textureCoords=new THREE.BufferAttribute(uv,2);
  function mesh(side,vertexColors,emissive,emissiveIntensity) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',positions);
    geometry.setAttribute('normal',normals);
    geometry.setAttribute('uv',textureCoords);
    geometry.setAttribute('color',new THREE.BufferAttribute(vertexColors,3));
    geometry.setIndex(faces);
    const fabric=new THREE.MeshStandardMaterial({
      color:0xffffff,vertexColors:true,side,roughness:.89,emissive,emissiveIntensity
    });
    fabric.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec2 clothUv;\n'+shader.vertexShader.replace(
        '#include <begin_vertex>','#include <begin_vertex>\nclothUv=uv;');
      shader.fragmentShader='varying vec2 clothUv;\n'+shader.fragmentShader.replace(
        '#include <color_fragment>',`#include <color_fragment>
          float threads=sin(clothUv.x*386.0)*sin(clothUv.y*271.0);
          float weave=1.-smoothstep(.014,.068,length(fwidth(clothUv)));
          diffuseColor.rgb*=.96+threads*.12*weave;
        `);
    };
    const part=new THREE.Mesh(geometry,fabric);
    part.frustumCulled=false;
    group.add(part);
    return geometry;
  }
  const outer=mesh(THREE.FrontSide,colors,0x130916,.29);
  mesh(THREE.BackSide,liningColors,0x370511,.42);

  function pin(shoulders) {
    for(let x=0;x<columns;x++) {
      const j=x*3;
      point.fromArray(rest,j).applyMatrix4(shoulders);
      point.toArray(particles,j);
      point.toArray(previous,j);
    }
  }

  function aim(i,shoulders,speed,lift,t) {
    const u=uv[i*2]*2-1,v=uv[i*2+1],column=i%columns,a=column*3;
    const length=lengths[column]*v;
    const billow=Math.sin(v*16-t*(5.1+speed*3.8)+u*4.4)*v;
    const gust=Math.sin(v*9-t*3.1+u*6.6)*v;
    const sail=.18+speed*.87-lift*.065+billow*(.12+speed*.14)+gust*.15;
    const spread=anchors[a]+u*(.12+speed*.59)*v+gust*.11+billow*.054;
    const drop=anchors[a+1]-Math.cos(sail)*length+gust*.080;
    const trail=anchors[a+2]*(1-v*.47)-.13*v-.87*Math.sin(sail)*length+gust*.091;
    return point.set(spread,drop,trail).applyMatrix4(shoulders);
  }

  function reset(shoulders,time) {
    for(let i=0;i<count;i++){
      aim(i,shoulders,0,0,time).toArray(particles,i*3);
      point.toArray(previous,i*3);
    }
    pin(shoulders);
    shoulders.decompose(lastPosition,lastRotation,poseScale);
    upload();
  }
  function upload() {
    positions.needsUpdate=true;
    outer.computeVertexNormals();
  }

  function step(shoulders,speed,lift,t) {
    matrix.copy(shoulders).invert();
    pin(shoulders);
    for(let i=columns;i<count;i++){
      const p=i*3;
      aim(i,shoulders,speed,lift,t);
      for(let axis=0;axis<3;axis++){
        const j=p+axis,current=particles[j];
        const gravity=axis===1?-.00072:0;
        const wind=(point.getComponent(axis)-current)*(.0067+speed*.0078);
        particles[j]=current+(current-previous[j])*.958+gravity+wind;
        previous[j]=current;
      }
    }
    for(let iteration=0;iteration<7;iteration++){
      for(const {a,b,distance,stiffness,freeA,freeB} of links){
        const dx=particles[b]-particles[a],dy=particles[b+1]-particles[a+1],dz=particles[b+2]-particles[a+2];
        const length=Math.sqrt(dx*dx+dy*dy+dz*dz);
        if(length<1e-7)continue;
        const f=(length-distance*poseScale.x)/length*stiffness/(Number(freeA)+Number(freeB)||1);
        if(freeA){particles[a]+=dx*f;particles[a+1]+=dy*f;particles[a+2]+=dz*f;}
        if(freeB){particles[b]-=dx*f;particles[b+1]-=dy*f;particles[b+2]-=dz*f;}
      }
      if(iteration%2===0)for(let i=columns;i<count;i++){
        const p=i*3;
        local.fromArray(particles,p).applyMatrix4(matrix);
        if(local.y<=-.51||local.y>=.35)continue;
        // An elliptical body proxy allows the cloth to roll around the
        // shoulders and hips while keeping it outside the torso.
        const bodyWidth=local.y<-.16?.141:.217;
        const r=Math.hypot(local.x/bodyWidth,local.z/.139);
        if(r>=1)continue;
        if(r<.001)local.z=-.139;
        else {local.x/=r; local.z/=r;}
        local.applyMatrix4(shoulders).toArray(particles,p);
      }
    }
  }

  let remainder=0;
  return {group,reset,update(shoulders,speed,lift,time,delta) {
    shoulders.decompose(nextPosition,nextRotation,poseScale);
    remainder+=delta;
    while(remainder>=fixedStep) {
      remainder-=fixedStep;
      const alpha=THREE.MathUtils.clamp(1-remainder/delta,0,1);
      smoothPosition.lerpVectors(lastPosition,nextPosition,alpha);
      smoothRotation.slerpQuaternions(lastRotation,nextRotation,alpha);
      interpolatedPose.compose(smoothPosition,smoothRotation,poseScale);
      step(interpolatedPose,speed,lift,time-remainder);
    }
    lastPosition.copy(nextPosition);
    lastRotation.copy(nextRotation);
    pin(shoulders);
    upload();
  }};
}
