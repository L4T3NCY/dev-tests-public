import * as THREE from 'three';

function spot(scene,color,distance) {
  const light=new THREE.SpotLight(color,0,distance,Math.PI*.32,.75,2);
  light.castShadow=true;
  light.shadow.mapSize.set(256,256);
  light.shadow.camera.near=.14;
  light.shadow.bias=-.00025;
  light.shadow.normalBias=.028;
  light.shadow.radius=2;
  light.shadow.autoUpdate=false;
  scene.add(light,light.target);
  return light;
}

export function makeSpellLighting(scene,renderer) {
  const channel=spot(scene,0xff4662,11),impact=spot(scene,0xff4656,12);
  let spark=0, shadowClock=0;
  const shadowOrigin=new THREE.Vector3();
  function request(light) {
    light.shadow.needsUpdate=true;
    renderer.shadowMap.needsUpdate=true;
  }
  function hit(enemy) {
    spark=enemy.health>0?81:43;
    impact.position.copy(enemy.position).addScaledVector(enemy.zone.normal,.47);
    impact.position.y+=.12;
    impact.target.position.copy(enemy.position).addScaledVector(enemy.zone.normal,-3.5);
    impact.target.position.y-=1.22;
    impact.intensity=spark;
    request(impact);
  }
  function update(position,progress,dt) {
    const wasLit=channel.intensity>0;
    channel.intensity=progress>0?(5.1+progress*progress*45):0;
    if(progress>0){
      channel.position.copy(position);
      channel.position.y+=.22;
      channel.target.position.set(position.x*.60,Math.min(11,position.y-1.45),position.z*.60);
      shadowClock-=dt;
      if(!wasLit||(shadowClock<=0&&shadowOrigin.distanceToSquared(position)>.45**2)){
        shadowOrigin.copy(position);
        shadowClock=.11;
        request(channel);
      }
    }
    spark*=Math.exp(-dt*10.8);
    impact.intensity=spark>.12?spark:0;
  }
  function reset() {
    spark=shadowClock=0;
    channel.intensity=impact.intensity=0;
  }
  return {hit,update,reset};
}
