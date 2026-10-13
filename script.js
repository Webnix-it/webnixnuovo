/* ============================================================
   WEBNIX — script.js  (SOLO JavaScript puro / Vanilla JS)
   Menu mobile drawer, scroll fluido, filtri portfolio,
   recensioni Firebase con fallback demo (anti-XSS),
   form contatti → WhatsApp, reveal scroll, loader globale.
   ============================================================ */

(function () {
  "use strict";

  var CFG = window.WEBNIX_CONFIG || null;

  /* Link WhatsApp: definito QUI (prima mancava -> errore JS che bloccava tutto lo script) */
  function waLink(testo) {
    var num = (CFG && CFG.contact && CFG.contact.whatsapp) || "14132259397";
    return "https://wa.me/" + num + (testo ? "?text=" + encodeURIComponent(testo) : "");
  }

  /* ---------- LOADER GLOBALE (#global-loader2) con barra REALMENTE funzionante ----------
     La percentuale NON è simulata: viene misurata davvero su:
     - risorse della pagina (immagini, CSS, JS, font) tramite performance API
     - richieste XHR/fetch (es. caricamento recensioni Firebase)
     La barra resta visibile fino al completamento reale (min 700ms, max 6s). */
  function avviaLoader() {
    var loader = document.getElementById("global-loader2");
    if (!loader) return;
    document.body.style.overflow = "hidden"; // scroll lock
    var barra = document.getElementById("progress-bar-fill2");
    var etichetta = document.getElementById("loading-text2");

    var totaleR = 0, caricateR = 0;   // risorse della pagina
    var totaleX = 0, caricateX = 0;   // richieste XHR/fetch
    var chiuso = false, timerTick = null;

    function aggiornaBarra() {
      var pesoR = 0.7, pesoX = 0.3;
      var pr = totaleR ? caricateR / totaleR : 0;
      var px = totaleX ? caricateX / totaleX : 1;
      var p = Math.round((pr * pesoR + px * pesoX) * 100);
      if (p < 0) p = 0; if (p > 100) p = 100;
      if (barra) barra.style.width = p + "%";
      if (etichetta) etichetta.textContent = "Caricamento in corso... " + p + "%";
      return p;
    }

    function misuraRisorse() {
      try {
        if (!window.performance || !performance.getEntriesByType) return;
        var res = performance.getEntriesByType("resource");
        totaleR = res.length;
        caricateR = 0;
        for (var i = 0; i < res.length; i++) {
          var e = res[i];
          if (e.responseEnd > 0) caricateR++;
        }
      } catch (err) { /* misurazione non supportata: si chiude al load */ }
    }

    /* Hook XHR (puro Vanilla JS): ogni ajax aumenta il totale e riduce al termine */
    try {
      var XHRO = window.XMLHttpRequest;
      if (XHRO) {
        window.XMLHttpRequest = function () {
          var xhr = new XHRO();
          totaleX++;
          xhr.addEventListener("loadend", function () { caricateX++; aggiornaBarra(); });
          xhr.addEventListener("error", function () { caricateX++; aggiornaBarra(); });
          aggiornaBarra();
          return xhr;
        };
        window.XMLHttpRequest.prototype = XHRO.prototype;
      }
      if (window.fetch) {
        var fetchOrig = window.fetch;
        window.fetch = function () {
          totaleX++;
          aggiornaBarra();
          return fetchOrig.apply(window, arguments).finally(function () {
            caricateX++; aggiornaBarra();
          });
        };
      }
    } catch (err) { /* niente hook: fallback su load/timeout */ }

    function chiudi() {
      if (chiuso) return;
      chiuso = true;
      clearInterval(timerTick);
      if (barra) barra.style.width = "100%";
      if (etichetta) etichetta.textContent = "Caricamento completato ✓";
      setTimeout(function () {
        loader.style.opacity = "0";
        loader.style.pointerEvents = "none"; // non blocca piu' i click durante la dissolvenza
        setTimeout(function () {
          loader.remove(); // rimuovi del tutto dal DOM dopo dissolvenza
          document.body.style.overflow = "";
        }, 650);
      }, 350);
    }

    /* Tick: ricalcola le risorse che arrivano durante il caricamento */
    timerTick = setInterval(function () { misuraRisorse(); aggiornaBarra(); }, 90);

    /* Chiusura: quando la pagina è davvero pronta E la barra ha mostrato il progresso (min 700ms) */
    var pronto = false, partenza = Date.now();
    function provaChiusura() {
      if (!pronto) return;
      misuraRisorse();
      var p = aggiornaBarra();
      var trascorso = Date.now() - partenza;
      if (p >= 100 && trascorso >= 700) chiudi();
      else if (trascorso >= 5200) chiudi(); // rete lenta: chiudi comunque
    }
    function onReady() { pronto = true; setTimeout(provaChiusura, 120); }
    if (document.readyState === "complete") onReady();
    else window.addEventListener("load", onReady);
    setTimeout(chiudi, 6000); // timeout di sicurezza assoluto
  }

  /* ---------- HEADER NAV: trasparente in cima, colorato allo scroll ---------- */
  function inizializzaHeaderScroll() {
    var header = document.getElementById("header");
    if (!header) return;
    var ultima = -1;
    function aggiorna() {
      var y = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      if (y === ultima) return;
      ultima = y;
      if (y > 40) header.setAttribute("scrollato", "si");
      else header.removeAttribute("scrollato");
    }
    // passive listener per prestazioni elevate; requestAnimationFrame come throttle
    var inCorso = false;
    window.addEventListener("scroll", function () {
      if (inCorso) return;
      inCorso = true;
      requestAnimationFrame(function () { aggiorna(); inCorso = false; });
    }, { passive: true });
    aggiorna(); // stato iniziale corretto anche con pagina già scorrata (es. reload a metà)
  }

  /* ---------- NAV BAR DA ZERO: link puliti, underline brand + zoom 1.2 (solo CSS) ---------- */

  /* ---------- MENU MOBILE (drawer <=900px) ---------- */
  function inizializzaMenu() {
    var hamburger = document.getElementById("hamburger");
    var drawer = document.getElementById("drawer-mobile");
    var overlay = document.getElementById("overlay-mobile");
    var chiudiBtn = document.getElementById("chiusura-drawer");
    if (!hamburger || !drawer || !overlay) return;

    function apri() {
      if (window.innerWidth > 900) return; // drawer attivo solo <=900px
      drawer.setAttribute("aperto", "si");
      overlay.setAttribute("aperto", "si");
      hamburger.setAttribute("aria-expanded", "true"); // stato aperto irrobustito
      document.body.style.overflow = "hidden";
    }
    function chiudi() {
      drawer.removeAttribute("aperto");
      overlay.removeAttribute("aperto");
      hamburger.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }
    hamburger.addEventListener("click", apri);
    if (chiudiBtn) chiudiBtn.addEventListener("click", chiudi);
    overlay.addEventListener("click", chiudi); // tap outside
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") chiudi();
    });
    drawer.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", chiudi);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 900) chiudi();
    });
  }

  /* ---------- SCROLL FLUIDO (ogni #id link interno) ---------- */
  function inizializzaScrollFluido() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener("click", function (e) {
        var id = link.getAttribute("href");
        if (id.length < 2) return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", id);
      });
    });
  }

  /* ---------- REVEAL SCROLL (IntersectionObserver one-shot, con MutationObserver) ---------- */
  function inizializzaReveal() {
    var ridotto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var tutti = function () { return document.querySelectorAll("[reveal]"); };

    if (ridotto || !("IntersectionObserver" in window)) {
      /* Fallback accessibilita / browser vecchi: mostra subito tutto */
      var rivelaTutto = function () {
        tutti().forEach(function (el) { el.setAttribute("visible", "si"); });
      };
      rivelaTutto();
      /* Gli elementi generati da JS (card servizi/portfolio) arrivano dopo: li mostriamo comunque */
      if ("MutationObserver" in window) {
        var mutOld = new MutationObserver(rivelaTutto);
        mutOld.observe(document.body, { childList: true, subtree: true });
      } else {
        setTimeout(rivelaTutto, 400);
        setTimeout(rivelaTutto, 1200);
      }
      return;
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (voce) {
        if (voce.isIntersecting) {
          voce.target.setAttribute("visible", "si");
          obs.unobserve(voce.target); // one-shot
        }
      });
    }, { threshold: 0.15 });

    /* Osserva gli elementi gia presenti */
    tutti().forEach(function (el) { obs.observe(el); });

    /* FIX CARD NASCOSTE: le card di servizi e portfolio sono create da JS DOPO il
      DOMContentLoaded; senza questo osservatore resterebbero a opacity:0 perche'
       mai registrate nell'IntersectionObserver. Il MutationObserver aggancia al volo
       ogni nuovo elemento [reveal] aggiunto nel documento. */
    var mut = new MutationObserver(function (cambiamenti) {
      cambiamenti.forEach(function (c) {
        c.addedNodes.forEach(function (nodo) {
          if (nodo.nodeType !== 1) return;
          if (nodo.hasAttribute && nodo.hasAttribute("reveal")) obs.observe(nodo);
          if (nodo.querySelectorAll) {
            nodo.querySelectorAll("[reveal]").forEach(function (el) { obs.observe(el); });
          }
        });
      });
    });
    mut.observe(document.body, { childList: true, subtree: true });

    /* Reti lenta: se qualcosa e' gia nel viewport prima del render JS, forzo un controllo */
    setTimeout(function () {
      tutti().forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.setAttribute("visible", "si");
      });
    }, 900);
  }

  /* ---------- RENDER SERVIZI (da config.js) ---------- */
  /* Dati pacchetti integrati nel JS: garantiscono il rendering anche se config.js non e' caricato */
  var SERVIZI_FALLBACK = [
    { id:"sito-web", eyebrow:"Sito Web", name:"Base", icon:"fa-solid fa-globe", badge:"Icona Sito Web", price:"-",
      description:"Un sito elegante e funzionale, perfetto da condividere nella bio di Instagram, Facebook e altri social.",
      detailsTitle:"Dettagli Pacchetto",
      includes:["1 Pagina con design moderno e personalizzato.","Sito responsive: perfetto su smartphone, tablet e desktop.","Sviluppo con HTML, CSS e JavaScript.","Hosting gratuito e permanente su GitHub Pages o Netlify (entrambi veloci e affidabili). Possibilita\u00e0 di usare un altro hosting su richiesta.","Integrazione con i tuoi profili social (Instagram, Facebook, LinkedIn, ecc.).","CookieBot gratuito per la gestione dei cookie (conformit\u00e0 GDPR di base).","Modulo di contatto funzionante.","Pagine legali di base (generate con IA): Privacy Policy, Termini e Condizioni, Cookie Policy. \u26a0\ufe0f generate automaticamente, non sostituiscono una consulenza legale.","30 giorni di assistenza gratuita dopo la consegna: fino a 3 modifiche gratuite.","Consegna in 5-12 giorni lavorativi."],
      excludes:["SEO: il sito \u00e8 pensato per essere condiviso via link diretto (bio Instagram, WhatsApp), non per apparire su Google.","Dominio personalizzato: la registrazione del dominio non \u00e8 inclusa.","Servizi di terze parti: Iubenda, PayPal, Stripe o newsletter non sono inclusi.","Manutenzione post-consegna: aggiornamenti successivi non inclusi."],
      faqDomanda:"Quali sono i costi futuri per mantenere il sito web attivo?", faqRisposta:"Nessun costo", cta:"Seleziona" },
    { id:"brand-identity", eyebrow:"Creazione", name:"Brand Identity", icon:"fa-solid fa-pen-nib", badge:"Icona Logo", price:"-",
      description:"Rendi unico il tuo brand con un logo professionale.", detailsTitle:"Dettagli Pacchetto",
      includes:["Logo personalizzato","Favicon (per web)","Palette colori personalizzata.","Selezione tipografica (font per titoli, testi e accenti).","Creazione di pattern o texture uniche per il brand.","Set di icone o simboli coordinati allo stile del logo.","Definizione dello stile fotografico (moodboard e guida visiva).","Anteprima del logo su prodotti (t-shirt, tazze, badge, ecc.)","Linee guida di composizione e uso del logo su sfondi chiari/scuri.","Tone of Voice (voce del brand).","Mini Brand Book in PDF.","Consegna in 5\u20138 giorni lavorativi."],
      excludes:["Naming (creazione del nome del brand).","Copywriting o slogan pubblicitario.","Materiali stampati (biglietti, brochure, packaging).","Stampa fisica (solo file digitale pronto per la stampa).","Template social (opzionale +20\u20ac)."], cta:"Seleziona" },
    { id:"creazione-grafica", eyebrow:"Creazione", name:"Grafica", icon:"fa-solid fa-image", badge:"Icona Locandina", price:"-",
      description:"Dai visibilit\u00e0 ai tuoi eventi, prodotti o promozioni con locandine dal design professionale e d'impatto.", detailsTitle:"Dettagli Pacchetto",
      includes:["1 Grafica personalizzata","2 proposte di design per scegliere lo stile che preferisci","Formati file (PNG, JPG ecc..)","Formato per social o stampa","1 revisione inclusa","Copywriting o slogan pubblicitario.","Consegna in 1-3 giorni lavorativi (spesso entro 24 ore)"],
      excludes:["Stampa fisica (forniamo solo il file digitale pronto per la stampa)."], cta:"Seleziona" },
    { id:"rebranding-social", eyebrow:"", name:"Rebranding Social", icon:"fa-solid fa-share-nodes", badge:"Icona Social", price:"-",
      description:"Dai un nuovo look ai tuoi profili social e migliora la tua presenza online.", detailsTitle:"Dettagli Pacchetto Social",
      includes:["Rebranding dei post e profilo (colori, layout e stile)","Aggiornamento della biografia e delle informazioni profilo","Consigli per un impatto visivo pi\u00f9 forte","Strategie per rendere il tuo profilo pi\u00f9 professionale e coerente","Mini guida step by step: \u201cCome andare virale in 30 giorni\u201d","Consigli per aumentare l\u2019engagement organico","Strategia settimanale: cosa postare, quando e perch\u00e9","5+ prompt pronti per ChatGPT per generare idee, testi e caption","Template per contenuti virali (reels e post)","Creazione logo (se necessario).","Consegna completa entro 24-48 ore"],
      excludes:[], cta:"Seleziona" },
    { id:"restyling-sito-web", eyebrow:"", name:"Restyling Sito Web", icon:"fa-solid fa-arrows-rotate", badge:"Icona Copywriting", price:"-",
      description:"Rinnova il tuo sito esistente con un design moderno, responsive e pi\u00f9 efficace.", detailsTitle:"Dettagli Pacchetto Restyling",
      includes:["Nuovo design moderno e professionale, coerente con il tuo brand","Versione completamente responsive (adatta a smartphone, tablet e desktop)","Miglioramento dell'usabilit\u00e0 e della navigazione","Aggiornamento di testi e immagini (se forniti)","Logo personalizzato creato da zero (se necessario)","Consegna in 3-6 giorni lavorativi"],
      excludes:["Modulo di contatto.","Integrazione con servizi esterni (es. Calendly, EmailJS, newsletter).","Funzionalit\u00e0 dinamiche (form, login, carrello).","Creazione di nuove pagine o contenuti non forniti.","Trasferimento o gestione del dominio.","Manutenzione o aggiornamenti futuri.","Pagine legali."], cta:"Seleziona" }
  ];

  function renderServizi() {
    var griglia = document.getElementById("griglia-servizi");
    if (!griglia) return;
    if (!CFG) { CFG = { services: SERVIZI_FALLBACK, portfolio: [], reviews: { demo: [] }, social: {}, contact: {} }; }
    if (!CFG.services) return;
    CFG.services.forEach(function (s, i) {
      var card = document.createElement("article");
      card.className = "card-servizio"; // marker layout (non classe di stile custom semantica)
      card.id = s.id;
      if (s.highlight) card.setAttribute("in evidenza", "si");
      card.setAttribute("reveal", "");
      card.setAttribute("delay", String((i % 3) + 1));

      /* --- Intestazione: eyebrow (es. "Sito Web") + nome grande (es. "Base") --- */
      var intest = document.createElement("div");
      intest.className = "intestazione-servizio";
      if (s.eyebrow) {
        var eye = document.createElement("span");
        eye.className = "eyebrow-card-servizio";
        eye.textContent = s.eyebrow;
        intest.appendChild(eye);
      }
      var h3 = document.createElement("h3");
      h3.textContent = s.name;
      intest.appendChild(h3);

      /* --- Badge con icona dedicata (es. "Icona Sito Web") --- */
      var etich = document.createElement("p");
      etich.className = "etichetta-servizio";
      var iconaBadge = document.createElement("i");
      iconaBadge.className = s.icon; // fa-solid*: unica eccezione tecnica Font Awesome
      var testoBadge = document.createElement("span");
      testoBadge.textContent = s.badge;
      etich.appendChild(iconaBadge); etich.appendChild(testoBadge);

      /* --- Prezzo (solo se presente in config) --- */
      var prezzo = document.createElement("p");
      prezzo.className = "prezzo-servizio";
      prezzo.textContent = s.price || "";
      if (!s.price) prezzo.style.display = "none";

      var desc = document.createElement("p");
      desc.className = "descrizione-servizio"; desc.textContent = s.description;

      var lista = document.createElement("div");
      lista.className = "lista-trasparenza";

      var hDet = document.createElement("h4");
      hDet.setAttribute("dettagli-pacchetto", "si");
      hDet.textContent = s.detailsTitle || "Dettagli Pacchetto";
      var ulDet = document.createElement("ul"); ulDet.className = "include";
      s.includes.forEach(function (t) {
        var li = document.createElement("li");
        var ic = document.createElement("i"); ic.className = "fa-solid fa-check";
        var sp = document.createElement("span"); sp.textContent = t;
        li.appendChild(ic); li.appendChild(sp); ulDet.appendChild(li);
      });

      lista.appendChild(hDet); lista.appendChild(ulDet);

      if (s.excludes && s.excludes.length) {
        var hEx = document.createElement("h4");
        hEx.setAttribute("non-includes", "si");
        hEx.textContent = "❌ Cosa NON è incluso:";
        var ulEx = document.createElement("ul"); ulEx.className = "esclude";
        s.excludes.forEach(function (t) {
          var li = document.createElement("li");
          var ic = document.createElement("i"); ic.className = "fa-solid fa-xmark";
          var sp = document.createElement("span"); sp.textContent = t;
          li.appendChild(ic); li.appendChild(sp); ulEx.appendChild(li);
        });
        lista.appendChild(hEx); lista.appendChild(ulEx);
      }

      /* --- Box FAQ (es. costi futuri -> Nessun Costo) --- */
      if (s.faqDomanda) {
        var boxFaq = document.createElement("div");
        boxFaq.setAttribute("box-faq-servizio", "si");
        var dFaq = document.createElement("p");
        dFaq.setAttribute("faq-domanda", "si");
        dFaq.innerHTML = ""; // sicurezza: niente HTML crudo
        var qIcon = document.createElement("i"); qIcon.className = "fa-solid fa-circle-question";
        var qTxt = document.createElement("span"); qTxt.textContent = s.faqDomanda;
        dFaq.appendChild(qIcon); dFaq.appendChild(qTxt);
        var rFaq = document.createElement("p");
        rFaq.setAttribute("faq-risposta", "si");
        var aIcon = document.createElement("i"); aIcon.className = "fa-solid fa-circle-check";
        var aTxt = document.createElement("span"); aTxt.textContent = s.faqRisposta;
        rFaq.appendChild(aIcon); rFaq.appendChild(aTxt);
        boxFaq.appendChild(dFaq); boxFaq.appendChild(rFaq);
        lista.appendChild(boxFaq);
      }

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn_seleziona";
      btn.textContent = s.cta;
      btn.addEventListener("click", function () {
        /* Il form è stato rimosso: il click porta direttamente alla sezione contatti */
        var contatto = document.getElementById("contatti");
        if (contatto) contatto.scrollIntoView({ behavior: "smooth" });
      });

      [intest, prezzo, etich, desc, lista, btn].forEach(function (n) { card.appendChild(n); });
      griglia.appendChild(card);
    });
  }

  /* ---------- PORTFOLIO: render + filtri ---------- */
  function renderPortfolio() {
    var griglia = document.getElementById("griglia-portfolio");
    if (!griglia || !CFG) return;
    CFG.portfolio.forEach(function (p, i) {
      var card = document.createElement("article");
      card.className = "card-portfolio";
      card.setAttribute("categoria", p.category);
      card.setAttribute("reveal", "");
      card.setAttribute("delay", String((i % 4) + 1));

      var img = document.createElement("img");
      img.src = p.img; img.alt = p.title; img.loading = "lazy";

      var corpo = document.createElement("div");
      corpo.className = "corpo-portfolio";
      var h3 = document.createElement("h3"); h3.textContent = p.title;
      var d = document.createElement("p"); d.textContent = p.desc;
      var tag = document.createElement("span");
      tag.className = "tag-portfolio";
      tag.textContent = p.category === "siti" ? "Sito Web" : p.category === "loghi" ? "Logo" : "Grafica";
      corpo.appendChild(h3); corpo.appendChild(d); corpo.appendChild(tag);

      card.appendChild(img); card.appendChild(corpo);
      griglia.appendChild(card);
    });
  }

  function inizializzaFiltri() {
    var fila = document.getElementById("fila-filtri");
    if (!fila) return;
    fila.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-filtro]");
      if (!btn) return;
      fila.querySelectorAll("[data-filtro]").forEach(function (b) { b.removeAttribute("selezionato"); });
      btn.setAttribute("selezionato", "si");
      var f = btn.getAttribute("data-filtro");
      document.querySelectorAll(".card-portfolio").forEach(function (c) {
        var mostra = (f === "tutti" || c.getAttribute("categoria") === f);
        if (mostra) c.removeAttribute("nascosto");
        else c.setAttribute("nascosto", "si");
      });
    });
  }

  /* ---------- RECENSIONI: Firebase REST (JS puro, no SDK) + fallback demo ----------
     Struttura DB: { name, text, url, stars, timestamp } */
  function costruisciCardRecensione(r) {
    var card = document.createElement("article");
    card.className = "card-recensione";

    var intest = document.createElement("div");
    intest.className = "intestazione-recensione";
    var ini = document.createElement("div");
    ini.className = "iniziali-recensore";
    var parti = String(r.name || "?").trim().split(/\s+/);
    ini.textContent = (parti[0][0] || "?") + (parti[1] ? parti[1][0] : "");
    var nome = document.createElement("strong"); nome.textContent = r.name || "Anonimo";
    var stelle = document.createElement("div");
    stelle.className = "stelle-recensione";
    var n = Math.max(1, Math.min(5, parseInt(r.stars, 10) || 5));
    stelle.textContent = "★".repeat(n) + "☆".repeat(5 - n);
    intest.appendChild(ini);
    var blocco = document.createElement("div");
    blocco.appendChild(nome); blocco.appendChild(stelle);
    intest.appendChild(blocco);

    var testo = document.createElement("p");
    testo.className = "testo-recensione";
    testo.textContent = r.text || ""; // textContent = anti-XSS
    card.appendChild(intest); card.appendChild(testo);

    if (r.url && /^https?:\/\//i.test(r.url)) {
      var a = document.createElement("a");
      a.href = r.url; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.textContent = "Vedi progetto ↗";
      a.style.fontSize = ".8rem";
      card.appendChild(a);
    }
    if (r.timestamp) {
      var data = document.createElement("span");
      data.className = "data-recensione";
      try {
        data.textContent = new Date(Number(r.timestamp)).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
      } catch (err) { data.textContent = ""; }
      card.appendChild(data);
    }
    return card;
  }

  function dipingiRecensioni(recensioni, griglia, isDemo) {
    griglia.innerHTML = "";
    var ordinato = recensioni.slice().sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    ordinato.forEach(function (r, i) {
      var c = costruisciCardRecensione(r);
      c.setAttribute("reveal", "");
      c.setAttribute("delay", String((i % 4) + 1));
      griglia.appendChild(c);
    });
    // riepilogo
    var votoEl = document.getElementById("voto-medio");
    var conteggioEl = document.getElementById("conteggio-recensioni");
    var avviso = document.getElementById("avviso-demo-recensioni");
    var StelleEl = document.getElementById("stelle-medie");
    if (ordinato.length) {
      var media = ordinato.reduce(function (s, r) { return s + (parseInt(r.stars, 10) || 5); }, 0) / ordinato.length;
      if (votoEl) votoEl.textContent = media.toFixed(1);
      if (StelleEl) StelleEl.textContent = "★".repeat(Math.round(media)) + "☆".repeat(5 - Math.round(media));
      if (conteggioEl) conteggioEl.textContent = ordinato.length + (ordinato.length === 1 ? " recensione" : " recensioni");
    }
    if (avviso && isDemo) avviso.textContent = "Le testimonianze mostrate sono dirette dei primi clienti. A breve arriverà il widget con le recensioni verificate.";
    // riattiva reveal per nodi appena inseriti
    inizializzaReveal();
  }

  function caricaRecensioni() {
    var griglia = document.getElementById("griglia-recensioni");
    var caricamento = document.getElementById("caricamento-recensioni");
    if (!griglia || !CFG) return;

    function fallbackDemo(motivo) {
      if (caricamento) caricamento.remove();
      dipingiRecensioni(CFG.reviews.demo, griglia, true);
      if (motivo) console.warn("Webnix recensioni:", motivo);
    }

    /* FIX BLOCCO TOTALE JS: se config.js non contiene il blocco firebase,
       leggere CFG.firebase.databaseURL lanciava un errore che fermava TUTTI gli
       script successivi (menu, modal "Visualizza l'anteprima", ecc.).
       Ora, senza configurazione Firebase, si usa direttamente la demo. */
    if (!CFG.firebase || !CFG.firebase.databaseURL) {
      fallbackDemo("Configurazione Firebase assente: uso recensioni demo");
      return;
    }
    var url = CFG.firebase.databaseURL + "/" + CFG.firebase.reviewsPath + ".json";
    if (!/^https:\/\/.+\.firebaseio\.com|^https:\/\/.+firebasestorage/.test(url) && !/firebase/.test(url)) {
      fallbackDemo("URL Firebase non valido");
      return;
    }
    var fatto = false;
    var timeout = setTimeout(function () {
      if (!fatto) { fatto = true; fallbackDemo("Timeout caricamento recensioni"); }
    }, CFG.reviews.loadTimeoutMs);

    fetch(url)
      .then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .then(function (data) {
        if (fatto) return; fatto = true; clearTimeout(timeout);
        if (caricamento) caricamento.remove();
        var lista = [];
        if (data) {
          Object.keys(data).forEach(function (k) {
            var r = data[k];
            if (r && r.name && r.text) lista.push(r);
          });
        }
        if (!lista.length) {
          // 0 recensioni reali → mostra testimonianze demo (mai "Caricamento..." infinito)
          dipingiRecensioni(CFG.reviews.demo, griglia, true);
        } else {
          dipingiRecensioni(lista, griglia, false);
        }
      })
      .catch(function (err) {
        if (fatto) return; fatto = true; clearTimeout(timeout);
        fallbackDemo(err.message);
      });
  }

  /* ---------- FORM CONTATTI: rimosso su richiesta, la sezione usa solo i link diretti ---------- */

  /* ---------- BOTTONE 1: stato [attivo] per touch ---------- */
  function inizializzaBottoneTouch() {
    ["bottone1", "bottone1-footer"].forEach(function (id) {
      var b = document.getElementById(id);
      if (!b) return;
      b.addEventListener("touchstart", function () { b.setAttribute("attivo", "si"); }, { passive: true });
      b.addEventListener("touchend", function () { setTimeout(function () { b.removeAttribute("attivo"); }, 400); });
    });
  }

  /* ---------- LINK DINAMICI DA CONFIG (social, mail, wa) ---------- */
  function applicaConfigLink() {
    if (!CFG || !CFG.social) return;
    var map = {
      "link-instagram": CFG.social.instagram,
      "link-facebook": CFG.social.facebook,
      "link-whatsapp": waLink(),
      "link-whatsapp-info": waLink(),
      "link-whatsapp-hero": waLink(),
      "link-email": "mailto:" + CFG.contact.email,
      "link-tel": "tel:+" + CFG.contact.phoneRaw
    };
    Object.keys(map).forEach(function (id) {
      // querySelectorAll: gestisce anche id duplicati (es. link-whatsapp in info contatti + footer)
      document.querySelectorAll('[id="' + id + '"]').forEach(function (el) { el.href = map[id]; });
    });
    var logoH = document.getElementById("logo-header");
    if (logoH) logoH.src = CFG.logoHeader;
    var logoF = document.getElementById("logo-footer");
    if (logoF) logoF.src = CFG.logoFooter;
    var copy = document.getElementById("anno-copyright");
    if (copy) copy.textContent = "© " + CFG.copyrightYear + " " + CFG.brand;
    var infoMail = document.getElementById("testo-email");
    if (infoMail) infoMail.textContent = CFG.contact.email;
    var infoTel = document.getElementById("testo-telefono");
    if (infoTel) { infoTel.textContent = CFG.contact.phoneDisplay; }
    var infoInd = document.getElementById("testo-indirizzo");
    if (infoInd) infoInd.textContent = CFG.contact.address;
    var infoOr = document.getElementById("testo-orari");
    if (infoOr) infoOr.textContent = CFG.contact.hours;
  }

  /* ---------- PACCHETTI (servizi.html): scopri, acquista ---------- */
  var NOMI_SERVIZI = {
    "sito-web": "Sito Web - Base",
    "creazione-logo": "Creazione Logo",
    "creazione-locandina": "Creazione Grafica / Locandine",
    "brand-identity": "Brand Identity",
    "rebranding-social": "Rebranding Social",
    "post-copywriting": "Post + Copywriting",
    "restyling-sito-web": "Restyling Sito Web",
    "calendario-prenotazione": "Calendario Prenotazione"
  };

  function inizializzaPacchetti() {
    /* "Scopri cosa offriamo": apri/chiudi il dettaglio */
    document.querySelectorAll("#prodotto-card").forEach(function (card) {
      var btn = card.querySelector("#bottone-scopri");
      var det = card.querySelector("#sezione-cosa-offriamo");
      if (!btn || !det) return;
      var etichetta = btn.querySelector(".scopri-etichetta");
      btn.addEventListener("click", function () {
        var aperto = det.getAttribute("aperto") === "si";
        det.setAttribute("aperto", aperto ? "" : "si");
        btn.setAttribute("aperto", aperto ? "" : "si");
        btn.setAttribute("aria-expanded", aperto ? "false" : "true");
        if (etichetta) {
          etichetta.textContent = aperto
            ? (btn.getAttribute("data-testo-chiuso") || "Scopri cosa offriamo")
            : "Chiudi il dettaglio";
        } else {
          btn.textContent = aperto
            ? (btn.getAttribute("data-testo-chiuso") || "\u2705 Scopri cosa offriamo")
            : "\u2b06\ufe0f Chiudi il dettaglio";
        }
      });
    });

    /* "Acquista questo pacchetto" / "Richiedi un Preventivo" -> WhatsApp precompilato */
    document.querySelectorAll("#bottone-acquista").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var chiave = btn.getAttribute("data-servizio") || "";
        var nome = NOMI_SERVIZI[chiave] || chiave;
        var frase = btn.getAttribute("data-preventivo") === "si"
          ? "Ciao Webnix! Voglio RICHIEDERE UN PREVENTIVO per il pacchetto \"" + nome + "\". Come procediamo?"
          : "Ciao Webnix! Voglio ACQUISTARE il pacchetto \"" + nome + "\". Come procediamo?";
        window.open(waLink(frase), "_blank", "noopener");
      });
    });
  }

  /* ---------- POPUP MODAL "Scopri di più" Calendario Prenotazione ---------- */
  function inizializzaModalCalendario() {
    var URL_DEMO = "https://b00kingpro.netlify.app/?utm_source=ig&utm_medium=social&utm_content=link_in_bio";
    var btnApri = document.getElementById("bottone-scopri-modal");
    var overlay = document.getElementById("overlay-calendario");
    var btnChiudi = document.getElementById("chiudi-modal-calendario");
    var frame = document.getElementById("frame-calendario");
    if (!btnApri || !overlay || !btnChiudi || !frame) return;

    function apri() {
      if (frame.getAttribute("src") === "about:blank") frame.setAttribute("src", URL_DEMO);
      overlay.classList.remove("uscita");
      overlay.classList.add("aperto");
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
    function chiudi() {
      overlay.classList.add("uscita");
      setTimeout(function () {
        overlay.classList.remove("aperto", "uscita");
        overlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
      }, 450);
    }

    btnApri.addEventListener("click", apri);
    btnChiudi.addEventListener("click", chiudi);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) chiudi();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("aperto")) chiudi();
    });
  }

  /* ---------- DROPDOWN "ALTRO" nella nav desktop ---------- */
  function inizializzaAltro() {
    var menu = document.querySelector("#nav-desk .menu-altro");
    if (!menu) return;
    var trigger = menu.querySelector(".trigger-altro");
    var pannello = menu.querySelector(".dropdown-altro");
    if (!trigger || !pannello) return;

    // Il pannello e' position:fixed: lo ancoriamo sotto al trigger (centrato, senza uscire dallo schermo)
    function posiziona() {
      var r = trigger.getBoundingClientRect();
      var larg = pannello.offsetWidth || 190;
      var sx = r.left + r.width / 2 - larg / 2;
      sx = Math.max(10, Math.min(sx, window.innerWidth - larg - 10));
      pannello.style.left = sx + "px";
      pannello.style.top = r.bottom + 8 + "px";
    }

    var apertoPerClick = false;
    function apri() { pannello.hidden = false; posiziona(); menu.classList.add("aperto"); trigger.setAttribute("aria-expanded", "true"); }
    function chiudi() { menu.classList.remove("aperto"); trigger.setAttribute("aria-expanded", "false"); apertoPerClick = false; }
    function chiuso() { return !menu.classList.contains("aperto"); }

    // hover: apertura immediata, chiusura con ritardo (attraversando il gap non si chiude)
    var tHover = null;
    menu.addEventListener("mouseenter", function () { clearTimeout(tHover); apri(); });
    menu.addEventListener("mouseleave", function () {
      if (apertoPerClick) return;
      tHover = setTimeout(chiudi, 250);
    });

    // click/tap: toggle affidabile (funziona anche su touch dove il mouseenter non c'e')
    trigger.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      if (chiuso()) { apri(); apertoPerClick = true; }
      else { apertoPerClick = false; chiudi(); }
    });

    // tocco diretto sul pannello (es. tap su mobile/tablet): mostra comunque il menu
    pannello.addEventListener("touchstart", function () { if (chiuso()) apri(); }, { passive: true });

    // tastiera: Enter/spazio aprono gia' col click; Escape e tab-out chiudono
    trigger.addEventListener("focus", function () { if (chiuso()) apri(); });
    menu.addEventListener("focusout", function (e) {
      if (e.relatedTarget && !menu.contains(e.relatedTarget)) chiudi();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") chiudi();
    });

    // click fuori dal menu -> chiude (catturando l'evento in fase di capture evitiamo
    // che altri handler blocchino la chiusura; qui sotto NON usiamo stopPropagation)
    document.addEventListener("pointerdown", function (e) {
      if (!menu.contains(e.target)) chiudi();
    }, true);

    // riancoraggio del pannello fisso durante scroll/resize
    window.addEventListener("scroll", function () { if (!chiuso()) posiziona(); }, { passive: true });
    window.addEventListener("resize", function () { if (!chiuso()) posiziona(); });
  }

  /* ---------- CARD UIVERSE (sezione Servizi home): click = apri/chiudi dettagli ---------- */
  function inizializzaCardUiverse() {
    var card = document.querySelectorAll(".scheda-uiverse");
    if (!card.length) return;
    function chiudi(tutte_tranne) {
      card.forEach(function (c) {
        if (c === tutte_tranne) return;
        c.classList.remove("aperta");
        c.setAttribute("aria-expanded", "false");
      });
    }
    card.forEach(function (c) {
      c.addEventListener("click", function (e) {
        /* se il click e' su un link dentro i dettagli, non chiudere la card */
        if (e.target.closest("a")) return;
        var aperta = c.classList.contains("aperta");
        if (aperta) { c.classList.remove("aperta"); c.setAttribute("aria-expanded", "false"); }
        else { chiudi(c); c.classList.add("aperta"); c.setAttribute("aria-expanded", "true"); }
      });
      c.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          if (e.target !== c) return;
          e.preventDefault();
          c.click();
        }
        if (e.key === "Escape") { c.classList.remove("aperta"); c.setAttribute("aria-expanded", "false"); }
      });
    });
    /* click fuori da tutte le card -> chiudi */
    document.addEventListener("pointerdown", function (e) {
      if (!e.target.closest(".scheda-uiverse")) chiudi(null);
    }, true);
  }

  /* ---------- POPUP MODAL "Visualizza l'anteprima" PORTFOLIO (home) ---------- */
  var ANTEPRIME_PORTFOLIO = [
    { img: "assets/portfolio/sito-barber.png",   titolo: "Barber Shop — Sito Web",      cat: "Sito Web" },
    { img: "assets/portfolio/sito-fisio.png",    titolo: "Studio Fisioterapia — Sito",  cat: "Sito Web" },
    { img: "assets/portfolio/sito-vesuvio.png",  titolo: "Vesuvio — Sito Web",          cat: "Sito Web" },
    { img: "assets/portfolio/logo-atelier.png",  titolo: "Atelier — Logo",              cat: "Logo" },
    { img: "assets/portfolio/logo-greenbox.png", titolo: "GreenBox — Logo",             cat: "Logo" },
    { img: "assets/portfolio/grafica-foodtruck.png", titolo: "Food Truck — Locandina",  cat: "Grafica" },
    { img: "assets/portfolio/grafica-palefit.png",   titolo: "PaleFit — Grafica",       cat: "Grafica" }
  ];

  function inizializzaModalPortfolio() {
    /* FIX: prima di tutto scollega il bottone dal reveal (evita che resti a
       opacity:0 / non cliccabile) e rimuove eventuali listener duplicati. */
    var btnApri = document.getElementById("openModal");
    var overlay = document.getElementById("overlay-portfolio");
    var btnChiudi = document.getElementById("chiudi-modal-portfolio");
    var elenco = document.getElementById("colonna-elenco-portfolio");
    var imgGrande = document.getElementById("immagine-grande-portfolio");
    var didascalia = document.getElementById("didascalia-portfolio");
    if (!btnApri || !overlay || !btnChiudi || !elenco || !imgGrande) return;

    btnApri.removeAttribute("reveal");
    btnApri.style.opacity = "1";
    btnApri.style.transform = "none";
    var nuovoBtn = btnApri.cloneNode(true);
    btnApri.parentNode.replaceChild(nuovoBtn, btnApri);
    btnApri = nuovoBtn;

    var popolato = false;
    function popola() {
      if (popolato) return;
      popolato = true;
      ANTEPRIME_PORTFOLIO.forEach(function (a, i) {
        var item = document.createElement("button");
        item.type = "button";
        item.className = "item-anteprima";
        item.innerHTML =
          '<img src="' + a.img + '" alt="' + a.titolo + '" loading="lazy">' +
          '<span class="meta-anteprima"><strong>' + a.titolo + '</strong><span>' + a.cat + '</span></span>';
        item.addEventListener("click", function () { scegli(i, item); });
        elenco.appendChild(item);
      });
      scegli(0, elenco.firstChild);
    }
    function scegli(i, item) {
      elenco.querySelectorAll(".item-anteprima").forEach(function (b) { b.removeAttribute("attiva"); });
      if (item) item.setAttribute("attiva", "si");
      var a = ANTEPRIME_PORTFOLIO[i];
      imgGrande.classList.add("cambio");
      setTimeout(function () {
        imgGrande.src = a.img;
        imgGrande.alt = a.titolo;
        if (didascalia) didascalia.textContent = a.titolo + " · " + a.cat;
        imgGrande.classList.remove("cambio");
      }, 250);
    }

    function apri() {
      popola();
      overlay.classList.remove("uscita");
      overlay.classList.add("aperto");
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
    function chiudi() {
      overlay.classList.add("uscita");
      setTimeout(function () {
        overlay.classList.remove("aperto", "uscita");
        overlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
      }, 450);
    }

    btnApri.addEventListener("click", apri);
    btnChiudi.addEventListener("click", chiudi);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) chiudi();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("aperto")) chiudi();
    });
  }

  /* ---------- AVVIO ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    avviaLoader();
    inizializzaHeaderScroll();
    inizializzaMenu();
    inizializzaScrollFluido();
    inizializzaAltro();
    renderServizi();
    renderPortfolio();
    inizializzaFiltri();
    caricaRecensioni();
    inizializzaBottoneTouch();
    applicaConfigLink();
    inizializzaPacchetti();
    inizializzaModalCalendario();
    inizializzaModalPortfolio();
    inizializzaCardUiverse();
    inizializzaReveal();
  });
})();

/* ============ FAQ: accordion + ricerca ============ */
(function () {
  const domande = document.querySelectorAll('.faq-item');
  if (!domande.length) return;
  domande.forEach(item => {
    const domanda = item.querySelector('.faq-question');
    const pulsa = () => {
      item.classList.toggle('aperta');
      // animazione elastica al click (come i bottoni): riavvia lo stato "cliccata"
      item.classList.remove('cliccata');
      void item.offsetWidth; // reflow per rilanciare la keyframe
      item.classList.add('cliccata');
    };
    domanda.addEventListener('click', pulsa);
    domanda.setAttribute('tabindex', '0');
    domanda.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pulsa(); }
    });
    item.addEventListener('animationend', () => item.classList.remove('cliccata'));
  });
  const campo = document.getElementById('search-input');
  if (campo) {
    const boxRicerca = document.getElementById('contenitore-ricerca');
    campo.addEventListener('focus', () => { if (boxRicerca) boxRicerca.classList.add('cliccata'); });
    campo.addEventListener('blur',  () => { if (boxRicerca) boxRicerca.classList.remove('cliccata'); });
    campo.addEventListener('input', () => {
      const q = campo.value.trim().toLowerCase();
      domande.forEach(item => {
        const testo = item.textContent.toLowerCase();
        const ok = !q || testo.includes(q);
        item.classList.toggle('nascosta-ricerca', !ok);
        if (q && ok) item.classList.add('aperta');
      });
    });
  }

})();
