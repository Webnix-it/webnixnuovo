/* ============================================================
   WEBNIX — script.js  (SOLO JavaScript puro / Vanilla JS)
   Menu mobile drawer, scroll fluido, filtri portfolio,
   recensioni Firebase con fallback demo (anti-XSS),
   form contatti → WhatsApp, reveal scroll, loader globale.
   ============================================================ */

(function () {
  "use strict";

  var CFG = window.WEBNIX_CONFIG || null;

  /* ---------- PRELOADER DELLA HOME (#preloader-home) ----------
     Presente solo in index.html: logo in dissolvenza (82% -> 100%) e barra di
     caricamento sotto il logo. La barra si riempie seguendo il caricamento
     reale della home (immagini, font, fogli di stile): quando gli elementi
     sono pronti arriva al 100%, resta piena un istante e il velo sfuma. */
  function avviaPreloader() {
    var pre = document.getElementById("preloader-home");
    if (!pre) return; // nelle altre pagine non esiste: nessun preloader
    var barra = document.getElementById("preloader-barra");
    document.body.style.overflow = "hidden"; // niente scroll durante l'attesa

    setTimeout(function () { pre.classList.add("entrata"); }, 80);

    var DURATA_MIN = 3200; // tempo minimo: logo e barra finiscono le animazioni
    var TENUTA = 400;      // pausa a barra piena prima della dissolvenza
    var inizio = Date.now();
    var progresso = 0;
    var pronto = document.readyState === "complete";
    var chiuso = false;

    function disegna() {
      if (barra) barra.style.transform = "scaleX(" + (progresso / 100) + ")";
    }
    disegna();

    function chiudi() {
      if (chiuso) return;
      chiuso = true;
      pre.classList.add("uscita");
      document.body.style.overflow = "";
      setTimeout(function () { pre.style.display = "none"; }, 1000);
    }

    // gli elementi della home sono tutti caricati (o la pagina ha già finito)
    function segnalaPronto() { pronto = true; }
    if (!pronto) {
      window.addEventListener("load", segnalaPronto, { once: true });
      // rete lenta: dopo 8 s si chiude comunque, senza bloccare il sito
      setTimeout(segnalaPronto, 8000);
    }

    // avanzamento: sale fluido fino all'89%, gli ultimi punti solo a fine caricamento
    var timer = setInterval(function () {
      var limite = pronto ? 100 : 89;
      var passo = pronto ? 6 : (progresso < 55 ? 2.4 : progresso < 75 ? 1.2 : .5);
      progresso = Math.min(limite, progresso + passo);
      disegna();
      if (progresso >= 100) {
        clearInterval(timer);
        var attesa = Math.max(TENUTA, DURATA_MIN - (Date.now() - inizio));
        setTimeout(chiudi, attesa);
      }
    }, 60);
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
      hamburger.setAttribute("aria-label", "Chiudi menu");
      document.body.style.overflow = "hidden";
      if (chiudiBtn) chiudiBtn.focus({ preventScroll: true }); // focus dentro il popup
    }
    function chiudi() {
      var dentro = drawer.contains(document.activeElement);
      drawer.removeAttribute("aperto");
      overlay.removeAttribute("aperto");
      hamburger.setAttribute("aria-expanded", "false");
      hamburger.setAttribute("aria-label", "Apri menu");
      document.body.style.overflow = "";
      if (dentro) hamburger.focus({ preventScroll: true }); // focus restituito all'hamburger
    }
    /* Voce della pagina corrente evidenziata nel menu mobile */
    var pagina = (location.pathname.split("/").pop() || "index.html");
    drawer.querySelectorAll("#nav-mobile a").forEach(function (link) {
      if (link.hash) return; // i link con ancora (Contatti) non marcano la pagina
      var file = new URL(link.href, location.href).pathname.split("/").pop() || "index.html";
      if (file === pagina) link.setAttribute("aria-current", "page");
    });
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
  function renderServizi() {
    var griglia = document.getElementById("griglia-servizi");
    if (!griglia || !CFG) return;
    CFG.services.forEach(function (s, i) {
      var card = document.createElement("article");
      card.className = "card-servizio"; // marker layout (non classe di stile custom semantica)
      card.id = s.id;
      if (s.highlight) card.setAttribute("in-evidenza", "si");
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

      /* --- Apri/chiudi i dettagli del pacchetto (minimal) --- */
      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "btn_dettagli_pacchetto";
      toggle.setAttribute("aria-expanded", "false");
      var toggleTxt = document.createElement("span");
      toggleTxt.textContent = "Vedi dettagli";
      var toggleFreccia = document.createElement("i");
      toggleFreccia.className = "fa-solid fa-chevron-down";
      toggleFreccia.setAttribute("aria-hidden", "true");
      toggle.appendChild(toggleTxt);
      toggle.appendChild(toggleFreccia);

      card.setAttribute("dettagli", "chiusi");

      function mostraDettagli(apri) {
        if (apri) {
          lista.style.maxHeight = lista.scrollHeight + "px";
          card.setAttribute("dettagli", "aperti");
        } else {
          if (lista.style.maxHeight === "none") {
            lista.style.maxHeight = lista.scrollHeight + "px";
            void lista.offsetHeight; /* forza il ricalcolo prima di chiudere */
          }
          card.setAttribute("dettagli", "chiusi");
          lista.style.maxHeight = "0px";
        }
        toggle.setAttribute("aria-expanded", apri ? "true" : "false");
        toggleTxt.textContent = apri ? "Nascondi dettagli" : "Vedi dettagli";
      }

      lista.addEventListener("transitionend", function (e) {
        if (e.propertyName === "max-height" && card.getAttribute("dettagli") === "aperti") {
          lista.style.maxHeight = "none";
        }
      });
      toggle.addEventListener("click", function () {
        mostraDettagli(card.getAttribute("dettagli") !== "aperti");
      });

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn_seleziona";
      btn.textContent = s.cta;
      var nomePacchetto = (s.eyebrow ? s.eyebrow + " " : "") + s.name;
      btn.addEventListener("click", function () {
        /* Mappa il nome pacchetto -> opzione del menu a tendina */
        var mappaOpzioni = {
          "Sito Web Base": "Sito Web Base",
          "Creazione Brand Identity": "Creazione Logo — Brand Identity",
          "Creazione Grafica": "Creazione Grafica / Locandine",
          "Rebranding Social": "Rebranding Social",
          "Restyling Sito Web": "Restyling Sito Web"
        };
        var scelta = mappaOpzioni[nomePacchetto] || "Non lo so ancora";
        var sel = document.getElementById("campo-servizio");
        var contatto = document.getElementById("contatti");
        if (!sel || !contatto) {
          /* nessun modulo in pagina (es. servizi.html): richiesta via WhatsApp
             con il pacchetto già indicato */
          window.open(waLink("Ciao Webnix! Mi interessa il pacchetto \"" + scelta + "\". Come procediamo?"), "_blank", "noopener");
          return;
        }
        contatto.scrollIntoView({ behavior: "smooth" });
        sel.value = scelta;
        var msg = document.getElementById("messaggio-modulo");
        if (msg) { msg.removeAttribute("tipo"); msg.textContent = ""; }
      });

      [intest, prezzo, etich, desc, toggle, lista, btn].forEach(function (n) { card.appendChild(n); });
      griglia.appendChild(card);
    });
  }

  /* ---------- PORTFOLIO: render + carosello (3 schede per pagina) ---------- */
  var statoPortfolio = { schede: [], filtro: "tutti", perPagina: 3 };

  function schedePerPagina() {
    if (window.innerWidth <= 640) return 1;
    if (window.innerWidth <= 960) return 2;
    return 3;
  }

  function renderPortfolio() {
    var griglia = document.getElementById("griglia-portfolio");
    if (!griglia || !CFG) return;
    var binario = document.getElementById("binario-portfolio") || griglia;
    binario.innerHTML = "";
    CFG.portfolio.forEach(function (p) {
      var card = document.createElement("article");
      card.className = "card-portfolio";
      card.setAttribute("categoria", p.category);
      card.setAttribute("data-immagine", p.img);
      card.setAttribute("data-didascalia", p.title);
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", "Apri l'anteprima di " + p.title);

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
      binario.appendChild(card);
    });
    statoPortfolio.schede = Array.prototype.slice.call(binario.children);
  }

  function inizializzaPortfolio() {
    var griglia = document.getElementById("griglia-portfolio");
    if (!griglia) return;
    var binario = document.getElementById("binario-portfolio") || griglia;
    var fila = document.getElementById("fila-filtri");
    var prev = document.getElementById("portfolio-prev");
    var next = document.getElementById("portfolio-next");
    var puntiBox = document.getElementById("punti-portfolio");
    var pagina = 0;

    statoPortfolio.perPagina = schedePerPagina();

    var visibili = function () {
      return statoPortfolio.schede.filter(function (c) {
        return statoPortfolio.filtro === "tutti" || c.getAttribute("categoria") === statoPortfolio.filtro;
      });
    };

    var disegnaPunti = function (tot) {
      if (!puntiBox) return;
      puntiBox.innerHTML = "";
      if (tot < 2) return;
      for (var i = 0; i < tot; i++) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "punto-portfolio";
        b.setAttribute("data-pagina", String(i));
        b.setAttribute("aria-label", "Pagina " + (i + 1) + " di " + tot);
        if (i === pagina) b.setAttribute("aria-current", "true");
        puntiBox.appendChild(b);
      }
    };

    /* sposta il binario in modo fluido: la pagina n si allinea alla sua prima scheda */
    var scorri = function () {
      var lista = visibili();
      var prima = lista[pagina * statoPortfolio.perPagina];
      var x = prima ? prima.offsetLeft : 0;
      var limite = binario.scrollWidth - griglia.clientWidth;
      if (limite > 0 && x > limite) x = limite; /* ultima pagina sempre piena, senza buchi */
      binario.style.transform = "translate3d(-" + x + "px, 0, 0)";
      return x;
    };

    /* le schede fuori dalla vista non prendono il focus da tastiera */
    var aggiornaAccessibilita = function (x) {
      var destra = x + griglia.clientWidth;
      statoPortfolio.schede.forEach(function (c) {
        var inVista = !c.hasAttribute("nascosto") && c.offsetWidth > 0 &&
          c.offsetLeft + c.offsetWidth > x + 2 && c.offsetLeft < destra - 2;
        c.setAttribute("tabindex", inVista ? "0" : "-1");
        if (inVista) c.removeAttribute("aria-hidden");
        else c.setAttribute("aria-hidden", "true");
      });
    };

    /* mostra la pagina n: il binario ci scorre sopra con una transizione continua */
    var mostra = function (n) {
      var lista = visibili();
      var tot = Math.max(1, Math.ceil(lista.length / statoPortfolio.perPagina));
      pagineTotali = tot;
      pagina = ((n % tot) + tot) % tot;
      aggiornaAccessibilita(scorri());
      disegnaPunti(tot);
      avviaPortfolio(); /* ogni cambio pagina riparte il conto dei 3 secondi */
    };

    /* ---------- AUTOPLAY: passa alle 3 schede successive ogni 3 secondi, in loop ---------- */
    var INTERVALLO_PORTFOLIO = 3000;
    var timerPortfolio = null;
    var pagineTotali = 1;

    var fermaPortfolio = function () {
      if (timerPortfolio) { window.clearInterval(timerPortfolio); timerPortfolio = null; }
    };

    var avviaPortfolio = function () {
      fermaPortfolio();
      if (pagineTotali < 2) return;
      timerPortfolio = window.setInterval(function () {
        if (document.hidden) return;
        var popup = document.getElementById("popup-lavori");
        if (popup && !popup.hasAttribute("hidden")) return; /* popup aperto: il carosello resta fermo */
        mostra(pagina + 1);
      }, INTERVALLO_PORTFOLIO);
    };

    /* si ferma al passaggio del mouse o col focus da tastiera, riparte appena esci */
    var sezionePortfolio = document.getElementById("portfolio");
    if (sezionePortfolio) {
      sezionePortfolio.addEventListener("mouseenter", fermaPortfolio);
      sezionePortfolio.addEventListener("mouseleave", avviaPortfolio);
      sezionePortfolio.addEventListener("focusin", fermaPortfolio);
      sezionePortfolio.addEventListener("focusout", function () {
        window.setTimeout(function () {
          if (sezionePortfolio.contains(document.activeElement)) return;
          avviaPortfolio();
        }, 0);
      });
    }

    if (prev) prev.addEventListener("click", function () { mostra(pagina - 1); });
    if (next) next.addEventListener("click", function () { mostra(pagina + 1); });

    if (puntiBox) {
      puntiBox.addEventListener("click", function (e) {
        var b = e.target.closest("[data-pagina]");
        if (!b) return;
        var scelta = parseInt(b.getAttribute("data-pagina"), 10) || 0;
        if (scelta === pagina) return;
        mostra(scelta);
      });
    }

    if (fila) {
      fila.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-filtro]");
        if (!btn) return;
        fila.querySelectorAll("[data-filtro]").forEach(function (b) { b.removeAttribute("selezionato"); });
        btn.setAttribute("selezionato", "si");
        statoPortfolio.filtro = btn.getAttribute("data-filtro");
        statoPortfolio.schede.forEach(function (c) {
          var ok = statoPortfolio.filtro === "tutti" || c.getAttribute("categoria") === statoPortfolio.filtro;
          if (ok) c.removeAttribute("nascosto");
          else c.setAttribute("nascosto", "si");
        });
        mostra(0);
      });
    }

    var attesa = null;
    window.addEventListener("resize", function () {
      window.clearTimeout(attesa);
      attesa = window.setTimeout(function () {
        statoPortfolio.perPagina = schedePerPagina();
        mostra(pagina); /* riallinea il binario alla nuova larghezza delle schede */
      }, 160);
    });

    /* contenuti arrivati da Firestore (dati-remoti.js): rilegge le schede */
    window.__webnixRicaricaPortfolio = function () {
      statoPortfolio.schede = Array.prototype.slice.call(binario.children);
      pagina = 0;
      mostra(0);
    };

    mostra(0);
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

  /* ---------- RECENSIONI A SCORRIMENTO CONTINUO ----------
     Il binario viene duplicato (le copie sono aria-hidden) fino a coprire due
     volte la vista, così l'animazione translateX(-50%) riparte senza stacchi
     visibili. La durata è calcolata per tenere costante la velocità in px/s. */
  function preparaScorrimentoRecensioni(binario) {
    if (!binario) return;
    var originali = Array.prototype.slice.call(binario.children);
    if (!originali.length) return;
    var vista = binario.parentElement;
    var larghezzaVista = vista ? vista.clientWidth : window.innerWidth;
    var giri = 1;
    var larghezzaBinario = function () {
      return Math.max(binario.scrollWidth, binario.getBoundingClientRect().width);
    };
    while ((larghezzaBinario() < larghezzaVista * 2 || giri % 2 !== 0) && giri < 8) {
      originali.forEach(function (card) {
        var copia = card.cloneNode(true);
        copia.setAttribute("aria-hidden", "true");
        Array.prototype.forEach.call(copia.querySelectorAll("a, button"), function (el) {
          el.setAttribute("tabindex", "-1");
        });
        binario.appendChild(copia);
      });
      giri++;
    }
    var velocita = 46; // px al secondo
    var durata = Math.round((larghezzaBinario() / 2) / velocita);
    binario.style.setProperty("--durata-scorrimento", Math.max(18, durata) + "s");
  }

  function dipingiRecensioni(recensioni, griglia, isDemo) {
    griglia.innerHTML = "";
    var ordinato = recensioni.slice().sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    ordinato.forEach(function (r) {
      griglia.appendChild(costruisciCardRecensione(r));
    });
    preparaScorrimentoRecensioni(griglia);
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

  /* ---------- FORM CONTATTI → WHATSAPP ---------- */
  function inizializzaForm() {
    /* Scelta del pacchetto arrivata da un'altra pagina (es. servizi.html) */
    var sceltaUrl = null;
    try { sceltaUrl = new URLSearchParams(window.location.search).get("servizio"); } catch (e) { sceltaUrl = null; }
    var selectServizio = document.getElementById("campo-servizio");
    if (sceltaUrl && selectServizio) {
      selectServizio.value = sceltaUrl;
      if (!selectServizio.value) selectServizio.value = "Non lo so ancora";
    }

    var form = document.getElementById("modulo-bozza") || document.getElementById("form-bozza");
    if (!form) return;
    var msg = document.getElementById("messaggio-modulo");
    var area = document.getElementById("campo-descrizione");
    var contatore = document.getElementById("contatore-caratteri");
    var max = (CFG && CFG.reviews.maxChars) || 1000; // limite uniformato a 1000

    if (area && contatore) {
      function aggiorna() {
        var resto = max - area.value.length;
        contatore.textContent = resto + " caratteri rimanenti (max " + max + ")";
        if (resto < 0) area.value = area.value.slice(0, max);
      }
      area.addEventListener("input", aggiorna);
      aggiorna();
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var nome = (document.getElementById("campo-nome") || {}).value || "";
      var attivita = (document.getElementById("campo-attivita") || {}).value || "";
      var tel = (document.getElementById("campo-telefono") || {}).value || "";
      var servizio = (document.getElementById("campo-servizio") || {}).value || "Sito Web Base";
      var desc = (document.getElementById("campo-descrizione") || {}).value || "";

      if (!nome.trim() || !attivita.trim()) {
        msg.textContent = "Inserisci almeno nome e attività: servono per preparare la bozza.";
        msg.setAttribute("tipo", "errore");
        return;
      }
      var testo =
        "Ciao Webnix! Richiedo la BOZZA GRATUITA in 48h.\n" +
        "• Nome: " + nome.trim() + "\n" +
        "• Attività: " + attivita.trim() + "\n" +
        "• Telefono: " + (tel.trim() || "n.d.") + "\n" +
        "• Servizio: " + servizio + "\n" +
        "• Dettaglio: " + (desc.trim() || "n.d.");
      window.open(waLink(testo), "_blank", "noopener");
      msg.textContent = "Perfetto! Ti abbiamo aperto WhatsApp: invia il messaggio precompilato e ricevi la bozza entro 48 ore.";
      msg.setAttribute("tipo", "ok");
      form.reset();
      if (contatore) contatore.textContent = "";
    });
  }

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
    if (!CFG) return;
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
      btn.addEventListener("click", function () {
        var aperto = det.getAttribute("aperto") === "si";
        det.setAttribute("aperto", aperto ? "" : "si");
        btn.textContent = aperto
          ? (btn.getAttribute("data-testo-chiuso") || "\u2705 Scopri cosa offriamo")
          : "\u2b06\ufe0f Chiudi il dettaglio";
        if (!btn.getAttribute("data-testo-chiuso")) btn.setAttribute("data-testo-chiuso", btn.textContent.replace("\u2b06\ufe0f Chiudi il dettaglio", "\u2705 Scopri cosa offriamo"));
      });
    });

    /* "Acquista questo pacchetto" \u2192 WhatsApp precompilato */
    document.querySelectorAll("#bottone-acquista").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var chiave = btn.getAttribute("data-servizio") || "";
        var nome = NOMI_SERVIZI[chiave] || chiave;
        window.open(waLink("Ciao Webnix! Voglio ACQUISTARE il pacchetto \"" + nome + "\". Come procediamo?"), "_blank", "noopener");
      });
    });
  }

  /* ---------- AVVIO ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    avviaPreloader();
    inizializzaHeaderScroll();
    inizializzaMenu();
    inizializzaScrollFluido();
    renderServizi();
    renderPortfolio();
    inizializzaPortfolio();
    caricaRecensioni();
    inizializzaForm();
    inizializzaBottoneTouch();
    applicaConfigLink();
    inizializzaPacchetti();
    inizializzaReveal();
  });
})();

/* ============ HERO: demo iPhone in loop ============
   Timeline CSS di 14s: la barra di ricerca compare al centro, si scrive
   "la mia attività", la barra sale, arriva la mappa, cade il pin e infine
   sale la scheda dell'attività. Qui gestiamo solo la digitazione. */
