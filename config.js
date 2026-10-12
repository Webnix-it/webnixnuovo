/* ============================================================
   WEBNIX — config.js  (dati del sito: brand, contatti, social,
   pacchetti servizi, portfolio, recensioni demo)
   Caricato PRIMA di script.js in tutte le pagine.
   ============================================================ */
(function () {
  "use strict";

  var NUMERO_WA = "14132259397";

  window.WEBNIX_CONFIG = {
    brand: "Webnix",
    logoHeader: "WEBNIX-Logo-Solo-Simbolo-(1).png",
    logoFooter: "WEBNIX-Logo-Solo-Simbolo-(1).png",
    copyrightYear: new Date().getFullYear(),

    contact: {
      email: "webnixit@gmail.com",
      phoneDisplay: "+1 413 225 9397",
      phoneRaw: "14132259397",
      whatsapp: NUMERO_WA,
      address: "Genova, Liguria, Italia",
      hours: "Lunedì – Venerdì, 09:00 – 18:00"
    },

    social: {
      instagram: "https://www.instagram.com/webnix.it/",
      facebook: "https://www.facebook.com/webnixit/",
      linkedin: "https://www.linkedin.com/company/webnix"
    },

    services: [
      {
        id: "sito-web",
        eyebrow: "Sito Web",
        name: "Base",
        icon: "fa-solid fa-globe",
        badge: "Icona Sito Web",
        price: "-",
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
          "Pagine legali di base (generate con IA): Privacy Policy, Termini e Condizioni, Cookie Policy. ⚠️ Attenzione: generate automaticamente, non sostituiscono una consulenza legale. Consigliamo di farle validare da un professionista.",
          "30 giorni di assistenza gratuita dopo la consegna: fino a 3 modifiche gratuite (testi, immagini, link, ecc.). Dopo, eventuali interventi saranno valutati separatamente.",
          "Consegna in 5-12 giorni lavorativi."
        ],
        excludes: [
          "Ottimizzazione per i motori di ricerca (SEO): il sito è pensato per essere condiviso tramite link diretto (bio Instagram, WhatsApp, ecc.), non per apparire su Google.",
          "Dominio personalizzato: la registrazione del dominio (es. www.tuositoweb.it) non è inclusa.",
          "Servizi di terze parti: strumenti come Iubenda, PayPal, Stripe o newsletter non sono inclusi.",
          "Manutenzione post-consegna: aggiornamenti successivi non sono inclusi nel pacchetto."
        ],
        faqDomanda: "Quali sono i costi futuri per mantenere il sito web attivo?",
        faqRisposta: "Nessun costo",
        cta: "Seleziona"
      },
      {
        id: "brand-identity",
        eyebrow: "Creazione",
        name: "Brand Identity",
        icon: "fa-solid fa-pen-nib",
        badge: "Icona Logo",
        price: "-",
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
        id: "creazione-grafica",
        eyebrow: "Creazione",
        name: "Grafica",
        icon: "fa-solid fa-image",
        badge: "Icona Locandina",
        price: "-",
        description: "Dai visibilità ai tuoi eventi, prodotti o promozioni con locandine dal design professionale e d'impatto.",
        detailsTitle: "Dettagli Pacchetto",
        includes: [
          "1 Grafica personalizzata",
          "2 proposte di design per scegliere lo stile che preferisci",
          "Formati file (PNG, JPG ecc..)",
          "Formato per social o stampa",
          "1 revisione inclusa",
          "Copywriting o slogan pubblicitario.",
          "Consegna in 1-3 giorni lavorativi (spesso entro 24 ore)"
        ],
        excludes: [
          "Stampa fisica (forniamo solo il file digitale pronto per la stampa)."
        ],
        cta: "Seleziona"
      },
      {
        id: "rebranding-social",
        eyebrow: "",
        name: "Rebranding Social",
        icon: "fa-solid fa-share-nodes",
        badge: "Icona Social",
        price: "-",
        description: "Dai un nuovo look ai tuoi profili social e migliora la tua presenza online.",
        detailsTitle: "Dettagli Pacchetto Social",
        includes: [
          "Rebranding dei post e profilo (colori, layout e stile)",
          "Aggiornamento della biografia e delle informazioni profilo",
          "Consigli per un impatto visivo più forte",
          "Strategie per rendere il tuo profilo più professionale e coerente",
          "Mini guida step by step: \"Come andare virale in 30 giorni\"",
          "Consigli per aumentare l'engagement organico",
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
        id: "restyling-sito-web",
        eyebrow: "",
        name: "Restyling Sito Web",
        icon: "fa-solid fa-arrows-rotate",
        badge: "Icona Copywriting",
        price: "-",
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

    portfolio: [
      { title: "Pizzeria Da Marco", desc: "Sito one-page per condivisione in bio Instagram.", category: "siti", img: "img/portfolio-placeholder.jpg" },
      { title: "Studio Rosa Logo", desc: "Identificazione visiva completa.", category: "loghi", img: "img/portfolio-placeholder.jpg" },
      { title: "Locandina Evento Summer", desc: "Grafica d'impatto per social e stampa.", category: "grafica", img: "img/portfolio-placeholder.jpg" }
    ],

    reviews: {
      demo: [
        { name: "Marco R.", stars: 5, text: "Sito bellissimo e velocissimo da caricare. Assistenza top!" }
      ]
    }
  };
})();
