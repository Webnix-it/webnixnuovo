/* ============================================================
   WEBNIX — config.js  (SOLO JavaScript puro / Vanilla JS)
   Configurazione centralizzata: Firebase, contatti, social,
   servizi, portfolio, recensioni demo.
   Nessun framework, nessun altro linguaggio.
   ============================================================ */

var WEBNIX_CONFIG = {
  /* ---------- BRAND ---------- */
  brand: "Webnix",
  brandFull: "Webnix Digital Agency",
  siteName: "WEBNIX",
  tagline: "Dimentica WordPress.",
  copyrightYear: 2026,
  logoHeader: "loghi/WEBNIX.png",
  logoFooter: "WEBNIX-Logo-Solo-Simbolo-(1).png",

  /* ---------- CONTATTI ---------- */
  contact: {
    email: "webnixit@gmail.com",
    phoneDisplay: "+1 413 225 9397",
    phoneRaw: "14132259397",
    address: "Genova, Liguria, Italia",
    hours: "Lunedì – Venerdì, 09:00 – 18:00"
  },

  /* ---------- SOCIAL ---------- */
  /* Instagram uniformato a "webnix.it" ovunque (footer + JSON-LD) */
  social: {
    instagram: "https://www.instagram.com/webnix.it",
    facebook: "https://www.facebook.com/people/Webnix-Digital-Agency/61582890411506/",
    whatsappBase: "https://wa.me/14132259397"
  },

  /* ---------- FIREBASE (Realtime Database) ---------- */
  firebase: {
    apiKey: "AIzaSyDEMOKEY-WEBNIX-replace-with-real-key",
    authDomain: "webnix-recensioni.firebaseapp.com",
    databaseURL: "https://webnix-recensioni-default-rtdb.firebaseio.com",
    projectId: "webnix-recensioni",
    storageBucket: "webnix-recensioni.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000000000",
    reviewsPath: "recensioni"
  },

  /* ---------- RECENSIONI ----------
     Limite caratteri UNIFORMATO a 1000 (commento e codice coerenti) */
  reviews: {
    maxChars: 1000,
    minStars: 1,
    maxStars: 5,
    loadTimeoutMs: 6000,
    /* Fallback demo: mostra 3 testimonianze dirette se il DB è vuoto
       o irraggiungibile, mai un "Caricamento..." infinito. */
    demo: [
      {
        name: "Chiara B.",
        text: "Avevo solo Instagram e dopo un blocco ho perso i contatti con i clienti. Webnix mi ha fatto il sito in due giorni, bozza gratuita inclusa. Onesti e veloci.",
        url: "",
        stars: 5,
        timestamp: 1735689600000
      },
      {
        name: "Marco T. — Nuova pizzeria",
        text: "Non comparivo su Google Maps. Dopo il sito e la scheda curata, le richieste sono raddoppiate in un mese. Pagato solo a lavoro approvato, zero sorprese.",
        url: "",
        stars: 5,
        timestamp: 1738368000000
      },
      {
        name: "Sara L. — Studio di fisioterapia",
        text: "Niente canoni mensili folli, niente WordPress. Il codice del sito è mio. Mi hanno spiegato tutto, anche cosa NON era incluso. Rarissima trasparenza.",
        url: "",
        stars: 5,
        timestamp: 1740787200000
      }
    ]
  },

  /* ---------- SERVIZI (trasparenza radicale: include / NON include) ---------- */
  services: [
    {
      id: "pacchetto-sito-web",
      icon: "fa-solid fa-globe",
      eyebrow: "Sito Web",
      name: "Base",
      price: "",
      badge: "Sito Web",
      highlight: true,
      description: "Un sito elegante e funzionale, perfetto da condividere nella bio di Instagram, Facebook e altri social.",
      detailsTitle: "Dettagli Pacchetto",
      includes: [
        "1 Pagina con design moderno e personalizzato.",
        "Sito responsive: perfetto su smartphone, tablet e desktop.",
        "Sviluppo con HTML, CSS e JavaScript.",
        "Hosting gratuito e permanente su GitHub Pages o Netlify (entrambi veloci e affidabili). Possibilità di usare un altro hosting su richiesta.",
        "Integrazione con i tuoi profili social (Instagram, Facebook, LinkedIn, ecc.).",
        "CookieBot gratuito per la gestione dei cookie (conformità GDPR di base).",
        "Modulo di contatto funzionante.",
        "Pagine legali di base (generate con IA): Privacy Policy, Termini e Condizioni, Cookie Policy. ⚠️ Attenzione: queste pagine sono generate automaticamente e non sostituiscono una consulenza legale. Consigliamo di farle validare da un professionista per una conformità completa.",
        "30 giorni di assistenza gratuita dopo la consegna: fino a 3 modifiche gratuite (testi, immagini, link, ecc.). Dopo le 3 modifiche o il termine del periodo, eventuali interventi saranno valutati separatamente.",
        "Consegna in 5-12 giorni lavorativi."
      ],
      excludes: [
        "Ottimizzazione per i motori di ricerca (SEO): il sito non è pensato per apparire su Google. È progettato per essere condiviso tramite link diretto (es. bio di Instagram, WhatsApp, ecc.).",
        "Dominio personalizzato: la registrazione del dominio (es. www.tuositoweb.it) non è inclusa.",
        "Servizi di terze parti: strumenti come Iubenda, PayPal, Stripe o newsletter non sono inclusi.",
        "Manutenzione post-consegna: aggiornamenti successivi non sono inclusi nel pacchetto."
      ],
      faqDomanda: "Quali sono i costi futuri per mantenere il sito web attivo?",
      faqRisposta: "Nessun costo",
      cta: "Seleziona"
    },
    {
      id: "pacchetto-creazione-logo",
      icon: "fa-solid fa-pen-nib",
      eyebrow: "Creazione",
      name: "Brand Identity",
      price: "",
      badge: "Logo",
      highlight: false,
      description: "Rendi unico il tuo brand con un logo professionale.",
      detailsTitle: "Dettagli Pacchetto",
      includes: [
        "Logo personalizzato",
        "Favicon (per web)",
        "Palette colori personalizzata.",
        "Selezione tipografica (font per titoli, testi e accenti).",
        "Creazione di pattern o texture uniche per il brand.",
        "Set di icone o simboli coordinati allo stile del logo.",
        "Definizione dello stile fotografico (moodboard e guida visiva).",
        "Anteprima del logo su prodotti (t-shirt, tazze, badge, ecc.)",
        "Linee guida di composizione e uso del logo su sfondi chiari/scuri.",
        "Tone of Voice (voce del brand: formale, amichevole, creativa, ecc.).",
        "Mini Brand Book in PDF (palette, font, loghi, pattern, stili e regole d'uso).",
        "Consegna in 5–8 giorni lavorativi."
      ],
      excludes: [
        "Naming (creazione del nome del brand).",
        "Copywriting o slogan pubblicitario.",
        "Materiali stampati (biglietti, brochure, packaging).",
        "Stampa fisica (forniamo solo il file digitale pronto per la stampa).",
        "Template social (opzionale +20€)."
      ],
      cta: "Seleziona"
    },
    {
      id: "pacchetto-grafica",
      icon: "fa-solid fa-image",
      eyebrow: "Creazione",
      name: "Grafica",
      price: "",
      badge: "Locandina",
      highlight: false,
      description: "Dai visibilità ai tuoi eventi, prodotti o promozioni con locandine dal design professionale e d'impatto.",
      detailsTitle: "Dettagli Pacchetto",
      includes: [
        "1 Grafica personalizzata",
        "2 proposte di design per scegliere lo stile che preferisci",
        "Formati file (PNG, JPG ecc.).",
        "Formato per social o stampa",
        "1 revisione inclusa",
        "Consegna in 1-3 giorni lavorativi (spesso entro 24 ore)."
      ],
      excludes: [
        "Copywriting o slogan pubblicitario.",
        "Stampa fisica (forniamo solo il file digitale pronto per la stampa)."
      ],
      cta: "Seleziona"
    },
    {
      id: "pacchetto-rebranding-social",
      icon: "fa-solid fa-share-nodes",
      eyebrow: "",
      name: "Rebranding Social",
      price: "",
      badge: "Social",
      highlight: false,
      description: "Dai un nuovo look ai tuoi profili social e migliora la tua presenza online.",
      detailsTitle: "Dettagli Pacchetto Social",
      includes: [
        "Rebranding dei post e profilo (colori, layout e stile)",
        "Aggiornamento della biografia e delle informazioni profilo",
        "Consigli per un impatto visivo più forte",
        "Strategie per rendere il tuo profilo più professionale e coerente",
        "Mini guida step by step: 'Come andare virale in 30 giorni'",
        "'Consigli per aumentare l'engagement organico'",
        "Strategia settimanale: cosa postare, quando e perché",
        "5+ prompt pronti per ChatGPT per generare idee, testi e caption",
        "Template per contenuti virali (reels e post)",
        "Creazione logo (se necessario).",
        "Consegna completa entro 24-48 ore"
      ],
      excludes: [],
      cta: "Seleziona"
    },
    {
      id: "pacchetto-restyling-sito",
      icon: "fa-solid fa-wand-magic-sparkles",
      eyebrow: "",
      name: "Restyling Sito Web",
      price: "",
      badge: "Restyling",
      highlight: false,
      description: "Rinnova il tuo sito esistente con un design moderno, responsive e più efficace.",
      detailsTitle: "Dettagli Pacchetto Restyling",
      includes: [
        "Nuovo design moderno e professionale, coerente con il tuo brand",
        "Versione completamente responsive (adatta a smartphone, tablet e desktop)",
        "Miglioramento dell'usabilità e della navigazione",
        "Aggiornamento di testi e immagini (se forniti)",
        "Logo personalizzato creato da zero (se necessario)",
        "Consegna in 3-6 giorni lavorativi"
      ],
      excludes: [
        "Modulo di contatto.",
        "Integrazione con servizi esterni (es. Calendly, EmailJS, newsletter).",
        "Funzionalità dinamiche (form, login, carrello).",
        "Creazione di nuove pagine o contenuti non forniti.",
        "Trasferimento o gestione del dominio.",
        "Manutenzione o aggiornamenti futuri.",
        "Pagine legali."
      ],
      cta: "Seleziona"
    }
  ],

  /* ---------- PORTFOLIO (griglia filtrabile) ---------- */
  portfolio: [
    { category: "siti", title: "Pizzeria Vesuvio — Genova", desc: "Sito vetrina + Maps, +38% chiamate in 30 giorni.", img: "assets/portfolio/sito-vesuvio.png" },
    { category: "siti", title: "Studio Fisio Nova", desc: "Landing page 48h, hostita su Netlify.", img: "assets/portfolio/sito-fisio.png" },
    { category: "siti", title: "Barber Shop Reale", desc: "Design dark neon, 98 score Lighthouse.", img: "assets/portfolio/sito-barber.png" },
    { category: "loghi", title: "Logo — GreenBox Delivery", desc: "Wordmark + simbolo, consegna file sorgente.", img: "assets/portfolio/logo-greenbox.png" },
    { category: "loghi", title: "Logo — Atelier Moda Ligure", desc: "Monogramma elegante, varianti print/digital.", img: "assets/portfolio/logo-atelier.png" },
    { category: "grafica", title: "Coordonato Social — PaleFit", desc: "Template post/storie coerenti col brand.", img: "assets/portfolio/grafica-palefit.png" },
    { category: "grafica", title: "Locandina Evento — Food Truck Fest", desc: "Stampa + digitale, CMYK/RGB.", img: "assets/portfolio/grafica-foodtruck.png" }
  ],

  /* ---------- WHATSAPP ---------- */
  whatsappMessage: "Ciao Webnix! Vorrei la bozza gratuita del mio sito web."
};

/* Utility globali (solo JS puro) */
function waLink(testo) {
  const msg = encodeURIComponent(testo || WEBNIX_CONFIG.whatsappMessage);
  return WEBNIX_CONFIG.social.whatsappBase + "?text=" + msg;
}

/* ============================================================
   EXPORT SU window — FONDAMENTALE: in JavaScript, una variabile
   dichiarata con "var" al livello PIU' ESTERNO di un file non e'
   garantita come proprieta' dell'oggetto window. script.js legge
   la configurazione tramite window.WEBNIX_CONFIG: senza questa
   riga CFG resta null e le 5 card dei servizi NON vengono create.
   ============================================================ */
window.WEBNIX_CONFIG = WEBNIX_CONFIG;
