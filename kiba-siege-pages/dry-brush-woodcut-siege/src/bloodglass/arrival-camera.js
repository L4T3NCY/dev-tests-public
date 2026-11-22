import * as THREE from 'three';

const up=new THREE.Vector3(0,1,0);
const settleTime=2.60;

export function makeArrivalCamera(){
  const position=new THREE.Vector3(),target=new THREE.Vector3();
  const center=new THREE.Vector3(),outward=new THREE.Vector3(),right=new THREE.Vector3(),toPack=new THREE.Vector3();
  const pose={position,target};
  let pack=null,age=0;

  function cue(enemies){
    pack=enemies;
    age=0;
  }

  function clear(){
    pack=null;
  }

  function update(dt,basePosition,baseTarget,camera){
    if(!pack)return null;
    age+=dt;
    if(age>=settleTime){
      clear();
      return null;
    }
    let flying=0;
    center.set(0,0,0);
    for(const enemy of pack){
      if(enemy.health<=0||enemy.phase!=='air')continue;
      center.add(enemy.position);
      flying++;
    }
    if(!flying){
      clear();
      return null;
    }
    center.multiplyScalar(1/flying);
    outward.subVectors(basePosition,baseTarget);
    const distance=outward.length();
    outward.divideScalar(distance);
    right.crossVectors(up,outward).normalize();
    toPack.subVectors(center,baseTarget);

    // Leave the player in frame even at close zoom or in a narrow window.
    const easeIn=THREE.MathUtils.smoothstep(age,0,.46);
    const easeOut=1-THREE.MathUtils.smoothstep(age,1.62,settleTime);
    const weight=easeIn*easeOut;
    const halfWidth=distance*Math.tan(THREE.MathUtils.degToRad(camera.fov)*.5)*camera.aspect;
    const panLimit=Math.min(6.6,halfWidth*.89);
    const pan=THREE.MathUtils.clamp(toPack.dot(right)*.60,-panLimit,panLimit)*weight;
    const rise=THREE.MathUtils.clamp(distance*.14,.30,1.85)*weight;
    const aimHeight=THREE.MathUtils.clamp(toPack.y*.28,-.6,Math.min(1.55,distance*.14))*weight;

    position.copy(basePosition).addScaledVector(outward,Math.min(4.4,distance*.29)*weight)
      .addScaledVector(right,pan*.22);
    position.y+=rise;
    target.copy(baseTarget).addScaledVector(right,pan);
    target.y+=aimHeight;
    return pose;
  }

  return {cue,clear,update};
}
