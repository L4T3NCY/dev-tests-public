import * as THREE from 'three';
import {waves} from './rules.js';
import {art} from '../bloodglass/art-direction.js';

const $=id=>document.getElementById(id);
const projected=new THREE.Vector3(),cameraSpace=new THREE.Vector3();
const yaw=p=>Math.atan2(p.x,p.z);
const shortest=(a,b)=>THREE.MathUtils.euclideanModulo(b-a+Math.PI,Math.PI*2)-Math.PI;

export function makeSiegeHud() {
  const holder=$('marks');
  const panel=$('threat');
  const limit=12;
  const markers=Array.from({length:limit},()=>{
    const node=document.createElement('div');
    const label=document.createElement('span');
    node.className='foe';
    node.hidden=true;
    node.append(document.createElement('i'),label);
    holder.append(node);
    return {node,label,x:-1,y:-1};
  });
  const scores=new Float64Array(limit),screenX=new Float32Array(limit),screenY=new Float32Array(limit);
  const selected=new Array(limit);
  let lastPhase='', lastWave=-1, alarm=0, lastOpacity='';
  function text(id,value) {
    const node=$(id);
    const next=String(value);
    if(node.textContent!==next)node.textContent=next;
  }
  function reset() {
    for(const {node} of markers)node.hidden=true;
    alarm=0;lastPhase='';
  }
  function flash(){alarm=.85;}

  function update(dt,siege,player,camera,paused) {
    const {game}=siege;
    const active=game.phase==='wave'||game.phase==='breather';
    const activeWave=game.phase==='wave';
    alarm=Math.max(0,alarm-dt*2.5);
    const opacity=alarm.toFixed(2);
    if(opacity!==lastOpacity){
      $('alarm').style.opacity=opacity;
      lastOpacity=opacity;
    }
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
        const incoming=game.latestPack&&game.elapsed-game.latestPack.time<2.40;
        const cue=incoming?` · ${game.latestPack.direction} pack incoming`:'';
        text('wave-count',`${game.enemies.length} active · ${attached} latched · ${game.kills} destroyed${cue}`);
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
    let visible=0;
    if(activeWave&&!document.body.classList.contains('clean')){
      const width=innerWidth,height=innerHeight;
      for(const enemy of game.enemies){
        projected.copy(enemy.position);
        projected.y+=.96;
        if(cameraSpace.copy(projected).applyMatrix4(camera.matrixWorldInverse).z>=0)continue;
        projected.project(camera);
        if(Math.abs(projected.x)>=.965||Math.abs(projected.y)>=.91)continue;
        // Spend the fixed marker budget on the current target and the most urgent threats.
        const priority=enemy===target?0:enemy.phase==='latched'?1:enemy.heavy?2:3;
        const score=priority+enemy.position.distanceToSquared(player)*.00001;
        if(visible===limit&&score>=scores[limit-1])continue;
        let slot=Math.min(visible,limit-1);
        while(slot>0&&score<scores[slot-1]){
          scores[slot]=scores[slot-1];
          screenX[slot]=screenX[slot-1];
          screenY[slot]=screenY[slot-1];
          selected[slot]=selected[slot-1];
          slot--;
        }
        scores[slot]=score;
        screenX[slot]=(projected.x*.5+.5)*width;
        screenY[slot]=(.5-projected.y*.5)*height;
        selected[slot]=enemy;
        visible=Math.min(visible+1,limit);
      }
    }
    for(let i=0;i<limit;i++){
      const marker=markers[i],{node,label}=marker;
      const hidden=i>=visible;
      if(node.hidden!==hidden)node.hidden=hidden;
      if(hidden){
        selected[i]=null;
        continue;
      }
      const enemy=selected[i],x=Math.round(screenX[i]),y=Math.round(screenY[i]);
      if(marker.x!==x||marker.y!==y){
        node.style.transform=`translate(${x}px,${y}px)`;
        marker.x=x;marker.y=y;
      }
      const isLatched=enemy.phase==='latched';
      const classes='foe'+(isLatched?' latched':'')+(enemy===target?' selected':'');
      if(node.className!==classes)node.className=classes;
      const title=isLatched?'LATCHED':enemy.heavy?'ARMORED':'';
      if(label.textContent!==title)label.textContent=title;
    }
  }
  return {update,reset,flash};
}
