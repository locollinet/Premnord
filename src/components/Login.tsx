import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { PremnordLogo } from './PremnordLogo';

export const Login: React.FC = () => {
  const { loginWithGoogle, error } = useFirebase();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-premnord-cream text-premnord-dark flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background elegant decoration */}
      <div className="absolute top-[-20%] left-[-20%] w-[60vw] h-[60vw] rounded-full bg-radial from-premnord-green-light to-transparent pointer-events-none opacity-60" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-radial from-premnord-gold-light to-transparent pointer-events-none opacity-60" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md bg-white border border-premnord-gold/20 rounded-3xl shadow-xl p-8 z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <PremnordLogo size={80} />
          </div>
          <h1 className="text-3xl font-serif font-medium tracking-tight text-premnord-dark text-center">
            Suivi App Premnord
          </h1>
          <div className="w-12 h-[1px] bg-premnord-gold my-3" />
          <p className="text-premnord-green-dark text-xs text-center max-w-[320px] font-sans leading-relaxed">
            Gestion de cave et de salle, traçabilité des stocks d'élite & suivi des 7 sites d'exploitation.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-900 text-xs leading-relaxed font-semibold">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
            className="w-full h-12 bg-premnord-dark hover:bg-premnord-green-dark text-white rounded-xl font-bold flex items-center justify-center gap-2.5 transition-all duration-300 cursor-pointer text-xs font-sans shadow-md"
          >
            <LogIn className="w-4 h-4 text-white" />
            {isSubmitting ? 'Connexion en cours...' : 'Se connecter avec Google'}
          </button>

          <div className="pt-2 text-center">
            <p className="text-xs text-stone-500 font-sans">
              Authentification sécurisée avec votre compte Google professionnel pour synchroniser en temps réel avec la cave Premnord.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-premnord-gold/10 text-center">
          <p className="text-premnord-green-dark/60 text-[10px] font-mono leading-relaxed">
            Premnord Cellar Manager &bull; v2.0.0<br/>
            Charte Graphique Officielle &bull; Haute Fidélité
          </p>
        </div>
      </motion.div>
    </div>
  );
};
