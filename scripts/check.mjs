import { readdir,readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const files=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(['node_modules','data','.cache','.git','.netlify'].includes(entry.name))continue;const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else if(/\.(mjs|js)$/.test(path))files.push(path);}}
await walk('.');let failed=false;
for(const path of files){const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});if(result.status!==0){console.error(result.stderr);failed=true;}}
for(const path of ['public/index.html','public/admin.html']){const html=await readFile(path,'utf8');for(const match of html.matchAll(/(?:src|href)="(\/(?:[\w.-]+\/)*[\w.-]+\.(?:js|css|jpeg))"/g)){try{await readFile('public'+match[1]);}catch{console.error(`Missing asset ${match[1]} in ${path}`);failed=true;}}}
if(failed)process.exit(1);console.log(`Syntax and local asset checks passed (${files.length} JavaScript modules).`);