(function () {
  var testo = document.getElementById("tel-testo");
  var cursore = document.getElementById("tel-caret");
  if (!testo || !cursore) return;

  var FRASE = "la mia attività";
  var CICLO = 14000;          /* stessa durata delle animazioni CSS */
  var INIZIO = 1400;          /* la barra è già comparsa */
  var PER_LETTERA = 145;

  var ultimo = null;
  var ultimoCursore = null;

  function disegna(ora) {
    var t = ora % CICLO;
    var visibile = "0";
    var parziale;
    if (t < INIZIO) {
      parziale = "";
    } else if (t < INIZIO + FRASE.length * PER_LETTERA) {
      parziale = FRASE.slice(0, Math.floor((t - INIZIO) / PER_LETTERA));
      visibile = Math.floor(ora / 480) % 2 === 0 ? "1" : "0";
    } else {
      parziale = FRASE;
    }
    /* si tocca il DOM solo quando cambia qualcosa */
    if (parziale !== ultimo) { testo.textContent = parziale; ultimo = parziale; }
    if (visibile !== ultimoCursore) { cursore.style.opacity = visibile; ultimoCursore = visibile; }
    window.requestAnimationFrame(disegna);
  }
  window.requestAnimationFrame(disegna);
})();

/* ============ HERO: scala il telefono sulla colonna disponibile ============
   Il telefono è disegnato a 406x796 px fissi: qui calcoliamo --scala così
   resta grande ma entra sempre nello spazio (desktop e mobile). */
