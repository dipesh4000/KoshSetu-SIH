import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/ui/Icon';

function ToolButton({ active, icon, label, onClick }) {
  return <button onClick={onClick} className={`flex min-h-12 items-center gap-2 rounded-lg border px-4 font-label-md text-[12px] font-semibold transition active:scale-95 ${active ? 'border-tertiary bg-tertiary-container text-on-tertiary-container' : 'border-outline-variant/60 bg-parchment-bright text-secondary hover:border-tertiary hover:text-primary'}`}><Icon name={icon} filled={active} size={19} /> {label}</button>;
}

export default function MediaViewer({ record, language, onBack }) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [translated, setTranslated] = useState(language === 'हिंदी');
  const [asking, setAsking] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(record.mediaKind === 'Audio' ? 32 : 0);
  const viewerRef = useRef(null);
  const timerRef = useRef(null);
  const text = translated ? record.translation : record.viewerText;
  const isAudio = record.mediaKind === 'Audio';
  const isPdf = Boolean(record.pdfUrl);

  useEffect(() => {
    setTranslated(language === 'हिंदी');
  }, [language]);

  useEffect(() => {
    if (playing) timerRef.current = window.setInterval(() => setProgress(value => value >= 100 ? 0 : value + .25), 180);
    return () => window.clearInterval(timerRef.current);
  }, [playing]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const pdfSource = useMemo(() => isPdf ? `${record.pdfUrl}#page=${page}&zoom=${zoom}&toolbar=0&navpanes=0&scrollbar=0` : '', [isPdf, page, record.pdfUrl, zoom]);

  const narrate = () => {
    if (!('speechSynthesis' in window)) return;
    if (narrating) {
      window.speechSynthesis.cancel();
      setNarrating(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text.join(' '));
    utterance.lang = translated ? 'hi-IN' : 'en-IN';
    utterance.rate = .9;
    utterance.onend = () => setNarrating(false);
    utterance.onerror = () => setNarrating(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setNarrating(true);
  };

  const fullscreen = () => viewerRef.current?.requestFullscreen?.();
  const elapsed = Math.round((progress / 100) * 2292);
  const time = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div ref={viewerRef} className="flex h-full flex-col overflow-hidden bg-surface page-enter">
      <header className="flex shrink-0 flex-col gap-3 border-b border-outline-variant/40 bg-surface-container-low px-5 py-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <button onClick={onBack} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-outline-variant/60 bg-parchment-bright hover:border-tertiary" aria-label="Back"><Icon name="arrow_back" size={22} /></button>
          <div className="min-w-0">
            <p className="font-label-md text-[10px] font-bold uppercase tracking-[.18em] text-tertiary">{record.id} · {record.mediaKind} · {record.year}</p>
            <h1 className="truncate font-headline-md text-[22px] font-semibold leading-tight text-primary">{record.title}</h1>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
          <ToolButton active={narrating} icon={narrating ? 'stop_circle' : 'record_voice_over'} label={translated ? 'वाचन' : 'Narrate'} onClick={narrate} />
          <ToolButton active={asking} icon="auto_awesome" label="Ask AI" onClick={() => setAsking(value => !value)} />
          <ToolButton active={translated} icon="translate" label={translated ? 'हिंदी' : 'Translate'} onClick={() => setTranslated(value => !value)} />
          <ToolButton icon="fullscreen" label="Full screen" onClick={fullscreen} />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,.75fr)]">
        <section className="flex min-h-0 flex-col border-r border-outline-variant/40 bg-[#e9e5d9]">
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 md:p-6">
            {isPdf ? (
              <div className="h-full w-full overflow-hidden rounded-lg border-8 border-[#2c2b27] bg-[#2c2b27] shadow-xl">
                <iframe key={pdfSource} title={`${record.title}, page ${page}`} src={pdfSource} className="h-full w-full border-0 bg-white" />
              </div>
            ) : (
              <div className="relative h-full w-full overflow-hidden rounded-lg border-8 border-[#2c2b27] bg-black shadow-xl">
                <img src={record.imageUrl} alt={record.title} className="h-full w-full object-contain grayscale" />
                {isAudio && <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10" />}
                {isAudio && <div className="absolute bottom-6 left-6 right-6 text-white"><p className="font-label-md text-[11px] uppercase tracking-[.2em] text-white/65">Audio archive · simulated playback</p><blockquote className="mt-2 max-w-3xl font-headline-md text-[25px] leading-snug">“{record.viewerText[0]}”</blockquote></div>}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-outline-variant/50 bg-parchment-bright px-5 py-3">
            {isAudio ? (
              <div className="flex items-center gap-4">
                <button onClick={() => setPlaying(value => !value)} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow active:scale-95"><Icon name={playing ? 'pause' : 'play_arrow'} filled size={30} /></button>
                <button onClick={() => setProgress(value => Math.max(0, value - 5))} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-container"><Icon name="replay_10" size={25} /></button>
                <div className="min-w-0 flex-1"><div onClick={event => setProgress((event.nativeEvent.offsetX / event.currentTarget.offsetWidth) * 100)} className="h-3 cursor-pointer overflow-hidden rounded-full bg-surface-container-high"><div className="h-full rounded-full bg-brass-patina" style={{ width: `${progress}%` }} /></div><div className="mt-1 flex justify-between font-label-md text-[10px] text-secondary"><span>{time(elapsed)}</span><span>{record.duration}</span></div></div>
                <button onClick={() => setProgress(value => Math.min(100, value + 5))} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-container"><Icon name="forward_10" size={25} /></button>
                <button className="hidden h-11 w-11 items-center justify-center rounded-full border border-outline-variant sm:flex"><Icon name="closed_caption" size={21} /></button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={!isPdf || page === 1} className="flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant disabled:opacity-30"><Icon name="chevron_left" size={24} /></button>
                  <span className="min-w-28 text-center font-label-md text-[12px] font-semibold">Page {page} of {record.pageCount || 1}</span>
                  <button onClick={() => setPage(value => Math.min(record.pageCount || 1, value + 1))} disabled={!isPdf || page === record.pageCount} className="flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant disabled:opacity-30"><Icon name="chevron_right" size={24} /></button>
                </div>
                <div className="flex items-center gap-2"><button onClick={() => setZoom(value => Math.max(70, value - 10))} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-container"><Icon name="zoom_out" size={22} /></button><span className="w-12 text-center font-label-md text-[11px]">{zoom}%</span><button onClick={() => setZoom(value => Math.min(160, value + 10))} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-container"><Icon name="zoom_in" size={22} /></button>{record.pdfUrl && <a href={record.pdfUrl} download className="ml-2 flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant hover:border-tertiary" aria-label="Download PDF"><Icon name="download" size={21} /></a>}</div>
              </div>
            )}
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto bg-surface">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-outline-variant/40 bg-surface/95 px-6 py-5 backdrop-blur">
            <div><p className="font-label-md text-[10px] font-bold uppercase tracking-[.16em] text-tertiary">{translated ? 'हिंदी अनुवाद' : isAudio ? 'AUTO-SYNCED' : 'READABLE TEXT'}</p><h2 className="font-headline-md text-[29px] font-semibold">{isAudio ? 'Transcript' : 'Document record'}</h2></div>
            <span className={`rounded-full px-3 py-1 font-label-md text-[10px] font-semibold ${record.verified ? 'bg-verified-green/10 text-verified-green' : 'bg-surface-container text-secondary'}`}>{record.verified ? '✓ Verified' : 'Catalogued'}</span>
          </div>
          <div className="p-6 md:p-8">
            <h3 className="font-headline-md text-[31px] font-semibold leading-tight">{record.title}</h3>
            <p className="mt-2 font-body-md text-[15px] text-secondary">Dr. B. R. Ambedkar · {record.year} · {record.id}</p>
            <div className="my-6 h-px bg-outline-variant/40" />
            <div className="space-y-4">
              {text.map((paragraph, index) => <p key={index} className={`rounded-r-lg border-l-4 px-4 py-3 font-body-lg text-[18px] leading-relaxed ${isAudio && index === 1 ? 'border-brass-patina bg-brass-patina/5 font-semibold text-primary' : 'border-transparent text-on-surface-variant hover:border-outline-variant'}`}>{paragraph}</p>)}
            </div>
            {translated && <div className="mt-6 flex items-start gap-2 rounded-xl border border-ai-assisted-blue/20 bg-ai-assisted-blue/5 p-4 font-label-md text-[11px] leading-relaxed text-ai-assisted-blue"><Icon name="translate" size={17} /> Demonstration translation for the kiosk prototype.</div>}
            {asking && <div className="mt-6 rounded-2xl border border-ai-assisted-blue/30 bg-parchment-bright p-5 shadow-sm"><div className="flex items-center gap-2 font-label-md text-[11px] font-bold uppercase tracking-wider text-ai-assisted-blue"><Icon name="auto_awesome" size={17} /> Ask AI · record insight</div><h4 className="mt-3 font-headline-md text-[22px] font-semibold">What is important about this record?</h4><p className="mt-2 font-body-md text-[16px] leading-relaxed text-secondary">{record.aiInsight}</p><div className="mt-4 flex flex-wrap gap-2"><button className="rounded-full border border-outline-variant px-3 py-2 font-label-md text-[10px] text-secondary">Summarise</button><button className="rounded-full border border-outline-variant px-3 py-2 font-label-md text-[10px] text-secondary">Explain context</button></div></div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
