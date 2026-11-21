/* ============================================================
   WEBNIX — modulo-config.js
   Configurazione di default del "Modulo Richiesta Bozza".

   Questo file è la base: la dashboard salva le modifiche in
   Firestore (impostazioni/modulo-bozza) e il sito le legge a
   ogni caricamento. Se il documento non esiste (o la rete non
   risponde) il popup usa esattamente questi valori.

   Tipi di domanda supportati (campo "tipo"):
     testo        → risposta breve
     email        → indirizzo email
     testo-lungo  → descrizione
     scelta       → una sola opzione (card)
     multipla     → più opzioni (card)
     si-no        → risposta rapida
     selettore    → menu a tendina
     file         → caricamento immagini e documenti
     budget       → selettore interattivo
     consenso     → casella di accettazione
     nota         → testo informativo (non è una domanda)

   Proprietà di una domanda:
     chiave, etichetta, tipo, obbligatorio, placeholder, aiuto,
     opzioni [{ valore, testo, icona }], multiplo (file),
     link { testo, url }, testo (per "nota"), mostraSe ("chiave=valore")
   ============================================================ */
window.WEBNIX_MODULO_DEFAULT = {
  titolo: "Richiedi la tua bozza gratuita",
  sottotitolo: "Raccontaci la tua idea: prepariamo una bozza gratuita e ti ricontattiamo entro 48 ore.",
  prezzo: "0 €",
  testoContinua: "Continua",
  testoIndietro: "Indietro",
  testoFinale: "Invia la richiesta gratuita →",
  messaggioSuccesso: "Richiesta inviata! Abbiamo ricevuto tutto: ti ricontattiamo entro 48 ore con la bozza gratuita della tua attività.",
  testoIntro: "",
  stile: {
    viola: "#e81cff",
    ciano: "#40c9ff",
    sfondo: "#0b0f16",
    raggio: 24,
    animazione: 480
  },
  budget: {
    min: 0,
    max: 5000,
    step: 25,
    valuta: "€",
    preset: [0, 50, 75, 100, 250, 500, 1000, 2500, 5000],
    nonDefinito: true,
    testo: "Importo puramente indicativo, modificabile dall'utente. Non costituisce un preventivo o un impegno di spesa."
  },
  notifica: {
    formspree: "https://formspree.io/f/xyewdvda",
    webhook: "",
    emailAdmin: "webnixit@gmail.com",
    emailCliente: true
  },
  pulsanti: [
    {
      chiave: "hero",
      testo: "Richiedi la tua bozza",
      tipo: "modulo",
      destinazione: "",
      attivo: true,
      selettore: "#bottone1"
    },
    {
      chiave: "navbar",
      testo: "Bozza Gratuita",
      tipo: "modulo",
      destinazione: "",
      attivo: true,
      selettore: "#link-bozza-nav"
    },
    {
      chiave: "menu",
      testo: "Bozza gratis in 48h",
      tipo: "modulo",
      destinazione: "",
      attivo: true,
      selettore: "#bottone-bozza-drawer"
    },
    {
      chiave: "footer",
      testo: "Bozza gratis in 48h",
      tipo: "modulo",
      destinazione: "",
      attivo: true,
      selettore: "#bottone1-footer"
    },
    {
      chiave: "pacchetti",
      testo: "Richiedi un preventivo",
      tipo: "modulo",
      destinazione: "",
      attivo: true,
      selettore: 'a.cta-scorrimento[href*="wa.me"]'
    }
  ],
  step: [
    {
      id: "dati",
      titolo: "Iniziamo a conoscerci.",
      descrizione: "Inserisci i tuoi dati per poterci mettere in contatto.",
      attivo: true,
      domande: [
        {
          chiave: "nome",
          etichetta: "Nome e cognome",
          tipo: "testo",
          obbligatorio: true,
          placeholder: "Es. Mario Rossi"
        },
        {
          chiave: "email",
          etichetta: "Email",
          tipo: "email",
          obbligatorio: true,
          placeholder: "nome@email.it"
        },
        {
          chiave: "consensoPrivacy",
          etichetta: "Acconsento al trattamento dei miei dati personali secondo quanto indicato nell'Informativa sulla Privacy Policy.",
          tipo: "consenso",
          obbligatorio: true,
          link: { testo: "Privacy Policy", url: "privacy-policy.html" }
        },
        {
          chiave: "consensoTermini",
          etichetta: "Ho letto e accetto i Termini e Condizioni e la Privacy Policy.",
          tipo: "consenso",
          obbligatorio: true,
          link: { testo: "Termini e Condizioni", url: "termini-condizioni.html" }
        },
        {
          chiave: "consensoMarketing",
          etichetta: "Desidero ricevere aggiornamenti e proposte Webnix (facoltativo).",
          tipo: "consenso",
          obbligatorio: false
        }
      ]
    },
    {
      id: "attivita",
      titolo: "La tua attività",
      descrizione: "Così capiamo subito di che settore hai bisogno.",
      attivo: true,
      domande: [
        {
          chiave: "attivita",
          etichetta: "Qual è la tua attività?",
          tipo: "scelta",
          obbligatorio: true,
          opzioni: [
            { valore: "Ristorante / Bar", testo: "Ristorante / Bar", icona: "fa-solid fa-utensils" },
            { valore: "Negozio", testo: "Negozio", icona: "fa-solid fa-store" },
            { valore: "Professionista", testo: "Professionista", icona: "fa-solid fa-user-tie" },
            { valore: "Attività locale", testo: "Attività locale", icona: "fa-solid fa-location-dot" },
            { valore: "Libero professionista", testo: "Libero professionista", icona: "fa-solid fa-laptop-code" },
            { valore: "Azienda", testo: "Azienda", icona: "fa-solid fa-building" },
            { valore: "E-commerce", testo: "E-commerce", icona: "fa-solid fa-cart-shopping" },
            { valore: "Altro", testo: "Altro", icona: "fa-solid fa-plus" }
          ]
        },
        {
          chiave: "attivitaAltro",
          etichetta: "Specifica la tua attività",
          tipo: "testo",
          obbligatorio: true,
          placeholder: "Es. studio di fotografia",
          mostraSe: "attivita=Altro"
        }
      ]
    },
    {
      id: "progetto",
      titolo: "Raccontaci il tuo progetto",
      descrizione: "Parlaci della tua attività e di cosa vorresti realizzare.",
      attivo: true,
      domande: [
        {
          chiave: "progetto",
          etichetta: "Il tuo progetto",
          tipo: "testo-lungo",
          obbligatorio: false,
          placeholder: "Raccontaci cosa fai, quali servizi offri e cosa vorresti ottenere attraverso la tua presenza online.",
          aiuto: "Più dettagli ci dai, più la bozza sarà vicina a quello che immagini."
        },
        {
          chiave: "allegati",
          etichetta: "Allega materiale utile",
          tipo: "file",
          obbligatorio: false,
          multiplo: true,
          aiuto: "Foto, documenti, immagini di riferimento: tutto quello che ci aiuta a capire il progetto (max 4 file, 4 MB ciascuno)."
        }
      ]
    },
    {
      id: "logo",
      titolo: "Hai già un logo?",
      descrizione: "Se non ce l'hai possiamo occuparcene noi.",
      attivo: true,
      domande: [
        {
          chiave: "logo",
          etichetta: "La tua attività ha già un logo?",
          tipo: "scelta",
          obbligatorio: true,
          opzioni: [
            { valore: "si", testo: "Sì, ce l'ho", icona: "fa-solid fa-check" },
            { valore: "no", testo: "No, non ancora", icona: "fa-solid fa-wand-magic-sparkles" }
          ]
        },
        {
          chiave: "logoFile",
          etichetta: "Carica il tuo logo",
          tipo: "file",
          obbligatorio: false,
          multiplo: false,
          aiuto: "PNG, JPG, SVG o PDF.",
          mostraSe: "logo=si"
        },
        {
          chiave: "logoNota",
          tipo: "nota",
          testo: "Nessun problema: registriamo il tuo interesse per il servizio di logo e brand identity e ne parliamo insieme.",
          mostraSe: "logo=no"
        }
      ]
    },
    {
      id: "budget",
      titolo: "Il tuo budget indicativo",
      descrizione: "Seleziona il budget che hai previsto per il progetto.",
      attivo: true,
      domande: [
        {
          chiave: "budget",
          etichetta: "Seleziona il budget che hai previsto",
          tipo: "budget",
          obbligatorio: false
        }
      ]
    }
  ]
};
