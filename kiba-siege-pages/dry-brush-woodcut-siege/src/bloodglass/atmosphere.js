import * as THREE from 'three';
import {makeDistantIslands} from './sky-depth.js';
import {makeInkClouds} from './ink-clouds.js';

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
  const moonPosition=new THREE.Vector3(2.7,9.8,-38);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(164,28,18),new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false,
    vertexShader:geometryVertex,
    fragmentShader:`
      varying vec3 worldPoint;
      void main(){
        vec3 ray=normalize(worldPoint-cameraPosition);
        float horizon=1.-smoothstep(.02,.95,abs(ray.y+.14));
        vec3 col=mix(vec3(.78,.72,.62),vec3(1.28,1.16,.97),horizon);
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  sky.renderOrder=1000;
  scene.add(sky);

  const moon=new THREE.Mesh(new THREE.SphereGeometry(5.45,40,28),new THREE.ShaderMaterial({
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
        lava*=.67+smoothstep(.34,.47,basin)*.52;
        lava+=rim*vec3(.49,.048,.029);
        lava*=.76+.58*max(0.,dot(n,normalize(vec3(-.22,.51,.89))));
        gl_FragColor=vec4(lava,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  moon.position.copy(moonPosition);
  scene.add(moon);

  const clouds=makeInkClouds();
  scene.add(clouds.group,makeDistantIslands());
  return {update:clouds.update,view(camera){
    sky.position.copy(camera.position);
    clouds.view(camera);
  }};
}
