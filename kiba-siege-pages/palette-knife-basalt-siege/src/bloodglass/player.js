import * as THREE from 'three';
import {flightRoute,flightPosition,lapLength,makeFlightState,updateFlightState,maxFlightSpeed} from './flight-route.js';
import {makeCape} from './cape.js';
import {makeVampireModel} from './vampire-model.js';

export function angleDelta(from,to) {
  return THREE.MathUtils.euclideanModulo(to-from+Math.PI,2*Math.PI)-Math.PI;
}

export function makePlayer() {
  const group=new THREE.Group();
  const rig=new THREE.Group(), model=makeVampireModel(),cape=makeCape();
  group.add(rig,cape.group);
  rig.add(model.body);

  const state=makeFlightState();
  const tangent=new THREE.Vector3();
  flightRoute.getTangentAt(0,tangent);
  let yaw=Math.atan2(tangent.x,tangent.z),bank=0;
  function pose(time,delta) {
    flightPosition(state.distance,rig.position);
    flightRoute.getTangentAt(state.distance/lapLength,tangent).multiplyScalar(state.heading);
    const motion=Math.min(1,Math.abs(state.speed)/maxFlightSpeed);
    const turn=angleDelta(yaw,Math.atan2(tangent.x,tangent.z));
    const steer=turn*(1-Math.exp(-delta*6.7));
    yaw+=steer;
    const bend=THREE.MathUtils.clamp(-turn*.65,-.39,.39);
    bank=THREE.MathUtils.damp(bank,bend,7,delta);
    rig.rotation.y=yaw;
    rig.position.y+=state.height+Math.sin(time*2.9)*.034*(1-motion*.62);
    const rise=THREE.MathUtils.clamp(tangent.y*motion+state.liftSpeed*.19,-1,1);
    model.pose(motion,rise,bank,time);
    group.updateMatrixWorld(true);
    return {motion,rise};
  }
  pose(0,0);
  cape.reset(model.body.matrixWorld,0);
  return {group,position:rig.position,reset(time) {
    Object.assign(state,makeFlightState());
    flightRoute.getTangentAt(0,tangent);
    yaw=Math.atan2(tangent.x,tangent.z);
    bank=0;
    pose(time,0);
    cape.reset(model.body.matrixWorld,time);
  },update(along,vertical,time,delta) {
    updateFlightState(state,along,vertical,delta);
    const {motion,rise}=pose(time,delta);
    cape.update(model.body.matrixWorld,motion,rise,time,delta);
  }};
}
