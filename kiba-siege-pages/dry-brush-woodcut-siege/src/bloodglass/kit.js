import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {art,paintStone} from './art-direction.js';

export const {stone,trim,basalt,iron,roof} = art.colors;
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
export function inkStoneMaterial(color) {
  return paintStone(new THREE.MeshLambertMaterial({color}));
}
const stoneMaterial = inkStoneMaterial(0xffffff);
export const rockMaterial = paintStone(new THREE.MeshLambertMaterial(),true);

export const glassMaterial = new THREE.MeshBasicMaterial({color:0xffffff, side:THREE.DoubleSide});
export const metalMaterial = new THREE.MeshStandardMaterial({color:0xffffff, roughness:.62, metalness:.24});
export const leafMaterial = new THREE.MeshLambertMaterial();

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
