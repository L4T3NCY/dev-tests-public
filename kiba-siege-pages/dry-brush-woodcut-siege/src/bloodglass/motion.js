import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MasonryBatch,seeded} from './kit.js';
import {falls} from './island.js';

function makeWater(group) {
  const random=seeded(0xbc2fe08);
  const time={value:0};
  const waterSheet=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time},
    vertexShader:`
      uniform float time;varying vec2 surface;
      void main(){
        vec3 p=position;
        p.x+=.057*sin(uv.y*22.-time*4.1+uv.x*7.)*uv.y;
        p.z+=.092*sin(uv.y*19.-time*3.5)*uv.y;
        surface=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader:`
      uniform float time;varying vec2 surface;
      float hash(vec2 p){return fract(sin(dot(p,vec2(31.8,173.9)))*47385.1);}
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }
      void main(){
        vec2 p=surface;
        float grain=noise(vec2(p.x*38.,p.y*9.-time*4.6));
        float threads=noise(vec2(p.x*49.,p.y*3.-time*3.7));
        float spray=smoothstep(.48,.87,grain*.49+threads*.51);
        float fall=1.-smoothstep(.35,1.,p.y);
        float edge=pow(max(0.,1.-abs(p.x*2.-1.)),.66);
        vec3 tint=mix(vec3(.23,.20,.21),vec3(1.39,1.18,1.06),spray*.88+fall*.12);
        float alpha=(.20+spray*.51)*fall*edge+.14*exp(-25.*p.y)*edge;
        gl_FragColor=vec4(tint,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });

  const particleOrigins=[],particleShape=[],particleSeed=[];
  const sources = [];
  for(const {x,y,z,width,length,direction} of falls){
    const at=(u,t)=>{
      const s=(u-.5)*width*(1+t*.30);
      return [x+Math.cos(direction)*s-t*t*(1.33+length*.096),y-t*length,
        z-Math.sin(direction)*s+.66*t+.55*t*t];
    };
    for(const layer of [0,.085]){
      const pos=[],uv=[],ids=[];
      for(let j=0;j<=22;j++)for(let i=0;i<=8;i++){
        const t=j/22,u=i/8,p=at(u,t);
        p[2]+=layer+.078*Math.sin(u*5.9)*(1-t);
        pos.push(...p);uv.push(u,t);
        const n=j*9+i;
        if(j<22&&i<8)ids.push(n,n+1,n+9,n+1,n+10,n+9);
      }
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
      geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      geo.setIndex(ids);
      group.add(new THREE.Mesh(geo,waterSheet));
    }
    for(let i=0;i<520;i++){
      const p=at(random(),0);
      particleOrigins.push(...p);
      particleShape.push(length,width,random(),random());
      particleSeed.push(random(),random(),random());
    }
    const pool=new THREE.Mesh(new THREE.CircleGeometry(1,32),new THREE.MeshStandardMaterial({
      color:0x563c65,roughness:.29,metalness:.30,emissive:0x480419,emissiveIntensity:.18
    }));
    pool.rotation.x=-Math.PI*.5;
    pool.position.set(x,y+.035,z-.44);
    pool.scale.set(width*.59,.52,1);
    group.add(pool);
    sources.push(pool);
  }
  const particles=new THREE.BufferGeometry();
  particles.setAttribute('position',new THREE.Float32BufferAttribute(particleOrigins,3));
  particles.setAttribute('fall',new THREE.Float32BufferAttribute(particleShape,4));
  particles.setAttribute('seed',new THREE.Float32BufferAttribute(particleSeed,3));
  const spray=new THREE.Points(particles,new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, uniforms:{time},
    vertexShader:`
      uniform float time;attribute vec4 fall;attribute vec3 seed;
      varying float life;varying float sparkle;
      void main(){
        float age=fract(time*(.38+fall.z*.13)+seed.x);
        float v=age*age;
        vec3 p=position;
        p.x-=(1.33+fall.x*.096)*v*v+age*fall.w*.79;
        p.z+=v*.66+v*v*.55+age*(seed.y-.5)*.76;
        p.y-=v*fall.x*(1.+seed.z*.15);
        p.y+=age*(1.-age)*seed.z*.17;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp((20.+seed.z*41.)/max(1.,-mv.z),1.,5.);
        life=(1.-smoothstep(.53,1.,age))*(.53+seed.z*.47);
        sparkle=.62+.38*pow(max(0.,sin(seed.x*60.+time*6.8)),8.);
      }`,
    fragmentShader:`
      varying float life;varying float sparkle;
      void main(){
        vec2 p=gl_PointCoord*2.-1.;
        float alpha=exp(-dot(p,p)*4.)*life*.74;
        gl_FragColor=vec4(vec3(1.12,.98,.91)*sparkle,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  spray.frustumCulled=false;
  group.add(spray);
  return t=>{
    time.value=t;
    sources.forEach((pool,i)=>{pool.material.emissiveIntensity=.17+.032*Math.sin(t*3.3+i);});
  };
}

function makeBats(group) {
  const shape=new THREE.Shape();
  shape.moveTo(.04,.07);shape.lineTo(.25,.19);shape.lineTo(.49,.101);
  shape.lineTo(.34,-.028);shape.quadraticCurveTo(.29,.079,.25,-.091);
  shape.quadraticCurveTo(.16,-.018,.14,-.12);shape.quadraticCurveTo(.10,-.045,.05,-.158);shape.closePath();
  const wing=new THREE.ShapeGeometry(shape,5);
  wing.rotateX(Math.PI*.5);
  const left=wing.clone().scale(-1,1,1);
  const body=new THREE.SphereGeometry(.066,6,6).scale(.54,.61,1.65);
  const geo=mergeGeometries([wing.toNonIndexed(),left.toNonIndexed(),body.toNonIndexed()]);
  const random=seeded(0x3ec520a);
  const records=[];
  for(let i=0;i<36;i++){
    const large=i<13;
    records.push({phase:random()*6.28,speed:.26+random()*.20,
      cx:large?-2.9:1.5,cy:large?5.15:8.0,cz:large?.8:-.9,
      rx:(large?8.0:5.7)+random()*3.4,rz:3.7+random()*3.3,
      rise:.89+random()*1.75,offset:(random()-.5)*3.0,
      size:.40+random()*.47,flap:2.9+random()*1.6});
  }
  geo.setAttribute('flap',new THREE.InstancedBufferAttribute(new Float32Array(records.map(r=>r.flap)),1));
  geo.setAttribute('phase',new THREE.InstancedBufferAttribute(new Float32Array(records.map(r=>r.phase)),1));
  const time={value:0};
  const mat=new THREE.MeshStandardMaterial({color:0x21152b,side:THREE.DoubleSide,roughness:.93});
  mat.onBeforeCompile=shader=>{
    shader.uniforms.flightTime=time;
    shader.vertexShader='uniform float flightTime;attribute float flap;attribute float phase;\n'+
      shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        float cycle=flightTime*flap*6.28318+phase;
        float stroke=sin(cycle)*(.76+.18*sin(flightTime*1.25+phase));
        float travel=abs(position.x);
        transformed.y+=sin(stroke)*travel*smoothstep(.039,.21,travel);
        transformed.x*=mix(1.,cos(stroke),smoothstep(.039,.21,travel));`);
  };
  const mesh=new THREE.InstancedMesh(geo,mat,records.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;group.add(mesh);
  const item=new THREE.Object3D();
  return t=>{
    time.value=t;
    records.forEach((b,i)=>{
      const a=t*b.speed+b.phase;
      item.position.set(b.cx+Math.cos(a)*b.rx,b.cy+Math.sin(a*1.99)*b.rise+b.offset,b.cz+Math.sin(a)*b.rz);
      item.rotation.set(.06+.32*Math.cos(a*1.99),Math.atan2(-Math.sin(a)*b.rx,Math.cos(a)*b.rz),-.37-.18*Math.sin(a*2.));
      item.scale.setScalar(b.size);
      item.updateMatrix();mesh.setMatrixAt(i,item.matrix);
    });
    mesh.instanceMatrix.needsUpdate=true;
  };
}

