// Build only public website assets for Netlify. Internal files remain outside dist.
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve('dist');
const publicExtensions = new Set(['.html','.css','.js','.png','.jpg','.jpeg','.webp','.gif','.svg','.ico','.woff','.woff2','.ttf','.webmanifest','.json','.txt','.mp4','.webm','.pdf']);
const explicitlyPublicRootFiles = new Set(['supabase-config.js']);
const publicDirs = ['images','img','assets','css','js','fonts','media','videos'];
fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});
function copyFile(src,dst) {fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);}
for(const name of fs.readdirSync('.')){
  const src=path.resolve(name);
  if(fs.statSync(src).isFile() && publicExtensions.has(path.extname(name).toLowerCase()) && (explicitlyPublicRootFiles.has(name) || !/^(package(-lock)?|tsconfig|eslint|supabase|security|readme|license|netlify|vite|postcss|tailwind)/i.test(name))){
    // JSON/PDF may contain private data, only explicit public file types at root
    if(['.json','.pdf','.txt'].includes(path.extname(name).toLowerCase())) continue;
    copyFile(src,path.join(output,name));
  }
}
function walk(src,dst){
 for(const entry of fs.readdirSync(src,{withFileTypes:true})){
  if(entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
  const from=path.join(src,entry.name),to=path.join(dst,entry.name);
  if(entry.isDirectory()) walk(from,to);
  else if(entry.isFile() && publicExtensions.has(path.extname(entry.name).toLowerCase()) && !['.json','.pdf','.txt'].includes(path.extname(entry.name).toLowerCase())) copyFile(from,to);
 }
}
for(const name of publicDirs) if(fs.existsSync(name)&&fs.statSync(name).isDirectory()) walk(name,path.join(output,name));
console.log('Netlify public assets ready in dist');
