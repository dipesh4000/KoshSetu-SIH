import { useState } from 'react';
import Icon from '../../components/ui/Icon';
import { askDemos, records } from '../../data/archiveData';

export default function AskPage({ language, onOpen }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = (value = question) => {
    if (!value.trim()) return;
    setQuestion(value);
    setAnswer(null);
    setLoading(true);
    const normalized = value.toLowerCase();
    const match = askDemos.find(item => item.question.toLowerCase() === normalized || item.questionHi === value)
      || askDemos.find(item => item.question.toLowerCase().split(' ').some(word => word.length > 6 && normalized.includes(word)))
      || askDemos[0];
    window.setTimeout(() => { setAnswer(match); setLoading(false); }, 800);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface page-enter">
      <header className="shrink-0 border-b border-outline-variant/35 px-8 py-6 md:px-16">
        <p className="font-label-md text-[11px] font-bold uppercase tracking-[.2em] text-tertiary">{language === 'हिंदी' ? 'स्रोत-आधारित सहायक' : 'SOURCE-GROUNDED ASSISTANT'}</p>
        <h1 className="mt-1 font-headline-lg text-[clamp(36px,4vw,54px)] font-semibold">Ask</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto archive-grid px-6 py-7 md:px-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          {!answer && !loading && !question && (
            <div className="flex min-h-52 flex-col items-center justify-center text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full border border-tertiary/50 bg-parchment-bright text-tertiary"><Icon name="auto_awesome" size={35} /></span>
              <h2 className="mt-5 font-headline-md text-[34px] font-semibold">{language === 'हिंदी' ? 'अभिलेख से पूछें। स्रोत तक पहुँचें।' : 'Ask the archive. Follow the evidence.'}</h2>
              <p className="mt-2 max-w-xl font-body-md text-[17px] text-secondary">{language === 'हिंदी' ? 'डेमो उत्तर देखने के लिए नीचे दिया गया प्रश्न चुनें।' : 'Choose a prepared question to see a concise answer with connected records.'}</p>
            </div>
          )}

          {question && <div className="flex justify-end"><div className="max-w-3xl rounded-2xl rounded-br-sm bg-surface-container-high px-6 py-4 font-body-lg text-[20px] shadow-sm">{question}</div></div>}
          {loading && <div className="flex items-center gap-3 rounded-xl px-5 py-4 text-secondary"><span className="flex gap-1">{[0,1,2].map(item => <i key={item} className="dot-blink h-2.5 w-2.5 rounded-full bg-tertiary" />)}</span><span className="font-body-md text-[16px]">{language === 'हिंदी' ? 'अभिलेखों में खोज जारी है…' : 'Reading across the archive…'}</span></div>}

          {answer && (
            <article className="rounded-2xl rounded-bl-sm border border-outline-variant/50 bg-parchment-bright p-6 shadow-md md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-label-md text-[11px] font-semibold uppercase tracking-wider text-ai-assisted-blue"><Icon name="auto_awesome" size={17} /> AI-assisted synthesis</span>
                <span className="flex items-center gap-2 font-label-md text-[11px] font-semibold uppercase tracking-wider text-verified-green"><Icon name="verified" size={17} filled /> {answer.sources.length} records connected</span>
              </div>
              <h2 className="mt-5 max-w-3xl font-headline-md text-[31px] font-semibold leading-tight">{language === 'हिंदी' ? answer.titleHi : answer.title}</h2>
              <p className="mt-4 max-w-4xl font-body-lg text-[20px] leading-relaxed text-on-surface-variant">{language === 'हिंदी' ? answer.answerHi : answer.answer}</p>
              <div className="mt-7 border-t border-outline-variant/35 pt-5">
                <h3 className="mb-3 font-label-md text-[12px] font-bold uppercase tracking-[.16em] text-secondary">{language === 'हिंदी' ? 'संदर्भित अभिलेख' : 'Referenced records'}</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {answer.sources.map((id, index) => {
                    const record = records.find(item => item.id === id);
                    return <button key={id} onClick={() => onOpen(record)} className="flex min-h-20 items-center gap-4 rounded-xl border border-tertiary/30 bg-tertiary/5 p-3 text-left transition hover:bg-tertiary/10"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tertiary text-white font-label-md text-[12px]">{index + 1}</span><span className="min-w-0 flex-1"><strong className="block truncate font-body-md text-[16px]">{record.title}</strong><small className="font-label-md text-[11px] text-secondary">{record.id} · {record.year}</small></span><Icon name="arrow_forward" size={18} className="text-tertiary" /></button>;
                  })}
                </div>
              </div>
              <p className="mt-5 flex items-start gap-2 rounded-lg bg-ai-assisted-blue/5 p-3 font-label-md text-[11px] leading-relaxed text-ai-assisted-blue"><Icon name="info" size={16} /> {language === 'हिंदी' ? 'यह कियोस्क प्रदर्शन के लिए तैयार किया गया हार्डकोडेड उत्तर है।' : 'This is a prepared, hardcoded response for the kiosk demonstration.'}</p>
            </article>
          )}

          <div className="flex gap-3 overflow-x-auto pb-2">
            {askDemos.map(item => <button key={item.question} onClick={() => submit(language === 'हिंदी' ? item.questionHi : item.question)} className="min-h-14 min-w-[250px] max-w-sm rounded-xl border border-outline-variant/60 bg-surface-container-low px-4 py-3 text-left font-label-md text-[12px] font-semibold leading-snug text-secondary transition hover:border-tertiary hover:text-primary">{language === 'हिंदी' ? item.questionHi : item.question}</button>)}
          </div>
        </div>
      </div>
      <form onSubmit={event => { event.preventDefault(); submit(); }} className="shrink-0 border-t border-outline-variant/40 bg-surface px-6 py-4 md:px-12">
        <div className="mx-auto flex min-h-[68px] max-w-5xl items-center gap-3 rounded-2xl border-2 border-outline-variant/60 bg-parchment-bright p-2 focus-within:border-tertiary">
          <Icon name="search" size={24} className="ml-3 text-secondary" />
          <input value={question} onChange={event => setQuestion(event.target.value)} placeholder={language === 'हिंदी' ? 'अभिलेख से प्रश्न पूछें…' : 'Inquire with the archive…'} className="min-w-0 flex-1 border-0 bg-transparent px-2 font-body-md text-[18px] outline-none" />
          <button disabled={!question.trim() || loading} className="flex min-h-13 items-center gap-2 rounded-xl bg-primary px-6 font-label-md text-[13px] font-semibold text-white disabled:opacity-40">{language === 'हिंदी' ? 'पूछें' : 'Ask'} <Icon name="send" size={18} /></button>
        </div>
      </form>
    </div>
  );
}
