import fs from 'node:fs';
import {createHash} from 'node:crypto';
fs.mkdirSync('dist',{recursive:true});
for(const entry of ['index.html','style.css','favicon.svg','src','vendor']) fs.cpSync(entry,`dist/${entry}`,{recursive:true});
const modules=fs.readdirSync('src').filter(name=>name.endsWith('.js')).sort();
const version=createHash('sha256').update(['index.html','style.css',...modules.map(name=>`src/${name}`)].map(path=>fs.readFileSync(path,'utf8')).join('\n')).digest('hex').slice(0,12);
// Version both the entrypoint and its imports so a deploy cannot mix old game code with new HTML.
for(const name of modules){
  const path=`dist/src/${name}`;
  fs.writeFileSync(path,fs.readFileSync(path,'utf8').replace(/(from\s+['"]\.\/[^'"]+\.js)(['"])/g,`$1?v=${version}$2`));
}
fs.writeFileSync('dist/index.html',fs.readFileSync('dist/index.html','utf8').replace(/((?:src|href)="\.\/[^"?]+\.(?:js|css))"/g,`$1?v=${version}"`));
console.log('Static site built in dist/');