(function () {
  var palco = document.getElementById("palcoscenico-telefono");
  var cornice = document.getElementById("cornice-telefono");
  var colonna = document.getElementById("demo-hero");
  if (!palco || !cornice || !colonna) return;

  var BASE_L = 406;
  var BASE_A = 796;

  var attuale = "";
  var inCoda = false;

  function misura() {
    inCoda = false;
    var larghezza = colonna.clientWidth;
    var altezza = window.innerHeight - 120;
    if (larghezza < 140) larghezza = 140;
    if (altezza < 320) altezza = 320;
    var scala = Math.min(larghezza / BASE_L, altezza / BASE_A, 1.25).toFixed(3);
    if (scala === attuale) return;
    attuale = scala;

    var s = parseFloat(scala);
    /* dimensioni e rotazione scritte direttamente: la stessa scala serve
       per lo spazio occupato (palco) e per il telefono (transform) */
    palco.style.width = Math.round(BASE_L * s) + "px";
    palco.style.height = Math.round(BASE_A * s) + "px";
    palco.style.setProperty("--scala", scala);
    cornice.style.transform = "rotateY(328deg) rotateZ(6deg) scale(" + s + ")";
  }

  /* un solo misuraggio per frame, mai in cascata */
  function pianifica() {
    if (inCoda) return;
    inCoda = true;
    window.requestAnimationFrame(misura);
  }

  misura();
  window.addEventListener("resize", pianifica);
  window.addEventListener("load", pianifica);
})();

