import * as THREE from 'three';

function spring(value) {
  return {value,velocity:0};
}

function advance(state,goal,rate,dt,snap) {
  if(snap){
    state.value=goal;
    state.velocity=0;
    return;
  }
  // Exact critically damped spring step, independent of the display refresh rate.
  const error=state.value-goal;
  const slope=state.velocity+rate*error;
  const decay=Math.exp(-rate*dt);
  state.value=goal+(error+slope*dt)*decay;
  state.velocity=(state.velocity-rate*slope*dt)*decay;
}

function constrain(state,min,max) {
  const bounded=THREE.MathUtils.clamp(state.value,min,max);
  if(bounded!==state.value){
    state.value=bounded;
    state.velocity=0;
  }
}

export function makeCameraEase(camera,controls) {
  const target=new THREE.Vector3();
  const offset=new THREE.Vector3();
  const orbit=new THREE.Spherical();
  const x=spring(0),y=spring(0),z=spring(0);
  const azimuth=spring(0),elevation=spring(Math.PI/2),distance=spring(0);

  return function update(dt,snap=false,position=controls.object.position,desired=controls.target) {
    orbit.setFromVector3(offset.subVectors(position,desired));
    advance(x,desired.x,19,dt,snap);
    advance(y,desired.y,17,dt,snap);
    advance(z,desired.z,19,dt,snap);

    // A sweep across the back of the castle should take the short way around.
    const turn=THREE.MathUtils.euclideanModulo(orbit.theta-azimuth.value+Math.PI,2*Math.PI)-Math.PI;
    advance(azimuth,azimuth.value+turn,22,dt,snap);
    advance(elevation,orbit.phi,22,dt,snap);
    advance(distance,Math.log(orbit.radius),19,dt,snap);
    constrain(elevation,controls.minPolarAngle,controls.maxPolarAngle);
    constrain(distance,Math.log(controls.minDistance),Math.log(controls.maxDistance));

    target.set(x.value,y.value,z.value);
    orbit.set(Math.exp(distance.value),elevation.value,azimuth.value);
    camera.position.setFromSpherical(orbit).add(target);
    camera.lookAt(target);
  };
}
