import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/ui/Icon';

function ToolButton({ active, icon, label, onClick }) {
  return <button onClick={onClick} className={`flex min-h-12 shrink-0 items-center gap-2 rounded-lg border px-4 font-label-md text-[12px] font-semibold transition active:scale-95 ${active ? 'border-tertiary bg-tertiary-container text-on-tertiary-container' : 'border-outline-variant/60 bg-parchment-bright text-secondary hover:border-tertiary hover:text-primary'}`}><Icon name={icon} filled={active} size={19} /> {label}</button>;
}

function RoundButton({ active, disabled, icon, label, onClick }) {
  return <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition active:scale-95 disabled:opacity-30 ${active ? 'border-tertiary bg-tertiary-container text-on-tertiary-container' : 'border-outline-variant/60 bg-transparent hover:bg-surface-container'}`}><Icon name={icon} filled={active} size={22} /></button>;
}

const parseDuration = value => {
  const parts = (value || '00:00').split(':').map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
};
const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export default function MediaViewer({ record, language, onBack }) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [viewMode, setViewMode] = useState('single');
  const [translated, setTranslated] = useState(language === 'हिंदी');
  const [asking, setAsking] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [progress, setProgress] = useState(record.mediaKind === 'Audio' ? 32 : 0);
  const [activeTrack, setActiveTrack] = useState(0);
  const [favourite, setFavourite] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [shared, setShared] = useState(false);
  const viewerRef = useRef(null);
  const timerRef = useRef(null);
  const text = translated ? record.translation : record.viewerText;
  const isAudio = record.mediaKind === 'Audio';
  const isVideo = record.mediaKind === 'Video';
  const isPlayable = isAudio || isVideo;
  const isPdf = Boolean(record.pdfUrl);
  const durationSeconds = parseDuration(record.duration);
  const elapsed = Math.round((progress / 100) * durationSeconds);

  useEffect(() => setTranslated(language === 'हिंदी'), [language]);
  useEffect(() => {
    if (playing) timerRef.current = window.setInterval(() => setProgress(value => value >= 100 ? 0 : value + .18), 180);
    return () => window.clearInterval(timerRef.current);
  }, [playing]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const pdfSource = useMemo(() => isPdf ? `${record.pdfUrl}#page=${page}&zoom=${zoom}&toolbar=0&navpanes=0&scrollbar=0` : '', [isPdf, page, record.pdfUrl, zoom]);

  const narrate = () => {
    if (!('speechSynthesis' in window)) return;
    if (narrating) { window.speechSynthesis.cancel(); setNarrating(false); return; }
    const utterance = new SpeechSynthesisUtterance(text.join(' '));
    utterance.lang = translated ? 'hi-IN' : 'en-IN';
    utterance.rate = .9;
    utterance.volume = muted ? 0 : 1;
    utterance.onend = () => setNarrating(false);
    utterance.onerror = () => setNarrating(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setNarrating(true);
  };

  const fullscreen = () => viewerRef.current?.requestFullscreen?.();
  const seek = amount => setProgress(value => Math.max(0, Math.min(100, value + (amount / Math.max(durationSeconds, 1)) * 100)));
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: record.title, text: `${record.title} · ${record.id}` });
      else await navigator.clipboard?.writeText(`${record.title} · ${record.id}`);
      setShared(true);
      window.setTimeout(() => setShared(false), 1800);
    } catch { /* visitor cancelled */ }
  };

  return (
    <div ref={viewerRef} className="flex h-full flex-col overflow-hidden bg-surface page-enter">
      <header className="flex shrink-0 flex-col gap-3 border-b border-outline-variant/40 bg-surface-container-low px-4 py-3 xl:flex-row xl:items-center xl:justify-between xl:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={onBack} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-outline-variant/60 bg-parchment-bright hover:border-tertiary" aria-label="Back"><Icon name="arrow_back" size={22} /></button>
          <div className="min-w-0"><p className="font-label-md text-[10px] font-bold uppercase tracking-[.18em] text-tertiary">{record.id} · {record.mediaKind} · {record.year}</p><h1 className="truncate font-headline-md text-[20px] font-semibold leading-tight text-primary md:text-[22px]">{record.title}</h1></div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
          <ToolButton active={narrating} icon={narrating ? 'stop_circle' : 'record_voice_over'} label={translated ? 'वाचन' : 'Narrate'} onClick={narrate} />
          <ToolButton active={asking} icon="auto_awesome" label="Ask AI" onClick={() => setAsking(value => !value)} />
          <ToolButton active={translated} icon="translate" label={translated ? 'हिंदी' : 'Translate'} onClick={() => setTranslated(value => !value)} />
          <ToolButton icon="fullscreen" label="Full screen" onClick={fullscreen} />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,.75fr)] lg:overflow-hidden">
        <section className="flex min-h-[540px] flex-col border-r border-outline-variant/40 bg-[#e9e5d9] lg:min-h-0">
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 md:p-5">
            {isPdf ? (
              <div className="h-full w-full overflow-hidden rounded-lg border-8 border-[#2c2b27] bg-[#2c2b27] shadow-xl"><iframe key={pdfSource} title={`${record.title}, page ${page}`} src={pdfSource} className="h-full w-full border-0 bg-white" /></div>
            ) : (
              <div className="relative h-full w-full overflow-hidden rounded-lg border-8 border-[#20201e] bg-black shadow-xl">
                <img src={record.imageUrl} alt={record.title} className={`h-full w-full object-contain grayscale transition duration-500 ${isVideo && playing ? 'scale-[1.02] opacity-85' : ''}`} />
                {isPlayable && <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />}
                {isVideo && !playing && <button onClick={() => setPlaying(true)} className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/65 text-white shadow-2xl backdrop-blur transition hover:scale-105" aria-label="Play documentary"><Icon name="play_arrow" filled size={44} /></button>}
                {isAudio && <div className="absolute inset-x-6 top-6 rounded-xl border border-white/15 bg-black/50 p-4 text-white backdrop-blur-sm"><p className="font-label-md text-[10px] uppercase tracking-[.2em] text-white/60">Play from</p>{['Archive recording · Side A', 'Archive recording · Side B'].map((track, index) => <button key={track} onClick={() => { setActiveTrack(index); setProgress(0); }} className={`mt-2 flex min-h-11 w-full items-center justify-between rounded-lg border px-4 text-left font-label-md text-[12px] ${activeTrack === index ? 'border-tertiary-fixed bg-white/10' : 'border-white/10 text-white/65'}`}><span>{index + 1}. {track}</span><span>{record.duration}</span></button>)}</div>}
                {captions && isPlayable && <div className="absolute bottom-5 left-5 right-5 text-white"><p className="font-label-md text-[10px] uppercase tracking-[.2em] text-white/55">{isVideo ? 'Documentary · captions on' : 'Audio archive · auto-synced transcript'}</p><blockquote className="mt-2 line-clamp-2 max-w-3xl rounded bg-black/55 px-3 py-2 font-headline-md text-[17px] leading-snug md:text-[23px]">{record.viewerText[Math.min(1, record.viewerText.length - 1)]}</blockquote></div>}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-outline-variant/50 bg-parchment-bright px-3 py-3 md:px-5">
            {isPlayable ? (
              <div className="flex items-center gap-2 md:gap-3">
                <button onClick={() => setPlaying(value => !value)} className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-primary p-3 text-white shadow active:scale-95" aria-label={playing ? 'Pause' : 'Play'}><Icon name={playing ? 'pause' : 'play_arrow'} filled size={29} /></button>
                <RoundButton icon="replay_10" label="Back 10 seconds" onClick={() => seek(-10)} />
                <RoundButton active={muted} icon={muted ? 'volume_off' : 'volume_up'} label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(value => !value)} />
                <div className="min-w-24 flex-1"><div onClick={event => setProgress((event.nativeEvent.offsetX / event.currentTarget.offsetWidth) * 100)} className="h-3 cursor-pointer overflow-hidden rounded-full bg-surface-container-high"><div className="h-full rounded-full bg-brass-patina" style={{ width: `${progress}%` }} /></div><div className="mt-1 flex justify-between font-label-md text-[10px] text-secondary"><span>{formatTime(elapsed)}</span><span>{record.duration}</span></div></div>
                <RoundButton icon="forward_10" label="Forward 10 seconds" onClick={() => seek(10)} />
                <span className="hidden sm:block"><RoundButton active={captions} icon="closed_caption" label="Toggle captions" onClick={() => setCaptions(value => !value)} /></span>
                <span className="hidden md:block"><RoundButton icon="fullscreen" label="Full screen" onClick={fullscreen} /></span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2"><RoundButton disabled={!isPdf || page === 1} icon="chevron_left" label="Previous page" onClick={() => setPage(value => Math.max(1, value - 1))} /><span className="min-w-24 text-center font-label-md text-[12px] font-semibold">Page {page} of {record.pageCount || 1}</span><RoundButton disabled={!isPdf || page === record.pageCount} icon="chevron_right" label="Next page" onClick={() => setPage(value => Math.min(record.pageCount || 1, value + 1))} /></div>
                {isPdf && <input aria-label="Choose page" type="range" min="1" max={record.pageCount} value={page} onChange={event => setPage(Number(event.target.value))} className="hidden min-w-32 flex-1 accent-[#9a7611] md:block" />}
                <div className="flex items-center gap-1"><RoundButton active={viewMode === 'single'} icon="crop_portrait" label="Single page" onClick={() => setViewMode('single')} /><RoundButton active={viewMode === 'spread'} icon="view_week" label="Two-page spread" onClick={() => setViewMode('spread')} /><RoundButton active={viewMode === 'grid'} icon="grid_view" label="Page grid" onClick={() => setViewMode('grid')} /><RoundButton icon="zoom_out" label="Zoom out" onClick={() => setZoom(value => Math.max(70, value - 10))} /><span className="hidden w-11 text-center font-label-md text-[10px] sm:inline">{zoom}%</span><RoundButton icon="zoom_in" label="Zoom in" onClick={() => setZoom(value => Math.min(160, value + 10))} />{record.pdfUrl && <a href={record.pdfUrl} download className="flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant hover:border-tertiary" aria-label="Download PDF"><Icon name="download" size={21} /></a>}</div>
              </div>
            )}
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto bg-surface">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-outline-variant/40 bg-surface/95 px-5 py-4 backdrop-blur md:px-6 md:py-5"><div><p className="font-label-md text-[10px] font-bold uppercase tracking-[.16em] text-tertiary">{translated ? 'हिंदी अनुवाद' : isPlayable ? 'AUTO-SYNCED' : 'READABLE TEXT'}</p><h2 className="font-headline-md text-[27px] font-semibold">{isPlayable ? 'Transcript' : 'Document record'}</h2></div><span className={`rounded-full px-3 py-1 font-label-md text-[10px] font-semibold ${record.verified ? 'bg-verified-green/10 text-verified-green' : 'bg-surface-container text-secondary'}`}>{record.verified ? '✓ Verified' : 'Catalogued'}</span></div>
          <div className="p-5 md:p-7">
            <h3 className="font-headline-md text-[29px] font-semibold leading-tight">{record.title}</h3><p className="mt-2 font-body-md text-[15px] text-secondary">Dr. B. R. Ambedkar · {record.year} · {record.id}</p>
            <div className="mt-5 flex flex-wrap gap-2 border-y border-outline-variant/35 py-4"><button onClick={() => setFavourite(value => !value)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 font-label-md text-[11px] ${favourite ? 'border-tertiary bg-tertiary-container' : 'border-outline-variant'}`}><Icon name="star" filled={favourite} size={18} /> {favourite ? 'Saved' : 'Favourite'}</button><button onClick={share} className="flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 font-label-md text-[11px]"><Icon name={shared ? 'check' : 'share'} size={18} /> {shared ? 'Copied' : 'Share'}</button><button onClick={() => setFlagged(value => !value)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 font-label-md text-[11px] ${flagged ? 'border-tertiary bg-tertiary-container' : 'border-outline-variant'}`}><Icon name="flag" filled={flagged} size={18} /> {flagged ? 'Flagged' : 'Flag'}</button></div>
            <div className="mt-5 space-y-3">{text.map((paragraph, index) => <p key={index} className={`rounded-r-lg border-l-4 px-4 py-3 font-body-lg text-[17px] leading-relaxed ${isPlayable && index === 1 ? 'border-brass-patina bg-brass-patina/5 font-semibold text-primary' : 'border-transparent text-on-surface-variant hover:border-outline-variant'}`}>{paragraph}</p>)}</div>
            {translated && <div className="mt-5 flex items-start gap-2 rounded-xl border border-ai-assisted-blue/20 bg-ai-assisted-blue/5 p-4 font-label-md text-[11px] leading-relaxed text-ai-assisted-blue"><Icon name="translate" size={17} /> Demonstration translation for the kiosk prototype.</div>}
            {asking && <div className="mt-5 rounded-2xl border border-ai-assisted-blue/30 bg-parchment-bright p-5 shadow-sm"><div className="flex items-center gap-2 font-label-md text-[11px] font-bold uppercase tracking-wider text-ai-assisted-blue"><Icon name="auto_awesome" size={17} /> Ask AI · record insight</div><h4 className="mt-3 font-headline-md text-[22px] font-semibold">What is important about this record?</h4><p className="mt-2 font-body-md text-[16px] leading-relaxed text-secondary">{record.aiInsight}</p><div className="mt-4 flex flex-wrap gap-2"><button className="rounded-full border border-outline-variant px-3 py-2 font-label-md text-[10px] text-secondary">Summarise</button><button className="rounded-full border border-outline-variant px-3 py-2 font-label-md text-[10px] text-secondary">Explain context</button></div></div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