/* ============ SEZIONE PROBLEMA: animazione automatica dei fotogrammi ============
   Gli 80 fotogrammi (SVG) si susseguono da soli quando il titolo della sezione
   arriva nello schermo (circa 5 secondi in tutto) e si fermano sull'ultimo.
   Tornando sulla sezione l'animazione riparte. La pagina scorre normalmente:
   nessun aggancio e nessun blocco dello scroll. */
(function () {
  var sezione = document.getElementById("sezione-sequenza");
  var immagine = document.getElementById("fotogramma-problema");
  if (!sezione || !immagine) return;

  var TOTALE = 80;
  var cartella = "assets/problema/";
  var DURATA = 5200;
  var fotogrammi = [];
  for (var i = 0; i < TOTALE; i++) {
    fotogrammi.push(cartella + "frame-" + String(i).padStart(3, "0") + ".svg");
  }

  /* Precarico: senza questo lo scambio dei fotogrammi fa lampeggiare l'immagine */
  fotogrammi.forEach(function (src) { var im = new Image(); im.src = src; });

  var indice = 0;
  var timer = null;

  /* Riparte sempre da frame-000: richiamabile ogni volta che il titolo
     della sezione torna nello schermo. */
  function avvia() {
    window.clearInterval(timer);
    indice = 0;
    immagine.src = fotogrammi[0];
    var inizio = Date.now();
    timer = window.setInterval(function () {
      var p = (Date.now() - inizio) / DURATA;
      if (p > 1) p = 1;
      var i = Math.round(p * (TOTALE - 1));
      if (i !== indice) {
        indice = i;
        immagine.src = fotogrammi[i];
      }
      if (p >= 1) {
        window.clearInterval(timer);
        timer = null;
      }
    }, 60);
  }

  /* Innesco: il titolo della sezione ben visibile (non la sezione intera,
     altrimenti l'animazione parte mentre si è ancora sull'hero ed è gia'
     finita quando ci si arriva). */
  var innesco = document.getElementById("intestazione-problema") || sezione;

  if ("IntersectionObserver" in window) {
    var osservatore = new IntersectionObserver(function (voci) {
      for (var i = 0; i < voci.length; i++) {
        var v = voci[i];
        /* parte solo quando il titolo entra davvero (rapporto >= 0.6) e non
           sta gia' andando: cosi' uscendo dalla sezione non si riavvia */
        if (v.isIntersecting && v.intersectionRatio >= 0.6 && !timer) {
          avvia();
          return;
        }
      }
    }, { threshold: [0.6] });
    osservatore.observe(innesco);
  } else {
    avvia();
  }
})();

