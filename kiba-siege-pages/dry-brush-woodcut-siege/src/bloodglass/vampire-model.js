import * as THREE from 'three';
const facets = new THREE.BoxGeometry(1,1,1);

function material(color, roughness=.76, extras={}) {
  return new THREE.MeshStandardMaterial({color,roughness,...extras});
}
const black = material(0x202036,.88,{emissive:0x110616,emissiveIntensity:.23});
const leather = material(0x1d192b,.75);
const silk = material(0x702237,.77);
const skin = material(0x8f859d,.84);
const shade = material(0x665a70,.86);
const hair = [material(0xece8ee,.88),material(0xb9bad4,.82)];
const eyes = material(0xff4354,.52,{emissive:0xff2032,emissiveIntensity:.58});
function block(parent,mat,position,scale,rotation=0) {
  const mesh=new THREE.Mesh(facets,mat);
  mesh.position.fromArray(position);
  mesh.scale.fromArray(scale);
  mesh.rotation.z=rotation;
  parent.add(mesh);
  return mesh;
}

// Octagonal cross-sections make the model read as cut and beveled volumes
// while keeping the jaw, chest and coat slim enough to fit the architecture.
function loft(parent,mat,rings) {
  const flat=[];
  const corners=[[-.64,-1],[.64,-1],[1,-.64],[1,.64],[.64,1],[-.64,1],[-1,.64],[-1,-.64]];
  const point=(row,i)=>{
    const [y,w,d,z=0]=rings[row], [u,v]=corners[i%8];
    return [u*w,y,v*d+z];
  };
  for(let row=0;row<rings.length-1;row++)for(let i=0;i<8;i++) {
    const a=point(row,i), b=point(row,i+1), c=point(row+1,i), d=point(row+1,i+1);
    flat.push(...a,...c,...b,...b,...c,...d);
  }
  const cap=(row,direction)=>{
    const [y,,,z=0]=rings[row];
    for(let i=0;i<8;i++){
      const a=point(row,i),b=point(row,i+1);
      flat.push(0,y,z,...(direction>0?b:a),...(direction>0?a:b));
    }
  };
  cap(0,-1);cap(rings.length-1,1);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(flat,3));
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,mat);
  parent.add(mesh);
  return mesh;
}

function collarPanel(parent,sign) {
  const verts=[
    [sign*.055,.31,.069],[sign*.171,.371,.040],[sign*.224,.508,-.088],
    [sign*.096,.450,-.105],[sign*.056,.342,-.079]
  ];
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts.flat(),3));
  geometry.setIndex(sign===1?[0,1,2,0,2,3,0,3,4]:[0,2,1,0,3,2,0,4,3]);
  geometry.computeVertexNormals();
  const outer=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x222135,roughness:.92,side:THREE.BackSide}));
  const inside=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xaa3851,roughness:.77,side:THREE.FrontSide}));
  parent.add(outer,inside);
}

export function makeVampireModel() {
  const body=new THREE.Group();
  body.name='Kiba vampire';
  body.scale.setScalar(.70);

  loft(body,black,[
    [-.20,.176,.082],[-.083,.136,.078],[.071,.114,.087],[.240,.170,.105],[.303,.174,.093],[.336,.086,.065]
  ]);
  for(const side of [-1,1]) {
    collarPanel(body,side);
  }
  block(body,silk,[0,.276,.107],[.051,.046,.019],Math.PI*.25);

  const head=new THREE.Group();
  head.position.y=.337;
  body.add(head);
  loft(head,shade,[[-.029,.042,.034],[.029,.049,.041]]);
  loft(head,skin,[
    [.019,.043,.048,.030],[.049,.073,.061,.015],[.100,.093,.071,.009],
    [.167,.089,.071,0],[.191,.067,.053,-.007]
  ]);
  for(const side of [-1,1]){
    block(head,shade,[side*.042,.122,.077],[.049,.032,.015],-side*.23);
    block(head,eyes,[side*.042,.120,.087],[.034,.010,.008],-side*.21);
  }
  loft(head,hair[1],[[.064,.084,.050,-.035],[.143,.112,.064,-.032],
    [.205,.103,.080,-.018],[.242,.062,.055,-.009]]);
  block(head,hair[0],[-.026,.194,.049],[.134,.075,.110],.22);
  block(head,hair[0],[-.075,.132,.064],[.049,.137,.044],-.28);
  block(head,hair[0],[.052,.169,.057],[.076,.110,.056],.37);
  block(head,hair[1],[.088,.104,.032],[.038,.103,.052],.16);

  const arms=[],legs=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();
    arm.position.set(side*.164,.272,.011);
    const elbow=new THREE.Group();
    elbow.position.y=-.196;
    loft(arm,black,[[-.203,.039,.040],[-.107,.058,.057],[.015,.057,.063]]);
    loft(elbow,leather,[[-.180,.021,.028],[-.073,.033,.037],[.003,.037,.042]]);
    arm.add(elbow);body.add(arm);arms.push({arm,elbow,side});

    const leg=new THREE.Group();
    leg.position.set(side*.069,-.161,.006);
    const knee=new THREE.Group();
    knee.position.y=-.178;
    loft(leg,black,[[-.191,.039,.045],[-.092,.048,.054],[.022,.059,.060]]);
    loft(knee,leather,[[-.22,.022,.029,.024],[-.174,.036,.050,.020],
      [-.067,.032,.036],[.010,.041,.045]]);
    leg.add(knee);body.add(leg);legs.push({leg,knee,side});
  }
  return {body,pose(speed,climb,bank,time) {
    const hover=Math.sin(time*2.7);
    body.rotation.set(speed*.26+climb*.045,0,bank,'YXZ');
    head.rotation.set(-.094*speed+.027*hover,.08*Math.sin(time*.82),-.22*bank);
    for(const {arm,elbow,side} of arms){
      arm.rotation.set(.08+speed*.50+side*.05*hover,-side*.09,side*(.12+speed*.28));
      elbow.rotation.x=-.17-speed*.18+side*hover*.032;
    }
    for(const {leg,knee,side} of legs){
      leg.rotation.set(.05+speed*.41+side*(.11+hover*.025),0,side*(.039+speed*.05));
      knee.rotation.x=.14+side*.09+speed*(side===1?.26:.16);
    }
  }};
}
