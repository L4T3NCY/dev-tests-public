import * as THREE from 'three';

// A horizontal rail outside the castle keeps its full vertical lane clear.
export const flightRoute=new THREE.CatmullRomCurve3([
  [4.35,6.78],[7.75,6.71],[9.70,4.81],[10.56,1.38],[9.86,-2.55],
  [8.31,-5.80],[4.56,-7.43],[.12,-8.05],[-4.42,-7.45],[-7.94,-6.34],
  [-10.33,-3.38],[-10.82,.78],[-10.78,3.81],[-9.85,5.57],
  [-6.60,7.23],[-2.05,7.35],[1.34,7.08]
].map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal');
flightRoute.arcLengthDivisions=1536;

export const lapLength=flightRoute.getLength();
export const maxFlightSpeed=11.65;
export const floor=.90, ceiling=15.60;

const wrap=n=>THREE.MathUtils.euclideanModulo(n,lapLength);

export function makeFlightState() {
  return {distance:0,speed:0,height:2.70,liftSpeed:0,heading:1};
}

export function updateFlightState(state,along,vertical,dt) {
  const {speed,liftSpeed}=state;
  state.speed=THREE.MathUtils.damp(speed,along*maxFlightSpeed,along?6.2:8.8,dt);
  state.liftSpeed=THREE.MathUtils.damp(liftSpeed,vertical*6.95,vertical?8.4:12.8,dt);
  if(!along&&Math.abs(state.speed)<.025)state.speed=0;
  if(!vertical&&Math.abs(state.liftSpeed)<.024)state.liftSpeed=0;
  if(Math.abs(state.speed)>.33)state.heading=Math.sign(state.speed);
  state.distance=wrap(state.distance+(speed+state.speed)*.5*dt);
  state.height=THREE.MathUtils.clamp(state.height+(liftSpeed+state.liftSpeed)*.5*dt,floor,ceiling);
  if(state.height===floor||state.height===ceiling)state.liftSpeed=0;
}

export function flightPosition(distance,target) {
  return flightRoute.getPointAt(wrap(distance)/lapLength,target);
}