/* ============ SCHEDE DEL PROBLEMA: ingresso in sequenza ============
   Le due schede (Instagram, credibilità) compaiono una dopo l'altra quando
   arrivano nello schermo. Animazione in CSS, quindi attiva anche con
   "movimento ridotto". */
(function () {
  var schede = document.querySelectorAll(".problema-extra");
  if (!schede.length) return;

  function mostra() {
    for (var i = 0; i < schede.length; i++) {
      schede[i].style.setProperty("--ritardo", (i * 0.14).toFixed(2) + "s");
      schede[i].classList.add("entrata");
    }
  }

  if (!("IntersectionObserver" in window)) { mostra(); return; }

  var bersaglio = document.getElementById("altri-problemi") || schede[0];
  var osservatore = new IntersectionObserver(function (voci) {
    for (var i = 0; i < voci.length; i++) {
      if (voci[i].isIntersecting) {
        osservatore.disconnect();
        mostra();
        return;
      }
    }
  }, { threshold: 0.15 });
  osservatore.observe(bersaglio);
})();

/* ============ COSA FACCIAMO: la scena gira in loop ============
   Un elemento alla volta: barra di ricerca (che scrive da sola), browser,
   telefono, mappa, pin, scheda attività e riga del risultato. Finito il
   giro la scena si svuota e riparte da capo. */
