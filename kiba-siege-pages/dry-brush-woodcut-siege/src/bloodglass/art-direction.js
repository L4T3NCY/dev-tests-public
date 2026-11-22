import * as THREE from 'three';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const woodcut = document.documentElement.dataset.style === 'woodcut';

export const art = woodcut ? {
  woodcut,
  name: 'Dry-Brush Woodcut',
  fog: 0xbeb3a9,
  fogDensity: .008,
  ambient: [0xe3e0d8, 0x403637, .72],
  key: [0xffecda, 2.70],
  rim: [0xc4aaa3, .52],
  fill: [0xb9b1ac, .20],
  exposure: 1.12,
  bloom: 0,
  colors: {
    stone: [0xa29c91,0xbdb3a4,0x888076,0xb3a99a,0xbab3a6,0x9b978e,0x989088,0xc3b7aa,0x9a8c83],
    trim: [0x534a46,0x736760,0x827366,0x6c655e,0x4e4442],
    basalt: [0x332e2c,0x49413b,0x393331,0x413932,0x544942,0x62564d,0x393336,0x4e4441],
    iron: [0x423937,0x514745,0x3c3433],
    roof: [0x383331,0x443b37,0x4f433c,0x423838,0x302a29,0x4d413c,0x573b3b]
  }
} : {
  woodcut,
  name: 'Palette-Knife Basalt',
  fog: 0x514652,
  fogDensity: .011,
  ambient: [0xe4d0cc, 0x61505d, .88],
  key: [0xffe0bd, 2.62],
  rim: [0xdf5b66, 1.05],
  fill: [0xa6a4bd, .44],
  exposure: 1.17,
  bloom: .16,
  colors: {
    stone: [0x82716d,0x9e8a81,0x695c5d,0x7c6c6a,0x917e7b,0x746664,0x62565a,0x92756e,0x79645f],
    trim: [0x9d887d,0xc0a493,0x9d8980,0xae8f82,0x746367],
    basalt: [0x322b35,0x433941,0x28242e,0x473b3f,0x5d4d4e,0x684b4f,0x352c34,0x4b3b40],
    iron: [0x342c30,0x504045,0x3e3235],
    roof: [0x432830,0x492c36,0x573038,0x4f2a31,0x362630,0x4b2e39,0x61373e]
  }
};

