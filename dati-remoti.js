/* ============================================================
   WEBNIX — dati-remoti.js
   Legge i contenuti pubblici da Firestore (via REST, niente SDK)
   e li applica alle pagine del sito:

   - impostazioni/sito → colori brand, social, CookieBot, Facebook Pixel
   - recensioni        → carosello recensioni della home
   - portfolio         → lavori della home
   - pacchetti         → card della pagina Servizi
   - faq               → domande della pagina FAQ

   Se firebase-config.js è vuoto (o la rete non risponde) il sito
   resta esattamente com'è, con i contenuti scritti nell'HTML.
   ============================================================ */

(function () {
  "use strict";

  var CFG = window.WEBNIX_FIREBASE || {};
  if (!CFG.apiKey || !CFG.projectId) return;

  var RADICE =
    "https://firestore.googleapis.com/v1/projects/" +
    encodeURIComponent(CFG.projectId) +
    "/databases/(default)/documents";

  /* numero WhatsApp usato dal link "di base" dei pacchetti */
  var numeroWhatsapp = "14132259397";

  function linkPreventivo(nome) {
    var testo = "Ciao Webnix! Mi interessa il pacchetto \"" + (nome || "indicato nel sito") + "\". Come procediamo?";
    return "https://wa.me/" + numeroWhatsapp + "?text=" + encodeURIComponent(testo);
  }

  /* ---------- conversione valori Firestore ---------- */
  function valore(v) {
    if (!v || typeof v !== "object") return "";
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return parseInt(v.integerValue, 10);
    if ("doubleValue" in v) return Number(v.doubleValue);
    if ("booleanValue" in v) return Boolean(v.booleanValue);
    if ("timestampValue" in v) return new Date(v.timestampValue).getTime();
    if ("nullValue" in v) return null;
    if ("mapValue" in v) {
      var mappa = {};
      var campi = (v.mapValue && v.mapValue.fields) || {};
      Object.keys(campi).forEach(function (k) { mappa[k] = valore(campi[k]); });
      return mappa;
    }
    if ("arrayValue" in v) {
      return ((v.arrayValue && v.arrayValue.values) || []).map(valore);
    }
    return "";
  }

  function documento(doc) {
    var dati = {};
    var campi = (doc && doc.fields) || {};
    Object.keys(campi).forEach(function (k) { dati[k] = valore(campi[k]); });
    if (doc && doc.name) dati.__id = doc.name.split("/").pop();
    return dati;
  }

  function leggiJson(url) {
    var controllo = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controllo ? setTimeout(function () { controllo.abort(); }, 7000) : null;
    return fetch(url, controllo ? { signal: controllo.signal } : undefined)
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        throw err;
      });
  }

  function leggiDocumento(percorso) {
    return leggiJson(RADICE + "/" + percorso + "?key=" + encodeURIComponent(CFG.apiKey))
      .then(documento);
  }

  function leggiCollezione(nome) {
    return leggiJson(RADICE + "/" + nome + "?key=" + encodeURIComponent(CFG.apiKey) + "&pageSize=100")
      .then(function (risposta) {
        return (risposta.documents || []).map(documento);
      })
      .catch(function () { return []; });
  }

  function perOrdine(a, b) {
    if (a.ordine && b.ordine) return a.ordine - b.ordine;
    return 0;
  }

  /* ============================================================
     COLORI
     ============================================================ */
  function applicaColori(colori) {
    if (!colori || typeof colori !== "object") return;
    var radice = document.documentElement;
    if (colori.viola) radice.style.setProperty("--viola", colori.viola);
    if (colori.ciano) radice.style.setProperty("--ciano", colori.ciano);
    if (colori.sfondo) {
      radice.style.setProperty("--sfondo", colori.sfondo);
      var tema = document.querySelector('meta[name="theme-color"]');
      if (tema) tema.setAttribute("content", colori.sfondo);
    }
    if (colori.sfondoCard) radice.style.setProperty("--sfondo-card", colori.sfondoCard);
    if (colori.viola && colori.ciano) {
      radice.style.setProperty(
        "--gradiente-brand",
        "linear-gradient(-45deg, " + colori.viola + " 0%, " + colori.ciano + " 100%)"
      );
    }
  }

  /* ============================================================
     SOCIAL / EMAIL / WHATSAPP
     ============================================================ */
  /* selettori dei link di ogni canale: servono a nasconderli quando
     l'interruttore della dashboard è spento */
  var CANALI = {
    instagram: 'a[href*="instagram.com"]',
    facebook: 'a[href*="facebook.com"]',
    tiktok: 'a[href*="tiktok.com"]',
    whatsapp: 'a[href*="wa.me"]',
    email: 'a[href^="mailto:"]'
  };

  /* un interruttore spento in dashboard vince su qualsiasi valore salvato */
  function canaleAttivo(chiave, visibili, valore) {
    var scelta = visibili ? visibili[chiave] : undefined;
    if (scelta === true || scelta === false) return scelta;
    if (chiave === "cookiebot" || chiave === "pixel") return Boolean(valore);
    return true;
  }

  function nascondi(elemento) {
    if (!elemento) return;
    elemento.hidden = true;
    elemento.style.display = "none";
  }

  /* i canali segnati come fissi (es. Instagram in FAQ o in Chi Siamo)
     restano visibili anche se l'interruttore della dashboard è spento */
  function canaleFisso(elemento) {
    if (!elemento) return false;
    if (elemento.hasAttribute && elemento.hasAttribute("data-canale-fisso")) return true;
    return Boolean(elemento.closest && elemento.closest("[data-canale-fisso]"));
  }

  function nascondiCanale(chiave) {
    document.querySelectorAll('[data-canale="' + chiave + '"]').forEach(function (el) {
      if (!canaleFisso(el)) nascondi(el);
    });
    var selettore = CANALI[chiave];
    if (!selettore) return;
    document.querySelectorAll(selettore).forEach(function (a) {
      if (canaleFisso(a)) return;
      /* card social del footer: nascondo tutto il link che la contiene */
      if (a.querySelector(".card-container")) return nascondi(a);
      var blocco = a.closest("[data-canale]");
      nascondi(blocco || a);
    });
  }

  /* TikTok nel footer: viene creato solo se il link è impostato in dashboard */
  function inserisciTikTok(url) {
    var cards = document.getElementById("cards");
    if (!cards) return;

    var esistente = cards.querySelector('.card-container[id="tiktok"]');
    if (esistente) {
      var linkEsistente = esistente.closest("a");
      if (linkEsistente && url) linkEsistente.href = url;
      return;
    }
    if (!url) return;

    var link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.style.textDecoration = "none";
    link.style.color = "inherit";
    link.setAttribute("aria-label", "Profilo TikTok di Webnix");

    var scheda = document.createElement("div");
    scheda.className = "card-container";
    scheda.id = "tiktok";

    var icona = document.createElement("div");
    icona.className = "icon-container";
    icona.innerHTML = '<svg viewBox="0 0 24 24" fill="#fff" width="16" height="16" aria-hidden="true"><path d="M16.6 5.9a5 5 0 0 1-2.9-2.5h-2.6v11.5a2.7 2.7 0 1 1-2.7-2.7c.2 0 .5 0 .7.1V9.6a5.4 5.4 0 1 0 4.6 5.3V9.3a7 7 0 0 0 3.7 1.1V7.7a4.5 4.5 0 0 1-.8-1.8z"></path></svg>';
    var etichetta = document.createElement("p");
    etichetta.textContent = "TikTok";
    icona.appendChild(etichetta);
    scheda.appendChild(icona);
    link.appendChild(scheda);

    var instagram = cards.querySelector('.card-container[id="instagram"]');
    var riferimento = instagram ? instagram.closest("a") : null;
    if (riferimento && riferimento.parentNode === cards) {
      cards.insertBefore(link, riferimento.nextSibling);
    } else {
      cards.appendChild(link);
    }
  }

  /* video YouTube della CTA: accetta link watch, youtu.be, shorts, live o embed */
  function idYouTube(url) {
    var trovato = String(url || "").match(
      /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/|live\/))([\w-]{11})/i
    );
    return trovato ? trovato[1] : "";
  }

  function applicaVideo(link) {
    var blocco = document.getElementById("video-cta");
    if (!blocco) return;

    var visibili = (link && link.visibili) || {};
    if (visibili.video === false) {
      nascondi(blocco);
      return;
    }
    blocco.hidden = false;
    blocco.style.display = "";

    var id = idYouTube(link && link.video);
    var iframe = blocco.querySelector("iframe");
    if (!id || !iframe) return;
    var indirizzo = "https://www.youtube-nocookie.com/embed/" + id + "?rel=0";
    if (iframe.getAttribute("src") !== indirizzo) iframe.setAttribute("src", indirizzo);
  }

  function applicaLink(link) {
    if (!link || typeof link !== "object") return;

    var visibili = link.visibili || {};

    /* ogni canale spento in dashboard sparisce dalle pagine */
    Object.keys(CANALI).forEach(function (chiave) {
      if (!canaleAttivo(chiave, visibili, link[chiave])) nascondiCanale(chiave);
    });

    if (canaleAttivo("instagram", visibili, link.instagram) && link.instagram) {
      document.querySelectorAll(CANALI.instagram).forEach(function (a) {
        a.href = link.instagram;
      });
    }
    if (canaleAttivo("facebook", visibili, link.facebook) && link.facebook) {
      document.querySelectorAll(CANALI.facebook).forEach(function (a) {
        a.href = link.facebook;
      });
    }
    if (canaleAttivo("tiktok", visibili, link.tiktok) && link.tiktok) {
      document.querySelectorAll(CANALI.tiktok).forEach(function (a) {
        a.href = link.tiktok;
      });
    }
    if (canaleAttivo("whatsapp", visibili, link.whatsapp) && link.whatsapp) {
      var numero = String(link.whatsapp).replace(/[^\d]/g, "");
      if (numero) {
        document.querySelectorAll('a[href*="wa.me/"]').forEach(function (a) {
          a.href = a.href.replace(/wa\.me\/\d+/, "wa.me/" + numero);
        });
      }
    }
    if (canaleAttivo("email", visibili, link.email) && link.email) {
      document.querySelectorAll(CANALI.email).forEach(function (a) {
        if (a.getAttribute("href").indexOf("?") !== -1) return; /* conserva l'oggetto precompilato */
        a.href = "mailto:" + link.email;
      });
    }

    /* la card TikTok viene creata solo se il canale è attivo */
    if (canaleAttivo("tiktok", visibili, link.tiktok)) inserisciTikTok(link.tiktok);

    /* video della CTA: link e interruttore arrivano dalla dashboard */
    applicaVideo(link);
  }

  /* ============================================================
     COOKIEBOT + FACEBOOK PIXEL
     ============================================================ */
  function caricaCookiebot(id) {
    if (!id || document.getElementById("Cookiebot")) return;
    var s = document.createElement("script");
    s.id = "Cookiebot";
    s.src = "https://consent.cookiebot.com/uc.js";
    s.async = true;
    s.setAttribute("data-cbid", id);
    s.setAttribute("data-blockingmode", "auto");
    document.head.appendChild(s);
  }

  function caricaPixel(id) {
    if (!id) return;
    if (!window.fbq) {
      /* snippet ufficiale Meta, riscritto in JavaScript puro */
      var fbq = function () {
        fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
      };
      if (!window._fbq) window._fbq = fbq;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
      window.fbq = fbq;

      var s = document.createElement("script");
      s.async = true;
      s.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(s);

      var img = document.createElement("img");
      img.height = 1;
      img.width = 1;
      img.style.display = "none";
      img.alt = "";
      img.src = "https://www.facebook.com/tr?id=" + encodeURIComponent(id) + "&ev=PageView&noscript=1";
      document.body.appendChild(img);
    }
    window.fbq("init", id);
    window.fbq("track", "PageView");
  }

  /* ============================================================
     RECENSIONI (home)
     ============================================================ */
  function cardRecensione(r) {
    var card = document.createElement("article");
    card.className = "card-recensione";

    var intest = document.createElement("div");
    intest.className = "intestazione-recensione";

    var iniziali = document.createElement("div");
    iniziali.className = "iniziali-recensore";
    var parti = String(r.name || "?").trim().split(/\s+/);
    iniziali.textContent = (parti[0][0] || "?") + (parti[1] ? parti[1][0] : "");

    var blocco = document.createElement("div");
    var nome = document.createElement("strong");
    nome.textContent = r.name || "Anonimo";
    var stelle = document.createElement("div");
    stelle.className = "stelle-recensione";
    var n = Math.max(1, Math.min(5, parseInt(r.stars, 10) || 5));
    stelle.textContent = "★".repeat(n) + "☆".repeat(5 - n);
    blocco.appendChild(nome);
    blocco.appendChild(stelle);

    intest.appendChild(iniziali);
    intest.appendChild(blocco);

    var testo = document.createElement("p");
    testo.className = "testo-recensione";
    testo.textContent = r.text || "";

    card.appendChild(intest);
    card.appendChild(testo);

    /* recensione lunga: testo tagliato e freccia per aprire quella completa */
    if (String(r.text || "").length > 180) {
      testo.classList.add("troncata");

      var area = document.createElement("span");
      area.className = "area-espandi";

      var suggerimento = document.createElement("span");
      suggerimento.className = "suggerimento-espandi";
      suggerimento.textContent = "Leggi la recensione completa";

      var freccia = document.createElement("button");
      freccia.type = "button";
      freccia.className = "bottone-espandi";
      freccia.setAttribute("aria-expanded", "false");
      freccia.setAttribute("aria-label", "Leggi la recensione completa");
      freccia.innerHTML = '<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';

      area.appendChild(suggerimento);
      area.appendChild(freccia);
      card.appendChild(area);
    }

    if (r.timestamp || r.url) {
      var piede = document.createElement("div");
      piede.className = "piede-recensione";

      if (r.timestamp) {
        var data = document.createElement("span");
        data.className = "data-recensione";
        try {
          data.textContent = new Date(Number(r.timestamp)).toLocaleDateString("it-IT", {
            day: "numeric", month: "long", year: "numeric"
          });
        } catch (e) { data.textContent = ""; }
        piede.appendChild(data);
      }

      if (r.url) {
        var linkProgetto = document.createElement("a");
        linkProgetto.className = "link-recensione";
        linkProgetto.href = r.url;
        linkProgetto.target = "_blank";
        linkProgetto.rel = "noopener";
        linkProgetto.textContent = "SITO WEB";
        piede.appendChild(linkProgetto);
      }

      card.appendChild(piede);
    }
    return card;
  }

  function disegnaRecensioni(voci) {
    var griglia = document.getElementById("griglia-recensioni");
    if (!griglia || !voci.length) return;

    var caricamento = document.getElementById("caricamento-recensioni");
    if (caricamento) caricamento.remove();

    voci.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

    /* delega: funziona anche sulle card copiate per lo scorrimento continuo */
    if (!griglia.dataset.espandiCollegato) {
      griglia.dataset.espandiCollegato = "si";
      griglia.addEventListener("click", function (e) {
        var freccia = e.target.closest(".bottone-espandi");
        if (!freccia) return;
        var card = freccia.closest(".card-recensione");
        var eraAperta = freccia.getAttribute("aria-expanded") === "true";
        freccia.setAttribute("aria-expanded", eraAperta ? "false" : "true");
        freccia.setAttribute("aria-label", eraAperta ? "Leggi la recensione completa" : "Mostra meno");
        if (card) card.classList.toggle("espansa", !eraAperta);
        var suggerimento = freccia.parentNode
          ? freccia.parentNode.querySelector(".suggerimento-espandi")
          : null;
        if (suggerimento) {
          suggerimento.textContent = eraAperta ? "Leggi la recensione completa" : "Mostra meno";
        }
      });
    }

    griglia.innerHTML = "";
    voci.forEach(function (r) { griglia.appendChild(cardRecensione(r)); });

    /* copia per lo scorrimento continuo: l'animazione va a -50% */
    Array.prototype.slice.call(griglia.children).forEach(function (card) {
      var copia = card.cloneNode(true);
      copia.setAttribute("aria-hidden", "true");
      griglia.appendChild(copia);
    });

    var larghezza = griglia.scrollWidth / 2;
    griglia.style.setProperty("--durata-scorrimento", Math.max(18, Math.round(larghezza / 46)) + "s");

    var media = voci.reduce(function (s, r) {
      return s + (parseInt(r.stars, 10) || 5);
    }, 0) / voci.length;

    var voto = document.getElementById("voto-medio");
    var stelleMedie = document.getElementById("stelle-medie");
    var conteggio = document.getElementById("conteggio-recensioni");
    if (voto) voto.textContent = media.toFixed(1);
    if (stelleMedie) {
      stelleMedie.textContent = "★".repeat(Math.round(media)) + "☆".repeat(5 - Math.round(media));
    }
    if (conteggio) {
      conteggio.textContent = voci.length + (voci.length === 1 ? " recensione" : " recensioni");
    }
  }

  /* ============================================================
     PORTFOLIO (home)
     ============================================================ */
  function disegnaPortfolio(voci) {
    var binario = document.getElementById("binario-portfolio");
    if (!binario || !voci.length) return;

    voci.sort(perOrdine);
    binario.innerHTML = "";

    voci.forEach(function (p) {
      var card = document.createElement("article");
      card.className = "card-portfolio";
      card.setAttribute("categoria", p.category || "siti");
      card.setAttribute("data-immagine", p.img || "");
      card.setAttribute("data-didascalia", p.title || "");
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", "Apri l'anteprima di " + (p.title || "progetto"));

      var img = document.createElement("img");
      img.src = p.img || "";
      img.alt = p.title || "";
      img.loading = "lazy";

      var corpo = document.createElement("div");
      corpo.className = "corpo-portfolio";

      var titolo = document.createElement("h3");
      titolo.textContent = p.title || "";

      var descrizione = document.createElement("p");
      descrizione.textContent = p.desc || "";

      var tag = document.createElement("span");
      tag.className = "tag-portfolio";
      tag.textContent = p.category === "loghi" ? "Logo" : p.category === "grafica" ? "Grafica" : "Sito Web";

      corpo.appendChild(titolo);
      corpo.appendChild(descrizione);
      corpo.appendChild(tag);

      card.appendChild(img);
      card.appendChild(corpo);
      binario.appendChild(card);
    });

    if (typeof window.__webnixRicaricaPortfolio === "function") {
      window.__webnixRicaricaPortfolio();
    }

    /* miniature della galleria nel popup */
    var galleria = document.querySelector("#popup-lavori .popup-galleria");
    if (galleria) {
      galleria.innerHTML = "";
      voci.forEach(function (p) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "popup-miniatura";
        b.setAttribute("data-immagine", p.img || "");
        b.setAttribute("data-didascalia", p.title || "");
        b.setAttribute("aria-label", "Vedi " + (p.title || "progetto"));

        var img = document.createElement("img");
        img.src = p.img || "";
        img.alt = "Anteprima " + (p.title || "");
        img.loading = "lazy";
        b.appendChild(img);

        b.addEventListener("click", function () {
          if (typeof window.__webnixApriAnteprima === "function") {
            window.__webnixApriAnteprima(p.img, p.title);
          }
        });
        galleria.appendChild(b);
      });
    }
  }

  /* ============================================================
     PORTFOLIO DELLA PAGINA SERVIZI ("I nostri lavori")
     Mostra i progetti con l'interruttore "Mostra in pagina Servizi" attivo.
     ============================================================ */
  function disegnaLavoriServizi(voci) {
    var scena = document.getElementById("sezione-nostri-lavori");
    if (!scena) return;

    var scelti = voci.filter(function (p) {
      return p.mostraServizi === true || p.mostraServizi === "true";
    });
    if (!scelti.length) return;
    scelti.sort(perOrdine);

    var pc = scena.querySelector(".pc-schermo");
    var telefono = scena.querySelector(".telefono-schermo");

    if (pc) {
      pc.innerHTML = "";
      scelti.forEach(function (p, i) {
        var img = document.createElement("img");
        img.className = "schermata" + (i === 0 ? " attiva" : "");
        img.src = p.img || "";
        img.alt = p.title || "";
        img.loading = "lazy";
        pc.appendChild(img);
      });
    }

    if (telefono) {
      telefono.innerHTML = "";
      scelti.slice().reverse().forEach(function (p, i) {
        var img = document.createElement("img");
        img.className = "schermata" + (i === 0 ? " attiva" : "");
        img.src = p.img || "";
        img.alt = p.title || "";
        img.loading = "lazy";
        telefono.appendChild(img);
      });
    }

    /* il popup sta fuori dalla sezione (si apre dove si è cliccato) */
    var galleria = document.querySelector("#popup-lavori .popup-galleria");
    if (galleria) {
      galleria.innerHTML = "";
      scelti.forEach(function (p) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "popup-miniatura";
        b.setAttribute("data-immagine", p.img || "");
        b.setAttribute("data-didascalia", p.title || "");
        b.setAttribute("aria-label", "Vedi " + (p.title || "progetto"));

        var img = document.createElement("img");
        img.src = p.img || "";
        img.alt = "Anteprima " + (p.title || "");
        img.loading = "lazy";
        b.appendChild(img);
        galleria.appendChild(b);
      });
    }

    if (typeof window.__webnixAggiornaLavori === "function") {
      window.__webnixAggiornaLavori();
    }
  }

  /* ============================================================
     PACCHETTI (pagina Servizi)
     ============================================================ */
  /* tutte le anteprime del pacchetto: la principale (img) più le altre
     indicate in dashboard, una per riga nel campo imgs */
  function immaginiPacchetto(p) {
    var elenco = [];
    var principale = typeof p.img === "string" ? p.img.trim() : "";
    if (principale) elenco.push(principale);

    String(typeof p.imgs === "string" ? p.imgs : "").split(/\r?\n/).forEach(function (riga) {
      var src = riga.trim();
      if (src && elenco.indexOf(src) === -1) elenco.push(src);
    });

    return elenco;
  }

  /* anteprima immagine impostata dalla dashboard: se non c'è nessuna
     immagine la card resta com'era. Al click si apre lo stesso popup
     del portfolio, con tutte le anteprime del pacchetto */
  function anteprimaPacchetto(p) {
    var elenco = immaginiPacchetto(p);
    if (!elenco.length) return null;

    var bottone = document.createElement("button");
    bottone.type = "button";
    bottone.className = "pacchetto-anteprima";
    bottone.setAttribute("aria-label", "Apri l'anteprima di " + (p.name || "questo pacchetto"));
    bottone.setAttribute("aria-haspopup", "dialog");

    var img = document.createElement("img");
    img.src = elenco[0];
    img.alt = "Anteprima " + (p.name || "pacchetto");
    img.loading = "lazy";
    bottone.appendChild(img);

    /* ombra che sale dal basso + scritta al passaggio del mouse */
    var ombra = document.createElement("span");
    ombra.className = "pacchetto-anteprima-ombra";
    ombra.setAttribute("aria-hidden", "true");
    bottone.appendChild(ombra);

    var scritta = document.createElement("span");
    scritta.className = "pacchetto-anteprima-testo";
    var icona = document.createElement("i");
    icona.className = "fa-solid fa-expand";
    icona.setAttribute("aria-hidden", "true");
    scritta.appendChild(icona);
    scritta.appendChild(document.createTextNode("Apri l'anteprima"));
    bottone.appendChild(scritta);

    bottone.addEventListener("click", function () {
      if (typeof window.__webnixApriGalleriaPacchetto !== "function") return;
      var voci = elenco.map(function (src, i) {
        var nome = p.name || "Pacchetto";
        return {
          img: src,
          titolo: elenco.length > 1 ? nome + " — " + (i + 1) + " di " + elenco.length : nome
        };
      });
      window.__webnixApriGalleriaPacchetto(voci, voci[0].titolo);
    });

    return bottone;
  }

  function disegnaPacchetti(voci) {
    var griglia = document.getElementById("griglia-lavori");
    if (!griglia || !voci.length) return;

    voci.sort(perOrdine);
    griglia.innerHTML = "";

    voci.forEach(function (p) {
      var card = document.createElement("article");
      card.className = "card-lavoro";
      /* il nome del pacchetto viaggia con il click: il modulo lo mostra e lo invia */
      card.setAttribute("data-pacchetto", p.name || "");

      var anteprima = anteprimaPacchetto(p);
      if (anteprima) card.appendChild(anteprima);

      var titolo = document.createElement("h3");
      titolo.textContent = p.name || "";

      var descrizione = document.createElement("p");
      descrizione.textContent = p.description || "";

      var link = document.createElement("a");
      link.className = "cta-scorrimento";
      /* link vuoto in dashboard = si apre il modulo con il pacchetto scelto */
      if (p.link) {
        link.href = p.link;
        link.target = "_blank";
        link.rel = "noopener";
      } else {
        link.href = "#";
        link.setAttribute("data-webnix-bozza", "bozza");
        link.setAttribute("aria-haspopup", "dialog");
      }
      link.textContent = p.cta || "Richiedi un preventivo";

      card.appendChild(titolo);
      card.appendChild(descrizione);
      card.appendChild(link);
      griglia.appendChild(card);
    });
  }

  /* ============================================================
     PACCHETTI IN HOME (interruttore "Mostra in home")
     ============================================================ */
  function disegnaServiziHome(voci) {
    var griglia = document.getElementById("griglia-servizi");
    if (!griglia) return;

    var scelti = voci.filter(function (p) {
      return p.mostraHome === true || p.mostraHome === "true";
    });
    if (!scelti.length) return;

    scelti.sort(perOrdine);
    griglia.innerHTML = "";

    scelti.forEach(function (p, i) {
      /* stessa card della pagina Servizi (.card-lavoro): targhetta, testo, CTA */
      var card = document.createElement("article");
      card.className = "card-lavoro";
      /* il nome del pacchetto viaggia con il click: il modulo lo mostra e lo invia */
      card.setAttribute("data-pacchetto", p.name || "");
      card.setAttribute("reveal", "");
      card.setAttribute("delay", String((i % 3) + 1));

      var anteprima = anteprimaPacchetto(p);
      if (anteprima) card.appendChild(anteprima);

      var titolo = document.createElement("h3");
      titolo.textContent = p.name || "";

      var descrizione = document.createElement("p");
      descrizione.textContent = p.description || "";

      var link = document.createElement("a");
      link.className = "cta-scorrimento";
      /* link vuoto in dashboard = si apre il modulo con il pacchetto scelto */
      if (p.link) {
        link.href = p.link;
        link.target = "_blank";
        link.rel = "noopener";
      } else {
        link.href = "#";
        link.setAttribute("data-webnix-bozza", "bozza");
        link.setAttribute("aria-haspopup", "dialog");
      }
      link.textContent = p.cta || "Richiedi un preventivo";

      card.appendChild(titolo);
      card.appendChild(descrizione);
      card.appendChild(link);
      griglia.appendChild(card);
    });
  }

  /* ============================================================
     FAQ (pagina FAQ)
     ============================================================ */
  function disegnaFaq(voci) {
    var pista = document.getElementById("rullo-pista");
    if (!pista || !voci.length) return;

    voci.sort(perOrdine);
    pista.innerHTML = "";

    voci.forEach(function (f, posizione) {
      var voce = document.createElement("button");
      voce.type = "button";
      voce.className = "rullo-voce";
      voce.setAttribute("data-risposta", f.answer || "");

      var badge = document.createElement("span");
      badge.className = "rullo-badge";
      badge.textContent = String(posizione + 1).padStart(2, "0");

      var contenitoreIcona = document.createElement("span");
      contenitoreIcona.className = "rullo-icona";
      var icona = document.createElement("i");
      icona.className = f.icon || "fa-solid fa-circle-question";
      icona.setAttribute("aria-hidden", "true");
      contenitoreIcona.appendChild(icona);

      var testo = document.createElement("span");
      testo.className = "rullo-domanda";
      testo.textContent = f.question || "";

      voce.appendChild(badge);
      voce.appendChild(contenitoreIcona);
      voce.appendChild(testo);
      pista.appendChild(voce);
    });

    /* il rullo rilegge le voci appena create e torna sulla prima */
    if (typeof window.webnixRulloRicarica === "function") window.webnixRulloRicarica();
  }

  /* ============================================================
     AVVIO
     ============================================================ */
  function avvia() {
    leggiDocumento("impostazioni/sito")
      .then(function (impostazioni) {
        if (!impostazioni) return;
        applicaColori(impostazioni.colori);
        applicaLink(impostazioni.link);
        if (impostazioni.link) {
          var visibili = impostazioni.link.visibili || {};
          if (canaleAttivo("whatsapp", visibili, impostazioni.link.whatsapp) && impostazioni.link.whatsapp) {
            var soloNumeri = String(impostazioni.link.whatsapp).replace(/[^\d]/g, "");
            if (soloNumeri) numeroWhatsapp = soloNumeri;
          }
          /* tracciamenti spenti: nessuno script e nessun pixel caricato */
          if (canaleAttivo("cookiebot", visibili, impostazioni.link.cookiebot)) {
            caricaCookiebot(impostazioni.link.cookiebot);
          }
          if (canaleAttivo("pixel", visibili, impostazioni.link.pixel)) {
            caricaPixel(impostazioni.link.pixel);
          }
        }
      })
      .catch(function () { /* configurazione non ancora pubblicata */ });

    if (document.getElementById("griglia-recensioni")) {
      leggiCollezione("recensioni").then(function (voci) {
        if (voci.length) {
          disegnaRecensioni(voci);
        } else {
          /* nessuna recensione nel database: niente "Caricamento..." infinito */
          var caricamento = document.getElementById("caricamento-recensioni");
          if (caricamento) caricamento.remove();
        }
      });
    }

    if (document.getElementById("binario-portfolio")) {
      leggiCollezione("portfolio").then(function (voci) {
        if (voci.length) disegnaPortfolio(voci);
      });
    }

    if (document.getElementById("sezione-nostri-lavori")) {
      leggiCollezione("portfolio").then(function (voci) {
        if (voci.length) disegnaLavoriServizi(voci);
      });
    }

    if (document.getElementById("griglia-lavori")) {
      leggiCollezione("pacchetti").then(function (voci) {
        if (voci.length) disegnaPacchetti(voci);
      });
    }

    if (document.getElementById("griglia-servizi")) {
      leggiCollezione("pacchetti").then(function (voci) {
        if (voci.length) disegnaServiziHome(voci);
      });
    }

    if (document.getElementById("rullo-pista")) {
      leggiCollezione("faq").then(function (voci) {
        if (voci.length) disegnaFaq(voci);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", avvia);
  } else {
    avvia();
  }
})();
