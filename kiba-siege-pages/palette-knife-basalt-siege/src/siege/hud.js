import * as THREE from 'three';
import {waves} from './rules.js';
import {art} from '../bloodglass/art-direction.js';

const $=id=>document.getElementById(id);
const projected=new THREE.Vector3(),cameraSpace=new THREE.Vector3();
const yaw=p=>Math.atan2(p.x,p.z);
const shortest=(a,b)=>THREE.MathUtils.euclideanModulo(b-a+Math.PI,Math.PI*2)-Math.PI;

export function makeSiegeHud() {
  const markers=new Map();
  const holder=$('marks');
  const panel=$('threat');
  let lastPhase='', lastWave=-1, alarm=0;
  function text(id,value) {
    const node=$(id);
    const next=String(value);
    if(node.textContent!==next)node.textContent=next;
  }
  function marker(enemy) {
    let node=markers.get(enemy.id);
    if(node)return node;
    node=document.createElement('div');
    node.className='foe';
    node.append(document.createElement('i'),document.createElement('span'));
    holder.append(node);
    markers.set(enemy.id,node);
    return node;
  }
  function erase(id) {
    markers.get(id)?.remove();
    markers.delete(id);
  }
  function reset() {
    for(const id of markers.keys())erase(id);
    alarm=0;lastPhase='';
  }
  function flash(){alarm=.85;}

  function update(dt,siege,player,camera,paused) {
    const {game}=siege;
    const active=game.phase==='wave'||game.phase==='breather';
    const activeWave=game.phase==='wave';
    alarm=Math.max(0,alarm-dt*2.5);
    $('alarm').style.opacity=alarm.toFixed(2);
    if($('wall').value!==game.integrity)$('wall').value=game.integrity;
    text('hp',game.integrity);
    if(game.phase!==lastPhase||game.wave!==lastWave){
      lastPhase=game.phase;lastWave=game.wave;
      $('briefing').hidden=active;
      text('wave-num',game.phase==='ready'?'Prepare':`Wave ${game.wave+1} / ${waves.length}`);
      text('wave-name',game.phase==='ready'?art.name:waves[game.wave].title);
      if(game.phase==='won'||game.phase==='lost'){
        const won=game.phase==='won';
        text('brief-title',won?'The citadel stands':'The walls have fallen');
        text('brief-copy',won?`All three waves repelled. ${game.kills} gargoyles destroyed with ${game.integrity}% integrity remaining.`:
          `${game.kills} gargoyles destroyed. On the next attempt, follow the direction cue to the attackers already on the walls.`);
        $('begin').replaceChildren(document.createTextNode('Try again '),Object.assign(document.createElement('span'),{textContent:'R'}));
      }
    }
    if(active){
      if(paused)text('wave-count','Paused');
      else if(game.phase==='breather')text('wave-count',`Walls braced • Next wave in ${Math.max(1,Math.ceil(game.intermission))}s`);
      else {
        let attached=0;
        for(const enemy of game.enemies)if(enemy.phase==='latched')attached++;
        text('wave-count',`${game.enemies.length} active · ${attached} latched · ${game.kills} destroyed`);
      }
    }
    if(!active&&game.phase!=='ready')text('wave-count',`${game.kills} gargoyles destroyed`);
    const target=activeWave?siege.nextTarget(player):null;
    const zone=target?.zone??(active?game.upcoming:null);
    panel.hidden=!zone;
    if(zone){
      const targetPosition=target?.position??zone.anchor;
      const turn=shortest(yaw(player),yaw(targetPosition));
      const dy=targetPosition.y-player.y;
      const near=target?siege.canReach(target,player):false;
      const along=Math.abs(turn)<.24?'':turn>0?'D →':'← A';
      const vertical=dy>1.55?'W ↑':dy< -1.55?'S ↓':'';
      panel.classList.toggle('latched',target?.phase==='latched');
      panel.classList.toggle('near',near);
      const charging=game.channel?.target===target&&!!target;
      panel.classList.toggle('charging',charging);
      if(charging)panel.style.setProperty('--charge',`${game.channel.progress*100}%`);
      text('arc-guide',near?'✦':along?turn>0?'›':'‹':dy>=0?'↑':'↓');
      text('threat-name',zone.label);
      text('threat-action',charging?'Blood magic charging':near?'Blood magic in range':
        [target?.phase==='latched'?'Latched':target?'Approaching':'Incoming',along,vertical].filter(Boolean).join(' · '));
    }
    for(const enemy of game.enemies){
      const node=marker(enemy);
      if(!activeWave){node.hidden=true;continue;}
      projected.copy(enemy.position);
      projected.y+=.96;
      const front=cameraSpace.copy(projected).applyMatrix4(camera.matrixWorldInverse).z<0;
      projected.project(camera);
      const visible=front&&Math.abs(projected.x)<.965&&Math.abs(projected.y)<.91;
      node.hidden=!visible;
      if(!visible)continue;
      node.style.transform=`translate(${Math.round((projected.x*.5+.5)*innerWidth)}px,${Math.round((.5-projected.y*.5)*innerHeight)}px)`;
      node.classList.toggle('latched',enemy.phase==='latched');
      node.classList.toggle('selected',enemy===target);
      const label=enemy.phase==='latched'?'LATCHED':enemy.heavy?'ARMORED':'';
      if(node.lastChild.textContent!==label)node.lastChild.textContent=label;
    }
  }
  return {update,erase,reset,flash};
}
