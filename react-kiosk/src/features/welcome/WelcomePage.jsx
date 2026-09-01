import { useEffect, useState } from 'react';
import Icon from '../../components/ui/Icon';
import { copy, records } from '../../data/archiveData';

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
    <div className="relative min-h-screen cursor-pointer overflow-hidden bg-primary text-white lg:cursor-default lg:bg-surface lg:text-primary" onClick={onEnter}>
      <div className="absolute inset-0 archive-grid hidden opacity-50 lg:block" />
      <div className="absolute inset-0 lg:hidden">
        {slides.map((slide, index) => (
          <img key={slide.image} src={slide.image} alt="" className={`absolute inset-0 h-full w-full object-cover grayscale transition-all duration-1000 ${index === activeSlide ? 'scale-100 opacity-100' : 'scale-105 opacity-0'}`} style={{ objectPosition: slide.position }} />
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/25 to-black/90" />
      </div>
      <div className="relative mx-auto grid min-h-screen max-w-[1500px] grid-cols-1 items-stretch lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative z-10 flex flex-col justify-between px-6 py-7 sm:px-10 sm:py-10 md:px-14 lg:px-20 lg:py-14">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 font-label-md text-[11px] font-semibold uppercase tracking-[.18em] text-tertiary-fixed lg:text-tertiary">
              <Icon name="language" size={23} /> Ambedkar Digital Heritage
            </div>
            <div className="flex rounded-full border border-white/40 bg-black/25 p-1 backdrop-blur lg:border-outline-variant lg:bg-parchment-bright" onClick={event => event.stopPropagation()}>
              {['ENG', 'हिंदी'].map(item => (
                <button key={item} onClick={() => onLanguage(item)} className={`min-h-10 rounded-full px-4 font-label-md text-[11px] font-semibold sm:min-h-11 sm:px-5 sm:text-[12px] ${language === item ? 'bg-white text-primary lg:bg-primary lg:text-white' : 'text-white/75 lg:text-secondary'}`}>{item}</button>
              ))}
            </div>
          </div>

          <div className="my-auto max-w-3xl py-10 lg:my-12 lg:py-0">
            <p className="mb-4 font-label-lg text-[11px] font-bold uppercase tracking-[.2em] text-tertiary-fixed lg:mb-5 lg:text-[13px] lg:text-tertiary">{text.welcomeEyebrow}</p>
            <h1 className="max-w-2xl font-display-lg text-[clamp(44px,12vw,72px)] font-bold leading-[.94] tracking-[-.035em] text-white drop-shadow-lg lg:text-[clamp(48px,6.4vw,92px)] lg:text-primary lg:drop-shadow-none">{text.welcomeTitle}</h1>
            <p className="mt-5 max-w-xl font-body-lg text-[clamp(17px,4.5vw,23px)] leading-relaxed text-white/80 lg:mt-7 lg:max-w-2xl lg:text-[clamp(19px,2vw,27px)] lg:text-secondary">{text.welcomeBody}</p>
          </div>

          <div className="flex flex-col gap-4 lg:gap-6">
            <div className="flex gap-2 lg:hidden" onClick={event => event.stopPropagation()}>
              {slides.map((slide, index) => <button key={slide.image} onClick={() => setActiveSlide(index)} className={`h-2.5 rounded-full transition-all ${index === activeSlide ? 'w-9 bg-tertiary-fixed' : 'w-2.5 bg-white/50'}`} aria-label={`Show slide ${index + 1}`} />)}
            </div>
            <button onClick={onEnter} className="group flex min-h-20 w-full max-w-2xl items-center justify-between rounded-2xl border border-white/25 bg-black/70 px-5 text-left text-white shadow-xl backdrop-blur transition hover:bg-black/85 active:scale-[.98] sm:px-7 lg:border-0 lg:bg-primary lg:hover:bg-ink-pressed">
              <span>
                <strong className="block font-headline-md text-[22px]">{text.touch}</strong>
                <small className="mt-1 block font-label-md text-[10px] uppercase tracking-widest text-white/60 sm:text-[12px]">{records.length} catalogued records · English / हिंदी</small>
              </span>
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container transition group-hover:translate-x-1"><Icon name="touch_app" size={28} filled /></span>
            </button>
            <p className="font-label-md text-[9px] uppercase tracking-[.16em] text-white/55 lg:text-[11px] lg:text-secondary">Verified records · Source-linked stories · Kiosk demo</p>
          </div>
        </section>

        <section
          className="relative hidden cursor-pointer overflow-hidden bg-primary lg:block"
          aria-label="Enter kiosk from featured archive slideshow"
          role="button"
          tabIndex={0}
          onClick={event => { event.stopPropagation(); onEnter(); }}
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
