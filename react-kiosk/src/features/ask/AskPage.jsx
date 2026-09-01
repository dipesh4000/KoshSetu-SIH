import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/ui/Icon';
import OnScreenKeyboard from '../../components/ui/OnScreenKeyboard';
import { askDemos, records } from '../../data/archiveData';

function findAnswer(value) {
  const normalized = value.toLowerCase();
  return askDemos.find(item => item.question.toLowerCase() === normalized || item.questionHi === value)
    || askDemos.find(item => item.question.toLowerCase().split(' ').some(word => word.length > 6 && normalized.includes(word)))
    || askDemos[0];
}

function AssistantMessage({ message, language, onOpen }) {
  const answer = message.answer;
  return (
    <article className="max-w-4xl rounded-2xl rounded-bl-sm border border-outline-variant/50 bg-parchment-bright p-5 shadow-md md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-label-md text-[10px] font-semibold uppercase tracking-wider text-ai-assisted-blue"><Icon name="auto_awesome" size={16} /> AI-assisted synthesis</span>
        {!message.streaming && <span className="flex items-center gap-2 font-label-md text-[10px] font-semibold uppercase tracking-wider text-verified-green"><Icon name="verified" size={16} filled /> {answer.sources.length} records connected</span>}
      </div>
      <h2 className="mt-4 font-headline-md text-[27px] font-semibold leading-tight">{language === 'हिंदी' ? answer.titleHi : answer.title}</h2>
      <p className="mt-3 min-h-14 font-body-lg text-[18px] leading-relaxed text-on-surface-variant">
        {message.visibleText}<span className={message.streaming ? 'stream-caret' : ''} />
      </p>
      {!message.streaming && (
        <div className="mt-5 border-t border-outline-variant/35 pt-4">
          <h3 className="mb-3 font-label-md text-[10px] font-bold uppercase tracking-[.16em] text-secondary">{language === 'हिंदी' ? 'संदर्भित अभिलेख' : 'Referenced records'}</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {answer.sources.map((id, index) => {
              const record = records.find(item => item.id === id);
              return <button key={id} onClick={() => onOpen(record)} className="flex min-h-16 items-center gap-3 rounded-xl border border-tertiary/30 bg-tertiary/5 p-3 text-left transition hover:bg-tertiary/10"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tertiary font-label-md text-[11px] text-white">{index + 1}</span><span className="min-w-0 flex-1"><strong className="block truncate font-body-md text-[15px]">{record.title}</strong><small className="font-label-md text-[10px] text-secondary">{record.id} · {record.year}</small></span><Icon name="arrow_forward" size={17} className="text-tertiary" /></button>;
            })}
          </div>
        </div>
      )}
    </article>
  );
}

