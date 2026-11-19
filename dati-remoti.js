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
  function applicaLink(link) {
    if (!link || typeof link !== "object") return;

    if (link.instagram) {
      document.querySelectorAll('a[href*="instagram.com"]').forEach(function (a) {
        a.href = link.instagram;
      });
    }
    if (link.facebook) {
      document.querySelectorAll('a[href*="facebook.com"]').forEach(function (a) {
        a.href = link.facebook;
      });
    }
    if (link.tiktok) {
      document.querySelectorAll('a[href*="tiktok.com"]').forEach(function (a) {
        a.href = link.tiktok;
      });
    }
    if (link.whatsapp) {
      var numero = String(link.whatsapp).replace(/[^\d]/g, "");
      if (numero) {
        document.querySelectorAll('a[href*="wa.me/"]').forEach(function (a) {
          a.href = a.href.replace(/wa\.me\/\d+/, "wa.me/" + numero);
        });
      }
    }
    if (link.email) {
      document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
        if (a.getAttribute("href").indexOf("?") !== -1) return; /* conserva l'oggetto precompilato */
        a.href = "mailto:" + link.email;
      });
    }
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

    if (r.timestamp) {
      var data = document.createElement("span");
      data.className = "data-recensione";
      try {
        data.textContent = new Date(Number(r.timestamp)).toLocaleDateString("it-IT", {
          day: "numeric", month: "long", year: "numeric"
        });
      } catch (e) { data.textContent = ""; }
      card.appendChild(data);
    }
    return card;
  }

  function disegnaRecensioni(voci) {
    var griglia = document.getElementById("griglia-recensioni");
    if (!griglia || !voci.length) return;

    var caricamento = document.getElementById("caricamento-recensioni");
    if (caricamento) caricamento.remove();

    voci.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

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
     PACCHETTI (pagina Servizi)
     ============================================================ */
  function disegnaPacchetti(voci) {
    var griglia = document.getElementById("griglia-lavori");
    if (!griglia || !voci.length) return;

    voci.sort(perOrdine);
    griglia.innerHTML = "";

    voci.forEach(function (p) {
      var card = document.createElement("article");
      card.className = "card-lavoro";

      var titolo = document.createElement("h3");
      titolo.textContent = p.name || "";

      var descrizione = document.createElement("p");
      descrizione.textContent = p.description || "";

      var link = document.createElement("a");
      link.className = "cta-scorrimento";
      /* link vuoto in dashboard = link WhatsApp di base */
      link.href = p.link || linkPreventivo(p.name);
      link.target = "_blank";
      link.rel = "noopener";
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
      var card = document.createElement("article");
      card.className = "card-servizio";
      card.setAttribute("reveal", "");
      card.setAttribute("delay", String((i % 3) + 1));

      var intest = document.createElement("div");
      intest.className = "intestazione-servizio";

      var eyebrow = document.createElement("span");
      eyebrow.className = "eyebrow-card-servizio";
      eyebrow.textContent = "Pacchetto";

      var titolo = document.createElement("h3");
      titolo.textContent = p.name || "";

      intest.appendChild(eyebrow);
      intest.appendChild(titolo);
      card.appendChild(intest);

      if (p.price) {
        var prezzo = document.createElement("p");
        prezzo.className = "prezzo-servizio";
        prezzo.textContent = p.price;
        card.appendChild(prezzo);
      }

      if (p.description) {
        var descrizione = document.createElement("p");
        descrizione.className = "descrizione-servizio";
        descrizione.textContent = p.description;
        card.appendChild(descrizione);
      }

      var link = document.createElement("a");
      link.className = "btn_seleziona";
      link.href = p.link || linkPreventivo(p.name);
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = p.cta || "Richiedi un preventivo";
      card.appendChild(link);

      griglia.appendChild(card);
    });
  }

  /* ============================================================
     FAQ (pagina FAQ)
     ============================================================ */
  function disegnaFaq(voci) {
    var pannello = document.getElementById("pannello-faq");
    if (!pannello || !voci.length) return;

    voci.sort(perOrdine);
    pannello.innerHTML = "";

    voci.forEach(function (f) {
      var item = document.createElement("div");
      item.className = "faq-item";

      var domanda = document.createElement("div");
      domanda.className = "faq-question";
      domanda.setAttribute("tabindex", "0");

      var punto = document.createElement("span");
      punto.className = "faq-punto";
      var icona = document.createElement("i");
      icona.className = f.icon || "fa-solid fa-circle-question";
      icona.setAttribute("aria-hidden", "true");
      punto.appendChild(icona);

      var testo = document.createElement("span");
      testo.className = "faq-testo";
      testo.textContent = f.question || "";

      var freccia = document.createElement("i");
      freccia.className = "fas fa-chevron-down faq-icon";
      freccia.setAttribute("aria-hidden", "true");

      domanda.appendChild(punto);
      domanda.appendChild(testo);
      domanda.appendChild(freccia);

      var risposta = document.createElement("div");
      risposta.className = "faq-answer";
      risposta.style.whiteSpace = "pre-line"; /* rispetta gli a capo scritti in dashboard */
      risposta.textContent = f.answer || "";

      function pulsa() {
        item.classList.toggle("aperta");
        item.classList.remove("cliccata");
        void item.offsetWidth;
        item.classList.add("cliccata");
      }
      domanda.addEventListener("click", pulsa);
      domanda.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pulsa();
        }
      });
      item.addEventListener("animationend", function () {
        item.classList.remove("cliccata");
      });

      item.appendChild(domanda);
      item.appendChild(risposta);
      pannello.appendChild(item);
    });

    /* ricerca: gli item sono nuovi, quindi il filtro viene riagganciato qui */
    var campo = document.getElementById("search-input");
    if (campo) {
      campo.addEventListener("input", function () {
        var q = campo.value.trim().toLowerCase();
        pannello.querySelectorAll(".faq-item").forEach(function (item) {
          var ok = !q || item.textContent.toLowerCase().indexOf(q) !== -1;
          item.classList.toggle("nascosta-ricerca", !ok);
          if (q && ok) item.classList.add("aperta");
        });
      });
    }
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
          if (impostazioni.link.whatsapp) {
            var soloNumeri = String(impostazioni.link.whatsapp).replace(/[^\d]/g, "");
            if (soloNumeri) numeroWhatsapp = soloNumeri;
          }
          caricaCookiebot(impostazioni.link.cookiebot);
          caricaPixel(impostazioni.link.pixel);
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

    if (document.getElementById("pannello-faq")) {
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
