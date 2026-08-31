import { useMemo, useState } from 'react';
import Icon from '../../components/ui/Icon';
import { decades, records, timelineEvents } from '../../data/archiveData';

export default function TimelinePage({ language, onOpen }) {
  const [decade, setDecade] = useState('All');
  const [selected, setSelected] = useState(null);
  const events = useMemo(() => decade === 'All' ? timelineEvents : timelineEvents.filter(item => item.decade === decade), [decade]);

  if (selected) {
    const related = records.find(record => record.id === selected.relatedRecord);
    return (
      <div className="flex h-full flex-col overflow-hidden bg-surface page-enter">
        <div className="flex shrink-0 items-center justify-between border-b border-outline-variant/40 px-7 py-4 md:px-12">
          <button onClick={() => setSelected(null)} className="flex min-h-12 items-center gap-2 rounded-lg px-3 font-label-md text-[13px] font-semibold text-secondary hover:bg-surface-container"><Icon name="arrow_back" size={20} /> {language === 'हिंदी' ? 'समयरेखा पर वापस' : 'Back to timeline'}</button>
          <span className="font-label-md text-[11px] uppercase tracking-[.18em] text-tertiary">Historical chronology</span>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[.8fr_1.2fr]">
          <aside className="overflow-y-auto border-r border-outline-variant/40 bg-surface-container-low p-6 md:p-10">
            <h1 className="font-headline-lg text-[42px] font-semibold">Timeline</h1>
            <div className="relative mt-8 border-l border-outline-variant pl-7">
              {timelineEvents.map(event => (
                <button key={event.id} onClick={() => setSelected(event)} className={`relative mb-3 w-full rounded-xl border p-4 text-left transition ${selected.id === event.id ? 'border-tertiary bg-parchment-bright shadow-sm' : 'border-transparent hover:bg-surface-container'}`}>
                  <span className={`absolute -left-[35px] top-7 h-3 w-3 rounded-full ring-4 ring-surface-container-low ${selected.id === event.id ? 'bg-tertiary' : 'bg-outline'}`} />
                  <span className="font-label-md text-[11px] font-bold uppercase tracking-wider text-tertiary">{event.date}</span>
                  <strong className="mt-1 block font-headline-md text-[19px] leading-tight text-primary">{event.title}</strong>
                </button>
              ))}
            </div>
          </aside>
          <section className="overflow-y-auto p-7 md:p-12">
            <article className="mx-auto flex min-h-full max-w-4xl flex-col rounded-2xl border border-outline-variant/50 bg-parchment-bright p-7 shadow-sm md:p-12">
              <p className="font-label-lg text-[14px] font-bold uppercase tracking-[.18em] text-tertiary">{selected.date}</p>
              <h2 className="mt-4 font-headline-lg text-[clamp(38px,5vw,64px)] font-semibold leading-none">{selected.title}</h2>
              <p className="mt-8 max-w-3xl font-body-lg text-[22px] leading-relaxed text-secondary">{selected.body}</p>
              <div className="my-10 h-px bg-outline-variant/40" />
              {related && <div className="mt-auto"><h3 className="mb-4 font-headline-md text-[27px] font-semibold">{language === 'हिंदी' ? 'संबंधित सामग्री' : 'Related material'}</h3><button onClick={() => onOpen(related)} className="flex w-full items-center gap-5 rounded-xl border border-outline-variant/50 bg-surface p-4 text-left transition hover:border-tertiary hover:shadow-md"><img src={related.imageUrl} alt="" className="h-24 w-20 rounded object-cover grayscale" /><div className="min-w-0 flex-1"><span className="font-label-md text-[11px] uppercase tracking-wider text-tertiary">{related.id} · {related.type} · {related.year}</span><strong className="mt-1 block font-headline-md text-[22px] leading-tight">{related.title}</strong></div><Icon name="arrow_forward" size={22} className="text-tertiary" /></button></div>}
            </article>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-7 py-10 page-enter md:px-16">
      <header className="mx-auto max-w-5xl text-center">
        <p className="font-label-md text-[12px] font-bold uppercase tracking-[.22em] text-tertiary">{language === 'हिंदी' ? 'ऐतिहासिक कालक्रम' : 'HISTORICAL CHRONOLOGY'}</p>
        <h1 className="mt-3 font-headline-lg text-[clamp(42px,6vw,72px)] font-semibold leading-none">{language === 'हिंदी' ? 'जीवन यात्रा' : 'A life in motion'}</h1>
        <p className="mx-auto mt-4 max-w-2xl font-body-md text-[18px] leading-relaxed text-secondary">{language === 'हिंदी' ? 'किसी पड़ाव को चुनकर उसका संदर्भ और संबंधित अभिलेख देखें।' : 'Trace the ideas, struggles and constitutional work that shaped modern India.'}</p>
        <div className="mt-7 flex justify-center gap-2 overflow-x-auto pb-2">
          {decades.map(item => <button key={item} onClick={() => setDecade(item)} className={`min-h-11 shrink-0 rounded-full border px-5 font-label-md text-[12px] font-semibold ${decade === item ? 'border-primary bg-primary text-white' : 'border-outline-variant bg-surface-container-low text-secondary'}`}>{item}</button>)}
        </div>
      </header>
      <section className="relative mx-auto mt-12 max-w-5xl pb-16">
        <div className="absolute bottom-0 left-1/2 top-0 hidden w-px bg-tertiary/35 md:block" />
        <div className="space-y-9 md:space-y-2">
          {events.map((event, index) => {
            const related = records.find(record => record.id === event.relatedRecord);
            const left = index % 2 === 0;
            return (
              <div key={event.id} className="relative grid min-h-[250px] grid-cols-1 items-center md:grid-cols-2">
                <span className="absolute left-1/2 top-1/2 z-10 hidden h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-surface bg-tertiary shadow md:block" />
                <button onClick={() => setSelected(event)} className={`group rounded-2xl border border-outline-variant/40 bg-parchment-bright p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-tertiary hover:shadow-lg md:max-w-[420px] ${left ? 'md:mr-14 md:justify-self-end' : 'md:col-start-2 md:ml-14'}`}>
                  <span className="font-label-md text-[12px] font-bold uppercase tracking-[.18em] text-tertiary">{event.date}</span>
                  <h2 className="mt-2 font-headline-md text-[29px] font-semibold leading-tight">{event.title}</h2>
                  <p className="mt-3 line-clamp-2 font-body-md text-[15px] leading-relaxed text-secondary">{event.body}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-outline-variant/30 pt-3"><span className="font-label-md text-[11px] uppercase tracking-wider text-secondary">{related?.type || 'Record'}</span><Icon name="arrow_forward" size={19} className="text-tertiary transition group-hover:translate-x-1" /></div>
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
