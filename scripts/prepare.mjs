import fs from 'node:fs';
import {feature, neighbors} from 'topojson-client';
const topo = JSON.parse(fs.readFileSync(new URL('../taiwan-source.topo.json', import.meta.url)));
const geometries = topo.objects.map.geometries;
const features = feature(topo, topo.objects.map).features;
const adjacent = neighbors(geometries);
const area = ring => Math.abs(ring.reduce((a,p,i)=>{const q=ring[(i+1)%ring.length];return a+p[0]*q[1]-q[0]*p[1]},0));
const data=features.map((f,i)=>{
  const polys=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates];
  const ring=polys.map(p=>p[0]).sort((a,b)=>area(b)-area(a))[0];
  return {id:f.properties.id,name:f.properties.name,points:ring.map(p=>[+(p[0]*.9063).toFixed(5),+(-p[1]).toFixed(5)]),neighbors:adjacent[i].map(j=>features[j].properties.id)};
});
fs.mkdirSync('src',{recursive:true});fs.mkdirSync('vendor',{recursive:true});
fs.writeFileSync('src/counties.js',`// Simplified county boundaries. Sources and MIT notice: THIRD_PARTY_NOTICES.md\nexport const counties = ${JSON.stringify(data)};\n`);
fs.copyFileSync('node_modules/matter-js/build/matter.min.js','vendor/matter.min.js');
fs.copyFileSync('node_modules/poly-decomp/build/decomp.min.js','vendor/decomp.min.js');
console.log(`Prepared ${data.length} county shapes and local physics libraries.`);
