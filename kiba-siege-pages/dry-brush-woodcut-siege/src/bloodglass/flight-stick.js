const deadZone=.14;

export function makeFlightStick(pad) {
  const knob=pad.querySelector('.flight-stick-knob');
  const axes={along:0,vertical:0};
  let pointer=null,originX=0,originY=0,radius=1;

  function reset() {
    const captured=pointer;
    pointer=null;
    if(captured!==null&&pad.hasPointerCapture(captured))pad.releasePointerCapture(captured);
    axes.along=axes.vertical=0;
    knob.style.removeProperty('transform');
    pad.classList.remove('held');
  }

  pad.addEventListener('pointerdown',event=>{
    if(pad.hidden||pointer!==null||!['touch','pen'].includes(event.pointerType))return;
    event.preventDefault();
    pointer=event.pointerId;
    originX=event.clientX;
    originY=event.clientY;
    radius=pad.clientWidth*.33;
    pad.setPointerCapture(pointer);
    pad.classList.add('held');
  });
  pad.addEventListener('pointermove',event=>{
    if(event.pointerId!==pointer)return;
    const x=event.clientX-originX,y=event.clientY-originY;
    const distance=Math.hypot(x,y);
    const travel=Math.min(radius,distance);
    const scale=distance===0?0:travel/distance;
    const strength=Math.max(0,(travel/radius-deadZone)/(1-deadZone));
    axes.along=distance===0?0:x/distance*strength;
    axes.vertical=distance===0?0:-y/distance*strength;
    knob.style.transform=`translate(${x*scale}px,${y*scale}px)`;
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture']){
    pad.addEventListener(type,event=>{
      if(event.pointerId===pointer)reset();
    });
  }
  pad.addEventListener('contextmenu',event=>event.preventDefault());

  function setEnabled(enabled) {
    if(pad.hidden===!enabled)return;
    if(!enabled)reset();
    pad.hidden=!enabled;
  }

  return {axes,reset,setEnabled};
}
