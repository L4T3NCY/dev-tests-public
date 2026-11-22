import * as THREE from 'three';
import {seeded} from './kit.js';
import {art} from './art-direction.js';

export function makeForegroundClouds(noise) {
  const group=new THREE.Group(),geometry=new THREE.SphereGeometry(1,30,19);
  const random=seeded(0x31e64c3);
  const sharedVertex=`
    varying vec3 shell;
    void main(){shell=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
  `;
  const sharedFragment=`
    uniform vec3 eye;uniform mat4 fromCloud;uniform float clock;uniform float seed;uniform float density;
    varying vec3 shell;
    ${noise}
    void main(){
      vec3 ray=normalize(shell-eye);
      float b=dot(eye,ray), c=dot(eye,eye)-1.;
      float test=b*b-c;
      if(test<=0.)discard;
      float radius=sqrt(test);
      float start=max(.035,-b-radius), finish=-b+radius;
      if(finish<=start)discard;
      float stride=(finish-start)/6.;
      vec4 accum=vec4(0.);
      float depthSample=-1.;
      for(int i=0;i<6;i++){
        float t=start+(float(i)+.48)*stride;
        vec3 p=eye+ray*t;
        vec3 q=p*vec3(2.55,2.61,2.26)+vec3(seed-clock*.134,6.2+seed*.89,11.);
        float billow=noise3(q)*.72+noise3(q*2.3+vec3(0,2.,7.))*.28;
        float shape=exp(-dot(p,p)*2.61);
        float interior=shape*smoothstep(.33,.72,billow+shape*.23);
        float alpha=1.-exp(-interior*density*stride);
        float lighting=smoothstep(-.63,.86,p.y+(billow-.59)*.92);
        vec3 shadow=${art.woodcut?'vec3(.22,.19,.16)':'vec3(.16,.12,.15)'};
        vec3 light=${art.woodcut?'vec3(.89,.84,.76)':'vec3(.60,.48,.49)'};
        vec3 tint=mix(shadow,light,lighting*(.61+.38*billow));
        if(depthSample<0.&&alpha>.019)depthSample=t;
        accum.rgb+=(1.-accum.a)*alpha*tint;
        accum.a+=(1.-accum.a)*alpha;
      }
      if(accum.a<.028)discard;
      vec4 clip=fromCloud*vec4(eye+ray*(depthSample<0.?start:depthSample),1.);
      gl_FragDepth=clamp(.5+.5*clip.z/clip.w,0.,1.);
      gl_FragColor=vec4(accum.rgb/accum.a,min(.60,accum.a));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;
  const heights=[5.9,3.8,10.9,2.3,6.7,2.5];
  const clouds=heights.map((height,i)=>{
    const phase=.32+i*Math.PI*2/heights.length;
    const radius=14.2+random()*2.56;
    const rate=.074+random()*.052;
    const uniforms={eye:{value:new THREE.Vector3()},fromCloud:{value:new THREE.Matrix4()},
      clock:{value:0},seed:{value:i*7.13+random()},density:{value:.70+random()*.38}};
    const mesh=new THREE.Mesh(geometry,new THREE.ShaderMaterial({
      uniforms,vertexShader:sharedVertex,fragmentShader:sharedFragment,
      transparent:true,depthWrite:false,side:THREE.BackSide
    }));
    mesh.scale.set(3.95+random()*2.72,1.11+random()*1.13,1.9+random()*1.53);
    group.add(mesh);
    return {mesh,uniforms,phase,radius,height,rate};
  });
  const inverse=new THREE.Matrix4(),projection=new THREE.Matrix4();
  function update(time) {
    for(const {mesh,uniforms,phase,radius,height,rate} of clouds){
      const a=phase+time*rate;
      const r=radius+.81*Math.sin(time*.38+phase);
      mesh.position.set(r*Math.sin(a),height+Math.sin(time*.48+phase*2.6)*1.62,r*Math.cos(a));
      mesh.rotation.set(0,a,Math.sin(time*.29+phase)*.17,'YXZ');
      uniforms.clock.value=time;
    }
  }
  function view(camera) {
    projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    for(const {mesh,uniforms} of clouds){
      mesh.updateMatrixWorld(true);
      uniforms.eye.value.copy(camera.position).applyMatrix4(inverse.copy(mesh.matrixWorld).invert());
      uniforms.fromCloud.value.multiplyMatrices(projection,mesh.matrixWorld);
    }
  }
  update(0);
  return {group,view,update};
}

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
  for(const [range,count,level] of [[55,7,-15],[83,10,-19]]){
    for(let i=0;i<count;i++){
      const angle=i/count*Math.PI*2+.33+(random()-.5)*.17;
      const radius=range+(random()-.5)*16;
      const x=Math.sin(angle)*radius,z=Math.cos(angle)*radius;
      const y=level+(random()-.50)*19;
      const scale=1.48+random()*2.60;
      const shades=range>60?[0x45435f,0x494867,0x4b4867]:[0x343b59,0x414461,0x3c4667];
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
