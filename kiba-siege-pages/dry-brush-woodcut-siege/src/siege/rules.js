import * as THREE from 'three';

export const attackRadius=8.8;
export const channelTime=.36;
export const recoveryTime=.10;
export const maxIntegrity=100;
const point=(x,y,z)=>new THREE.Vector3(x,y,z);
export const zones=[
  {label:'South chapel',anchor:point(4.67,3.08,3.35),normal:point(0,0,1)},
  {label:'South gatehouse',anchor:point(-7.50,2.07,.95),normal:point(0,0,1)},
  {label:'East watchtower',anchor:point(8.25,3.73,-2.44),normal:point(1,0,0)},
  {label:'East chapel',anchor:point(6.97,3.60,.27),normal:point(1,0,0)},
  {label:'North bell tower',anchor:point(4.12,7.04,-6.06),normal:point(0,0,-1)},
  {label:'North rampart',anchor:point(-3.62,6.03,-5.62),normal:point(0,0,-1)},
  {label:'West gate',anchor:point(-8.52,2.18,-.42),normal:point(-1,0,0)},
  {label:'West spire',anchor:point(-7.46,4.77,-4.73),normal:point(-1,0,0)},
  {label:'High belfry · south',anchor:point(.90,9.51,-.56),normal:point(0,0,1)},
  {label:'High belfry · east',anchor:point(1.92,10.18,-2.37),normal:point(1,0,0)},
  {label:'High belfry · north',anchor:point(-.55,10.16,-3.76),normal:point(0,0,-1)},
  {label:'High belfry · west',anchor:point(-1.71,10.25,-2.68),normal:point(-1,0,0)}
];

export const waves=[
  {title:'Stone scouts',formations:[
    [.55,[0,0]], [3.25,[3,2]], [3.30,[4,5]], [3.35,[6,7]]
  ]},
  {title:'The four fronts',formations:[
    [.62,[6,6,7]], [3.25,[4,5,10]], [3.10,[2,3,9]], [3.15,[0,1,8]]
  ]},
  {title:'The Blackwing Host',formations:[
    [.55,[8,0,0,1]], [3.20,[7,6,11]], [3.05,[2,3,2,9]], [3.15,[4,10,5]], [3.10,[6,7,6,11]]
  ]}
].map(wave=>({...wave,lanes:wave.formations.flatMap(([,lanes])=>lanes)}));

