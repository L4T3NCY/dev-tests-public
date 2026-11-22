import * as THREE from 'three';
import {MasonryBatch,basalt,seeded,choose} from './kit.js';
import {makeForegroundClouds,makeDistantIslands} from './sky-depth.js';
import {art} from './art-direction.js';

const noise = `
float hash3(vec3 p) {
  p=fract(p*.1031);
  p+=dot(p,p.yzx+33.33);
  return fract((p.x+p.y)*p.z);
}
float noise3(vec3 p){
  vec3 i=floor(p),f=fract(p);
  f=f*f*(3.-2.*f);
  return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){
  float r=0.,amp=.55;
  for(int i=0;i<4;i++){r+=noise3(p)*amp;p=p*2.07+vec3(2.3,14.2,4.1);amp*=.48;}
  return r;
}
`;
const geometryVertex = `varying vec3 worldPoint;varying vec3 modelPoint;
void main(){
  modelPoint=position;
  worldPoint=(modelMatrix*vec4(position,1.)).xyz;
  gl_Position=projectionMatrix*viewMatrix*vec4(worldPoint,1.);
}`;

export function makeAtmosphere(scene) {
  const time={value:0}, moonPosition=new THREE.Vector3(2.7,9.8,-38);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(164,28,18),new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false,
    uniforms:{time,moonPosition:{value:moonPosition}}, vertexShader:geometryVertex,
    fragmentShader:`
      uniform float time;uniform vec3 moonPosition;
      varying vec3 worldPoint;
      ${noise}
      void main(){
        vec3 ray=normalize(worldPoint-cameraPosition);
        vec3 lightDir=normalize(moonPosition-cameraPosition);
        float moonDot=max(0.,dot(lightDir,ray));
        float haze=exp(-pow((ray.y+.09)*2.55,2.));
        vec3 dir=ray*vec3(5.4,13.,5.4)+vec3(time*.012,0.,-5.);
        float broad=fbm(dir);
        float fiber=fbm(dir*vec3(.84,2.70,.84)+vec3(0.,broad*1.29,0.));
        float pigment=broad*.64+fiber*.36;
        float body=smoothstep(.42,.60,pigment);
        float shape=smoothstep(.48,.51,pigment)*.56+smoothstep(.54,.58,pigment)*.44;
        float highlight=smoothstep(.52,.61,pigment+fiber*.12);
        ${art.woodcut?`
          vec3 paper=mix(vec3(.81,.75,.66),vec3(1.15,1.06,.96),haze);
          float etched=noise3(dir*vec3(10.,14.,10.)+vec3(fiber*3.,1.,9.));
          float wash=smoothstep(.525,.55,pigment)*.42+smoothstep(.58,.62,pigment)*.43;
          float strokes=smoothstep(.46,.51,pigment)*smoothstep(.50,.75,etched);
          vec3 col=paper*(1.-wash*.69-strokes*.16);
          col=mix(col,vec3(.18,.16,.14),wash*(1.-haze*.39)*.55);
        `:`
          vec3 col=mix(vec3(.026,.018,.035),vec3(.25,.135,.158),haze);
          float strokes=smoothstep(.48,.70,noise3(dir*vec3(3.,12.,3.)+vec3(fiber*2.,0.,7.)));
          col=mix(col,vec3(.38,.29,.35),body*.72);
          col+=highlight*vec3(.21,.15,.19)*(strokes*.65+.39);
          col+=pow(moonDot,12.)*vec3(.105,.014,.027);
          col-=shape*(1.-highlight)*vec3(.056,.048,.054);
        `}
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  sky.renderOrder=-20;
  scene.add(sky);

  const moon=new THREE.Mesh(new THREE.SphereGeometry(5.45,80,48),new THREE.ShaderMaterial({
    uniforms:{},vertexShader:geometryVertex,
    fragmentShader:`
      varying vec3 worldPoint;varying vec3 modelPoint;
      ${noise}
      void main(){
        vec3 n=normalize(modelPoint);
        vec3 p=n*4.9;
        float basin=fbm(p+vec3(0.,5.3,1.));
        float grain=noise3(p*17.)*.46+noise3(p*37.)*.54;
        float rough=fbm(p*3.3+15.);
        float seas=smoothstep(.38,.62,basin+rough*.13);
        float rim=pow(1.-max(0.,dot(n,normalize(cameraPosition-worldPoint))),3.4);
        vec3 lava=mix(vec3(1.08,.041,.081),vec3(.35,.007,.027),seas*.91);
        lava*=.73+rough*.45+grain*.21;
        ${art.woodcut?'lava*=.67+smoothstep(.34,.47,basin)*.52;':''}
        lava+=rim*vec3(.49,.048,.029);
        lava*=.76+.58*max(0.,dot(n,normalize(vec3(-.22,.51,.89))));
        gl_FragColor=vec4(lava,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  moon.position.copy(moonPosition);
  scene.add(moon);

  const random=seeded(0xf1ad1926);
  const puffs = [];
  function bank(x,y,z,count,span,wide,thickness,speed,kind) {
    for(let i=0;i<count;i++){
      const phase=(i/count-.5);
      puffs.push([
        x+phase*span+(random()-.5)*2.2,y+Math.sin(i*.83)*thickness*.45+(random()-.5)*thickness,
        z+(random()-.5)*wide*.73,
        wide*(.47+random()*.70),thickness*(.66+random()*.81),speed,kind,random()
      ]);
    }
  }
  // Background banks, middle-distance swirls, and a few low foreground veils.
  bank(-14,5,-23,17,48,13,4.7,.19,0);
  bank(16,2,-35,19,50,15,4.5,.115,0);
  bank(-15,-4,-13,15,39,13,6.4,.32,1);
  bank(19,-6,-11,16,45,17,6.6,.31,1);
  bank(3,-12,9,16,46,16,5.7,.73,2);
  bank(-10,-7,16,6,38,14,2.05,.91,2);
  bank(15,-5.7,17,5,34,15,2.60,.88,2);
  bank(-18,-9.3,2,7,20,12,3.1,.54,1);
  const clouds=makePuffs(puffs,time);
  scene.add(clouds);
  const foreground=makeForegroundClouds(noise);
  scene.add(foreground.group,makeDistantIslands());

  // A trio of remote shelves establishes scale when looking through the bridge.
  const outcrops = [];
  for(const [x,y,z,r] of [[-22,-6,-23,4.6],[24,-8,-25,4.0],[-18,-11,8,2.9],[21,-13,13,2.05],[-34,-9,-4,3.6],[26,-8,5,1.8]]){
    const shard=new THREE.Group();shard.position.set(x,y,z);
    const kit=new MasonryBatch();
    for(let a=-r;a<=r;a+=.71)for(let b=-r*.55;b<=r*.55;b+=.68){
      const f=Math.hypot(a/r,b/(r*.58));
      if(f>.97+random()*.10)continue;
      const drop=.38+(1-f)**.6*r*1.40+random()*.45;
      for(let j=0;j<drop;j+=.81){
        kit.block([a,-j,b],[.71+random()*.09,.86,.69+random()*.085],choose(random,basalt),0,false,false);
      }
    }
    if(z<-14)for(let i=0;i<4;i++){
      const a=(random()-.5)*r*1.2,b=(random()-.5)*r*.56,h=.42+random()*1.6;
      kit.block([a,h*.5,b],[.45,h,.45],0x40384f,0,false,false);
      kit.spike([a,h+.37,b],[.52,.75,.52],0x312a41);
    }
    kit.attach(shard);scene.add(shard);
    outcrops.push({shard,y,phase:random()*6.28});
  }
  return {update(t) {
    time.value=t;
    if(t>0)outcrops.forEach(({shard,y,phase})=>{shard.position.y=y+Math.sin(t*.26+phase)*.24;});
    clouds.reorder(t);
    foreground.update(t);
  },view(camera) {
    sky.position.copy(camera.position);
    foreground.view(camera);
  }};
}

function makePuffs(puffs,time) {
  const cloudRoot=new THREE.Group();
  const material=new THREE.ShaderMaterial({
    depthWrite:false,transparent:true,side:THREE.DoubleSide,
    uniforms:{time},
    vertexShader:`
      uniform float time;
      attribute vec3 center;attribute vec2 size;attribute vec3 weather;
      varying vec2 mask;varying vec3 info;
      void main(){
        vec3 p=center;
        p.x=mod(p.x-time*weather.x+61.,122.)-61.;
        p.y+=sin(time*.24+weather.z*6.28)*.31;
        vec4 mv=viewMatrix*vec4(p,1.);
        mv.xy+=position.xy*size;
        info=vec3(weather.yz,-mv.z);
        mask=position.xy*2.;
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:`
      uniform float time;
      varying vec2 mask;varying vec3 info;
      ${noise}
      void main(){
        float kind=info.x;
        vec3 q=vec3(mask*vec2(2.2,1.42),info.y*17.);
        q.x+=time*.067;
        float vapor=fbm(q*vec3(.81,1.67,1.)+vec3(0.,2.3,0.));
        float core=dot(mask,mask*vec2(1.18,1.60))+(vapor-.51)*.78;
        float shell=max(0.,exp(-core*2.85)-.055);
        float density=shell*smoothstep(.28,.61,vapor);
        float cut=smoothstep(.41,.46,vapor);
        float alpha=clamp(density*(.52+cut*.48)*(kind>1.5?.37:kind>.5?.48:.59),0.,.58);
        alpha*=smoothstep(2.,10.,info.z);
        if(alpha<.008)discard;
        float top=smoothstep(-.73,.51,mask.y+(vapor-.49)*.9);
        vec3 dark=${art.woodcut?'vec3(.42,.37,.33)':'vec3(.095,.055,.089)'};
        vec3 light=${art.woodcut?'vec3(.93,.87,.81)':'vec3(.52,.41,.45)'};
        vec3 tint=mix(dark,light,top*.82);
        gl_FragColor=vec4(tint,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  // Independent world-space Gaussian cards let Three sort their overlap from any orbit.
  const quad=new THREE.PlaneGeometry(1,1);
  const sprites=[];
  for(const [x,y,z,width,height,speed,kind,phase] of puffs){
    const geo=new THREE.InstancedBufferGeometry();
    geo.index=quad.index;
    geo.attributes.position=quad.attributes.position;
    geo.setAttribute('center',new THREE.InstancedBufferAttribute(new Float32Array([0,0,0]),3));
    geo.setAttribute('size',new THREE.InstancedBufferAttribute(new Float32Array([width,height]),2));
    geo.setAttribute('weather',new THREE.InstancedBufferAttribute(new Float32Array([speed,kind,phase]),3));
    geo.instanceCount=1;
    const card=new THREE.Mesh(geo,material);
    card.frustumCulled=false;
    // The anchor is updated on the CPU so transparent sorting uses the same location as the shader.
    cloudRoot.add(card);
    geo.attributes.center.setXYZ(0,x,y,z);
    sprites.push({card,x,y,z,speed});
  }
  cloudRoot.reorder=t=>{
    for(const {card,x,y,z,speed} of sprites){
      const drift=THREE.MathUtils.euclideanModulo(x-t*speed+61,122)-61;
      card.position.set(drift,y,z);
    }
  };
  return cloudRoot;
}
