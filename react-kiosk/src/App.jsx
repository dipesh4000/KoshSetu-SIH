import { useCallback, useEffect, useState } from 'react';
import AppShell from './components/layout/AppShell';
import WelcomePage from './features/welcome/WelcomePage';
import BrowsePage from './features/browse/BrowsePage';
import SearchPage from './features/search/SearchPage';
import TimelinePage from './features/timeline/TimelinePage';
import AskPage from './features/ask/AskPage';
import MediaViewer from './features/viewer/MediaViewer';
import { records } from './data/archiveData';
import './styles.css';

export default function App() {
  const [page, setPage] = useState('welcome');
  const [language, setLanguage] = useState('ENG');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(90);

  const navigate = useCallback((destination) => {
    if (destination === 'welcome' || destination === 'home') {
      window.speechSynthesis?.cancel();
      setSelectedRecord(null);
      setPage('welcome');
      setSecondsLeft(90);
      return;
    }
    setSelectedRecord(null);
    setPage(destination);
    setSecondsLeft(90);
  }, []);

  useEffect(() => {
    if (page === 'welcome') return undefined;
    const reset = () => setSecondsLeft(90);
    const countdown = window.setInterval(() => setSecondsLeft(value => {
      if (value <= 1) {
        window.speechSynthesis?.cancel();
        setSelectedRecord(null);
        setPage('welcome');
        return 90;
      }
      return value - 1;
    }), 1000);
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    return () => {
      window.clearInterval(countdown);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [page]);

  if (page === 'welcome') {
    return <WelcomePage language={language} onLanguage={setLanguage} onEnter={() => navigate('browse')} />;
  }

  const openRecord = (record) => {
    setSelectedRecord(record);
    setSecondsLeft(90);
  };

  let content;
  if (selectedRecord) content = <MediaViewer record={selectedRecord} language={language} onBack={() => setSelectedRecord(null)} />;
  else if (page === 'browse') content = <BrowsePage language={language} onOpen={openRecord} onNavigate={navigate} />;
  else if (page === 'search') content = <SearchPage language={language} onOpen={openRecord} />;
  else if (page === 'timeline') content = <TimelinePage language={language} onOpen={openRecord} />;
  else content = <AskPage language={language} onOpen={openRecord} />;

  return (
    <AppShell
      page={page}
      language={language}
      secondsLeft={secondsLeft}
      onNavigate={navigate}
      onLanguage={setLanguage}
    >
      {content}
    </AppShell>
  );
}

export { records };
