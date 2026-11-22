import * as THREE from 'three';

const sphere=new THREE.SphereGeometry(1,36,24);
const stroke=new THREE.TorusGeometry(.96,.022,5,45,Math.PI*1.54);
const mote=new THREE.OctahedronGeometry(1,0);
const turn=[new THREE.Vector3(.60,.92,.24),new THREE.Vector3(.86,.30,.54),new THREE.Vector3(.21,.56,1)]
  .map(axis=>axis.normalize());

function skin(color,frequency) {
  return new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,
    blending:THREE.AdditiveBlending,
    uniforms:{ink:{value:new THREE.Color(...color)},energy:{value:0},time:{value:0},frequency:{value:frequency}},
    vertexShader:`
      varying vec3 direction;varying vec3 worldPoint;varying vec3 surfaceNormal;
      void main(){
        direction=normalize(position);
        vec4 world=modelMatrix*vec4(position,1.);
        worldPoint=world.xyz;surfaceNormal=normalize(mat3(modelMatrix)*normal);
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader:`
      uniform vec3 ink;uniform float energy;uniform float time;uniform float frequency;
      varying vec3 direction;varying vec3 worldPoint;varying vec3 surfaceNormal;
      void main(){
        vec3 n=normalize(direction);
        float facing=abs(dot(normalize(surfaceNormal),normalize(cameraPosition-worldPoint)));
        float rim=pow(1.-facing,2.15);
        vec3 p=n*frequency;
        float crooked=sin(p.z*1.91+sin(p.y*2.33-time*3.8))*.72;
        float vein=pow(.5+.5*cos(p.x*2.41+p.y*1.7+p.z*2.1+crooked*3.6-time*4.6),10.);
        float sparks=pow(.5+.5*sin(p.y*4.2+p.x*2.9+sin(p.z*4.0+time*1.2)*2.6),8.)*vein;
        float gaps=smoothstep(-.62,.34,sin(p.y*1.4+p.z*1.1+p.x*.69+time*.82));
        float alpha=energy*(.031+.27*rim+.30*vein*gaps+.24*sparks)*(gl_FrontFacing?1.:.60);
        if(alpha<.008)discard;
        gl_FragColor=vec4(ink*(.48+.66*rim+.43*vein+.82*sparks),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
}

function orb() {
  const root=new THREE.Group();
  const outer=new THREE.Mesh(sphere,skin([2.2,.020,.105],4.2));
  const inner=new THREE.Mesh(sphere,skin([2.58,.133,.204],6.2));
  const core=new THREE.Mesh(sphere,new THREE.MeshBasicMaterial({
    color:new THREE.Color(3.15,.273,.33),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending
  }));
  const arcs=turn.map((axis,i)=>{
    const cradle=new THREE.Group();
    cradle.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),axis);
    const ring=new THREE.Mesh(stroke,new THREE.MeshBasicMaterial({
      color:new THREE.Color(1.97,i===0?.053:.136,.216),transparent:true,depthWrite:false,
      blending:THREE.AdditiveBlending
    }));
    ring.rotation.z=i*2.094;
    cradle.add(ring);
    root.add(cradle);
    return ring;
  });
  root.add(outer,inner,core);
  root.visible=false;
  return {root,outer,inner,core,arcs};
}

function shade(mesh,scale,opacity,clock) {
  mesh.scale.setScalar(scale);
  mesh.material.uniforms.energy.value=opacity;
  mesh.material.uniforms.time.value=clock;
}

export function makeSpellOrbs() {
  const group=new THREE.Group(),charge=orb(),bursts=Array.from({length:6},orb);
  const crystal=new THREE.InstancedMesh(mote,new THREE.MeshBasicMaterial({
    color:new THREE.Color(2.26,.115,.31),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending
  }),34);
  crystal.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  crystal.frustumCulled=false;
  charge.root.add(crystal);
  group.add(charge.root,...bursts.map(burst=>burst.root));
  const dummy=new THREE.Object3D();
  let cursor=0;

  function channel(position,progress,time) {
    charge.root.visible=progress>0;
    if(!charge.root.visible)return;
    const power=Math.max(.04,progress),envelope=Math.min(1,power*5.5);
    charge.root.position.copy(position);
    charge.root.position.y+=.10;
    charge.root.rotation.set(time*1.82,time*3.13,time*.97);
    shade(charge.outer,1.12-power*.47,envelope*.84,time*1.66);
    shade(charge.inner,.20+power*.38,envelope*.93,-time*1.47);
    charge.core.scale.setScalar(.12+power*.14);
    charge.core.material.opacity=power*power*.79;
    for(let i=0;i<charge.arcs.length;i++){
      const arc=charge.arcs[i];
      arc.material.opacity=envelope*(.46+i*.067);
      arc.scale.setScalar(1.20-power*.42+i*.079);
      arc.rotation.z=time*(3.6+i*2.3)+i*1.9;
    }
    for(let i=0;i<crystal.count;i++){
      const y=(i+.5)/crystal.count*2-1,r=Math.sqrt(1-y*y);
      const a=i*2.399963+time*(2.43+i*.050),phase=Math.sin(a*1.15+time*4.2);
      const d=(1.48-power*.61)*(1+.138*phase);
      dummy.position.set(Math.cos(a)*r*d,y*d,Math.sin(a)*r*d);
      const size=.026+power*.030+(i%4)*.008;
      dummy.scale.set(.68*size,size*(2.2+.41*phase),size);
      dummy.rotation.set(a,a*.43,time*3.8+a*.31);
      dummy.updateMatrix();
      crystal.setMatrixAt(i,dummy.matrix);
    }
    crystal.material.opacity=envelope*.84;
    crystal.instanceMatrix.needsUpdate=true;
  }

  function release(position,source=false) {
    const burst=bursts[cursor++%bursts.length];
    burst.root.position.copy(position);
    burst.root.rotation.set(cursor*.89,cursor*1.71,-cursor*.77);
    burst.root.visible=true;
    burst.source=source;
    burst.age=0;
  }

  function update(dt,time) {
    for(const burst of bursts){
      if(!burst.root.visible)continue;
      burst.age+=dt;
      const t=burst.age/(burst.source?.37:.69);
      if(t>=1){burst.root.visible=false;continue;}
      const decay=1-t,reach=burst.source?1.18:2.12;
      const surge=.15+(1-Math.exp(-t*4.75))*reach;
      burst.root.rotation.y+=dt*(burst.source?3.8:2.7);
      shade(burst.outer,surge,decay*decay*(burst.source?.99:1.14),time*1.19);
      const follow=Math.max(0,t-.10);
      shade(burst.inner,.12+(1-Math.exp(-follow*6.7))*reach*.79,decay*.87,time*-1.62);
      burst.core.scale.setScalar((.12+t*.83)*(burst.source?.72:1.46));
      burst.core.material.opacity=Math.exp(-t*11)*.98;
      for(let i=0;i<burst.arcs.length;i++){
        const arc=burst.arcs[i];
        arc.scale.setScalar(surge*(.83+i*.105));
        arc.rotation.z=burst.age*(6.1+i*1.89)+i*2.1;
        arc.material.opacity=decay*decay*(burst.source?.68:.86);
      }
    }
  }
  function reset(){
    charge.root.visible=false;
    for(const burst of bursts)burst.root.visible=false;
    cursor=0;
  }
  return {group,channel,release,update,reset};
}
