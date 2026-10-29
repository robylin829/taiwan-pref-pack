export const regions = [
  {id:'north',name:'北部地方',short:'北',color:'#82b8a4',dark:'#356452',ids:['63000','65000','10017','68000','10004','10018','10002']},
  {id:'east',name:'東部地方',short:'東',color:'#b4a4d2',dark:'#695585',ids:['10015','10014']},
  {id:'central',name:'中部地方',short:'中',color:'#edc46c',dark:'#80652b',ids:['10005','66000','10007','10008','10009']},
  {id:'south',name:'南部地方',short:'南',color:'#e69c86',dark:'#8a4d3c',ids:['10010','10020','67000','64000','10013']},
  {id:'islands',name:'離島地方',short:'島',color:'#87b7d0',dark:'#426c86',ids:['10016','09020','09007']}
];
export const regionOf=id=>regions.find(r=>r.ids.includes(id));
export function completedRegions(ids){return regions.filter(r=>r.ids.every(id=>ids.includes(id)))}
// Game-only sea links keep the offshore counties reachable from the main island.
const seaLinks=[['10016','09020'],['10016','09007'],['09020','09007'],['10016','64000'],['09007','10017']];
export function canMerge(a,b,countyData){
  if(a.some(id=>b.includes(id)))return false;
  return a.some(id=>countyData.find(c=>c.id===id)?.neighbors.some(n=>b.includes(n))) ||
    seaLinks.some(([x,y])=>(a.includes(x)&&b.includes(y))||(a.includes(y)&&b.includes(x)));
}
export function mergeScore(ids){return ids.length*15+completedRegions(ids).length*100+(ids.length===22?1000:0)}
export function shuffledBag(random=Math.random){
  const ids=regions.flatMap(r=>r.ids);
  for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]]}return ids;
}
