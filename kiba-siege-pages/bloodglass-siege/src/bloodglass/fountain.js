import * as THREE from 'three';
import {MasonryBatch,stone,trim,seeded,choose} from './kit.js';
import {falls} from './island.js';

const x=-3.86,z=4.08;
const basinTop=.581;
const iron=0x574253;

export function makeFountain() {
  const group=new THREE.Group(),kit=new MasonryBatch();
  const time={value:0};
  const random=seeded(0x6baf77);
  const pick=palette=>choose(random,palette);
  const octagon=(radius,height,i)=>[x+Math.sin(i*Math.PI/4)*radius,height,z+Math.cos(i*Math.PI/4)*radius];
  const towerStone=new THREE.MeshStandardMaterial({color:0x544962,roughness:.77,metalness:.07});
  const water=waterMaterial(time);
  function tier(profile,segments,mat=towerStone) {
    const mesh=new THREE.Mesh(new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),segments),mat);
    mesh.position.set(x,0,z);
    mesh.castShadow=true;mesh.receiveShadow=true;
    group.add(mesh);
  }
  tier([[0,.15],[1.09,.15],[1.09,.26],[1.02,.32],[.99,.44],[.99,.52],[1.06,.54],[1.06,.60],[.91,.60],[.89,.56],[.87,.43]],8);
  tier([[0,.46],[.42,.46],[.42,.53],[.29,.57],[.24,.68],[.20,.95],[.29,1.01],[.39,1.06],[.43,1.17],[.42,1.23],[.38,1.23],[.37,1.17]],8);
  tier([[0,1.15],[.15,1.15],[.17,1.38],[.12,1.45],[.08,1.59],[0,1.70]],6);

  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    kit.block(octagon(1.001,.376,i),[.156,.30,.116],pick(trim),a);
    kit.block(octagon(1.045,.392,i),[.104,.104,.065],0x9b747c,a);
    const [xx,,zz]=octagon(.54,.55,i);
    const [topX,,topZ]=octagon(.23,.91,i+.40);
    kit.beam([xx,.57,zz],[topX,.93,topZ],.077,pick(trim),true);
    if(i%2===0){
      kit.spike(octagon(.78,.73,i),[.20,.25,.20],pick(stone),a);
      kit.block(octagon(.79,.636,i),[.15,.16,.15],pick(trim),a);
    }
  }
  kit.spike([x,1.71,z],[.105,.31,.105],iron,Math.PI*.25);
  kit.attach(group);

  for(const [radius,height] of [[.94,basinTop],[.406,1.198]]){
    const poolGeometry=new THREE.CircleGeometry(radius,8,Math.PI/2);
    poolGeometry.rotateX(-Math.PI*.5);
    const pool=new THREE.Mesh(poolGeometry,water);
    pool.position.set(x,height,z);
    group.add(pool);
  }

  const outlet=falls[0];
  // The same source point is used by the island's existing waterfall.
  const run=[
    [x,basinTop,z+.82],[x-.033,.60,z+1.025],[x-.06,.34,z+1.135],[x-.14,.272,5.43],
    [x-.035,.261,5.72],[outlet.x+.075,.243,6.31],[outlet.x,outlet.y+.012,outlet.z+.087]
  ].map(point=>new THREE.Vector3(...point));
  const runoff=new THREE.CatmullRomCurve3(run,false,'centripetal');
  group.add(ribbon(runoff,water,.39,.91,48));

  const droplets=[];
  for(let i=0;i<5;i++){
    const angle=i*Math.PI*2/5+.29;
    const at=(r,y)=>[x+r*Math.sin(angle),y,z+r*Math.cos(angle)];
    const route=new THREE.CatmullRomCurve3([
      at(.23,1.23),at(.40,1.229),at(.49,1.13),at(.60,.84),at(.68,basinTop)
    ].map(p=>new THREE.Vector3(...p)));
    group.add(ribbon(route,water,.077,.12,20));
    for(let j=0;j<18;j++)droplets.push({route,speed:.87+random()*.47,phase:random(),size:.010+random()*.018});
  }
  for(let i=0;i<4;i++){
    const alpha=i*.39+1.12;
    const splashAt=(rad,y)=>[x+rad*Math.sin(alpha),y,z+rad*Math.cos(alpha)];
    const route=new THREE.CatmullRomCurve3([
      splashAt(.88,basinTop+.02),splashAt(1.015,basinTop+.03),splashAt(1.11,.45),splashAt(1.27,.28)
    ].map(p=>new THREE.Vector3(...p)));
    group.add(ribbon(route,water,.085,.19,18));
    for(let j=0;j<9;j++)droplets.push({route,speed:1.05+random()*.62,phase:random(),size:.010+random()*.017});
  }
  for(let j=0;j<22;j++)droplets.push({route:runoff,speed:.24+random()*.24,phase:random(),size:.007+random()*.013});
  const sparks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),
    new THREE.MeshBasicMaterial({color:new THREE.Color(1.13,.28,.39)}),droplets.length);
  sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  sparks.frustumCulled=false;
  group.add(sparks);
  const dummy=new THREE.Object3D();
  return {group,update(t) {
    time.value=t;
    droplets.forEach(({route,speed,phase,size},i)=>{
      const u=(t*speed+phase)%1;
      route.getPointAt(u,dummy.position);
      dummy.position.y+=Math.sin(u*Math.PI)*(.021+.029*Math.sin(i));
      dummy.scale.set(size,size*(1.10+u*.36),size);
      dummy.updateMatrix();sparks.setMatrixAt(i,dummy.matrix);
    });
    sparks.instanceMatrix.needsUpdate=true;
  }};
}

function ribbon(curve,material,startWidth,endWidth,segments) {
  const positions=[],uv=[],indices=[];
  const side=new THREE.Vector3(),point=new THREE.Vector3(),tangent=new THREE.Vector3();
  const up=new THREE.Vector3(0,1,0);
  for(let i=0;i<=segments;i++){
    const u=i/segments;
    curve.getPoint(u,point);curve.getTangent(u,tangent);
    side.crossVectors(tangent,up).normalize();
    const width=THREE.MathUtils.lerp(startWidth,endWidth,u)*.5;
    for(const sign of [-1,1]){
      positions.push(point.x+sign*side.x*width,point.y,point.z+sign*side.z*width);
      uv.push((sign+1)/2,u);
    }
    if(i<segments){
      const a=i*2; indices.push(a,a+2,a+1,a+1,a+2,a+3);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(indices);
  return new THREE.Mesh(geo,material);
}

function waterMaterial(time) {
  return new THREE.ShaderMaterial({
    uniforms:{time},transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`
      varying vec2 waterUV;
      void main(){waterUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
    `,
    fragmentShader:`
      uniform float time;varying vec2 waterUV;
      void main(){
        vec2 p=waterUV;
        float stream=sin(p.x*45.+sin(p.y*17.-time*3.7)*2.);
        float current=sin(p.y*84.-time*6.6+stream*2.2);
        float glint=pow(max(0.,sin(p.y*55.-time*5.+sin(p.x*28.)*2.)*
          sin(p.x*36.+p.y*18.+time*1.3)),6.);
        vec3 tint=mix(vec3(.167,.075,.23),vec3(.82,.27,.42),.29+.17*stream+.13*current);
        tint+=vec3(.92,.43,.59)*glint*.85;
        gl_FragColor=vec4(tint,.70+glint*.16);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
}