export default function AskPage({ language, onOpen }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const streamTimer = useRef(null);

  useEffect(() => {
    return () => {
      window.clearInterval(streamTimer.current);
    };
  }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const fillPrompt = (value) => {
    setQuestion(value);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const submit = () => {
    const sentQuestion = question.trim();
    if (!sentQuestion || streaming) return;
    const answer = findAnswer(sentQuestion);
    const fullText = language === 'हिंदी' ? answer.answerHi : answer.answer;
    const words = fullText.split(' ');
    const assistantId = `assistant-${Date.now()}`;
    setQuestion('');
    setKeyboardOpen(false);
    setStreaming(true);
    setMessages(previous => [
      ...previous,
      { id: `user-${Date.now()}`, role: 'user', text: sentQuestion },
      { id: assistantId, role: 'assistant', answer, visibleText: '', streaming: true },
    ]);

    let index = 0;
    streamTimer.current = window.setInterval(() => {
      index += 1;
      setMessages(previous => previous.map(message => message.id === assistantId
        ? { ...message, visibleText: words.slice(0, index).join(' '), streaming: index < words.length }
        : message));
      if (index >= words.length) {
        window.clearInterval(streamTimer.current);
        setStreaming(false);
      }
    }, 45);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface page-enter">
      <header className="flex shrink-0 items-end justify-between border-b border-outline-variant/35 px-7 py-4 md:px-12">
        <div><p className="font-label-md text-[10px] font-bold uppercase tracking-[.2em] text-tertiary">{language === 'हिंदी' ? 'स्रोत-आधारित सहायक' : 'SOURCE-GROUNDED ASSISTANT'}</p><h1 className="font-headline-lg text-[clamp(32px,3.2vw,46px)] font-semibold">Ask</h1></div>
        {messages.length > 0 && <button onClick={() => { setMessages([]); setQuestion(''); }} className="flex min-h-11 items-center gap-2 rounded-lg px-4 font-label-md text-[11px] font-semibold text-secondary hover:bg-surface-container"><Icon name="add_comment" size={18} /> {language === 'हिंदी' ? 'नई बातचीत' : 'New conversation'}</button>}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto archive-grid px-5 py-5 md:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-5">
          {messages.length === 0 && (
            <div className="flex min-h-44 flex-col items-center justify-center text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-tertiary/50 bg-parchment-bright text-tertiary"><Icon name="auto_awesome" size={29} /></span>
              <h2 className="mt-4 font-headline-md text-[30px] font-semibold">{language === 'हिंदी' ? 'अभिलेख से पूछें। स्रोत तक पहुँचें।' : 'Ask the archive. Follow the evidence.'}</h2>
              <p className="mt-1 max-w-xl font-body-md text-[15px] text-secondary">{language === 'हिंदी' ? 'किसी सुझाव को चुनें, फिर भेजने के लिए पूछें दबाएँ।' : 'Choose a suggestion to fill the composer, then press Ask when you are ready.'}</p>
            </div>
          )}

          {messages.map(message => message.role === 'user'
            ? <div key={message.id} className="flex justify-end"><div className="max-w-3xl rounded-2xl rounded-br-sm bg-surface-container-high px-5 py-4 font-body-lg text-[18px] shadow-sm">{message.text}</div></div>
            : <AssistantMessage key={message.id} message={message} language={language} onOpen={onOpen} />)}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-outline-variant/40 bg-surface px-5 pb-3 pt-2 md:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {askDemos.map(item => {
              const label = language === 'हिंदी' ? item.questionHi : item.question;
              return <button type="button" key={item.question} onClick={() => fillPrompt(label)} className="min-h-10 min-w-[220px] max-w-xs rounded-full border border-outline-variant/60 bg-surface-container-low px-4 text-left font-label-md text-[10px] font-semibold leading-tight text-secondary transition hover:border-tertiary hover:text-primary">{label}</button>;
            })}
          </div>
          <form onSubmit={event => { event.preventDefault(); submit(); }} className="flex min-h-[64px] items-center gap-2 border-b-2 border-outline-variant bg-transparent px-1 transition focus-within:border-tertiary">
            <Icon name="forum" size={22} className="text-tertiary" />
            <input ref={inputRef} value={question} onChange={event => setQuestion(event.target.value)} placeholder={language === 'हिंदी' ? 'अभिलेख से प्रश्न पूछें…' : 'Inquire with the archive…'} className="min-w-0 flex-1 border-0 bg-transparent px-2 font-body-md text-[18px] outline-none placeholder:text-outline" />
            <button type="button" onClick={() => setKeyboardOpen(value => !value)} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition ${keyboardOpen ? 'bg-tertiary-container text-on-tertiary-container' : 'text-secondary hover:bg-surface-container'}`} aria-label="Toggle on-screen keyboard"><Icon name="keyboard" size={23} /></button>
            <button type="submit" disabled={!question.trim() || streaming} className="flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 font-label-md text-[12px] font-semibold text-white disabled:opacity-40">{language === 'हिंदी' ? 'पूछें' : 'Ask'} <Icon name="send" size={17} /></button>
          </form>
        </div>
      </div>

      {keyboardOpen && <OnScreenKeyboard language={language} onKey={key => setQuestion(value => value + key)} onBackspace={() => setQuestion(value => value.slice(0, -1))} onClear={() => setQuestion('')} onClose={() => setKeyboardOpen(false)} />}
    </div>
  );
}
