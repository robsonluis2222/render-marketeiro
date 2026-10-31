import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const GENERATED = path.join(PUBLIC, 'generated');
const ASSETS = path.join(ROOT, 'storage', 'assets');
const jobs = new Map();
let bundleLocation;
await Promise.all([fs.mkdir(GENERATED, {recursive:true}), fs.mkdir(ASSETS, {recursive:true})]);
const app = express();
app.use(cors({origin:true,methods:['GET','POST','DELETE','OPTIONS'],allowedHeaders:['Content-Type','Accept']}));
app.options('*', cors());
app.use((req,res,next)=>{res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');res.set('Pragma','no-cache');res.set('Expires','0');next()});
app.use(express.json({limit:'30mb'}));
app.use('/assets', express.static(ASSETS));
app.use('/generated', express.static(GENERATED));
const upload = multer({storage: multer.diskStorage({destination: ASSETS, filename: (_, f) => `${crypto.randomUUID()}-${f.originalname.replace(/[^a-zA-Z0-9._-]/g,'_')}`}), limits:{fileSize:100*1024*1024}});

async function getBundle() { if (!bundleLocation) bundleLocation = await bundle({entryPoint:path.join(ROOT,'src','index.jsx'), webpackOverride: config => config}); return bundleLocation; }
function parseSettings(req) { return {fps: Math.max(15, Math.min(60, Number(req.body.settings?.fps || 30))), quality: req.body.settings?.quality || 'high', codec: req.body.settings?.codec || 'h264', manifest: req.body.settings?.manifest || {}}; }
async function renderJob(id, body) {
  const job=jobs.get(id); job.status='bundling';
  let audioFile;
  try {
    const settings=parseSettings({body});
    if (body.tts?.audio_base64) { const raw=String(body.tts.audio_base64).replace(/^data:audio\/[^;]+;base64,/,''); audioFile=`data:audio/mpeg;base64,${raw}`; }
    const loc=await getBundle();
    const script=body.script || {scenes:[]};
    const comp=await selectComposition({serveUrl:loc, id:'HotVertical', inputProps:{script, fps:settings.fps, manifest:settings.manifest, audioFile}});
    job.status='rendering';
    const outputPath=path.join(GENERATED,`${id}.mp4`);
    await renderMedia({composition:comp, serveUrl:loc, codec: settings.codec === 'h264' ? 'h264' : 'vp8', outputLocation:outputPath, inputProps:{script, fps:settings.fps, manifest:settings.manifest, audioFile}, crf: settings.quality === 'high' ? 18 : 23, concurrency: Number(process.env.REMOTION_CONCURRENCY || 1), onProgress: p => {job.progress=Math.round(p.progress*100)}});
    job.status='done'; job.progress=100; job.url=`/render/${id}/file`; job.completedAt=new Date().toISOString();
  } catch (e) { job.status='failed'; job.error=e?.stack || e?.message || String(e); }
}
app.get('/health', (_,res)=>{res.set('Cache-Control','no-store');return res.json({ok:true, renderer:'remotion', remotion: true, jobs: jobs.size});});
app.get('/render/:id', (req,res)=>{ res.set('Cache-Control','no-store'); const j=jobs.get(req.params.id); if(!j) return res.status(404).json({success:false,message:'Render não encontrado'}); res.json({success:j.status!=='failed', response:{id:req.params.id,status:j.status,progress:j.progress||0,url:j.url,error:j.error||null}}); });
app.get('/render/:id/file', async (req,res)=>{ const j=jobs.get(req.params.id); if(!j?.url || j.status!=='done') return res.status(409).json({message:'Render ainda não concluído'}); res.download(path.join(GENERATED,`${req.params.id}.mp4`), 'aivf-remotion.mp4'); });
app.post('/render', async (req,res)=>{ if(!req.body?.script?.scenes?.length) return res.status(400).json({success:false,message:'script.scenes é obrigatório'}); const id=crypto.randomUUID(); jobs.set(id,{id,status:'queued',progress:0,createdAt:new Date().toISOString()}); renderJob(id,req.body); res.status(201).json({success:true,message:'Render enfileirado',response:{id}}); });
app.get('/assets', async (_,res)=>{ const files=await fs.readdir(ASSETS); res.json({success:true,assets:files.map(name=>({id:name,name,url:`/assets/${encodeURIComponent(name)}`}))}); });
app.post('/assets', upload.single('file'), (req,res)=>{ if(!req.file) return res.status(400).json({success:false,message:'file é obrigatório'}); res.status(201).json({success:true,asset:{id:req.file.filename,name:req.file.originalname,url:`/assets/${encodeURIComponent(req.file.filename)}`}}); });
app.delete('/assets/:name', async (req,res)=>{ try {await fs.unlink(path.join(ASSETS,req.params.name)); res.json({success:true});} catch {res.status(404).json({success:false,message:'asset não encontrado'});} });
app.listen(PORT,()=>console.log(`Remotion renderer listening on ${PORT}`));
