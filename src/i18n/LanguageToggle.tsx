import { motion } from 'framer-motion';
import { useLanguage } from './LanguageContext';
import { triggerHaptic } from '../lib/haptics';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  const handleSelect = (lang: 'en' | 'bn') => {
    if (lang !== language) {
      triggerHaptic('toggle');
      setLanguage(lang);
    }
  };

  return (
    <div className="language-toggle" role="group" aria-label={language === 'bn' ? 'ভাষা নির্বাচন' : 'Language selection'}>
      <motion.button
        type="button"
        lang="en"
        aria-pressed={language === 'en'}
        onClick={() => handleSelect('en')}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.93 }}
        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
      >
        English
      </motion.button>
      <motion.button
        type="button"
        lang="bn"
        aria-pressed={language === 'bn'}
        onClick={() => handleSelect('bn')}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.93 }}
        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
      >
        বাংলা
      </motion.button>
    </div>
  );
}
