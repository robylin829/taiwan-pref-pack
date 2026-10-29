import fs from 'node:fs';
fs.mkdirSync('dist',{recursive:true});
for(const entry of ['index.html','style.css','favicon.svg','src','vendor']) fs.cpSync(entry,`dist/${entry}`,{recursive:true});
console.log('Static site built in dist/');