function makeBrushAtlas() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  let seed = 43871;
  function random() {
    seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function mark(x,y,length,width,angle,value) {
    ctx.fillStyle = 'rgb(' + value + ' ' + value + ' ' + value + ')';
    // Wrap strokes across all sides so projected marks can tile continuously.
    for(const dx of [-size,0,size])for(const dy of [-size,0,size]) {
      ctx.save();
      ctx.translate(x+dx,y+dy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(-length*.5,0);
      ctx.lineTo(-length*.31,-width*.46);
      ctx.lineTo(length*.16,-width*.50);
      ctx.lineTo(length*.36,-width*.32);
      ctx.lineTo(length*.50,0);
      ctx.lineTo(length*.30,width*.17);
      ctx.lineTo(length*.17,width*.51);
      ctx.lineTo(-length*.38,width*.30);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.fillStyle = woodcut ? '#fff' : '#777';
  ctx.fillRect(0,0,size,size);
  if(woodcut) {
    for(let patch=0;patch<29;patch++) {
      const x=random()*size, y=random()*size, angle=.52+(random()-.5)*.26;
      const length=23+random()*82, count=3+Math.floor(random()*7);
      for(let row=0;row<count;row++) {
        const offset=row*4.1;
        const lengthFactor=.36+.64*Math.sin(Math.PI*(row+1)/(count+1));
        mark(x-offset*.62+random()*12,y+offset,length*lengthFactor,
          1.5+random()*3.4,angle,Math.floor(10+random()*142));
      }
    }
  } else {
    for(let i=0;i<108;i++) {
      const x=random()*size,y=random()*size, length=16+random()*94;
      const width=3+random()*19, angle=.38+(random()-.5)*.71;
      const mid=Math.floor(66+random()*101);
      mark(x,y,length,width,angle,mid);
      mark(x,y-width*.29,length*.84,width*(.11+random()*.17),angle,Math.min(250,mid+45+Math.floor(random()*40)));
      mark(x+length*.14,y+width*.28,length*.69,Math.max(1,width*.14),angle,Math.max(25,mid-32));
    }
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.anisotropy=4;
  return texture;
}

const atlas=makeBrushAtlas();

export function paintStone(material, rock=false) {
  material.customProgramCacheKey = () => 'siege-brush/' + woodcut + '/' + rock;
  material.onBeforeCompile = shader => {
    shader.uniforms.brushAtlas = {value:atlas};
    shader.vertexShader = 'varying vec3 brushPosition;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec4 brushPoint=vec4(position,1.);
       #ifdef USE_INSTANCING
       brushPoint=instanceMatrix*brushPoint;
       #endif
       brushPosition=(modelMatrix*brushPoint).xyz;`
    );
    shader.fragmentShader = `varying vec3 brushPosition;
      uniform sampler2D brushAtlas;
      vec2 brushCoordinates(vec3 p) {
        vec3 face=abs(cross(dFdx(p),dFdy(p)));
        if(face.y>max(face.x,face.z)) return p.xz;
        return face.x>face.z ? p.zy : p.xy;
      }
    ` + shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec2 brushUV=brushCoordinates(brushPosition);
      vec2 brushSlope=vec2(brushUV.x+${rock?'.38':'.10'}*brushUV.y,brushUV.y);
      float brush=texture2D(brushAtlas,brushSlope*${rock?'.41':'.75'}).r;
      float value=dot(outgoingLight,vec3(.24,.66,.10));
      float distant=smoothstep(27.,62.,length(vViewPosition));
      float wash=texture2D(brushAtlas,brushSlope*vec2(.22,.35)+vec2(.36,.12)).r;
      float pigment=smoothstep(.16,.88,wash)-.5;
      float inkWash=value+pigment*${rock?'.038':'.095'};
      float shade=1.-smoothstep(.047,.30,inkWash);
      float paper=smoothstep(.015,.45,inkWash)*.64+value*.21;
      vec3 printed=mix(vec3(.010,.009,.010),vec3(.93,.87,.78),clamp(paper,0.,1.));
      float hatch=(1.-brush)*smoothstep(.021,.09,value)*(1.-smoothstep(.24,.63,value));
      printed*=1.-hatch*(1.-distant*.80)*${rock?'.81':'.54'};
      printed*=1.-shade*${rock?'.38':'.15'};
      ${rock?`printed+=vec3(.13,.112,.093)*smoothstep(.30,.69,1.-brush)
        *(1.-distant*.73)*(.32+.68*smoothstep(.01,.15,value));`:''}
      float stain=smoothstep(.025,.105,diffuseColor.r-diffuseColor.g*1.45);
      float redLight=smoothstep(.035,.28,outgoingLight.r-outgoingLight.g*1.16);
      outgoingLight=mix(printed,outgoingLight,max(stain*.73,redLight*.28));
      #include <opaque_fragment>
    `);
  };
  return material;
}

export function makeStudyOutput() {
  const pass = new OutputPass();
  const grading = woodcut ? `
    vec3 pixel=gl_FragColor.rgb;
    float value=dot(pixel,vec3(.26,.63,.11));
    float red=smoothstep(.075,.31,pixel.r-max(pixel.g,pixel.b));
    vec3 paper=value*vec3(1.03,1.0,.92);
    vec3 pigment=mix(paper,vec3(pixel.r,pixel.g*.69,pixel.b*.73),red*.97);
    gl_FragColor.rgb=clamp(pigment,0.,1.);
  ` : `
    vec3 pixel=gl_FragColor.rgb;
    float value=dot(pixel,vec3(.25,.65,.10));
    vec3 ash=value*vec3(1.034,.972,.98);
    float crimson=smoothstep(.024,.29,pixel.r-max(pixel.g,pixel.b));
    gl_FragColor.rgb=mix(ash,pixel,mix(.57,1.,crimson));
  `;
  pass.material.fragmentShader = pass.material.fragmentShader.replace(
    '#ifdef SRGB_TRANSFER', grading + '\n#ifdef SRGB_TRANSFER'
  );
  return pass;
}
