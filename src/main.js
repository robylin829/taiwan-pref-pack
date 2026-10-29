import {counties} from './counties.js';
import {joltBodies} from './shake.js';
import {pieceScale,shakeablePieces} from './geometry-scale.js';
import {countyLabelAnchors,visibleCountyLabels} from './labels.js';
import {regions,regionOf,completedRegions,canMerge,mergeScore,shuffledBag} from './model.js';
const {Engine,Bodies,Body,Composite,Events,Common,Vertices}=window.Matter;
Common.setDecomp(window.decomp);
const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d'),W=390,H=520;
const engine=Engine.create({enableSleeping:true,gravity:{x:0,y:1.2}});
const floor=Bodies.rectangle(W/2,H+20,W+80,50,{isStatic:true});
const walls=[floor,Bodies.rectangle(-16,H/2,40,H*3,{isStatic:true}),Bodies.rectangle(W+16,H/2,40,H*3,{isStatic:true})];
Composite.add(engine.world,walls);
const SAVE='taiwan-pack-save-v1',RECORDS='taiwan-pack-records-v1';
let pieces=[],bag=[],current=null,next=null,score=0,aim=W/2,phase='home',lastDrop=0,dropNumber=0,lastTime=0,accumulator=0,overflow=0,pending=[],particles=[],muted=true,audio,saveTimer=0,toastTimer,shakeStart=-Infinity,shakePulse=0,queuedDrop=false;
let records=[];try{records=JSON.parse(localStorage.getItem(RECORDS)||'[]');if(!Array.isArray(records))records=[]}catch{}
let best=records[0]?.score||0;$('best').textContent=best;
const byId=new Map(counties.map(c=>[c.id,c]));
function storageSet(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function clearSave(){try{localStorage.removeItem(SAVE)}catch{}}
function getSaved(){try{const v=JSON.parse(localStorage.getItem(SAVE));return v?.version===1&&Array.isArray(v.pieces)&&v.current&&v.next?v:null}catch{return null}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2400)}
function beep(merge=false){if(muted)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.setValueAtTime(merge?660:280,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(merge?990:180,audio.currentTime+.12);gain.gain.setValueAtTime(.055,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.2);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+.2)}catch{}}
function geometry(ids){
  let rings=ids.map(id=>byId.get(id).points);
  // Offshore counties are an inset: their geographic distance would hide their shapes.
  if(ids.some(id=>regionOf(id).id==='islands')){
    const mainland=rings.filter((_,i)=>regionOf(ids[i]).id!=='islands');
    const base=mainland.length?Math.min(...mainland.flat().map(p=>p[0])):0;
    const top=mainland.length?Math.min(...mainland.flat().map(p=>p[1])):0;
    let islandIndex=0;
    rings=rings.map((ring,i)=>{if(regionOf(ids[i]).id!=='islands')return ring;const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);const x0=Math.min(...xs),y0=Math.min(...ys),size=Math.max(Math.max(...xs)-x0,Math.max(...ys)-y0);const k=.22/size;const index=islandIndex++;return ring.map(p=>[(p[0]-x0)*k+base-.45,(p[1]-y0)*k+top+index*.35])});
  }
  const flat=rings.flat(),xs=flat.map(p=>p[0]),ys=flat.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const scale=pieceScale(rings);
  const local=rings.map(r=>r.map(p=>({x:(p[0]-(minX+maxX)/2)*scale,y:(p[1]-(minY+maxY)/2)*scale})));
  const hull=Vertices.hull(local.flat()),center=Vertices.centre(hull);
  const polygons=local.map(r=>r.map(p=>({x:p.x-center.x,y:p.y-center.y})));
  return {polygons,labels:countyLabelAnchors(polygons),hull:hull.map(p=>({x:p.x-center.x,y:p.y-center.y})),width:(maxX-minX)*scale,height:(maxY-minY)*scale};
}
function makePiece(ids,x,y,angle=0){
  const g=geometry(ids),body=Bodies.fromVertices(x,y,[g.hull],{friction:.42,frictionStatic:.7,restitution:.12,frictionAir:.015,density:.002,slop:.02});
  Body.setAngle(body,angle);
  const dx=body.bounds.min.x<8?8-body.bounds.min.x:body.bounds.max.x>W-8?W-8-body.bounds.max.x:0;
  const dy=body.bounds.max.y>H-7?H-7-body.bounds.max.y:0;
  Body.translate(body,{x:dx,y:dy});
  const piece={ids,body,g,born:engine.timing.timestamp,over:0,enteredBox:body.bounds.min.y>=116};body.plugin.piece=piece;pieces.push(piece);Composite.add(engine.world,body);return piece;
}
function drawPiece(context,p,x,y,angle=0,alpha=1){
  context.save();context.globalAlpha=alpha;context.translate(x,y);context.rotate(angle);context.lineJoin='round';
  p.g.polygons.forEach((ring,i)=>{context.beginPath();ring.forEach((v,j)=>j?context.lineTo(v.x,v.y):context.moveTo(v.x,v.y));context.closePath();context.shadowColor='#2d493421';context.shadowBlur=3;context.shadowOffsetY=3;context.fillStyle=regionOf(p.ids[i]).color;context.fill();context.shadowColor='transparent';context.strokeStyle='#fffdf2';context.lineWidth=1.6;context.stroke()});
  context.rotate(-angle);
  context.font='600 11px "Noto Sans TC",sans-serif';context.textAlign='center';context.textBaseline='middle';context.lineWidth=3;context.strokeStyle='#fffdf0dd';context.fillStyle='#314e43';
  const labels=visibleCountyLabels(p.g.labels,angle,i=>context.measureText(byId.get(p.ids[i]).name).width,p.ids.length===1);
  for(const label of labels){const name=byId.get(p.ids[label.index]).name;context.strokeText(name,label.x,label.y);context.fillText(name,label.x,label.y)}
  context.restore();
}
function mapSVG(ids=counties.map(c=>c.id)){
  const g=geometry(ids),points=g.polygons.flat(),left=Math.min(...points.map(p=>p.x))*1.1-8,top=Math.min(...points.map(p=>p.y))*1.1-8;
  return `<svg viewBox="${left} ${top} ${g.width*1.1+16} ${g.height*1.1+16}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="台灣縣市分區地圖">${g.polygons.map((r,i)=>`<path d="M${r.map(p=>`${p.x*1.1},${p.y*1.1}`).join('L')}Z" fill="${regionOf(ids[i]).color}" stroke="#fffdf2" stroke-width="1"/>`).join('')}</svg>`;
}
$('title-map').innerHTML=mapSVG();
function take(){if(!bag.length)bag=shuffledBag();return bag.shift()}
function preview(){const c=$('next').getContext('2d');c.clearRect(0,0,100,80);if(!next)return;const p={ids:[next],g:geometry([next])};c.save();c.translate(50,40);c.scale(.85,.85);drawPiece(c,p,0,0,0);c.restore();$('next-name').textContent=byId.get(next).name}
function updateUI(){
  $('score').textContent=score;$('best').textContent=Math.max(best,score);$('shuffle').disabled=phase!=='playing';$('pause').disabled=phase==='home'||phase==='over';$('reset').disabled=phase==='home';
  const max=pieces.reduce((n,p)=>Math.max(n,p.ids.length),0);$('largest').textContent=`最大合體 ${max} / 22`;
  const collected=new Set(pieces.flatMap(p=>p.ids)).size;$('remaining').textContent=`剩餘縣市：${counties.length-collected} / ${counties.length}`;
  $('region-list').innerHTML=regions.map(r=>{const count=pieces.reduce((n,p)=>Math.max(n,p.ids.filter(id=>r.ids.includes(id)).length),0);return `<button class="region-row ${count===r.ids.length?'complete':''}" style="--c:${r.color}" data-region="${r.id}" aria-label="查看${r.name}"><span class="region-emblem">${r.short}</span><span class="region-info"><b>${r.name}</b><span class="region-progress"><i style="width:${count/r.ids.length*100}%"></i></span></span></button>`}).join('');
}
function resetGame(){Composite.clear(engine.world,false);Composite.add(engine.world,walls);pieces=[];particles=[];pending=[];bag=shuffledBag();current=take();next=take();score=0;shakeStart=-Infinity;shakePulse=0,queuedDrop=false;dropNumber=0;overflow=0;lastDrop=-1000;aim=W/2;engine.timing.timestamp=0;clearSave();$('start-overlay').hidden=true;phase='playing';$('board-hint').hidden=false;$('game-status').textContent='找找看，誰和誰是鄰居？';updateUI();preview();canvas.focus({preventScroll:true})}
function save(){if(phase!=='playing'&&phase!=='paused')return;storageSet(SAVE,{version:1,score,bag,current,next,dropNumber,pieces:pieces.map(p=>({ids:p.ids,x:p.body.position.x,y:p.body.position.y,angle:p.body.angle}))})}
function resumeSaved(){const s=getSaved();if(!s){resetGame();return}resetGame();try{pieces.forEach(p=>Composite.remove(engine.world,p.body));pieces=[];if(!s.pieces.every(p=>p.ids.length&&p.ids.every(id=>byId.has(id))&&Number.isFinite(p.x)&&Number.isFinite(p.y)))throw Error();s.pieces.forEach(p=>makePiece(p.ids,p.x,p.y,p.angle));score=s.score;bag=s.bag;current=s.current;next=s.next;dropNumber=s.dropNumber;updateUI();preview()}catch{resetGame();toast('存檔無法讀取，已開始新旅程。')}}
function drop(){if(phase!=='playing')return;if(performance.now()-lastDrop<280){queuedDrop=true;return}queuedDrop=false;lastDrop=performance.now();const g=geometry([current]);const x=Math.max(10+g.width/2,Math.min(W-10-g.width/2,aim));makePiece([current],x,72);score+=5;dropNumber++;current=next;next=take();$('board-hint').hidden=true;beep();preview();updateUI();save()}
Events.on(engine,'collisionStart',e=>{for(const pair of e.pairs){const a=(pair.bodyA.parent||pair.bodyA).plugin.piece,b=(pair.bodyB.parent||pair.bodyB).plugin.piece;if(a&&b&&canMerge(a.ids,b.ids,counties))pending.push([a,b])}});
function mergePending(){let changed=false;for(const [a,b]of pending){if(!pieces.includes(a)||!pieces.includes(b))continue;const ids=[...a.ids,...b.ids];const x=(a.body.position.x+b.body.position.x)/2,y=Math.max(70,(a.body.position.y+b.body.position.y)/2);pieces=pieces.filter(p=>p!==a&&p!==b);Composite.remove(engine.world,[a.body,b.body]);const p=makePiece(ids,x,y);Body.setVelocity(p.body,{x:0,y:-1});score+=mergeScore(ids);if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)for(let i=0;i<16;i++)particles.push({x,y,vx:(Math.random()-.5)*5,vy:(Math.random()-.8)*5,life:1,color:regionOf(ids[0]).color});beep(true);changed=true;const completed=completedRegions(ids);if(completed.length&&completed.reduce((n,r)=>n+r.ids.length,0)===ids.length){toast(ids.length===22?'台灣裝進去了！':`${completed.map(r=>r.name).join('、')}合體完成！`);$('game-status').textContent=`已完成 ${completed.length} 個地方`;}if(ids.length===22){endGame(true);break}}
pending=[];if(changed){updateUI();save()}}
function endGame(won=false){if(phase==='over')return;phase='over';clearSave();best=Math.max(best,score);const record={score,date:new Date().toLocaleDateString('zh-TW'),largest:Math.max(0,...pieces.map(p=>p.ids.length)),won};records=[...records,record].sort((a,b)=>b.score-a.score).slice(0,3);storageSet(RECORDS,records);updateUI();openDialog(`<span class="dialog-kicker">${won?'ISLAND COMPLETE':'NICE LITTLE JOURNEY'}</span><h2>${won?'整座台灣，都裝下了！':'箱子滿了，旅程還沒完。'}</h2><p>這次的島嶼成績</p><div class="result-score">${score.toLocaleString()}</div><p>最大合體 ${record.largest} / 22 縣市 · ${won?'完成台灣！':'再試一次，讓更多縣市相遇。'}</p><button class="primary-button" data-action="retry">再裝一次 <span>↗</span></button><button class="secondary-button" data-action="share">分享這次成績</button>`,false)}
function openDialog(html,pause=true){if(pause&&phase==='playing'){phase='paused';save()}$('dialog-content').innerHTML=html;if(!$('dialog').open)$('dialog').showModal();updateUI()}
function closeDialog(){$('dialog').close();if(phase==='paused')phase='playing';updateUI()}
function showMap(){openDialog(`<span class="dialog-kicker">A LITTLE GUIDE TO TAIWAN</span><h2>五個地方，一座台灣。</h2><div class="map-grid">${mapSVG()}<div class="map-legend">${regions.map(r=>`<p><b style="color:${r.dark}">${r.name}</b><br>${r.ids.map(id=>byId.get(id).name).join('、')}</p>`).join('')}</div></div><p class="map-note">本遊戲分區：宜蘭屬北部，苗栗、雲林屬中部。離島以示意位置排列；綠島、蘭嶼隸屬臺東縣。</p>`)}
function showRules(){openDialog(`<span class="dialog-kicker">HOW TO PACK AN ISLAND</span><h2>台灣這麼大，慢慢裝。</h2><ol><li>左右移動滑鼠或手指，選好位置後放開，縣市就會落下。</li><li><b>接壤或相鄰且不重複</b>的縣市碰在一起會合體。不受北中南東分區限制。離島使用遊戲海上連接：澎湖與高雄、連江與基隆，三離島也能互相合體。</li><li>收齊地方內的所有縣市，就能完成一個地方。所有圖塊都依相鄰關係繼續合體，直到 22 縣市成為台灣！</li><li>卡住了？「搖一搖」不限次數，會將圖塊左右晃動，讓它們重新排列。圖塊在虛線以上停留 2.5 秒，遊戲就會結束；剛落下的圖塊有緩衝時間。</li></ol><p><span class="rule-key">←</span> <span class="rule-key">→</span> 調整位置　<span class="rule-key">空白鍵</span> 落下<br><span class="rule-key">S</span> 搖一搖　<span class="rule-key">P / Esc</span> 暫停</p><p class="map-note">每次落下 +5 分，合體依縣市數 ×15 計分，完整地方額外 +100，完整台灣再 +1000。最高三筆紀錄與遊戲進度儲存在此瀏覽器。</p><button class="primary-button" data-action="close">知道了，一起拼台灣 <span>↗</span></button>`)}
function pauseGame(){if(phase!=='playing')return;openDialog(`<span class="dialog-kicker">TAKE A LITTLE BREAK</span><h2>島嶼等你，慢慢來。</h2><p>目前 ${score} 分，進度已自動保存在這台裝置。</p><button class="primary-button" data-action="close">繼續旅程 <span>↗</span></button><button class="secondary-button" data-action="home">回到首頁</button>`)}
function shake(){
  if(phase!=='playing'||engine.timing.timestamp-shakeStart<650)return;
  shakeStart=engine.timing.timestamp;shakePulse=1;
  for(const p of pieces)p.over=0;
  joltBodies(window.Matter,shakeablePieces(pieces,engine.timing.timestamp).map(p=>p.body),1);
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)canvas.parentElement.animate([{transform:'translateX(0)'},{transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'translateX(-4px)'},{transform:'translateX(4px)'},{transform:'translateX(0)'}],{duration:480});
  canvas.focus({preventScroll:true});beep();save();
}
function point(e){const r=canvas.getBoundingClientRect();aim=Math.max(40,Math.min(W-40,(e.clientX-r.left)*W/r.width))}
canvas.addEventListener('pointermove',point);canvas.addEventListener('pointerdown',e=>{if(phase!=='playing')return;point(e);canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointerup',e=>{point(e);drop()});
document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select'))return;if(e.code==='Escape'&&phase==='playing'){e.preventDefault();pauseGame();return}if($('dialog').open||phase!=='playing')return;if(['ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='ArrowLeft')aim=Math.max(40,aim-15);if(e.code==='ArrowRight')aim=Math.min(W-40,aim+15);if(e.code==='Space'&&!e.repeat)drop();if(e.code==='KeyS')shake();if(e.code==='KeyP')pauseGame()});
$('start').onclick=resetGame;$('continue').hidden=!getSaved();$('continue').onclick=resumeSaved;$('rules').onclick=showRules;$('map').onclick=showMap;$('pause').onclick=pauseGame;$('shuffle').onclick=shake;
$('sound').onclick=()=>{muted=!muted;$('sound').textContent=muted?'♪':'♫';$('sound').setAttribute('aria-label',muted?'開啟音效':'關閉音效');toast(muted?'音效已關閉':'音效已開啟');beep()};
$('reset').onclick=()=>openDialog(`<span class="dialog-kicker">A FRESH START</span><h2>重新裝一箱台灣？</h2><p>這一局的進度會重新開始，最高紀錄會保留。</p><button class="primary-button" data-action="retry">重新開始 <span>↻</span></button><button class="secondary-button" data-action="close">繼續這一局</button>`);
$('close-dialog').onclick=closeDialog;$('dialog').addEventListener('cancel',e=>{e.preventDefault();closeDialog()});$('dialog').addEventListener('click',e=>{if(e.target===$('dialog')){const r=$('dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog()}});
$('dialog-content').onclick=async e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='close')closeDialog();if(action==='retry'){closeDialog();resetGame()}if(action==='home'){save();$('dialog').close();phase='home';$('start-overlay').hidden=false;$('continue').hidden=!getSaved();updateUI()}if(action==='share'){const text=`台灣裝得下！\n我拿到 ${score} 分，最大合體 ${Math.max(0,...pieces.map(p=>p.ids.length))}/22 縣市。\n一起把台灣拼起來！`;try{if(navigator.share){await navigator.share({title:'台灣裝得下！',text,url:location.href})}else if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text+'\n'+location.href);toast('成績已複製，貼給朋友吧！')}else throw Error()}catch(error){if(error.name!=='AbortError')openDialog(`<h2>分享你的島嶼成績</h2><p>複製下方文字分享給朋友：</p><div class="share-result">${text}</div>`,false)}}};
$('region-list').onclick=e=>{const id=e.target.closest('[data-region]')?.dataset.region;if(!id)return;const r=regions.find(r=>r.id===id);openDialog(`<span class="dialog-kicker">ISLAND COLLECTION</span><h2 style="color:${r.dark}">${r.name}</h2><div style="height:180px;text-align:center">${mapSVG(r.ids)}</div><p>${r.ids.map(id=>byId.get(id).name).join(' · ')}</p><p class="map-note">${r.id==='islands'?'離島縣市碰到即可合體。':'相鄰的縣市在箱子裡碰到就會合體；重複縣市不會合體。'}收齊 ${r.ids.length} 個縣市，即可完成${r.name}。</p>`)};
$('show-records').onclick=()=>openDialog(`<span class="dialog-kicker">PERSONAL BEST</span><h2>我的島嶼紀錄</h2>${records.length?records.map((r,i)=>`<div class="record-row"><span>0${i+1}　${r.date}</span><b>${r.score} 分</b></div>`).join(''):'<p>還沒有紀錄。裝滿第一箱台灣，就從現在開始。</p>'}<p class="map-note">紀錄保存在這台裝置的瀏覽器中。</p>`);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='playing')pauseGame()});window.addEventListener('pagehide',save);
function frame(time){const delta=Math.min(50,Math.max(0,time-(lastTime||time)));lastTime=time;if(phase==='playing'){const shaking=engine.timing.timestamp-shakeStart;if(shakePulse>0&&shakePulse<3&&shaking>=shakePulse*170){joltBodies(window.Matter,shakeablePieces(pieces,engine.timing.timestamp).map(p=>p.body),shakePulse%2?-1:1);shakePulse++}accumulator+=delta;while(accumulator>=1000/60){Engine.update(engine,1000/60);accumulator-=1000/60}mergePending();if(queuedDrop&&performance.now()-lastDrop>=280)drop();for(const p of pieces)if(p.body.bounds.min.y>=116)p.enteredBox=true;const danger=pieces.some(p=>{const high=engine.timing.timestamp-shakeStart>1400&&p.body.bounds.min.y<116&&engine.timing.timestamp-p.born>2000&&p.body.speed<1.5;p.over=high?p.over+delta:0;return p.over>2500});overflow=pieces.some(p=>p.over>0)?Math.max(...pieces.map(p=>p.over)):0;if(danger)endGame();if(time-saveTimer>2500){save();saveTimer=time}}else{accumulator=0}
ctx.clearRect(0,0,W,H);ctx.strokeStyle='#b9c9ad';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(5,113);ctx.lineTo(5,H-9);ctx.quadraticCurveTo(5,H-3,13,H-3);ctx.lineTo(W-13,H-3);ctx.quadraticCurveTo(W-5,H-3,W-5,H-9);ctx.lineTo(W-5,113);ctx.stroke();ctx.save();ctx.setLineDash([4,6]);ctx.strokeStyle=overflow?'#cf775f':'#d8b3a0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(10,116);ctx.lineTo(W-10,116);ctx.stroke();ctx.restore();
if(overflow){ctx.fillStyle='#c97960';ctx.font='10px sans-serif';ctx.textAlign='right';ctx.fillText(`快滿了！${((2500-overflow)/1000).toFixed(1)}s`,W-15,109)}
for(const p of pieces)drawPiece(ctx,p,p.body.position.x,p.body.position.y,p.body.angle);
if(phase==='playing'&&current){const p={ids:[current],g:geometry([current])};ctx.save();ctx.setLineDash([3,6]);ctx.strokeStyle='#b8c5ae60';ctx.beginPath();ctx.moveTo(aim,91);ctx.lineTo(aim,H-10);ctx.stroke();ctx.restore();drawPiece(ctx,p,aim,67,0,.85)}
if(phase==='playing')particles=particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.1;p.life-=.035;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);return p.life>0});ctx.globalAlpha=1;requestAnimationFrame(frame)}
updateUI();requestAnimationFrame(frame);