(function () {
  var sezione = document.getElementById("cosa-facciamo");
  var scena = document.getElementById("scena-cosa");
  if (!sezione || !scena) return;

  var FRASE = "la mia attività";
  var PEZZI = [
    ["#cosa-ricerca", 0],
    ["#cosa-browser", 1400],
    ["#cosa-telefono", 2400],
    ["#cosa-mappa", 3400],
    ["#cosa-pin", 3800],
    ["#cosa-scheda", 4400],
    ["#cosa-risultato", 5400]
  ];
  var INIZIO_SCRITTURA = 700;
  var PER_LETTERA = 140;
  var FINE = 7800;
  var PAUSA = 1500;

  var testo = document.getElementById("cosa-testo");
  var cursore = document.getElementById("cosa-caret");
  var timer = [];
  var giro = 0;

  function dopo(ms, fn, mio) {
    timer.push(window.setTimeout(function () { if (mio === giro) fn(); }, ms));
  }

  function svuota() {
    var pezzi = scena.querySelectorAll(".pezzo");
    for (var i = 0; i < pezzi.length; i++) pezzi[i].classList.remove("acceso");
    if (testo) testo.textContent = "";
    if (cursore) cursore.style.opacity = "0";
  }

  function scrivi(mio) {
    var i = 0;
    function passo() {
      i++;
      if (mio !== giro) return;
      if (testo) testo.textContent = FRASE.slice(0, i);
      if (cursore) cursore.style.opacity = "1";
      if (i < FRASE.length) dopo(PER_LETTERA, passo, mio);
    }
    passo();
  }

  function gioca() {
    giro++;
    var mio = giro;
    timer = [];
    svuota();

    for (var i = 0; i < PEZZI.length; i++) {
      (function (sel, ritardo) {
        dopo(ritardo, function () {
          var el = scena.querySelector(sel);
          if (el) el.classList.add("acceso");
        }, mio);
      })(PEZZI[i][0], PEZZI[i][1]);
    }

    dopo(INIZIO_SCRITTURA, function () { scrivi(mio); }, mio);

    dopo(FINE, function () {
      svuota();
      dopo(PAUSA, gioca, mio);
    }, mio);
  }

  function ferma() {
    giro++;
    timer = [];
  }

  if (!("IntersectionObserver" in window)) { gioca(); return; }

  var osservatore = new IntersectionObserver(function (voci) {
    for (var i = 0; i < voci.length; i++) {
      if (voci[i].isIntersecting) {
        sezione.classList.add("demo-attiva");
        gioca();
      } else {
        sezione.classList.remove("demo-attiva");
        ferma();
        svuota();
      }
    }
  }, { threshold: 0.25 });

  osservatore.observe(sezione);
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


/* ============ SERVIZI: laptop che si apre, iPhone da destra, anteprime a rotazione,
   frecce per cambiare immagine e popup con la galleria completa ============ */
(function () {
  var scena = document.getElementById('sezione-nostri-lavori');
  if (!scena) return;

  var pcImmagini = scena.querySelectorAll('.pc-schermo img');
  var telImmagini = scena.querySelectorAll('.telefono-schermo img');
  var indicePc = 0;
  var indiceTel = 0;
  var timerPc = null;
  var timerTel = null;

  var attiva = function (lista, indice) {
    for (var k = 0; k < lista.length; k++) {
      lista[k].classList.toggle('attiva', k === indice);
    }
  };

  var mostraPc = function (n) {
    if (!pcImmagini.length) return;
    indicePc = (n + pcImmagini.length) % pcImmagini.length;
    attiva(pcImmagini, indicePc);
  };

  var avviaPc = function () {
    if (timerPc || pcImmagini.length < 2) return;
    timerPc = setInterval(function () { mostraPc(indicePc + 1); }, 4200);
  };

  var avviaTelefono = function () {
    if (timerTel || telImmagini.length < 2) return;
    timerTel = setInterval(function () {
      indiceTel = (indiceTel + 1) % telImmagini.length;
      attiva(telImmagini, indiceTel);
    }, 3600);
  };

  /* ---- popup con anteprima grande + galleria a destra ---- */
  var popup = document.getElementById('popup-lavori');
  var popupImmagine = document.getElementById('popup-immagine');
  var popupDidascalia = document.getElementById('popup-didascalia');
  var popupChiudi = document.getElementById('popup-chiudi');
  var miniature = popup ? popup.querySelectorAll('.popup-miniatura') : [];
  var apriBtn = document.getElementById('apri-anteprima-lavori');
  var fuocoPrecedente = null;

  var seleziona = function (src, didascalia) {
    if (!popupImmagine || !src) return;
    popupImmagine.src = src;
    popupImmagine.alt = didascalia ? 'Anteprima ' + didascalia : 'Anteprima del progetto';
    if (popupDidascalia) popupDidascalia.textContent = didascalia || '';
    for (var k = 0; k < miniature.length; k++) {
      if (miniature[k].getAttribute('data-immagine') === src) {
        miniature[k].setAttribute('aria-current', 'true');
      } else {
        miniature[k].removeAttribute('aria-current');
      }
    }
  };

  var collegaMiniature = function () {
    miniature = popup ? popup.querySelectorAll('.popup-miniatura') : [];
    for (var k = 0; k < miniature.length; k++) {
      if (miniature[k].getAttribute('data-collegata') === 'si') continue;
      miniature[k].setAttribute('data-collegata', 'si');
      miniature[k].addEventListener('click', function () {
        seleziona(this.getAttribute('data-immagine'), this.getAttribute('data-didascalia'));
      });
    }
  };

  var inChiusura = false;

  var apriPopup = function () {
    if (!popup) return;
    fuocoPrecedente = document.activeElement;
    var img = pcImmagini[indicePc];
    seleziona(img ? img.getAttribute('src') : 'assets/portfolio/sito-vesuvio.png', img ? img.alt : '');
    popup.classList.remove('chiusura');
    inChiusura = false;
    popup.hidden = false;
    document.body.classList.add('popup-aperto');
    if (popupChiudi) popupChiudi.focus();
  };

  var chiudiPopup = function () {
    if (!popup || popup.hidden || inChiusura) return;
    inChiusura = true;
    popup.classList.add('chiusura');
    document.body.classList.remove('popup-aperto');
    window.setTimeout(function () {
      popup.hidden = true;
      popup.classList.remove('chiusura');
      inChiusura = false;
      if (fuocoPrecedente && typeof fuocoPrecedente.focus === 'function') fuocoPrecedente.focus();
    }, 300);
  };

  if (apriBtn) apriBtn.addEventListener('click', apriPopup);
  if (popupChiudi) popupChiudi.addEventListener('click', chiudiPopup);
  if (popup) {
    var sfondo = popup.querySelector('.popup-sfondo');
    if (sfondo) sfondo.addEventListener('click', chiudiPopup);
    collegaMiniature();
    document.addEventListener('keydown', function (e) {
      if (popup.hidden) return;
      if (e.key === 'Escape' || e.key === 'Esc') chiudiPopup();
    });
  }

  /* ---- frecce: cambiano l'immagine del PC e fanno ripartire la rotazione ---- */
  var cambia = function (passo) {
    mostraPc(indicePc + passo);
    if (timerPc) { clearInterval(timerPc); timerPc = null; }
    avviaPc();
  };
  var frecciaPrev = document.getElementById('freccia-prev');
  var frecciaNext = document.getElementById('freccia-next');
  if (frecciaPrev) frecciaPrev.addEventListener('click', function () { cambia(-1); });
  if (frecciaNext) frecciaNext.addEventListener('click', function () { cambia(1); });

  /* i progetti caricati da Firestore (dati-remoti.js) arrivano dopo: si riagganciano qui */
  window.__webnixAggiornaLavori = function () {
    pcImmagini = scena.querySelectorAll('.pc-schermo img');
    telImmagini = scena.querySelectorAll('.telefono-schermo img');
    collegaMiniature();
    mostraPc(0);
    indiceTel = 0;
    attiva(telImmagini, 0);
    if (timerPc) { clearInterval(timerPc); timerPc = null; }
    if (timerTel) { clearInterval(timerTel); timerTel = null; }
    avviaPc();
    avviaTelefono();
  };

  var apri = function () {
    if (scena.classList.contains('in-scena')) return;
    scena.classList.add('in-scena');
    avviaPc();
    avviaTelefono();
  };

  if (!('IntersectionObserver' in window)) { apri(); return; }
  /* osserva i dispositivi (non tutta la sezione): il coperchio si apre quando
     la scena è davvero dentro lo schermo, così l'apertura si vede tutta */
  var bersaglio = document.getElementById('scena-dispositivi') || scena;
  var oss = new IntersectionObserver(function (voci) {
    voci.forEach(function (voce) {
      if (voce.isIntersecting) { apri(); oss.disconnect(); }
    });
  }, { threshold: 0.45, rootMargin: '0px 0px -8% 0px' });
  oss.observe(bersaglio);
})();

/* ============ CHI SIAMO: il pannello WhatsApp entra quando lo si raggiunge ============ */
(function () {
  var box = document.getElementById('whatsappContainer');
  if (!box) return;
  if (!('IntersectionObserver' in window)) { box.classList.add('entrato'); return; }
  var oss = new IntersectionObserver(function (voci) {
    voci.forEach(function (voce) {
      if (voce.isIntersecting) { box.classList.add('entrato'); oss.disconnect(); }
    });
  }, { threshold: 0.25 });
  oss.observe(box);
})();

/* ============ PORTFOLIO (home): popup anteprima, lo stesso della pagina Servizi ============ */
(function () {
  var popup = document.getElementById('popup-lavori');
  if (!popup) return;

  var cfg = window.WEBNIX_CONFIG;
  var galleria = popup.querySelector('.popup-galleria');
  var immagine = document.getElementById('popup-immagine');
  var didascalia = document.getElementById('popup-didascalia');
  var chiudiBtn = document.getElementById('popup-chiudi');
  var miniature = [];
  var fuocoPrecedente = null;
  var inChiusura = false;

  /* colonna di miniature a destra, costruita dai lavori in config.js */
  if (galleria && cfg && cfg.portfolio) {
    galleria.innerHTML = '';
    cfg.portfolio.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'popup-miniatura';
      b.setAttribute('data-immagine', p.img);
      b.setAttribute('data-didascalia', p.title);
      b.setAttribute('aria-label', 'Vedi ' + p.title);
      var img = document.createElement('img');
      img.src = p.img;
      img.alt = 'Anteprima ' + p.title;
      img.loading = 'lazy';
      b.appendChild(img);
      b.addEventListener('click', function () { seleziona(p.img, p.title); });
      galleria.appendChild(b);
    });
    miniature = Array.prototype.slice.call(galleria.querySelectorAll('.popup-miniatura'));
  }

  function seleziona(src, testo) {
    if (!immagine || !src) return;
    immagine.src = src;
    immagine.alt = testo ? 'Anteprima ' + testo : 'Anteprima del progetto';
    if (didascalia) didascalia.textContent = testo || '';
    miniature.forEach(function (b) {
      if (b.getAttribute('data-immagine') === src) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
  }

  function apri(src, testo) {
    fuocoPrecedente = document.activeElement;
    seleziona(src, testo);
    popup.classList.remove('chiusura');
    inChiusura = false;
    popup.hidden = false;
    document.body.classList.add('popup-aperto');
    if (chiudiBtn) chiudiBtn.focus();
  }

  /* apertura dall'esterno (miniature generate da dati-remoti.js) */
  window.__webnixApriAnteprima = apri;

  function chiudi() {
    if (popup.hidden || inChiusura) return;
    inChiusura = true;
    popup.classList.add('chiusura');
    document.body.classList.remove('popup-aperto');
    window.setTimeout(function () {
      popup.hidden = true;
      popup.classList.remove('chiusura');
      inChiusura = false;
      if (fuocoPrecedente && typeof fuocoPrecedente.focus === 'function') fuocoPrecedente.focus();
    }, 300);
  }

  var griglia = document.getElementById('griglia-portfolio');
  var apriDa = function (card) {
    if (!card) return;
    apri(card.getAttribute('data-immagine'), card.getAttribute('data-didascalia'));
  };

  var apriBtn = document.getElementById('apri-anteprima-lavori');
  if (apriBtn) apriBtn.addEventListener('click', function () {
    var prima = griglia ? griglia.querySelector('.card-portfolio:not([nascosto])') : null;
    apriDa(prima || (griglia ? griglia.querySelector('.card-portfolio') : null));
  });

  if (griglia) {
    griglia.addEventListener('click', function (e) {
      apriDa(e.target.closest('.card-portfolio'));
    });
    griglia.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = e.target.closest('.card-portfolio');
      if (!card) return;
      e.preventDefault();
      apriDa(card);
    });
  }

  if (chiudiBtn) chiudiBtn.addEventListener('click', chiudi);
  var sfondo = popup.querySelector('.popup-sfondo');
  if (sfondo) sfondo.addEventListener('click', chiudi);
  document.addEventListener('keydown', function (e) {
    if (popup.hidden) return;
    if (e.key === 'Escape' || e.key === 'Esc') chiudi();
  });
})();