function seeded() {
  let seed=0xb1d4669;
  return ()=>(seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296;
}

export function makeSiege(emit=()=>{}) {
  const game={phase:'ready',wave:0,integrity:maxIntegrity,kills:0,enemies:[],intermission:0,
    upcoming:null,latestPack:null,reinforcements:0,damageCount:0,elapsed:0,channel:null};
  const diff=new THREE.Vector3();
  let clock=0,recovery=0,formationIndex=0,serial=0,random=seeded();

  function wave(index) {
    game.phase='wave';
    game.wave=index;
    formationIndex=0;
    game.latestPack=null;
    clock=waves[index].formations[0][0];
    game.upcoming=zones[waves[index].lanes[0]];
    game.reinforcements=waves[index].lanes.length;
    emit('wave',game);
  }

  function start() {
    game.enemies.length=0;
    game.integrity=maxIntegrity;
    game.kills=game.damageCount=game.elapsed=0;
    game.intermission=0;
    game.channel=null;
    serial=recovery=0;
    random=seeded();
    wave(0);
  }

  function spawnFormation([,lanes]) {
    const {normal}=zones[lanes[0]];
    const sideways=point(normal.z,0,-normal.x);
    const center=point(0,0,0);
    for(const lane of lanes)center.add(zones[lane].anchor);
    center.multiplyScalar(1/lanes.length);

    const start=center.clone().addScaledVector(normal,15.2+random()*2.7)
      .addScaledVector(sideways,(random()-.5)*3.2);
    start.y+=4.0+random()*1.8;
    const bend=center.clone().lerp(start,.54).addScaledVector(sideways,(random()-.5)*4.2);
    bend.y+=.70;
    const approach=4.45+random()*.50-game.wave*.16;
    const enemies=lanes.map((lane,slot)=>{
      const zone=zones[lane];
      const rank=slot-(lanes.length-1)*.5;
      const depth=Math.abs(rank);
      const heavy=game.wave>0&&(serial+game.wave)%4===0;
      const target=zone.anchor.clone().addScaledVector(sideways,rank*.34);
      target.y+=rank*.35;
      const entry=start.clone().addScaledVector(sideways,rank*1.57).addScaledVector(normal,depth*.82);
      entry.y+=rank*.27+depth*.44;
      const turn=bend.clone().lerp(target,.19).addScaledVector(sideways,rank*1.17);
      turn.y+=rank*.41+depth*.24;
      const enemy={id:++serial,zone,heavy,target,start:entry,bend:turn,position:entry.clone(),
        warm:random()*6.283,age:0,health:heavy?2:1,phase:'air',hitAt:1.2,flash:0,
        approach:approach+depth*.17+slot*.06};
      game.enemies.push(enemy);
      emit('spawn',enemy);
      return enemy;
    });
    game.reinforcements-=lanes.length;
    const direction=normal.x?(normal.x>0?'East':'West'):(normal.z>0?'South':'North');
    game.latestPack={enemies,direction,time:game.elapsed};
    emit('pack',game.latestPack);
  }

  function inRange(enemy,player,radius) {
    if(enemy.position.distanceToSquared(player)>radius*radius)return false;
    // The wall separates gargoyles on the opposite side from the player.
    return diff.subVectors(player,enemy.target).dot(enemy.zone.normal)>-.28;
  }
  const canReach=(enemy,player)=>inRange(enemy,player,attackRadius);

  function targetScore(enemy,player) {
    return enemy.position.distanceToSquared(player)*(enemy.phase==='latched'?.64:1);
  }
  function nextTarget(player) {
    if(game.channel&&inRange(game.channel.target,player,attackRadius+1.2))return game.channel.target;
    let chosen=null,lowest=Infinity;
    for(const enemy of game.enemies){
      const score=targetScore(enemy,player);
      if(score<lowest){chosen=enemy;lowest=score;}
    }
    return chosen;
  }
  function acquire(player) {
    let chosen=null,best=Infinity;
    for(const enemy of game.enemies){
      if(!canReach(enemy,player))continue;
      const score=targetScore(enemy,player);
      if(score<best){best=score;chosen=enemy;}
    }
    return chosen;
  }
  function attack(chosen,player) {
    chosen.health--;
    chosen.flash=.19;
    emit('attack',{enemy:chosen,from:player.clone()});
    if(chosen.health===0){
      game.kills++;
      emit('kill',chosen);
      game.enemies.splice(game.enemies.indexOf(chosen),1);
    }
    recovery=recoveryTime;
  }

  function charge(dt,player) {
    recovery=Math.max(0,recovery-dt);
    if(recovery>0)return;
    if(!game.channel){
      const target=acquire(player);
      if(target)game.channel={target,elapsed:0,progress:0};
      return;
    }
    const channel=game.channel;
    // Keep the charge while flying. A small range buffer prevents flicker
    // as a gargoyle crosses the acquisition boundary.
    if(!inRange(channel.target,player,attackRadius+1.2)){
      const target=acquire(player);
      if(!target){game.channel=null;return;}
      channel.target=target;
    }
    channel.elapsed+=dt;
    channel.progress=Math.min(1,channel.elapsed/channelTime);
    if(channel.progress===1){
      game.channel=null;
      attack(channel.target,player);
    }
  }

  function advanceEnemy(enemy,dt) {
    enemy.age+=dt;
    enemy.flash=Math.max(0,enemy.flash-dt);
    if(enemy.phase==='air'){
      const t=Math.min(1,enemy.age/enemy.approach);
      const r=1-t;
      enemy.position.copy(enemy.start).multiplyScalar(r*r).addScaledVector(enemy.bend,2*r*t)
        .addScaledVector(enemy.target,t*t);
      enemy.position.y+=Math.sin(enemy.age*5+enemy.warm)*.27*Math.sin(Math.PI*t);
      if(t<1)return;
      enemy.phase='latched';
      enemy.hitAt=enemy.age+.69;
      emit('latch',enemy);
      return;
    }
    if(enemy.age<enemy.hitAt)return;
    enemy.hitAt+=enemy.heavy?1.02:1.27;
    const hit=enemy.heavy?5:(game.wave===0?2:3);
    game.integrity=Math.max(0,game.integrity-hit);
    game.damageCount++;
    emit('damage',enemy);
  }

  function update(dt,player) {
    if(game.phase!=='wave'&&game.phase!=='breather')return;
    game.elapsed+=dt;
    if(game.phase==='breather'){
      game.intermission-=dt;
      if(game.intermission<=0)wave(game.wave+1);
      return;
    }
    const setup=waves[game.wave];
    clock-=dt;
    while(clock<=0&&formationIndex<setup.formations.length){
      spawnFormation(setup.formations[formationIndex++]);
      const next=setup.formations[formationIndex];
      game.upcoming=next?zones[next[1][0]]:null;
      if(next)clock+=next[0];
    }
    charge(dt,player);
    for(const enemy of game.enemies){
      advanceEnemy(enemy,dt);
      if(game.integrity===0){
        game.phase='lost';game.channel=null;emit('lost',game);return;
      }
    }
    if(formationIndex===setup.formations.length&&game.enemies.length===0){
      game.channel=null;
      if(game.wave===waves.length-1){
        game.phase='won';emit('won',game);
      }else{
        game.phase='breather';game.intermission=3.6;
        game.integrity=Math.min(maxIntegrity,game.integrity+18);
        game.upcoming=zones[waves[game.wave+1].lanes[0]];
        emit('cleared',game);
      }
    }
  }
  return {game,start,update,nextTarget,canReach};
}
