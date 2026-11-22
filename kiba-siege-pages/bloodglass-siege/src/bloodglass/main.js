import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {makeCitadel} from './citadel.js';
import {makeIsland} from './island.js';
import {makeAtmosphere} from './atmosphere.js';
import {makeMotion} from './motion.js';
import {makePlayer,angleDelta} from './player.js';
import {makeRoseGarden} from './garden.js';
import {makeFountain} from './fountain.js';
import {makeSiege} from '../siege/rules.js';
import {makeGargoyle} from '../siege/gargoyle.js';
import {makeSiegeEffects} from '../siege/spell.js';
import {makeSiegeHud} from '../siege/hud.js';
import {makeSpellLighting} from '../siege/spell-light.js';
import {collisionBounds,makeDebrisField} from '../siege/debris-physics.js';
import {makeGargoyleDebris} from '../siege/gargoyle-debris.js';

const $=id=>document.getElementById(id);

function launch() {
  const renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true,powerPreference:'high-performance'});
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate=false;
  renderer.shadowMap.needsUpdate=true;

  const scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(0x28223d,.010);
  const camera=new THREE.PerspectiveCamera(40,1,.16,200);
  const controls=new OrbitControls(camera,$('scene'));
  controls.enableDamping=true;
  controls.dampingFactor=.075;
  controls.rotateSpeed=.79;
  controls.zoomSpeed=.92;
  controls.panSpeed=.80;
  controls.minDistance=2.65;
  controls.maxDistance=106;
  controls.maxPolarAngle=2.50;
  controls.minPolarAngle=.12;
  controls.listenToKeyEvents(window);

  const player=makePlayer();
  scene.add(player.group);
  const hud=makeSiegeHud(), effects=makeSiegeEffects();
  const foes=new Map();
  const spellLighting=makeSpellLighting(scene,renderer);
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const impactShakeDuration=.175;
  let shakeTime=0,shaking=false;
  scene.add(effects.group);
  const siege=makeSiege((type,event)=>{
    if(type==='spawn'){
      const gargoyle=makeGargoyle(event.heavy);
      scene.add(gargoyle.body);foes.set(event.id,gargoyle);
    }else if(type==='attack'){
      effects.lash(event.from,event.enemy.position,event.enemy.health>0);
      spellLighting.hit(event.enemy);
      if(!reduceMotion.matches)shakeTime=impactShakeDuration;
    }else if(type==='kill'){
      debris.shatter(event);
      scene.remove(foes.get(event.id).body);foes.delete(event.id);
      hud.erase(event.id);
    }else if(type==='damage'){
      effects.burst(event.position,22,2.20,'wall');
      hud.flash();
    }else if(type==='latch'){
      effects.burst(event.position,13,1.3,'wall');
    }
  });
  const up=new THREE.Vector3(0,1,0);
  const followOffset=new THREE.Vector3(-2.35,4.35,11.7);
  const center=player.position.clone().add(new THREE.Vector3(0,.83,0));
  const nextCenter=new THREE.Vector3(),targetOffset=new THREE.Vector3(),eyeOffset=new THREE.Vector3();
  let followAngle=Math.atan2(center.x,center.z);
  const views={
    follow:null,
    overview:{pos:[23.1,13.5,36.1],target:[-.40,.95,.10]}
  };
  let flight=null, activeView='follow';
  const goalPosition=new THREE.Vector3(),goalTarget=new THREE.Vector3();
  function setFollowGoal() {
    const narrow=1+Math.max(0,1.1-camera.aspect)*.39;
    goalTarget.copy(center);
    goalPosition.copy(followOffset).applyAxisAngle(up,followAngle).multiplyScalar(narrow).add(center);
  }
  function useView(view,instant=false) {
    activeView=view;
    if(view==='follow')setFollowGoal();
    else {
      const {pos,target}=views[view];
      const narrow=1+Math.max(0,1.2-camera.aspect)*(view==='overview'?.70:.31);
      goalTarget.fromArray(target);
      goalPosition.fromArray(pos).sub(goalTarget).multiplyScalar(narrow).add(goalTarget);
    }
    for(const id of Object.keys(views))$(id).setAttribute('aria-pressed',String(id===view));
    if(instant) {
      camera.position.copy(goalPosition);
      controls.target.copy(goalTarget);
      controls.update();
      flight=null;
    } else {
      flight={time:0,position:camera.position.clone(),target:controls.target.clone()};
    }
  }
  for(const id of Object.keys(views))$(id).addEventListener('click',()=>useView(id));
  controls.addEventListener('start',()=>{
    flight=null;
    if(activeView==='follow')return;
    activeView=null;
    for(const id of Object.keys(views))$(id).setAttribute('aria-pressed','false');
  });

  const citadel=makeCitadel(), island=makeIsland(), motion=makeMotion();
  const garden=makeRoseGarden(),fountain=makeFountain();
  scene.add(island.group,citadel.group,motion.group,garden.group,fountain.group);
  const debris=makeGargoyleDebris(makeDebrisField(collisionBounds(citadel.group,island.group,fountain.group)));
  scene.add(debris.group);
  const atmosphere=makeAtmosphere(scene);
  scene.add(new THREE.HemisphereLight(0xbdceff,0x614267,1.36));
  const key=new THREE.DirectionalLight(0xbacbff,2.20);
  key.position.set(-19,23,15);
  key.castShadow=true;
  key.shadow.mapSize.set(1536,1536);
  Object.assign(key.shadow.camera,{left:-20,right:20,top:21,bottom:-19,near:1,far:68});
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias=-.00019;
  key.shadow.normalBias=.04;
  key.shadow.radius=2;
  key.shadow.autoUpdate=false;
  key.shadow.needsUpdate=true;
  scene.add(key);
  const rim=new THREE.DirectionalLight(0xff5564,2.18);
  rim.position.set(4,14,-25);
  scene.add(rim);
  const fill=new THREE.DirectionalLight(0x848dff,.61);
  fill.position.set(16,-6,14);
  scene.add(fill);

  // A few larger stained glass groups illuminate the adjacent real geometry.
  const lamps=[];
  for(const anchor of citadel.lightAnchors) {
    const [x,y,z]=anchor;
    if (y<1.80 || (z<0.01 && y<7.5)) continue;
    const light=new THREE.PointLight(y>4.0?0xff3c39:0xff5f4c,y<6.4?11.8:7.8,5.3,2);
    light.position.set(x,y,z);
    lamps.push({light,strength:light.intensity});
    scene.add(light);
  }

  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1,1),.48,.56,.72));
  composer.addPass(new OutputPass());

  let elapsed=0, previous=performance.now(),paused=false;
  const keys=new Set();
  const flightKeys=new Set(['KeyW','KeyA','KeyS','KeyD']);
  const held=code=>Number(keys.has(code));
  function resize(first=false) {
    const w=window.innerWidth,h=window.innerHeight;
    const pixelRatio=Math.min(devicePixelRatio,1.4,Math.sqrt(2750000/(w*h)));
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w,h,false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w,h);
    effects.resize(h*pixelRatio);
    camera.aspect=w/h;
    camera.updateProjectionMatrix();
    if(activeView)useView(activeView,first);
  }
  window.addEventListener('resize',()=>resize());
  resize(true);

  function setPaused(value) {
    paused=value;
    keys.clear();
    $('motion').setAttribute('aria-pressed',String(paused));
    $('motion').textContent=paused?'Play':'Pause';
  }
  function restart() {
    for(const foe of foes.values())scene.remove(foe.body);
    foes.clear();
    hud.reset();effects.reset();
    debris.reset();
    spellLighting.reset();
    shakeTime=0;
    setPaused(false);
    player.reset(elapsed);
    center.copy(player.position);center.y+=.83;
    followAngle=Math.atan2(center.x,center.z);
    useView('follow',true);
    siege.start();
  }
  $('motion').addEventListener('click',()=>setPaused(!paused));
  $('begin').addEventListener('click',restart);
  window.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.isComposing||
      event.target instanceof Element&&event.target.closest('input,textarea,[contenteditable]'))return;
    if(flightKeys.has(event.code)){
      event.preventDefault();
      if(siege.game.phase==='ready')restart();
      if(!paused)keys.add(event.code);
      return;
    }
    if(event.repeat)return;
    if(event.key.toLowerCase()==='h')document.body.classList.toggle('clean');
    if(event.key.toLowerCase()==='r')restart();
    if(event.key.toLowerCase()==='p')setPaused(!paused);
    if(event.key.toLowerCase()==='f')useView('follow');
    if(event.key==='Escape'||event.key==='1')useView('overview');
  });
  window.addEventListener('keyup',event=>keys.delete(event.code));
  window.addEventListener('blur',()=>keys.clear());
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){keys.clear();if(siege.game.phase==='wave')setPaused(true);}
  });
  $('scene').addEventListener('webglcontextlost',event=>{
    event.preventDefault();
    renderer.setAnimationLoop(null);
    $('status').hidden=false;
    $('status').textContent='The graphics context was interrupted. Reload to restart the diorama.';
  });

  function animate(now) {
    const delta=Math.max(0,Math.min(.05,(now-previous)*.001));
    previous=now;
    if(!paused){
      elapsed+=delta;
      const flying=siege.game.phase==='wave'||siege.game.phase==='breather';
      player.update(flying?held('KeyD')-held('KeyA'):0,flying?held('KeyW')-held('KeyS'):0,elapsed,delta);
      siege.update(delta,player.position);
      for(const enemy of siege.game.enemies)foes.get(enemy.id).update(enemy,elapsed);
      const charge=siege.game.channel?.progress??0;
      effects.channel(player.position,charge,elapsed);
      effects.update(delta,elapsed);
      debris.update(delta);
      spellLighting.update(player.position,charge,delta);
      shakeTime=Math.max(0,shakeTime-delta);
      island.update(elapsed);
      motion.update(elapsed);
      garden.update(elapsed);
      fountain.update(elapsed);
      atmosphere.update(elapsed);
      for(let i=0;i<lamps.length;i++){
        const {light,strength}=lamps[i];
        light.intensity=strength*(.92+.08*Math.sin(elapsed*2.24+i*2.04));
      }
    }
    nextCenter.copy(player.position);
    nextCenter.y+=.83;
    nextCenter.lerp(center,Math.exp(-delta*13));
    const heading=Math.atan2(player.position.x,player.position.z);
    const shift=angleDelta(followAngle,heading)*(1-Math.exp(-delta*5.4));
    followAngle+=shift;
    if(activeView==='follow'&&!flight) {
      // Carry the user’s orbit, pan, and zoom with the moving follow target.
      eyeOffset.copy(camera.position).sub(controls.target).applyAxisAngle(up,shift);
      targetOffset.copy(controls.target).sub(center).applyAxisAngle(up,shift);
      controls.target.copy(nextCenter).add(targetOffset);
      camera.position.copy(controls.target).add(eyeOffset);
    }
    center.copy(nextCenter);
    if(flight) {
      if(activeView==='follow')setFollowGoal();
      flight.time+=delta/.75;
      const t=Math.min(1,flight.time), blend=t*t*(3-2*t);
      camera.position.lerpVectors(flight.position,goalPosition,blend);
      controls.target.lerpVectors(flight.target,goalTarget,blend);
      if(t===1)flight=null;
    }
    controls.update();
    if(shakeTime>0){
      const t=1-shakeTime/impactShakeDuration,amplitude=1.85*(1-t)*(1-t);
      const x=amplitude*Math.sin(t*29.5+.7),y=amplitude*.64*Math.cos(t*23.+1.7);
      camera.setViewOffset(innerWidth,innerHeight,x,y,innerWidth,innerHeight);
      shaking=true;
    }else if(shaking){
      camera.clearViewOffset();
      shaking=false;
    }
    camera.updateMatrixWorld();
    atmosphere.view(camera);
    hud.update(paused?0:delta,siege,player.position,camera,paused);
    composer.render();
    $('status').hidden=true;
  }
  renderer.setAnimationLoop(animate);
}

try{
  launch();
}catch(error){
  console.error(error);
  $('status').textContent='The diorama could not start. Try reloading in a browser with WebGL 2 enabled.';
}
