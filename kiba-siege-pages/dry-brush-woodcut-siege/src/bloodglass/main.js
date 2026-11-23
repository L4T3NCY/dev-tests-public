import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {art,makeStudyOutput} from './art-direction.js';
import {makeCitadel} from './citadel.js';
import {makeIsland} from './island.js';
import {makeCliffStrata} from './cliff-strata.js';
import {makeAtmosphere} from './atmosphere.js';
import {makeMotion} from './motion.js';
import {makePlayer,angleDelta} from './player.js';
import {makeCameraEase} from './camera-ease.js';
import {makeFlightStick} from './flight-stick.js';
import {makeArrivalCamera} from './arrival-camera.js';
import {makeRoseGarden} from './garden.js';
import {makeFountain} from './fountain.js';
import {makeSiege} from '../siege/rules.js';
import {makeGargoyleCrowd} from '../siege/gargoyle.js';
import {makeSiegeEffects} from '../siege/spell.js';
import {makeSiegeHud} from '../siege/hud.js';
import {makeSpellLighting} from '../siege/spell-light.js';
import {collisionBounds,makeDebrisField} from '../siege/debris-physics.js';
import {makeGargoyleDebris} from '../siege/gargoyle-debris.js';

const $=id=>document.getElementById(id);

function useCompactShadowFilter() {
  // The pinned Three.js filter uses 17 comparisons. Five retain a soft edge for the ink wash.
  const chunk=THREE.ShaderChunk.shadowmap_pars_fragment;
  const filter=/(#if defined\( SHADOWMAP_TYPE_PCF \))\s*vec2 texelSize[^]*?(?=#elif defined\( SHADOWMAP_TYPE_PCF_SOFT \))/;
  THREE.ShaderChunk.shadowmap_pars_fragment=chunk.replace(filter,`$1
    vec2 radius=vec2(.35*shadowRadius)/shadowMapSize;
    shadow=(
      texture2DCompare(shadowMap,shadowCoord.xy,shadowCoord.z)+
      texture2DCompare(shadowMap,shadowCoord.xy+radius,shadowCoord.z)+
      texture2DCompare(shadowMap,shadowCoord.xy-radius,shadowCoord.z)+
      texture2DCompare(shadowMap,shadowCoord.xy+vec2(radius.x,-radius.y),shadowCoord.z)+
      texture2DCompare(shadowMap,shadowCoord.xy+vec2(-radius.x,radius.y),shadowCoord.z)
    )*.2;
  `);
}

async function launch() {
  useCompactShadowFilter();
  const renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:false,powerPreference:'high-performance'});
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=art.exposure;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate=false;
  renderer.shadowMap.needsUpdate=true;

  const scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(art.fog,art.fogDensity);
  const camera=new THREE.PerspectiveCamera(40,1,.16,200);
  const orbitCamera=camera.clone();
  const controls=new OrbitControls(orbitCamera,$('scene'));
  controls.rotateSpeed=.79;
  controls.zoomSpeed=.92;
  controls.panSpeed=.80;
  controls.minDistance=2.65;
  controls.maxDistance=106;
  controls.maxPolarAngle=2.50;
  controls.minPolarAngle=.12;
  controls.listenToKeyEvents(window);
  const updateCamera=makeCameraEase(camera,controls);
  const arrivalCamera=makeArrivalCamera();
  let orbiting=false;

  const player=makePlayer();
  scene.add(player.group);
  const hud=makeSiegeHud(), effects=makeSiegeEffects();
  const gargoyles=makeGargoyleCrowd();
  let ready=false;
  const spellLighting=makeSpellLighting(scene,renderer);
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const impactShakeDuration=.175;
  let shakeTime=0,shaking=false;
  scene.add(effects.group,gargoyles.group);
  const siege=makeSiege((type,event)=>{
    if(type==='pack'){
      if(activeView==='follow'&&!orbiting&&!reduceMotion.matches)arrivalCamera.cue(event.enemies);
    }else if(type==='attack'){
      effects.lash(event.from,event.enemy.position,event.enemy.health>0);
      spellLighting.hit(event.enemy);
      if(!reduceMotion.matches)shakeTime=impactShakeDuration;
    }else if(type==='kill'){
      debris.shatter(event);
    }else if(type==='damage'){
      effects.burst(event.position,siege.game.enemies.length>60?7:22,2.20,'wall');
      hud.flash();
    }else if(type==='latch'){
      effects.burst(event.position,siege.game.enemies.length>60?4:13,1.3,'wall');
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
  let activeView='overview';
  const goalPosition=new THREE.Vector3(),goalTarget=new THREE.Vector3();
  function setFollowGoal() {
    const narrow=1+Math.max(0,1.1-camera.aspect)*.39;
    goalTarget.copy(center);
    goalPosition.copy(followOffset).applyAxisAngle(up,followAngle).multiplyScalar(narrow).add(center);
  }
  function useView(view,instant=false) {
    activeView=view;
    arrivalCamera.clear();
    if(view==='follow')setFollowGoal();
    else {
      const {pos,target}=views[view];
      const narrow=1+Math.max(0,1.2-camera.aspect)*.70;
      goalTarget.fromArray(target);
      goalPosition.fromArray(pos).sub(goalTarget).multiplyScalar(narrow).add(goalTarget);
    }
    for(const id of Object.keys(views))$(id).setAttribute('aria-pressed',String(id===view));
    orbitCamera.position.copy(goalPosition);
    controls.target.copy(goalTarget);
    controls.update();
    if(instant||reduceMotion.matches)updateCamera(0,true);
  }
  for(const id of Object.keys(views))$(id).addEventListener('click',()=>useView(id));
  controls.addEventListener('start',()=>{
    orbiting=true;
    arrivalCamera.clear();
    if(activeView==='follow')return;
    activeView=null;
    for(const id of Object.keys(views))$(id).setAttribute('aria-pressed','false');
  });

  controls.addEventListener('end',()=>{orbiting=false;});
  reduceMotion.addEventListener('change',()=>arrivalCamera.clear());

  const citadel=makeCitadel(), island=makeIsland(), motion=makeMotion();
  const garden=makeRoseGarden(),fountain=makeFountain();
  scene.add(island.group,citadel.group,motion.group,garden.group,fountain.group);
  const debris=makeGargoyleDebris(makeDebrisField(collisionBounds(citadel.group,island.group,fountain.group)));
  scene.add(debris.group,makeCliffStrata());
  const atmosphere=makeAtmosphere(scene);
  scene.add(new THREE.HemisphereLight(...art.ambient));
  const key=new THREE.DirectionalLight(...art.key);
  key.position.set(-19,23,15);
  key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-20,right:20,top:21,bottom:-19,near:1,far:68});
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias=-.00019;
  key.shadow.normalBias=.04;
  key.shadow.radius=2;
  key.shadow.autoUpdate=false;
  key.shadow.needsUpdate=true;
  scene.add(key);
  // The stained glass carries most of the color. Light the main façades at three points.
  for(const [x,y,z,brightness] of [
    [4.33,4.09,3.68,6.7],
    [.12,8.80,-.42,4.8],
    [-5.6,4.16,-4.75,4.4]
  ]){
    const light=new THREE.PointLight(0xff4255,brightness,4.5,2);
    light.position.set(x,y,z);
    scene.add(light);
  }

  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  composer.addPass(makeStudyOutput());

  let elapsed=0, previous=performance.now(),paused=false;
  const keys=new Set();
  const flightStick=makeFlightStick($('flight-stick'));
  const inFlight=()=>siege.game.phase==='wave'||siege.game.phase==='breather';
  const flightKeys=new Set(['KeyW','KeyA','KeyS','KeyD']);
  const held=code=>Number(keys.has(code));
  let renderScale=1, averageFrame=16.7, qualityClock=0, fastTime=0;
  function scaleBuffers() {
    const w=window.innerWidth,h=window.innerHeight;
    const pixelRatio=Math.min(devicePixelRatio,1.4,Math.sqrt(1250000/(w*h)))*renderScale;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w,h,false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w,h);
    effects.resize(h*pixelRatio);
  }
  function resize(first=false) {
    scaleBuffers();
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    orbitCamera.aspect=camera.aspect;
    orbitCamera.updateProjectionMatrix();
    if(first||activeView==='overview')useView('overview',first);
  }
  window.addEventListener('resize',()=>resize());
  resize(true);

  function tuneResolution(frameMs) {
    // Ignore tab switches and startup spikes, and wait for sustained headroom before increasing quality.
    if(frameMs<=0||frameMs>500||document.hidden)return;
    const step=Math.min(frameMs,75);
    averageFrame+=(step-averageFrame)*.075;
    qualityClock+=frameMs;
    fastTime=averageFrame<19?fastTime+step:0;
    if(qualityClock<1300)return;
    qualityClock=0;
    const next=averageFrame>29?Math.max(.66,renderScale-.10):
      fastTime>2900?Math.min(1,renderScale+.05):renderScale;
    if(next===renderScale)return;
    renderScale=next;
    fastTime=0;
    scaleBuffers();
  }

  function setPaused(value) {
    paused=value;
    keys.clear();
    flightStick.reset();
    flightStick.setEnabled(!paused&&inFlight());
    $('motion').setAttribute('aria-pressed',String(paused));
    $('motion').textContent=paused?'Play':'Pause';
  }
  function restart() {
    if(!ready)return;
    hud.reset();effects.reset();
    debris.reset();
    spellLighting.reset();
    shakeTime=0;
    setPaused(false);
    player.reset(elapsed);
    center.copy(player.position);center.y+=.83;
    followAngle=Math.atan2(center.x,center.z);
    useView('follow');
    siege.start();
    flightStick.setEnabled(true);
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
  window.addEventListener('blur',()=>{keys.clear();flightStick.reset();});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){keys.clear();flightStick.reset();if(inFlight())setPaused(true);}
  });
  $('scene').addEventListener('webglcontextlost',event=>{
    event.preventDefault();
    flightStick.setEnabled(false);
    renderer.setAnimationLoop(null);
    $('status').hidden=false;
    $('status').textContent='The graphics context was interrupted. Reload to restart the diorama.';
  });

  function animate(now) {
    const frameMs=now-previous;
    const delta=Math.max(0,Math.min(.05,frameMs*.001));
    previous=now;
    if($('status').hidden)tuneResolution(frameMs);
    if(!paused){
      elapsed+=delta;
      const flying=inFlight();
      const {along,vertical}=flightStick.axes;
      const turn=THREE.MathUtils.clamp(held('KeyD')-held('KeyA')+along,-1,1);
      const climb=THREE.MathUtils.clamp(held('KeyW')-held('KeyS')+vertical,-1,1);
      player.update(flying?turn:0,flying?climb:0,elapsed,delta);
      siege.update(delta,player.position);
      flightStick.setEnabled(inFlight());
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
    }
    nextCenter.copy(player.position);
    nextCenter.y+=.83;
    const heading=Math.atan2(player.position.x,player.position.z);
    const shift=angleDelta(followAngle,heading);
    followAngle=heading;
    if(activeView==='follow') {
      // Carry user framing in the moving follow rig; ease the resulting pose only once.
      eyeOffset.copy(orbitCamera.position).sub(controls.target).applyAxisAngle(up,shift);
      targetOffset.copy(controls.target).sub(center).applyAxisAngle(up,shift);
      controls.target.copy(nextCenter).add(targetOffset);
      orbitCamera.position.copy(controls.target).add(eyeOffset);
      controls.update();
    }
    center.copy(nextCenter);
    const arrival=arrivalCamera.update(paused?0:delta,orbitCamera.position,controls.target,camera);
    updateCamera(delta,reduceMotion.matches,arrival?.position,arrival?.target);
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
    gargoyles.update(siege.game.enemies,elapsed,camera);
    atmosphere.view(camera);
    hud.update(paused?0:delta,siege,player.position,camera,paused);
    composer.render();
    if(!$('status').hidden)$('status').hidden=true;
  }
  // Warm the real render target, buffers, materials, and both spell shadow maps behind the loading screen.
  const aim=player.position.clone();
  const target=aim.clone().add(new THREE.Vector3(.9,.2,-1.5));
  const sample={position:target,target:aim,phase:'air',zone:{normal:new THREE.Vector3(0,0,1)}};
  gargoyles.prepare();
  effects.channel(aim,.65,0);
  effects.lash(aim,target);
  effects.update(0,0);
  debris.shatter(sample);
  debris.update(0);
  spellLighting.hit(sample);
  spellLighting.update(aim,.65,0);
  camera.updateMatrixWorld();
  atmosphere.update(0);
  atmosphere.view(camera);
  renderer.setRenderTarget(composer.readBuffer);
  await renderer.compileAsync(scene,camera);
  renderer.setRenderTarget(null);
  composer.render();
  effects.reset();
  debris.reset();
  spellLighting.reset();
  gargoyles.update([],0,camera);
  ready=true;
  previous=performance.now();
  renderer.setAnimationLoop(animate);
}

launch().catch(error=>{
  console.error(error);
  $('status').textContent='The diorama could not start. Try reloading in a browser with WebGL 2 enabled.';
});
