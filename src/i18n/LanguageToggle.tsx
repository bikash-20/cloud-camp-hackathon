import { useLanguage } from './LanguageContext';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="language-toggle" role="group" aria-label={language === 'bn' ? 'ভাষা নির্বাচন' : 'Language selection'}>
      <button
        type="button"
        lang="en"
        aria-pressed={language === 'en'}
        onClick={() => setLanguage('en')}
      >
        English
      </button>
      <button
        type="button"
        lang="bn"
        aria-pressed={language === 'bn'}
        onClick={() => setLanguage('bn')}
      >
        বাংলা
      </button>
    </div>
  );
}
