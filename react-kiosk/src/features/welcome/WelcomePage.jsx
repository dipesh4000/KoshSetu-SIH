import { useEffect, useState } from 'react';
import Icon from '../../components/ui/Icon';
import { copy } from '../../data/archiveData';

const slides = [
  { image: '/assets/ambedkar-portrait-demo.png', position: 'center', quote: 'Cultivation of mind should be the ultimate aim of human existence.', label: 'Portrait archive' },
  { image: '/assets/constituent-assembly-demo.png', position: 'center', quote: 'Constitutional morality is not a natural sentiment. It has to be cultivated.', label: 'Constituent Assembly' },
  { image: '/assets/manuscript-demo.png', position: 'center 28%', quote: 'History shows that where ethics and economics come in conflict, victory is always with economics.', label: 'Manuscript collection' },
];

export default function WelcomePage({ language, onLanguage, onEnter }) {
  const text = copy[language];
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setActiveSlide(value => (value + 1) % slides.length), 4800);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="relative min-h-screen overflow-hidden bg-surface text-primary">
      <div className="absolute inset-0 archive-grid opacity-50" />
      <div className="relative mx-auto grid min-h-screen max-w-[1500px] grid-cols-1 items-stretch lg:grid-cols-[1.05fr_.95fr]">
        <section className="flex flex-col justify-between px-8 py-10 md:px-16 md:py-14 lg:px-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 font-label-md text-[12px] font-semibold uppercase tracking-[.18em] text-tertiary">
              <Icon name="language" size={23} /> Ambedkar Digital Heritage
            </div>
            <div className="flex rounded-full border border-outline-variant bg-parchment-bright p-1">
              {['ENG', 'हिंदी'].map(item => (
                <button key={item} onClick={() => onLanguage(item)} className={`min-h-11 rounded-full px-5 font-label-md text-[12px] font-semibold ${language === item ? 'bg-primary text-white' : 'text-secondary'}`}>{item}</button>
              ))}
            </div>
          </div>

          <div className="my-12 max-w-3xl">
            <p className="mb-5 font-label-lg text-[13px] font-bold uppercase tracking-[.2em] text-tertiary">{text.welcomeEyebrow}</p>
            <h1 className="font-display-lg text-[clamp(48px,6.4vw,92px)] font-bold leading-[.94] tracking-[-.035em] text-primary">{text.welcomeTitle}</h1>
            <p className="mt-7 max-w-2xl font-body-lg text-[clamp(19px,2vw,27px)] leading-relaxed text-secondary">{text.welcomeBody}</p>
          </div>

          <div className="flex flex-col gap-6">
            <button onClick={onEnter} className="group flex min-h-20 w-full max-w-2xl items-center justify-between rounded-2xl bg-primary px-7 text-left text-white shadow-xl transition hover:bg-ink-pressed active:scale-[.98]">
              <span>
                <strong className="block font-headline-md text-[22px]">{text.touch}</strong>
                <small className="mt-1 block font-label-md text-[12px] uppercase tracking-widest text-white/60">8 catalogued records · English / हिंदी</small>
              </span>
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container transition group-hover:translate-x-1"><Icon name="touch_app" size={28} filled /></span>
            </button>
            <p className="font-label-md text-[11px] uppercase tracking-[.18em] text-secondary">Verified records · Source-linked stories · Kiosk demo</p>
          </div>
        </section>

        <section
          className="relative hidden cursor-pointer overflow-hidden bg-primary lg:block"
          aria-label="Enter kiosk from featured archive slideshow"
          role="button"
          tabIndex={0}
          onClick={onEnter}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onEnter();
            }
          }}
        >
          {slides.map((slide, index) => (
            <img key={slide.image} src={slide.image} alt="" className={`absolute inset-0 h-full w-full object-cover grayscale transition-all duration-1000 ${index === activeSlide ? 'scale-100 opacity-100' : 'scale-105 opacity-0'}`} style={{ objectPosition: slide.position }} />
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/5 to-primary/15" />
          <div className="absolute bottom-0 left-0 right-0 p-12 text-white">
            <div className="mb-5 h-px w-24 bg-tertiary-fixed" />
            <blockquote key={activeSlide} className="slide-copy max-w-lg font-headline-md text-[26px] leading-snug">“{slides[activeSlide].quote}”</blockquote>
            <div className="mt-5 flex items-center justify-between gap-4">
              <p className="font-label-md text-[11px] uppercase tracking-widest text-white/60">{slides[activeSlide].label} · Dr. B. R. Ambedkar</p>
              <div className="flex gap-2">
                {slides.map((slide, index) => <button key={slide.image} onClick={event => { event.stopPropagation(); setActiveSlide(index); }} className={`h-2.5 rounded-full transition-all ${index === activeSlide ? 'w-8 bg-tertiary-fixed' : 'w-2.5 bg-white/45'}`} aria-label={`Show slide ${index + 1}`} />)}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
