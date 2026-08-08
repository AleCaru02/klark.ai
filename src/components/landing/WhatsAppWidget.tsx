import { useState } from "react";
import { Mail, MessageCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { product, supportMailto } from "@/config/product";

export function WhatsAppWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="mb-4 w-80 rounded-2xl bg-card border border-border shadow-lg overflow-hidden"
          >
            <div className="bg-primary p-4 text-primary-foreground">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-foreground/15 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Contatti {product.name}</p>
                    <p className="text-xs text-primary-foreground/75">Canale disponibile: email</p>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-primary-foreground/15 transition-colors" aria-label="Chiudi contatti">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4">
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Il numero WhatsApp commerciale non è ancora pubblicato. Scrivi una email indicando attività, numero medio di chiamate e gestione attuale dell'agenda.
              </p>
              <a
                href={supportMailto("Richiesta informazioni ClerkAI")}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                <Mail className="w-4 h-4" />
                Scrivi a {product.supportEmail}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen((open) => !open)}
        className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
        aria-label={isOpen ? "Chiudi contatti" : "Apri contatti"}
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </motion.button>
    </div>
  );
}
