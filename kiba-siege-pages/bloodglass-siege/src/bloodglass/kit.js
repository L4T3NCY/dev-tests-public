import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

export const stone = [0x384560, 0x485573, 0x303953, 0x4d4e61, 0x555469, 0x3d4559, 0x343748, 0x695356, 0x524452];
export const trim = [0x6b6278, 0x575970, 0x686979, 0x796376, 0x524862];
export const basalt = [0x293047, 0x353b55, 0x262b44, 0x3d3750, 0x48506c, 0x514255, 0x36304b, 0x2f3b52];
export const iron = [0x302939, 0x484354, 0x3d3546];
export const roof = [0x3e283f, 0x422b42, 0x50334a, 0x513448, 0x34283f, 0x412d48, 0x5e3949];
export const choose = (random, palette) => palette[Math.floor(random() * palette.length)];
export const radians = a => a * Math.PI / 180;

export function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const unitBox = new RoundedBoxGeometry(1, 1, 1, 1, .056);
const plainBox = new THREE.BoxGeometry();
const shaft = new THREE.CylinderGeometry(.40, .5, 1, 5);
const pin = new THREE.CylinderGeometry(.022, .5, 1, 4);
const up = new THREE.Vector3(0, 1, 0);
const worldPosition = new THREE.Vector3();
const axis = new THREE.Vector3();
const rotation = new THREE.Quaternion();
const pivot = new THREE.Object3D();
const scratchColor = new THREE.Color();
const stoneMaterial = new THREE.MeshStandardMaterial({color:0xffffff,roughness:.87,metalness:.03});
stoneMaterial.onBeforeCompile = shader => {
  shader.vertexShader = 'varying vec3 stonePosition;\n' + shader.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
     vec4 blockPosition=vec4(position,1.);
     #ifdef USE_INSTANCING
     blockPosition=instanceMatrix*blockPosition;
     #endif
     stonePosition=blockPosition.xyz;`);
  shader.fragmentShader = `varying vec3 stonePosition;
  float mineral(vec3 p) {
    p=fract(p*.1031);
    p+=dot(p,p.yzx+33.33);
    return fract((p.x+p.y)*p.z);
  }
  ` + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
    vec3 grit=stonePosition*vec3(17.,33.,17.);
    float grain=mineral(floor(grit));
    float seam=mineral(floor(stonePosition*vec3(4.,9.,4.)));
    float edge=1.-smoothstep(.3,1.2,max(length(dFdx(grit)),length(dFdy(grit))));
    diffuseColor.rgb*=.91+(grain-.46)*edge*.30+seam*.20;
  `);
};

export const glassMaterial = new THREE.MeshBasicMaterial({color:0xffffff, side:THREE.DoubleSide});
export const metalMaterial = new THREE.MeshStandardMaterial({color:0xffffff, roughness:.62, metalness:.24});
export const leafMaterial = new THREE.MeshStandardMaterial({color:0xffffff,roughness:.94});

export class MasonryBatch {
  constructor() {
    this.batches = new Map();
  }

  instance(geometry, material, position, size, color, turn=0, shadow=true) {
    const key = `${geometry.id}/${material.id}/${shadow}`;
    if (!this.batches.has(key)) this.batches.set(key,{geometry,material,shadow,items:[]});
    pivot.position.fromArray(position);
    pivot.scale.fromArray(size);
    if (typeof turn === 'number') pivot.rotation.set(0,turn,0);
    else pivot.quaternion.copy(turn);
    pivot.updateMatrix();
    this.batches.get(key).items.push([pivot.matrix.clone(),scratchColor.set(color).clone()]);
  }

  block(position, size, color, turn=0, rounded=true, shadow=true) {
    this.instance(rounded?unitBox:plainBox,stoneMaterial,position,size,color,turn,shadow);
  }

  leaf(position, size, color, turn) {
    this.instance(plainBox,leafMaterial,position,size,color,turn,false);
  }

  spike(position, size, color, turn=0) {
    this.instance(pin,stoneMaterial,position,size,color,turn);
  }

  beam(a,b,r,color,angular=false) {
    worldPosition.fromArray(a);
    axis.fromArray(b).sub(worldPosition);
    const length = axis.length();
    rotation.setFromUnitVectors(up,axis.normalize());
    worldPosition.addScaledVector(axis,length*.5);
    this.instance(angular?plainBox:shaft,stoneMaterial,worldPosition.toArray(),[r,length,r],color,rotation);
  }

  attach(parent) {
    for (const {geometry,material,shadow,items} of this.batches.values()) {
      const mesh = new THREE.InstancedMesh(geometry,material,items.length);
      for (let i=0;i<items.length;i++) {
        mesh.setMatrixAt(i,items[i][0]);
        mesh.setColorAt(i,items[i][1]);
      }
      mesh.castShadow=shadow;
      mesh.receiveShadow=material!==glassMaterial;
      mesh.computeBoundingSphere();
      parent.add(mesh);
    }
    this.batches.clear();
  }
}
