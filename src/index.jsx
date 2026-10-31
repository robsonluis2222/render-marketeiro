import React from 'react';
import {registerRoot, Composition, AbsoluteFill, Img, Audio, Sequence, useCurrentFrame, interpolate, spring} from 'remotion';

const safeColor = (v, fallback) => /^#[0-9a-f]{6}$/i.test(v || '') ? v : fallback;
const matchAsset = (scene, manifest) => {
  const hay = `${(scene.elements || []).join(' ')} ${scene.visual_description || ''} ${(scene.visual_scene?.asset_tags || []).join(' ')}`.toLowerCase();
  for (const [tag, url] of Object.entries(manifest || {})) if (hay.includes(tag.toLowerCase())) return url;
  return null;
};
const secondsFor = scene => Math.max(2.4, Math.min(12, ((scene.narration || '').trim().split(/\s+/).filter(Boolean).length || 8) / 2.3));

function Scene({scene, index, manifest, fps, start, duration}) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, Math.min(15, duration / 3), duration], [0, 1, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const enter = spring({frame, fps, config: {damping: 18, stiffness: 120}});
  const asset = matchAsset(scene, manifest);
  const bg = scene.background || {};
  const from = safeColor(bg.from, '#090914');
  const to = safeColor(bg.to, '#2b174d');
  const text = scene.on_screen_text || '';
  const narration = scene.narration || '';
  const type = scene.animation_type || 'pop';
  const scale = type === 'zoom' ? interpolate(frame, [0, duration], [1.05, 1], {extrapolateRight: 'clamp'}) : 1;
  const x = type === 'slide' ? interpolate(enter, [0, 1], [-80, 0]) : 0;
  return <AbsoluteFill style={{opacity: p, background: `linear-gradient(145deg, ${from}, ${to})`, overflow: 'hidden'}}>
    {asset ? <Img src={asset} style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', transform:`scale(${scale}) translateX(${x}px)`, opacity:.55}} /> : <>
      <div style={{position:'absolute', width:720, height:720, borderRadius:'50%', background:'rgba(167,139,250,.16)', top:-200, right:-220, transform:`scale(${1 + .08 * Math.sin(frame/20)})`}} />
      <div style={{position:'absolute', bottom:180, left:70, right:70, height:7, background:'rgba(255,255,255,.18)', transform:`scaleX(${p})`, transformOrigin:'left'}} />
    </>}
    <AbsoluteFill style={{justifyContent:'center', alignItems:'center', padding:70, transform:`translateX(${x}px) scale(${scale})`}}>
      <div style={{fontFamily:'Arial, sans-serif', fontWeight:800, fontSize:76, lineHeight:1.04, color:'#fff', textAlign:'center', textShadow:'0 5px 22px #000', maxWidth:950}}>{text}</div>
      <div style={{position:'absolute', bottom:210, left:70, right:70, fontFamily:'Arial, sans-serif', fontSize:34, lineHeight:1.22, color:'#fff', textAlign:'center', textShadow:'0 3px 12px #000', background:'rgba(0,0,0,.35)', borderRadius:20, padding:'18px 24px'}}>{narration}</div>
    </AbsoluteFill>
    <div style={{position:'absolute', top:35, left:45, right:45, height:7, background:'rgba(255,255,255,.25)', borderRadius:10}}><div style={{width:`${p*100}%`, height:'100%', background:'#a78bfa', borderRadius:10}} /></div>
  </AbsoluteFill>;
}

function Video({script, fps=30, manifest={}, audioFile}) {
  const scenes = script?.scenes || [];
  const durations = scenes.map(secondsFor);
  const total = durations.reduce((a,b)=>a+b,0);
  let start = 0;
  return <AbsoluteFill style={{background:'#090914'}}>
    {scenes.map((scene, i) => { const d = Math.round(durations[i] * fps); const s = Math.round(start * fps); start += durations[i]; return <div key={i} style={{position:'absolute', inset:0, display:'none'}}><Scene scene={scene} index={i} manifest={manifest} fps={fps} start={s} duration={d}/></div>; })}
    {scenes.map((scene, i) => { const d = Math.round(durations[i] * fps); const s = Math.round(durations.slice(0,i).reduce((a,b)=>a+b,0) * fps); return <SequenceLayer key={`layer-${i}`} scene={scene} manifest={manifest} fps={fps} from={s} duration={d}/>; })}
    {audioFile ? <Audio src={audioFile} volume={1} /> : null}
  </AbsoluteFill>;
}
function SequenceLayer({scene, manifest, fps, from, duration}) { return <div style={{position:'absolute', inset:0}}><RemotionSequence from={from} durationInFrames={duration}><Scene scene={scene} manifest={manifest} fps={fps} start={from} duration={duration}/></RemotionSequence></div>; }
function RemotionSequence({children, from, durationInFrames}) { return <Sequence from={from} durationInFrames={durationInFrames}>{children}</Sequence>; }

export const RemotionRoot = () => <>
  <Composition id="HotVertical" component={Video} durationInFrames={300} fps={30} width={1080} height={1920} defaultProps={{script:{scenes:[]}, fps:30, manifest:{}}} calculateMetadata={({props}) => { const ds=(props.script?.scenes||[]).map(secondsFor); return {durationInFrames: Math.max(1, Math.ceil(ds.reduce((a,b)=>a+b,0) * (props.fps||30))), fps: props.fps||30, width:1080, height:1920}; }} />
</>;
registerRoot(RemotionRoot);