function makeFlags(group) {
  const time={value:0};
  const material=new THREE.ShaderMaterial({
    side:THREE.DoubleSide,uniforms:{time},
    vertexShader:`uniform float time;attribute vec2 flutter;varying vec2 cloth;varying float brightness;
      void main(){
        vec3 p=position;
        float freeEdge=pow(1.-uv.y,.70);
        float wave=sin(uv.y*10.+uv.x*4.+time*flutter.x+flutter.y);
        p.x-=freeEdge*(.14+.095*sin(uv.y*7.+time*flutter.x+flutter.y));
        p.z+=freeEdge*(.07+.173*wave);
        cloth=uv;brightness=.73+wave*.20+freeEdge*.16;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader:`varying vec2 cloth;varying float brightness;
      void main(){
        vec2 p=cloth;
        float notch=.150*(1.-pow(abs(p.x*2.-1.),.79));
        if(p.y<notch+.02)discard;
        float border=1.-smoothstep(.030,.085,min(min(p.x,1.-p.x),p.y-notch));
        float stitch=1.-smoothstep(.012,.031,abs(min(p.x,1.-p.x)-.104));
        float y=(p.y-.43)/.41;
        float roundBase=(y-.28)/.28;
        float width=y<.28?.188*sqrt(max(0.,1.-roundBase*roundBase)):.188*pow(max(0.,(1.-y)/.72),1.12);
        float sigil=(1.-smoothstep(width-.017,width+.003,abs(p.x-.5)))*step(0.,y)*step(y,1.);
        float shine=exp(-length((p-vec2(.448,.56))*vec2(15.,11.))*2.9);
        vec3 color=mix(vec3(.035,.015,.028),vec3(.175,.009,.025),max(border,stitch*.52));
        color=mix(color,mix(vec3(.59,.014,.044),vec3(.87,.058,.086),shine),sigil);
        gl_FragColor=vec4(color*brightness,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const fittings=new MasonryBatch();
  let phase=0;
  for(const [x,y,z,w,h,turn] of [[-6.82,2.86,1.05,.74,1.32,0],[-1.43,6.82,-.055,.68,1.69,0],
    [1.58,6.17,-.05,.63,1.48,0],[7.42,3.40,3.88,.63,1.39,0],[7.38,3.38,1.37,.59,1.36,Math.PI*.5]]){
    const geometry=new THREE.PlaneGeometry(w,h,14,24);
    const flutter=new Float32Array(geometry.attributes.position.count*2);
    for(let j=0;j<flutter.length;j+=2){flutter[j]=2.70+phase*.179;flutter[j+1]=phase*2.39996;}
    phase++;
    geometry.setAttribute('flutter',new THREE.BufferAttribute(flutter,2));
    const cloth=new THREE.Mesh(geometry,material);
    cloth.position.set(x,y-h*.5,z);cloth.rotation.y=turn;
    group.add(cloth);
    const dx=Math.cos(turn)*w*.61,dz=-Math.sin(turn)*w*.61;
    fittings.beam([x-dx,y+.018,z-dz],[x+dx,y+.018,z+dz],.056,0x876069);
    for(const sign of [-1,1]){
      const ax=x+sign*dx*.82,az=z+sign*dz*.82;
      fittings.beam([ax-Math.sin(turn)*.45,y+.018,az-Math.cos(turn)*.45],[ax,y+.018,az],.046,0x625267);
    }
  }
  fittings.attach(group);
  return t=>{time.value=t;};
}

export function makeMotion() {
  const group=new THREE.Group();
  const water=makeWater(group),bats=makeBats(group),flags=makeFlags(group);
  return {group,update(t){water(t);bats(t);flags(t);}};
}
