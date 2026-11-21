/* ============================================================
   WEBNIX — modulo-bozza.js
   Popup unico "Richiedi la tua bozza gratuita".

   - Apre lo stesso modulo da ogni CTA collegata (hero, navbar,
     menu mobile, footer, pacchetti) e da qualsiasi elemento con
     l'attributo data-webnix-bozza.
   - La struttura degli step arriva da Firestore
     (impostazioni/modulo-bozza) e si modifica dalla dashboard.
   - Le richieste vengono salvate in richieste-bozza con stato
     iniziale "Nuova".
   - Le email partono da EmailJS (se configurato) oppure da Formspree.
   - JavaScript puro, nessuna dipendenza.
   ============================================================ */

(function () {
  "use strict";

  var CFG = window.WEBNIX_FIREBASE || {};
  var RADICE =
    "https://firestore.googleapis.com/v1/projects/" +
    encodeURIComponent(CFG.projectId || "") +
    "/databases/(default)/documents";
  var API_KEY = CFG.apiKey || "";
  var ATTIVO = Boolean(API_KEY && CFG.projectId);

  var MAX_FILE = 4 * 1024 * 1024;
  var MAX_ALLEGATI = 4;

  /* ---------- utilità ---------- */
  function copia(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function fondi(base, sopra) {
    if (!sopra || typeof sopra !== "object") return base;
    Object.keys(sopra).forEach(function (k) {
      var v = sopra[k];
      if (v === undefined || v === null) return;
      if (Array.isArray(v)) {
        base[k] = v;
      } else if (typeof v === "object") {
        base[k] = fondi(base[k] && typeof base[k] === "object" ? base[k] : {}, v);
      } else {
        base[k] = v;
      }
    });
    return base;
  }

  function crea(tag, classe, testo) {
    var el = document.createElement(tag);
    if (classe) el.className = classe;
    if (testo !== undefined && testo !== null) el.textContent = testo;
    return el;
  }

  function slug(testo) {
    return String(testo || "file")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "file";
  }

  function formattaPeso(byte) {
    if (byte >= 1024 * 1024) return (byte / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB";
    if (byte >= 1024) return Math.round(byte / 1024) + " KB";
    return byte + " B";
  }

  /* ---------- conversione Firestore REST ---------- */
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
    if ("arrayValue" in v) return ((v.arrayValue && v.arrayValue.values) || []).map(valore);
    return "";
  }

  function documento(doc) {
    var dati = {};
    var campi = (doc && doc.fields) || {};
    Object.keys(campi).forEach(function (k) { dati[k] = valore(campi[k]); });
    return dati;
  }

  /* I campi di caricamento file ("Allega materiale utile" e "Carica il
     tuo logo") sono stati rimossi: se una configurazione salvata li
     contiene ancora, vengono ignorati. */
  var CAMPI_RIMOSSI = ["allegati", "logoFile"];

  function pulisciConfig(config) {
    (config.step || []).forEach(function (s) {
      if (!s || !Array.isArray(s.domande)) return;
      s.domande = s.domande.filter(function (d) {
        return !(d && CAMPI_RIMOSSI.indexOf(d.chiave) !== -1);
      });
    });
    return config;
  }

  function leggiConfig() {
    if (!ATTIVO) return Promise.resolve(copia(window.WEBNIX_MODULO_DEFAULT));
    var url = RADICE + "/impostazioni/modulo-bozza?key=" + encodeURIComponent(API_KEY);
    var controllo = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controllo ? setTimeout(function () { controllo.abort(); }, 7000) : null;
    return fetch(url, controllo ? { signal: controllo.signal } : undefined)
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        return pulisciConfig(fondi(copia(window.WEBNIX_MODULO_DEFAULT), documento(json)));
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        return copia(window.WEBNIX_MODULO_DEFAULT);
      });
  }

  /* ---------- tipi Firestore in scrittura ---------- */
  function tStr(v) { return { stringValue: String(v === undefined || v === null ? "" : v) }; }
  function tInt(v) { return { integerValue: String(Math.round(Number(v) || 0)) }; }
  function tBool(v) { return { booleanValue: Boolean(v) }; }
  function tTime(v) { return { timestampValue: new Date(v).toISOString() }; }
  function tArr(v) { return { arrayValue: { values: v || [] } }; }
  function tMap(v) {
    var campi = {};
    Object.keys(v || {}).forEach(function (k) {
      var x = v[k];
      if (typeof x === "boolean") campi[k] = tBool(x);
      else if (typeof x === "number") campi[k] = tInt(x);
      else campi[k] = tStr(x);
    });
    return { mapValue: { fields: campi } };
  }

  /* ---------- stato ---------- */
  var stato = {
    config: null,
    passi: [],
    indice: 0,
    risposte: {},
    file: {},
    budget: 0,
    budgetDefinito: true,
    inviato: false,
    invio: false,
    provenienza: "",
    fuocoPrecedente: null
  };

  var radice = null;
  var card = null;
  var corpo = null;
  var form = null;
  var bottoneAvanti = null;
  var bottoneIndietro = null;
  var barra = null;
  var passoEl = null;
  var aperto = false;
  var chiusuraInCorso = false;

  /* ============================================================
     COSTRUZIONE DEL POPUP (una sola volta)
     ============================================================ */
  function costruisci() {
    if (radice) return;

    radice = crea("div");
    radice.id = "wb-bozza";
    radice.hidden = true;

    /* gradiente del brand usato dalla casella di consenso animata */
    var defsIcone = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    defsIcone.setAttribute("class", "wb-defs");
    defsIcone.setAttribute("aria-hidden", "true");
    defsIcone.setAttribute("focusable", "false");
    defsIcone.innerHTML =
      '<defs><linearGradient id="wb-brand-grad" x1="0" y1="1" x2="1" y2="0">' +
      '<stop offset="0%" class="wb-stop-a"></stop>' +
      '<stop offset="100%" class="wb-stop-b"></stop>' +
      '</linearGradient></defs>';
    radice.appendChild(defsIcone);

    var sfondo = crea("div", "wb-sfondo");
    sfondo.setAttribute("data-wb-chiudi", "");

    card = crea("div", "wb-card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "wb-titolo");

    /* testata */
    var testa = crea("header", "wb-testa");
    var testi = crea("div", "wb-testa-testi");
    var occhiello = crea("span", "wb-occhiello", "Richiesta bozza");
    var titolo = crea("h2", "", "");
    titolo.id = "wb-titolo";
    var sotto = crea("p", "wb-sottotitolo");
    testi.appendChild(occhiello);
    testi.appendChild(titolo);
    testi.appendChild(sotto);

    var prezzo = crea("span", "wb-prezzo", "0 €");
    prezzo.setAttribute("aria-label", "Costo della bozza: zero euro");

    var chiudi = crea("button", "wb-chiudi");
    chiudi.type = "button";
    chiudi.setAttribute("aria-label", "Chiudi il modulo");
    chiudi.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    chiudi.addEventListener("click", function () { chiudiPopup(); });

    testa.appendChild(testi);
    testa.appendChild(prezzo);
    testa.appendChild(chiudi);

    /* avanzamento */
    var avanzamento = crea("div", "wb-avanzamento");
    var barraBox = crea("div", "wb-barra");
    barra = crea("span", "wb-barra-riempimento");
    barraBox.appendChild(barra);
    passoEl = crea("p", "wb-passo", "STEP 01 / 06");
    avanzamento.appendChild(barraBox);
    avanzamento.appendChild(passoEl);

    /* corpo */
    corpo = crea("div", "wb-corpo");
    form = crea("form", "wb-form");
    form.setAttribute("novalidate", "");
    corpo.appendChild(form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      avanti();
    });

    /* piede */
    var piede = crea("footer", "wb-piede");
    bottoneIndietro = crea("button", "wb-indietro");
    bottoneIndietro.type = "button";
    bottoneIndietro.textContent = "Indietro";
    bottoneIndietro.hidden = true;
    bottoneIndietro.addEventListener("click", function () { indietro(); });

    bottoneAvanti = crea("button", "wb-avanti");
    bottoneAvanti.type = "button";
    bottoneAvanti.textContent = "Continua";
    bottoneAvanti.addEventListener("click", function () { avanti(); });

    piede.appendChild(bottoneIndietro);
    piede.appendChild(bottoneAvanti);

    card.appendChild(testa);
    card.appendChild(avanzamento);
    card.appendChild(corpo);
    card.appendChild(piede);

    radice.appendChild(sfondo);
    radice.appendChild(card);
    document.body.appendChild(radice);

    /* chiusura: sfondo, ESC, focus trap */
    sfondo.addEventListener("click", function () { chiudiPopup(); });
    document.addEventListener("keydown", function (e) {
      if (!aperto) return;
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        chiudiPopup();
        return;
      }
      if (e.key !== "Tab") return;
      var focalizzabili = card.querySelectorAll(
        'button:not([disabled]):not([hidden]), a[href], input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
      );
      if (!focalizzabili.length) return;
      var primo = focalizzabili[0];
      var ultimo = focalizzabili[focalizzabili.length - 1];
      if (e.shiftKey && document.activeElement === primo) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primo.focus();
      }
    });
  }

  function applicaStile() {
    var s = stato.config.stile || {};
    card.style.setProperty("--wb-raggio", (parseInt(s.raggio, 10) || 24) + "px");
    if (s.viola) {
      card.style.setProperty("--viola", s.viola);
      radice.style.setProperty("--viola", s.viola);
    }
    if (s.ciano) {
      card.style.setProperty("--ciano", s.ciano);
      radice.style.setProperty("--ciano", s.ciano);
    }
    if (s.viola && s.ciano) {
      var gradiente = "linear-gradient(-45deg, " + s.viola + " 0%, " + s.ciano + " 100%)";
      card.style.setProperty("--gradiente-brand", gradiente);
      radice.style.setProperty("--gradiente-brand", gradiente);
    }
    if (s.sfondo) {
      var bordo = (s.viola || "#e81cff") + "bf";
      var bordo2 = (s.ciano || "#40c9ff") + "73";
      card.style.background =
        "linear-gradient(160deg, " + s.sfondo + " 0%, #080b11 60%, " + s.sfondo + " 100%) padding-box, " +
        "linear-gradient(135deg, " + bordo + ", " + bordo2 + " 45%, " + bordo + ") border-box";
    }
    if (s.font) {
      card.style.fontFamily = s.font;
    }
    if (s.animazione) {
      card.style.setProperty("--wb-anim", Math.max(120, Math.min(1500, parseInt(s.animazione, 10) || 500)) + "ms");
    }

    card.querySelector("#wb-titolo").textContent = stato.config.titolo || "Richiedi la tua bozza gratuita";
    var sotto = card.querySelector(".wb-sottotitolo");
    sotto.textContent = stato.config.sottotitolo || "";
    sotto.hidden = !sotto.textContent;
    card.querySelector(".wb-prezzo").textContent = stato.config.prezzo || "0 €";
    bottoneIndietro.textContent = stato.config.testoIndietro || "Indietro";
  }

  /* ============================================================
     STEP E DOMANDE
     ============================================================ */
  function preparaPassi() {
    var attivi = (stato.config.step || []).filter(function (s) {
      return s && s.attivo !== false && (s.domande || []).length;
    });
    stato.passi = attivi.concat([{ id: "riepilogo", riepilogo: true, titolo: "Riepilogo", descrizione: "Controlla le risposte prima di inviare." }]);
  }

  function totalePassi() {
    return stato.passi.length;
  }

  function domandaVisibile(d) {
    if (!d.mostraSe) return true;
    var parti = String(d.mostraSe).split("=");
    if (parti.length < 2) return true;
    var chiave = parti[0].trim();
    var atteso = parti.slice(1).join("=").trim().toLowerCase();
    var attuale = stato.risposte[chiave];
    if (Array.isArray(attuale)) {
      return attuale.map(function (x) { return String(x).toLowerCase(); }).indexOf(atteso) !== -1;
    }
    return String(attuale === undefined || attuale === null ? "" : attuale).toLowerCase() === atteso;
  }

  function aggiornaCondizioni() {
    if (!form) return;
    form.querySelectorAll(".wb-domanda[data-mostra]").forEach(function (el) {
      var chiave = el.getAttribute("data-mostra");
      var domanda = trovaDomanda(chiave);
      el.hidden = domanda ? !domandaVisibile(domanda) : false;
    });
  }

  function trovaDomanda(chiave) {
    var trovata = null;
    (stato.config.step || []).forEach(function (s) {
      (s.domande || []).forEach(function (d) {
        if (d.chiave === chiave) trovata = d;
      });
    });
    return trovata;
  }

  function formattaImporto(n) {
    var b = stato.config.budget || {};
    var valuta = b.valuta || "€";
    var numero = Math.round(Number(n) || 0);
    if (valuta === "€") {
      try {
        return new Intl.NumberFormat("it-IT", {
          style: "currency", currency: "EUR", maximumFractionDigits: 0
        }).format(numero);
      } catch (e) { /* fallback sotto */ }
    }
    return numero.toLocaleString("it-IT") + " " + valuta;
  }

  function creaDomanda(d) {
    var blocco = crea("div", "wb-domanda");
    blocco.setAttribute("data-chiave", d.chiave);
    if (d.mostraSe) blocco.setAttribute("data-mostra", d.chiave);

    if (d.tipo === "nota") {
      blocco.appendChild(crea("p", "wb-aiuto", d.testo || ""));
      return blocco;
    }

    if (d.tipo === "budget") {
      blocco.appendChild(creaBudget(d));
      return blocco;
    }

    if (d.tipo === "consenso") {
      var consenso = crea("label", "wb-consenso");
      var check = crea("input");
      check.type = "checkbox";
      check.name = d.chiave;

      /* casella animata: il tratto si disegna con i colori del brand */
      var icona = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icona.setAttribute("class", "wb-consenso-icona");
      icona.setAttribute("viewBox", "0 0 64 64");
      icona.setAttribute("aria-hidden", "true");
      icona.setAttribute("focusable", "false");
      var percorso = document.createElementNS("http://www.w3.org/2000/svg", "path");
      percorso.setAttribute("class", "wb-consenso-path");
      percorso.setAttribute("d", "M 0 16 V 56 A 8 8 90 0 0 8 64 H 56 A 8 8 90 0 0 64 56 V 8 A 8 8 90 0 0 56 0 H 8 A 8 8 90 0 0 0 8 V 16 L 32 48 L 64 16 V 8 A 8 8 90 0 0 56 0 H 8 A 8 8 90 0 0 0 8 V 56 A 8 8 90 0 0 8 64 H 56 A 8 8 90 0 0 64 56 V 16");
      percorso.setAttribute("pathLength", "575.0541381835938");
      icona.appendChild(percorso);

      var testo = crea("span", "wb-consenso-testo");
      testo.textContent = d.etichetta || "";
      if (d.link && d.link.url) {
        testo.appendChild(document.createTextNode(" "));
        var a = crea("a", "", d.link.testo || "Informativa");
        a.href = d.link.url;
        a.target = "_blank";
        a.rel = "noopener";
        testo.appendChild(a);
      }
      consenso.appendChild(check);
      consenso.appendChild(icona);
      consenso.appendChild(testo);

      check.checked = stato.risposte[d.chiave] === true;
      consenso.classList.toggle("wb-attivo", check.checked);
      check.addEventListener("change", function () {
        stato.risposte[d.chiave] = check.checked;
        consenso.classList.toggle("wb-attivo", check.checked);
        consenso.classList.toggle("wb-non-valido", !check.checked && d.obbligatorio);
        if (check.checked) blocco.classList.remove("wb-non-valida");
      });
      blocco.appendChild(consenso);
      blocco.appendChild(crea("span", "wb-errore", "Devi accettare per continuare."));
      return blocco;
    }

    var etichetta = crea("span", "wb-etichetta");
    etichetta.textContent = d.etichetta || "";
    if (d.obbligatorio) {
      var obbligo = crea("span", "wb-obbligo", "*");
      obbligo.setAttribute("aria-hidden", "true");
      etichetta.appendChild(obbligo);
    }
    blocco.appendChild(etichetta);

    switch (d.tipo) {
      case "scelta":
      case "si-no":
      case "multipla":
        blocco.appendChild(creaOpzioni(d));
        break;
      case "file":
        blocco.appendChild(creaFile(d));
        break;
      case "selettore":
        blocco.appendChild(creaSelettore(d));
        break;
      case "testo-lungo":
        blocco.appendChild(creaArea(d));
        break;
      default:
        blocco.appendChild(creaTesto(d));
    }

    if (d.aiuto) blocco.appendChild(crea("span", "wb-aiuto", d.aiuto));
    blocco.appendChild(crea("span", "wb-errore", d.tipo === "email"
      ? "Inserisci un indirizzo email valido."
      : "Compila questo campo per continuare."));
    return blocco;
  }

  function creaTesto(d) {
    var input = crea("input", "wb-campo");
    input.type = d.tipo === "email" ? "email" : "text";
    input.name = d.chiave;
    input.placeholder = d.placeholder || "";
    input.autocomplete = d.tipo === "email" ? "email" : "name";
    input.value = stato.risposte[d.chiave] || "";
    input.addEventListener("input", function () {
      stato.risposte[d.chiave] = input.value;
      input.closest(".wb-domanda").classList.remove("wb-non-valida");
      aggiornaCondizioni();
    });
    return input;
  }

  function creaArea(d) {
    var area = crea("textarea", "wb-area");
    area.name = d.chiave;
    area.placeholder = d.placeholder || "";
    area.value = stato.risposte[d.chiave] || "";
    area.addEventListener("input", function () {
      stato.risposte[d.chiave] = area.value;
      area.closest(".wb-domanda").classList.remove("wb-non-valida");
    });
    return area;
  }

  function creaSelettore(d) {
    var select = crea("select", "wb-select");
    select.name = d.chiave;
    var vuoto = crea("option", "", "Seleziona…");
    vuoto.value = "";
    select.appendChild(vuoto);
    (d.opzioni || []).forEach(function (o) {
      var opt = crea("option", "", o.testo || o.valore);
      opt.value = o.valore;
      select.appendChild(opt);
    });
    select.value = stato.risposte[d.chiave] || "";
    select.addEventListener("change", function () {
      stato.risposte[d.chiave] = select.value;
      select.closest(".wb-domanda").classList.remove("wb-non-valida");
      aggiornaCondizioni();
    });
    return select;
  }

  function creaOpzioni(d) {
    var opzioni = d.opzioni || [];
    if (d.tipo === "si-no" && !opzioni.length) {
      opzioni = [
        { valore: "si", testo: "Sì", icona: "fa-solid fa-check" },
        { valore: "no", testo: "No", icona: "fa-solid fa-xmark" }
      ];
    }
    var multipla = d.tipo === "multipla";
    var box = crea("div", "wb-opzioni");
    if (opzioni.length <= 3) box.setAttribute("data-colonne", "1");

    var attuale = stato.risposte[d.chiave];
    if (multipla && !Array.isArray(attuale)) attuale = [];
    if (!multipla && !attuale && stato.config) attuale = "";

    function sincronizza() {
      box.querySelectorAll(".wb-opzione").forEach(function (b) {
        var v = b.getAttribute("data-valore");
        var scelta = multipla
          ? (stato.risposte[d.chiave] || []).indexOf(v) !== -1
          : stato.risposte[d.chiave] === v;
        b.classList.toggle("wb-scelta", scelta);
        var input = b.querySelector("input");
        if (input) input.checked = scelta;
      });
    }

    opzioni.forEach(function (o) {
      var bottone = crea("label", "wb-opzione");
      bottone.setAttribute("data-valore", o.valore);
      var input = crea("input");
      input.type = multipla ? "checkbox" : "radio";
      input.name = d.chiave;
      input.value = o.valore;
      if (o.icona) {
        var icona = crea("span", "wb-icona");
        icona.innerHTML = '<i class="' + o.icona + '" aria-hidden="true"></i>';
        bottone.appendChild(icona);
      }
      bottone.appendChild(input);
      bottone.appendChild(crea("span", "", o.testo || o.valore));
      bottone.appendChild(crea("span", "wb-segno"));
      bottone.addEventListener("click", function (e) {
        e.preventDefault();
        if (multipla) {
          var lista = Array.isArray(stato.risposte[d.chiave]) ? stato.risposte[d.chiave].slice() : [];
          var pos = lista.indexOf(o.valore);
          if (pos === -1) lista.push(o.valore);
          else lista.splice(pos, 1);
          stato.risposte[d.chiave] = lista;
        } else {
          stato.risposte[d.chiave] = o.valore;
        }
        sincronizza();
        bottone.closest(".wb-domanda").classList.remove("wb-non-valida");
        aggiornaCondizioni();
      });
      box.appendChild(bottone);
    });

    sincronizza();
    return box;
  }

  function creaFile(d) {
    var box = crea("div");
    var drop = crea("label", "wb-drop");
    var input = crea("input");
    input.type = "file";
    input.multiple = Boolean(d.multiplo);
    input.accept = "image/*,.pdf,.doc,.docx,.svg,.zip,.txt";

    var icona = crea("span", "wb-drop-icona");
    icona.innerHTML = '<i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>';
    var testi = crea("span", "wb-drop-testi");
    testi.appendChild(crea("strong", "", "Trascina qui o tocca per caricare"));
    testi.appendChild(crea("small", "", "Foto, documenti o immagini di riferimento"));

    drop.appendChild(input);
    drop.appendChild(icona);
    drop.appendChild(testi);

    var lista = crea("ul", "wb-file-lista");
    var avviso = crea("span", "wb-aiuto");

    function aggiornaLista() {
      lista.innerHTML = "";
      var files = stato.file[d.chiave] || [];
      files.forEach(function (f, i) {
        var li = crea("li", "wb-file");
        li.appendChild(crea("span", "", f.name));
        li.appendChild(crea("small", "", formattaPeso(f.size)));
        var b = crea("button");
        b.type = "button";
        b.setAttribute("aria-label", "Rimuovi " + f.name);
        b.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
        b.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          files.splice(i, 1);
          aggiornaLista();
        });
        li.appendChild(b);
        lista.appendChild(li);
      });
    }

    function aggiungi(fileList) {
      var files = stato.file[d.chiave] || [];
      avviso.textContent = "";
      Array.prototype.forEach.call(fileList, function (f) {
        if (!d.multiplo) files = [];
        if (files.length >= MAX_ALLEGATI) {
          avviso.textContent = "Puoi allegare al massimo " + MAX_ALLEGATI + " file.";
          return;
        }
        if (f.size > MAX_FILE) {
          avviso.textContent = "«" + f.name + "» supera 4 MB: scegli un file più leggero.";
          return;
        }
        files.push(f);
      });
      stato.file[d.chiave] = files;
      aggiornaLista();
    }

    input.addEventListener("change", function () { aggiungi(input.files); input.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault();
        drop.classList.add("wb-sopra");
      });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault();
        drop.classList.remove("wb-sopra");
      });
    });
    drop.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files) aggiungi(e.dataTransfer.files);
    });

    box.appendChild(drop);
    box.appendChild(avviso);
    box.appendChild(lista);
    return box;
  }

  function creaBudget() {
    var b = stato.config.budget || {};
    var min = Number.isFinite(Number(b.min)) ? Number(b.min) : 0;
    var max = Number.isFinite(Number(b.max)) && Number(b.max) > min ? Number(b.max) : 5000;
    var step = Number(b.step) > 0 ? Number(b.step) : 25;
    var valuta = b.valuta || "€";

    if (stato.budget < min) stato.budget = min;

    var box = crea("div", "wb-budget");

    var etichetta = crea("span", "wb-budget-etichetta", "Il tuo budget indicativo");
    var valoreEl = crea("div", "wb-budget-valore");

    var slider = crea("input", "wb-slider");
    slider.type = "range";
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(stato.budget);

    var scala = crea("div", "wb-scale");
    scala.appendChild(crea("span", "", formattaImporto(min)));
    scala.appendChild(crea("span", "", formattaImporto(max) + "+"));

    var preset = crea("div", "wb-preset");
    var valori = (b.preset && b.preset.length ? b.preset : [min, 50, 75, 100, 250, 500, 1000, 2500, 5000, max])
      .map(Number)
      .filter(function (n, i, arr) { return Number.isFinite(n) && arr.indexOf(n) === i; })
      .sort(function (x, y) { return x - y; });

    function aggiorna() {
      var indefinito = !stato.budgetDefinito && b.nonDefinito !== false;
      valoreEl.innerHTML = "";
      if (indefinito) {
        valoreEl.setAttribute("data-indefinito", "si");
        valoreEl.appendChild(document.createTextNode("Non ho ancora definito un budget"));
      } else {
        valoreEl.removeAttribute("data-indefinito");
        valoreEl.appendChild(document.createTextNode(formattaImporto(stato.budget)));
        var piccolo = crea("small", "", "indicativi");
        valoreEl.appendChild(piccolo);
      }
      var percentuale = max > min ? ((stato.budget - min) / (max - min)) * 100 : 0;
      slider.style.setProperty("--wb-riempimento", percentuale + "%");
      slider.value = String(stato.budget);
      slider.disabled = indefinito;
      slider.classList.toggle("wb-spento", indefinito);
      preset.querySelectorAll("button").forEach(function (btn) {
        var nonDef = btn.hasAttribute("data-indefinito");
        btn.setAttribute("aria-pressed", nonDef ? (indefinito ? "true" : "false") : (!indefinito && Number(btn.getAttribute("data-importo")) === stato.budget ? "true" : "false"));
      });
    }

    slider.addEventListener("input", function () {
      stato.budget = Number(slider.value);
      stato.budgetDefinito = true;
      aggiorna();
    });

    valori.forEach(function (n) {
      var btn = crea("button");
      btn.type = "button";
      btn.setAttribute("data-importo", String(n));
      btn.textContent = n >= max ? formattaImporto(n) + "+" : formattaImporto(n);
      btn.addEventListener("click", function () {
        stato.budget = n;
        stato.budgetDefinito = true;
        aggiorna();
      });
      preset.appendChild(btn);
    });

    if (b.nonDefinito !== false) {
      var nonDef = crea("button");
      nonDef.type = "button";
      nonDef.setAttribute("data-indefinito", "");
      nonDef.textContent = "Non ho ancora definito un budget";
      nonDef.addEventListener("click", function () {
        stato.budgetDefinito = false;
        aggiorna();
      });
      preset.appendChild(nonDef);
    }

    box.appendChild(etichetta);
    box.appendChild(valoreEl);
    box.appendChild(slider);
    box.appendChild(scala);
    box.appendChild(preset);
    if (b.testo) box.appendChild(crea("p", "wb-budget-nota", b.testo));
    if (!valuta) box.setAttribute("data-valuta", "€");

    aggiorna();
    return box;
  }

  /* ---------- riepilogo ---------- */
  function testoOpzione(d, valore) {
    var trovata = null;
    (d.opzioni || []).forEach(function (o) {
      if (o && String(o.valore) === String(valore)) trovata = o.testo || o.valore;
    });
    return trovata === null ? String(valore) : trovata;
  }

  function valoreRisposta(d) {
    var v = stato.risposte[d.chiave];
    if (d.tipo === "budget") {
      if (!stato.budgetDefinito && (stato.config.budget || {}).nonDefinito !== false) {
        return "Non ho ancora definito un budget";
      }
      return formattaImporto(stato.budget);
    }
    if (d.tipo === "file") {
      var files = stato.file[d.chiave] || [];
      return files.length ? files.map(function (f) { return f.name; }).join(", ") : "Nessun file";
    }
    if (d.tipo === "consenso") return v === true ? "Acconsentito" : "Non acconsentito";
    if (Array.isArray(v)) {
      return v.length ? v.map(function (x) { return testoOpzione(d, x); }).join(", ") : "—";
    }
    if (v === undefined || v === null || v === "") return "—";
    return testoOpzione(d, v);
  }

  function creaRiepilogo() {
    var box = crea("div", "wb-riepilogo");
    (stato.config.step || []).forEach(function (s, indicePasso) {
      if (!s || s.attivo === false) return;
      (s.domande || []).forEach(function (d) {
        if (!domandaVisibile(d)) return;
        if (d.tipo === "nota") return;
        if (d.tipo === "consenso") return;

        var riga = crea("div", "wb-riga");
        var testi = crea("div", "wb-riga-testi");
        testi.appendChild(crea("small", "", d.etichetta || d.chiave));
        testi.appendChild(crea("strong", "", valoreRisposta(d)));
        riga.appendChild(testi);

        var modifica = crea("button", "", "Modifica");
        modifica.type = "button";
        modifica.addEventListener("click", function () {
          var destinazione = stato.passi.indexOf(s);
          if (destinazione === -1) {
            /* step non attivo: cerco la domanda nel primo passo disponibile */
            destinazione = 0;
          }
          stato.indice = destinazione;
          disegnaPasso("indietro");
        });
        riga.appendChild(modifica);
        box.appendChild(riga);
      });
    });

    var consensi = crea("div", "wb-riga");
    var testiConsensi = crea("div", "wb-riga-testi");
    testiConsensi.appendChild(crea("small", "", "Consensi"));
    testiConsensi.appendChild(crea("strong", "", "Privacy e Termini accettati con data e ora"));
    consensi.appendChild(testiConsensi);
    box.appendChild(consensi);

    return box;
  }

  /* ============================================================
     DISEGNO DEI PASSI
     ============================================================ */
  function disegnaPasso(direzione) {
    var passo = stato.passi[stato.indice];
    if (!passo) return;
    form.innerHTML = "";

    var sezione = crea("section", "wb-step");
    if (direzione === "indietro") sezione.setAttribute("data-direzione", "indietro");

    var titolo = crea("h3", "wb-step-titolo", passo.titolo || "");
    sezione.appendChild(titolo);
    if (passo.descrizione) sezione.appendChild(crea("p", "wb-step-descrizione", passo.descrizione));
    if (stato.indice === 0 && stato.config.testoIntro) {
      sezione.appendChild(crea("p", "wb-intro", stato.config.testoIntro));
    }

    if (passo.riepilogo) {
      sezione.appendChild(creaRiepilogo());
    } else {
      (passo.domande || []).forEach(function (d) {
        sezione.appendChild(creaDomanda(d));
      });
    }

    form.appendChild(sezione);
    aggiornaCondizioni();

    var numero = String(stato.indice + 1).padStart(2, "0");
    var totale = String(totalePassi()).padStart(2, "0");
    passoEl.textContent = "STEP " + numero + " / " + totale;
    barra.style.width = ((stato.indice + 1) / totalePassi() * 100) + "%";

    bottoneIndietro.hidden = stato.indice === 0;
    var ultimo = stato.indice === totalePassi() - 1;
    bottoneAvanti.innerHTML = ultimo
      ? '<span>' + (stato.config.testoFinale || "Invia la richiesta gratuita") + '</span>'
      : '<span>' + (stato.config.testoContinua || "Continua") + '</span><i class="fa-solid fa-arrow-right wb-freccia" aria-hidden="true"></i>';
    bottoneAvanti.disabled = stato.invio;

    corpo.scrollTop = 0;
    titolo.setAttribute("tabindex", "-1");
    try { titolo.focus({ preventScroll: true }); } catch (e) { /* browser vecchi */ }
  }

  /* ---------- validazione ---------- */
  function validaPasso() {
    var passo = stato.passi[stato.indice];
    if (!passo || passo.riepilogo) return true;

    var primoErrore = null;
    (passo.domande || []).forEach(function (d) {
      if (!d.obbligatorio) return;
      if (!domandaVisibile(d)) return;
      var blocco = form.querySelector('.wb-domanda[data-chiave="' + d.chiave + '"]');
      if (!blocco) return;

      var ok = true;
      var v = stato.risposte[d.chiave];

      if (d.tipo === "consenso") {
        ok = v === true;
        var boxConsenso = blocco.querySelector(".wb-consenso");
        if (boxConsenso) boxConsenso.classList.toggle("wb-non-valido", !ok);
      } else if (d.tipo === "file") {
        ok = (stato.file[d.chiave] || []).length > 0;
      } else if (d.tipo === "multipla") {
        ok = Array.isArray(v) && v.length > 0;
      } else if (d.tipo === "budget") {
        ok = true;
      } else {
        var testo = String(v === undefined || v === null ? "" : v).trim();
        ok = testo !== "";
        if (ok && d.tipo === "email") {
          ok = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(testo);
        }
      }

      if (!ok) {
        blocco.classList.add("wb-non-valida");
        if (!primoErrore) primoErrore = blocco;
      } else {
        blocco.classList.remove("wb-non-valida");
      }
    });

    if (primoErrore) {
      primoErrore.scrollIntoView({ behavior: "smooth", block: "center" });
      var campo = primoErrore.querySelector("input, textarea, select");
      if (campo) {
        try { campo.focus({ preventScroll: true }); } catch (e) { /* ignora */ }
      }
      return false;
    }
    return true;
  }

  function avanti() {
    if (stato.invio) return;
    if (!validaPasso()) return;
    if (stato.indice < totalePassi() - 1) {
      stato.indice++;
      disegnaPasso("avanti");
      return;
    }
    invia();
  }

  function indietro() {
    if (stato.indice === 0 || stato.invio) return;
    stato.indice--;
    disegnaPasso("indietro");
  }

  /* ============================================================
     INVIO
     ============================================================ */
  function caricaAllegato(file, cartella) {
    if (!CFG.storageBucket) return Promise.resolve(null);
    var nome = cartella + "/" + Date.now() + "-" + slug(file.name);
    var url = "https://firebasestorage.googleapis.com/v0/b/" +
      encodeURIComponent(CFG.storageBucket) +
      "/o?uploadType=media&name=" + encodeURIComponent(nome);

    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (dati) {
        var percorso = encodeURIComponent(dati.name);
        var token = dati.downloadTokens ? "&token=" + encodeURIComponent(dati.downloadTokens) : "";
        return {
          nome: file.name,
          tipo: file.type || "",
          dimensione: file.size,
          url: "https://firebasestorage.googleapis.com/v0/b/" +
            encodeURIComponent(CFG.storageBucket) + "/o/" + percorso + "?alt=media" + token
        };
      })
      .catch(function () {
        return { nome: file.name, tipo: file.type || "", dimensione: file.size, url: "" };
      });
  }

  function raccogliAllegati() {
    var files = [];
    Object.keys(stato.file).forEach(function (chiave) {
      (stato.file[chiave] || []).forEach(function (f) { files.push({ chiave: chiave, file: f }); });
    });
    var cartella = "richieste-bozza/" + new Date().toISOString().slice(0, 10);
    return Promise.all(files.map(function (voce) {
      return caricaAllegato(voce.file, cartella).then(function (dati) {
        if (dati) dati.campo = voce.chiave;
        return dati;
      });
    })).then(function (lista) {
      return lista.filter(Boolean);
    });
  }

  function compilaRisposte() {
    var risposte = [];
    (stato.config.step || []).forEach(function (s) {
      if (!s || s.attivo === false) return;
      (s.domande || []).forEach(function (d) {
        if (!domandaVisibile(d) || d.tipo === "nota") return;
        risposte.push({
          passo: s.titolo || "",
          domanda: d.etichetta || d.chiave,
          chiave: d.chiave,
          risposta: valoreRisposta(d)
        });
      });
    });
    return risposte;
  }

  function creaInFirestore(campi) {
    var url = RADICE + "/richieste-bozza?key=" + encodeURIComponent(API_KEY);
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: campi })
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  /* ---------- Formspree: invia la richiesta per email ---------- */
  function inviaFormspree(dati) {
    var endpoint = String(((stato.config.notifica || {}).formspree) || "").trim();
    if (!/^https:\/\/formspree\.io\/f\/[a-z0-9]+$/i.test(endpoint)) return Promise.resolve(false);

    var corpo = {
      _subject: "Nuova richiesta bozza — " + (dati.nome || "senza nome") + " (" + dati.riferimento + ")",
      nome: dati.nome || "",
      email: dati.email || "",
      attivita: dati.attivita || "",
      budget: dati.budget || "",
      riferimento: dati.riferimento || "",
      pagina: location.pathname + location.search,
      consensi: testoConsensi(),
      messaggio: testoDettagli()
    };
    if (dati.email) corpo._replyto = dati.email;

    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(corpo)
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return true;
    }).catch(function (err) {
      console.warn("[Webnix modulo] email non inviata", err);
      return false;
    });
  }

  /* ---------- EmailJS: canale principale quando è configurato ---------- */
  function emailjsConfigurato() {
    var c = (stato.config.notifica || {}).emailjs || {};
    return c.attivo !== false &&
      /^service_[a-z0-9]+$/i.test(String(c.serviceId || "").trim()) &&
      /^template_[a-z0-9]+$/i.test(String(c.templateId || "").trim()) &&
      Boolean(String(c.publicKey || "").trim());
  }

  function inviaEmailJS(dati) {
    var c = (stato.config.notifica || {}).emailjs || {};
    var parametri = {
      subject: "Nuova richiesta bozza — " + (dati.nome || "senza nome") + " (" + dati.riferimento + ")",
      to_email: (stato.config.notifica || {}).emailAdmin || "",
      from_name: dati.nome || "",
      reply_to: dati.email || "",
      nome: dati.nome || "",
      email: dati.email || "",
      attivita: dati.attivita || "",
      budget: dati.budget || "",
      riferimento: dati.riferimento || "",
      pagina: location.pathname + location.search,
      consensi: testoConsensi(),
      /* i consensi sono già in {{consensi}}: nel messaggio non si ripetono */
      messaggio: testoRichiesta(dati, true)
    };

    return fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: String(c.serviceId || "").trim(),
        template_id: String(c.templateId || "").trim(),
        user_id: String(c.publicKey || "").trim(),
        template_params: parametri
      })
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return true;
    }).catch(function (err) {
      console.warn("[Webnix modulo] EmailJS non ha inviato", err);
      return false;
    });
  }

  function notificaEmail(dati) {
    if (!emailjsConfigurato()) return inviaFormspree(dati);
    return inviaEmailJS(dati).then(function (ok) {
      return ok ? true : inviaFormspree(dati);
    });
  }

  function notificaWebhook(dati) {
    var webhook = (stato.config.notifica || {}).webhook;
    if (!webhook || !/^https?:\/\//i.test(webhook)) return;
    try {
      fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dati)
      }).catch(function () { /* la richiesta è già salvata */ });
    } catch (e) { /* ignora */ }
  }

  function numeroWhatsapp() {
    var link = document.querySelector('a[href*="wa.me/"]');
    var trovato = link ? String(link.getAttribute("href")).match(/wa\.me\/(\d+)/) : null;
    return trovato ? trovato[1] : "14132259397";
  }

  function copiaTesto(testo) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(testo);
    }
    return new Promise(function (ok, ko) {
      try {
        var area = document.createElement("textarea");
        area.value = testo;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.top = "-1000px";
        area.style.left = "-1000px";
        document.body.appendChild(area);
        area.select();
        var fatto = document.execCommand("copy");
        document.body.removeChild(area);
        if (fatto) ok(); else ko(new Error("copia non disponibile"));
      } catch (e) { ko(e); }
    });
  }

  /* ---------- testi della richiesta ---------- */
  var TITOLI_SEZIONE = {
    dati: "Dati di contatto",
    attivita: "La tua attività",
    progetto: "Il tuo progetto",
    logo: "Logo",
    budget: "Budget indicativo"
  };

  function titoloSezione(s, indice) {
    var id = String(s.id || "").toLowerCase();
    if (TITOLI_SEZIONE[id]) return TITOLI_SEZIONE[id];
    return s.titolo || "Step " + (indice + 1);
  }

  /* risposte raggruppate per step, nell'ordine del modulo */
  function gruppiRisposte() {
    var gruppi = [];
    (stato.config.step || []).forEach(function (s, indice) {
      if (!s || s.attivo === false) return;
      var righe = [];
      (s.domande || []).forEach(function (d) {
        if (!d || d.tipo === "nota" || d.tipo === "consenso") return;
        if (!domandaVisibile(d)) return;
        var valore = valoreRisposta(d);
        if (d.chiave === "attivita" && valore === "Altro" && stato.risposte.attivitaAltro) {
          valore = "Altro: " + stato.risposte.attivitaAltro;
        }
        righe.push({ chiave: d.chiave, etichetta: d.etichetta || d.chiave, valore: valore });
      });
      if (righe.length) gruppi.push({ id: s.id || "", titolo: titoloSezione(s, indice), righe: righe });
    });
    return gruppi;
  }

  /* caselle di consenso usate se la configurazione non ne dichiara nessuna */
  var CONSENSI_BASE = [
    { chiave: "consensoPrivacy", etichetta: "Informativa sulla Privacy Policy" },
    { chiave: "consensoTermini", etichetta: "Termini e Condizioni" },
    { chiave: "consensoMarketing", etichetta: "Aggiornamenti e proposte Webnix" }
  ];

  /* tutte le caselle presenti nel modulo, con il testo mostrato all'utente */
  function vociConsensi() {
    var voci = [];
    var viste = {};
    (stato.config.step || []).forEach(function (s) {
      (s.domande || []).forEach(function (d) {
        if (!d || d.tipo !== "consenso" || !d.chiave || viste[d.chiave]) return;
        viste[d.chiave] = true;
        voci.push({ chiave: d.chiave, etichetta: d.etichetta || d.chiave });
      });
    });
    CONSENSI_BASE.forEach(function (v) {
      if (!viste[v.chiave]) voci.push(v);
    });
    return voci;
  }

  /* una riga per casella: testo completo + «Acconsentito» / «Non acconsentito» */
  function testoConsensi() {
    return vociConsensi().map(function (v) {
      var ok = stato.risposte[v.chiave] === true;
      return "• " + v.etichetta + " — " + (ok ? "Acconsentito" : "Non acconsentito");
    }).join("\n");
  }

  /* solo le risposte del progetto: nome ed email sono già campi separati */
  function testoDettagli() {
    var righe = [];
    gruppiRisposte().forEach(function (g) {
      var dettagli = g.righe.filter(function (r) {
        return r.chiave !== "nome" && r.chiave !== "email";
      });
      if (!dettagli.length) return;
      if (righe.length) righe.push("");
      righe.push(g.titolo.toUpperCase());
      dettagli.forEach(function (r) {
        righe.push("• " + r.etichetta + ": " + r.valore);
      });
    });
    return righe.length ? righe.join("\n") : "Nessun dettaglio inserito.";
  }

  /* testo completo: per la copia include i consensi, per l'email no
     (l'email li mostra a parte, nel parametro {{consensi}}) */
  function testoRichiesta(dati, senzaConsensi) {
    dati = dati || {};
    var righe = ["RICHIESTA BOZZA GRATUITA — WEBNIX"];
    if (dati.riferimento) righe.push("Riferimento: " + dati.riferimento);
    righe.push("Ricevuta il: " + new Date().toLocaleString("it-IT"));
    righe.push("Pagina: " + (dati.pagina || (location.pathname + location.search)));

    gruppiRisposte().forEach(function (g) {
      righe.push("");
      righe.push(g.titolo.toUpperCase());
      g.righe.forEach(function (r) {
        righe.push("• " + r.etichetta + ": " + r.valore);
      });
    });

    if (!senzaConsensi) {
      righe.push("");
      righe.push("CONSENSI");
      righe.push(testoConsensi());
    }
    return righe.join("\n");
  }

  function messaggioWhatsapp() {
    var righe = ["Ciao Webnix! Vorrei la bozza gratuita del mio sito web."];
    var nome = stato.risposte.nome;
    var email = stato.risposte.email;
    if (nome) righe.push("Nome: " + nome);
    if (email) righe.push("Email: " + email);
    if (stato.budgetDefinito) righe.push("Budget indicativo: " + formattaImporto(stato.budget));
    return righe.join("\n");
  }

  function invia() {
    if (stato.invio) return;
    if (!validaPasso()) return;

    stato.invio = true;
    bottoneAvanti.disabled = true;
    bottoneAvanti.innerHTML = '<span>Invio in corso…</span><i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>';
    var errorePrecedente = form.querySelector(".wb-errore-invio");
    if (errorePrecedente) errorePrecedente.remove();

    raccogliAllegati()
      .then(function (allegati) {
        var adesso = Date.now();
        var risposte = compilaRisposte();
        var idLocale = "WB-" + String(adesso).slice(-6);
        var campi = {
          nome: tStr(stato.risposte.nome || ""),
          email: tStr(stato.risposte.email || ""),
          attivita: tStr(stato.risposte.attivita === "Altro" ? (stato.risposte.attivitaAltro || "Altro") : (stato.risposte.attivita || "")),
          budget: tInt(stato.budgetDefinito ? stato.budget : 0),
          budgetDefinito: tBool(stato.budgetDefinito),
          budgetTesto: tStr(stato.budgetDefinito ? formattaImporto(stato.budget) : "Non ho ancora definito un budget"),
          stato: tStr("Nuova"),
          riferimento: tStr(idLocale),
          pagina: tStr(location.pathname + location.search),
          provenienza: tStr(stato.provenienza || "cta"),
          creatoIl: tTime(adesso),
          risposte: tArr(risposte.map(tMap)),
          allegati: tArr(allegati.map(tMap)),
          consensi: tMap({
            privacy: stato.risposte.consensoPrivacy === true,
            privacyIl: new Date(adesso).toISOString(),
            termini: stato.risposte.consensoTermini === true,
            terminiIl: new Date(adesso).toISOString(),
            marketing: stato.risposte.consensoMarketing === true,
            marketingIl: new Date(adesso).toISOString()
          }),
          noteInterne: tStr(""),
          storico: tArr([tMap({ stato: "Nuova", il: new Date(adesso).toISOString(), da: "Modulo sito" })]),
          userAgent: tStr(navigator.userAgent || "")
        };

        var riepilogo = {
          riferimento: idLocale,
          nome: stato.risposte.nome || "",
          email: stato.risposte.email || "",
          attivita: campi.attivita.stringValue,
          budget: campi.budgetTesto.stringValue,
          risposte: risposte,
          allegati: allegati,
          inviatoIl: new Date(adesso).toISOString()
        };

        /* EmailJS (o Formspree) invia l'email anche se Firestore non risponde */
        var invioEmail = notificaEmail(riepilogo);

        if (!ATTIVO) {
          return invioEmail.then(function (emailOk) {
            if (!emailOk) throw new Error("Invio email non riuscito");
            return { name: "formspree/" + idLocale };
          });
        }

        return Promise.all([
          creaInFirestore(campi).then(
            function (risposta) { return { ok: true, risposta: risposta }; },
            function (errore) { return { ok: false, errore: errore }; }
          ),
          invioEmail
        ]).then(function (esiti) {
          var db = esiti[0];
          var emailOk = esiti[1] === true;
          if (!db.ok && !emailOk) throw db.errore || new Error("Invio non riuscito");
          if (db.ok) notificaWebhook(riepilogo);
          return db.ok ? db.risposta : { name: "formspree/" + idLocale };
        });
      })
      .then(function (risposta) {
        mostraSuccesso();
      })
      .catch(function (err) {
        console.error("[Webnix modulo]", err);
        stato.invio = false;
        bottoneAvanti.disabled = false;
        bottoneAvanti.innerHTML = '<span>' + (stato.config.testoFinale || "Invia la richiesta gratuita") + '</span>';

        var box = crea("div", "wb-errore-invio");
        box.appendChild(document.createTextNode(
          "Non siamo riusciti a inviare la richiesta. Riprova tra poco oppure scrivici su "
        ));
        var link = crea("a", "", "WhatsApp");
        link.href = "https://wa.me/" + numeroWhatsapp() + "?text=" + encodeURIComponent(messaggioWhatsapp());
        link.target = "_blank";
        link.rel = "noopener";
        box.appendChild(link);
        box.appendChild(document.createTextNode(": non perdere i dati che hai inserito."));

        var testoErrore = crea("div", "wb-errore-testo");
        while (box.firstChild) testoErrore.appendChild(box.firstChild);

        var copiaBtn = crea("button", "wb-copia");
        copiaBtn.type = "button";
        copiaBtn.setAttribute("aria-label", "Copia tutti i dati e le risposte");
        copiaBtn.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
          '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.6"></rect>' +
          '<path d="M15.6 5.5a2.2 2.2 0 0 0-2.2-2.2H6.3A2.3 2.3 0 0 0 4 5.6v7.1a2.2 2.2 0 0 0 2.2 2.2"></path>' +
          '</svg><span class="wb-copia-tip">Copia tutti i dati e le risposte</span>';
        copiaBtn.addEventListener("click", function () {
          var testo = testoRichiesta();
          var tip = copiaBtn.querySelector(".wb-copia-tip");
          copiaTesto(testo).then(function () {
            copiaBtn.classList.add("wb-copiato");
            if (tip) tip.textContent = "Copiato!";
            setTimeout(function () {
              copiaBtn.classList.remove("wb-copiato");
              if (tip) tip.textContent = "Copia tutti i dati e le risposte";
            }, 2200);
          }).catch(function () {
            console.warn("[Webnix modulo] copia non disponibile");
            if (tip) tip.textContent = "Copia non riuscita";
          });
        });

        box.appendChild(testoErrore);
        box.appendChild(copiaBtn);
        form.querySelector(".wb-step").appendChild(box);
      });
  }

  function mostraSuccesso() {
    stato.inviato = true;
    stato.invio = false;
    card.classList.add("wb-finito");

    corpo.innerHTML = "";
    var box = crea("div", "wb-successo");
    var anello = crea("div", "wb-successo-anello");
    anello.innerHTML =
      '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<defs><linearGradient id="wb-grad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#e81cff"/><stop offset="100%" stop-color="#40c9ff"/>' +
      '</linearGradient></defs>' +
      '<path d="M13 25.5 20.5 33 35 16.5"/></svg>';
    box.appendChild(anello);
    box.appendChild(crea("h3", "", "Richiesta inviata!"));
    box.appendChild(crea("p", "", stato.config.messaggioSuccesso || "Ti ricontattiamo entro 48 ore."));

    var chiudi = crea("button", "wb-avanti", "Chiudi");
    chiudi.type = "button";
    chiudi.addEventListener("click", function () { chiudiPopup(); });
    box.appendChild(chiudi);
    corpo.appendChild(box);

    barra.style.width = "100%";
    passoEl.textContent = "COMPLETATO";
    try { chiudi.focus({ preventScroll: true }); } catch (e) { /* ignora */ }
  }

  /* ============================================================
     APERTURA / CHIUSURA
     ============================================================ */
  function azzera() {
    stato.indice = 0;
    stato.risposte = {};
    stato.file = {};
    stato.budget = Number((stato.config.budget || {}).min) || 0;
    stato.budgetDefinito = true;
    stato.inviato = false;
    stato.invio = false;
    card.classList.remove("wb-finito");
    corpo.innerHTML = "";
    corpo.appendChild(form);
    form.innerHTML = "";
    bottoneAvanti.disabled = false;
  }

  function apri(provenienza) {
    costruisci();
    if (aperto) return;
    if (!stato.config || !stato.passi.length) return;

    stato.provenienza = provenienza || "cta";
    stato.fuocoPrecedente = document.activeElement;
    if (stato.inviato) azzera();

    /* il menu mobile, se aperto, si chiude */
    var drawer = document.getElementById("drawer-mobile");
    if (drawer && drawer.getAttribute("aperto") === "si") {
      var chiudiDrawer = document.getElementById("chiusura-drawer");
      if (chiudiDrawer) chiudiDrawer.click();
    }

    radice.hidden = false;
    aperto = true;
    document.body.classList.add("wb-blocco-scroll");
    disegnaPasso("avanti");
    var primoCampo = card.querySelector(".wb-campo, .wb-opzione, .wb-consenso input");
    var chiudiBtn = card.querySelector(".wb-chiudi");
    try { (primoCampo || chiudiBtn).focus({ preventScroll: true }); } catch (e) { /* ignora */ }
  }

  function chiudiPopup() {
    if (!aperto || chiusuraInCorso) return;
    chiusuraInCorso = true;
    card.classList.add("wb-chiusura");
    window.setTimeout(function () {
      radice.hidden = true;
      aperto = false;
      chiusuraInCorso = false;
      card.classList.remove("wb-chiusura");
      document.body.classList.remove("wb-blocco-scroll");
      if (!stato.inviato) azzera();
      if (stato.fuocoPrecedente && typeof stato.fuocoPrecedente.focus === "function") {
        try { stato.fuocoPrecedente.focus({ preventScroll: true }); } catch (e) { /* ignora */ }
      }
    }, 280);
  }

  /* ============================================================
     PULSANTI COLLEGATI
     ============================================================ */
  function applicaTestoPulsante(el, pulsante) {
    if (!pulsante.testo) return;
    var norme = el.querySelector("#bozza-norme");
    if (norme) { norme.textContent = pulsante.testo; return; }
    var bottoneInterno = el.querySelector("#bottone1-footer");
    if (bottoneInterno) {
      if (bottoneInterno.getAttribute("data-sopra") !== pulsante.testo) {
        bottoneInterno.setAttribute("data-sopra", pulsante.testo);
      }
      return;
    }
    if (el.id === "link-bozza-nav") return;
    if (el.id === "bottone1") {
      el.textContent = pulsante.testo;
    }
  }

  /* Testi dei pulsanti statici (le CTA possono arrivare anche dopo il load). */
  function applicaTestiPulsanti() {
    (stato.config.pulsanti || []).forEach(function (p) {
      if (!p || p.attivo === false || !p.selettore) return;
      var elementi = [];
      try { elementi = document.querySelectorAll(p.selettore); } catch (e) { return; }
      Array.prototype.forEach.call(elementi, function (el) {
        applicaTestoPulsante(el, p);
      });
    });
  }

  /* Trova il pulsante configurato che contiene l'elemento cliccato. */
  function pulsanteDi(el) {
    var pulsanti = (stato.config && stato.config.pulsanti) || [];
    for (var i = 0; i < pulsanti.length; i++) {
      var p = pulsanti[i];
      if (!p || p.attivo === false || !p.selettore) continue;
      try {
        if (el.closest(p.selettore)) return p;
      } catch (err) { /* selettore non valido: ignora */ }
    }
    var generico = el.closest("[data-webnix-bozza]");
    if (generico) return { chiave: generico.getAttribute("data-webnix-bozza") || "cta", tipo: "modulo" };
    return null;
  }

  var delegaPronta = false;

  function collegaPulsanti() {
    applicaTestiPulsanti();
    if (delegaPronta) return;
    delegaPronta = true;

    /* Un solo listener in fase di cattura: funziona anche per le CTA
       generate dal database (pacchetti, portfolio) e per quelle future,
       e blocca gli onclick/href preesistenti dei pulsanti. */
    document.addEventListener("click", function (e) {
      if (!stato.config || !e.target || typeof e.target.closest !== "function") return;
      var el = e.target.closest("a, button, [data-webnix-bozza]");
      if (!el) return;
      var p = pulsanteDi(el);
      if (!p) return;

      if (p.tipo === "link" && p.destinazione) {
        e.preventDefault();
        location.href = p.destinazione;
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      apri(p.chiave || "cta");
    }, true);
  }

  /* ============================================================
     AVVIO
     ============================================================ */
  function avvia() {
    costruisci();

    /* Configurazione di default già in pagina: il popup è utilizzabile
       subito, anche se Firestore risponde in ritardo o non risponde. */
    var base = copia(window.WEBNIX_MODULO_DEFAULT || {});
    if (base && base.step && base.step.length) {
      stato.config = base;
      applicaStile();
      preparaPassi();
      collegaPulsanti();
    }

    /* Poi arriva la versione salvata dalla dashboard. */
    leggiConfig().then(function (config) {
      if (aperto || !config || !config.step || !config.step.length) return;
      stato.config = config;
      applicaStile();
      preparaPassi();
      collegaPulsanti();
    });
  }

  /* il popup è pronto anche per chiamate esterne */
  window.__webnixApriBozza = function (provenienza) {
    if (stato.config) return apri(provenienza);
    leggiConfig().then(function (config) {
      stato.config = config;
      applicaStile();
      preparaPassi();
      collegaPulsanti();
      apri(provenienza);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", avvia);
  } else {
    avvia();
  }
})();
