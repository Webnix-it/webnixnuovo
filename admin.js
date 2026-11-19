/* ============================================================
   WEBNIX — admin.js
   Dashboard con Google Sign-In + Firestore (Firebase 10, moduli ESM).
   Collezioni: recensioni, portfolio, pacchetti, faq
   Documento:  impostazioni/sito  → { colori, link }
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

var CFG = window.WEBNIX_FIREBASE || {};
var ADMIN_EMAILS = (window.WEBNIX_ADMIN_EMAILS || []).map(function (e) {
  return String(e).toLowerCase();
});

var $ = function (sel) { return document.querySelector(sel); };

var avvisoConfig = $("#avviso-configurazione");
var schermataAccesso = $("#schermata-accesso");
var dashboard = $("#dashboard");
var erroreAccesso = $("#errore-accesso");
var bottoneGoogle = $("#bottone-google");
var bottoneEsci = $("#bottone-esci");
var emailAdmin = $("#email-admin");
var statoEl = $("#stato-salvataggio");

/* ---------------- configurazione ---------------- */
var configurato = Boolean(CFG.apiKey && CFG.projectId && CFG.authDomain && CFG.appId);

if (!configurato) {
  if (avvisoConfig) avvisoConfig.hidden = false;
  if (schermataAccesso) schermataAccesso.hidden = true;
  if (dashboard) dashboard.hidden = true;
} else {
  if (avvisoConfig) avvisoConfig.hidden = true;
  if (schermataAccesso) schermataAccesso.hidden = false;
}

/* ---------------- Firebase ---------------- */
var app = null, auth = null, db = null;

if (configurato) {
  app = initializeApp(CFG);
  auth = getAuth(app);
  db = getFirestore(app);
}

/* ---------------- messaggi di stato ---------------- */
var timerStato = null;
function mostraStato(testo, tipo) {
  if (!statoEl) return;
  statoEl.textContent = testo || "";
  if (tipo) statoEl.setAttribute("data-tipo", tipo);
  else statoEl.removeAttribute("data-tipo");
  statoEl.classList.add("visibile");
  window.clearTimeout(timerStato);
  timerStato = window.setTimeout(function () {
    statoEl.classList.remove("visibile");
  }, 3800);
}
function errore(testo) {
  console.error("[Webnix admin]", testo);
  mostraStato(testo, "errore");
}

/* ============================================================
   SCHEMI DEI CONTENUTI
   ============================================================ */
/* ---------- stelle e date (usate dal modulo e dalle liste) ---------- */
function formattaData(valore) {
  if (!valore) return "";
  var quando;
  if (typeof valore === "number") {
    quando = new Date(valore);
  } else {
    var testo = String(valore);
    var quandoMs = Date.parse(testo.length === 10 ? testo + "T12:00:00" : testo);
    quando = isNaN(quandoMs) ? null : new Date(quandoMs);
  }
  if (!quando || isNaN(quando.getTime())) return "";
  return quando.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

function oggiISO() {
  var ora = new Date();
  var mese = String(ora.getMonth() + 1).padStart(2, "0");
  var giorno = String(ora.getDate()).padStart(2, "0");
  return ora.getFullYear() + "-" + mese + "-" + giorno;
}

function stelleAdmin(n) {
  var quante = Math.max(1, Math.min(5, parseInt(n, 10) || 5));
  var box = document.createElement("span");
  box.className = "stelle-admin";
  box.setAttribute("aria-label", quante + " stelle su 5");
  for (var i = 1; i <= 5; i++) {
    var stella = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    stella.setAttribute("viewBox", "0 0 24 24");
    stella.setAttribute("aria-hidden", "true");
    stella.setAttribute("focusable", "false");
    if (i <= quante) stella.classList.add("attiva");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9L12 2.6z");
    stella.appendChild(path);
    box.appendChild(stella);
  }
  return box;
}

function metaRecensione(d) {
  var box = document.createElement("div");
  box.className = "meta-admin";
  box.appendChild(stelleAdmin(d.stars));
  var quando = formattaData(d.data) || formattaData(d.timestamp ? Number(d.timestamp) : "");
  if (quando) {
    var data = document.createElement("span");
    data.className = "data-admin";
    data.textContent = quando;
    box.appendChild(data);
  }
  return box;
}

var SEZIONI = {
  recensioni: {
    collezione: "recensioni",
    campi: [
      { chiave: "name", etichetta: "Nome cliente", tipo: "text", obbligatorio: true, placeholder: "Es. Mario Rossi" },
      { chiave: "stars", etichetta: "Stelle", tipo: "stelle", valore: 5 },
      { chiave: "data", etichetta: "Data", tipo: "date" },
      { chiave: "url", etichetta: "Link progetto (facoltativo)", tipo: "url", placeholder: "Vuoto = nessun link" },
      { chiave: "text", etichetta: "Testo della recensione", tipo: "textarea", obbligatorio: true, largo: true }
    ],
    nuovi: function () { return { timestamp: Date.now(), ordine: Date.now() }; },
    titolo: function (d) { return d.name || "Senza nome"; },
    sottotitolo: function (d) { return d.text || ""; },
    meta: function (d) { return metaRecensione(d); },
    extra: function (d) { return d.url ? "Link: " + d.url : ""; }
  },

  portfolio: {
    collezione: "portfolio",
    campi: [
      { chiave: "title", etichetta: "Titolo progetto", tipo: "text", obbligatorio: true, placeholder: "Es. Sito web — Vesuvio" },
      {
        chiave: "category", etichetta: "Categoria", tipo: "select", obbligatorio: true, valore: "siti",
        opzioni: [
          { valore: "siti", testo: "Siti web" },
          { valore: "loghi", testo: "Loghi" },
          { valore: "grafica", testo: "Grafica" }
        ]
      },
      { chiave: "img", etichetta: "Immagine (URL o percorso)", tipo: "text", obbligatorio: true, placeholder: "assets/portfolio/progetto.png" },
      { chiave: "link", etichetta: "Link al progetto (facoltativo)", tipo: "url", placeholder: "https://…" },
      { chiave: "desc", etichetta: "Descrizione breve", tipo: "textarea", largo: true }
    ],
    nuovi: function () { return { ordine: Date.now() }; },
    titolo: function (d) { return d.title || "Senza titolo"; },
    sottotitolo: function (d) {
      var nomi = { siti: "Siti web", loghi: "Loghi", grafica: "Grafica" };
      return (nomi[d.category] || d.category || "—") + " · " + (d.desc || "");
    },
    extra: function (d) { return d.link ? "Link: " + d.link : ""; },
    immagine: function (d) { return d.img || ""; }
  },

  pacchetti: {
    collezione: "pacchetti",
    campi: [
      { chiave: "name", etichetta: "Nome pacchetto (targhetta)", tipo: "text", obbligatorio: true, placeholder: "Es. Brand Identity" },
      { chiave: "price", etichetta: "Prezzo", tipo: "text", placeholder: "Es. da 299 €" },
      { chiave: "cta", etichetta: "Testo del bottone", tipo: "text", placeholder: "Richiedi un preventivo" },
      { chiave: "link", etichetta: "Link del bottone (facoltativo)", tipo: "url", placeholder: "Vuoto = link WhatsApp di base" },
      { chiave: "mostraHome", etichetta: "Mostra in home", tipo: "toggle", valore: false, aiuto: "Se attivo, il pacchetto compare tra i servizi della home." },
      { chiave: "description", etichetta: "Descrizione", tipo: "textarea", largo: true }
    ],
    nuovi: function () { return { ordine: Date.now(), cta: "Richiedi un preventivo" }; },
    titolo: function (d) { return d.name || "Senza nome"; },
    sottotitolo: function (d) { return (d.price ? d.price + " · " : "") + (d.description || ""); },
    extra: function (d) {
      var parti = [d.link ? "Bottone: " + (d.cta || "Apri") + " → " + d.link : "Bottone: link WhatsApp di base"];
      if (d.mostraHome === true || d.mostraHome === "true") parti.push("Visibile in home");
      return parti.join(" · ");
    }
  },

  faq: {
    collezione: "faq",
    campi: [
      { chiave: "question", etichetta: "Domanda", tipo: "text", obbligatorio: true, largo: true },
      { chiave: "icon", etichetta: "Icona Font Awesome", tipo: "text", valore: "fa-solid fa-circle-question", placeholder: "fa-solid fa-circle-question" },
      { chiave: "answer", etichetta: "Risposta", tipo: "textarea", obbligatorio: true, largo: true }
    ],
    nuovi: function () { return { ordine: Date.now() }; },
    titolo: function (d) { return d.question || "Senza domanda"; },
    sottotitolo: function (d) { return d.answer || ""; }
  }
};

/* ============================================================
   NAVIGAZIONE
   ============================================================ */
var vociMenu = document.querySelectorAll(".voce-menu");
var pannelli = document.querySelectorAll(".pannello");

function mostraSezione(nome) {
  pannelli.forEach(function (p) {
    p.hidden = p.getAttribute("data-pannello") !== nome;
  });
  vociMenu.forEach(function (v) {
    if (v.getAttribute("data-sezione") === nome) v.setAttribute("aria-current", "page");
    else v.removeAttribute("aria-current");
  });
  try { history.replaceState(null, "", "#" + nome); } catch (e) { /* file:// */ }
}

vociMenu.forEach(function (voce) {
  voce.addEventListener("click", function () {
    mostraSezione(voce.getAttribute("data-sezione"));
  });
});

/* ============================================================
   FORM GENERICI (recensioni, portfolio, pacchetti, faq)
   ============================================================ */
function creaSelettoreStelle(c) {
  var blocco = document.createElement("div");
  blocco.className = "blocco-stelle";

  var etichetta = document.createElement("span");
  etichetta.className = "etichetta-campo";
  etichetta.textContent = c.etichetta;

  var input = document.createElement("input");
  input.type = "hidden";
  input.name = c.chiave;
  input.value = String(c.valore === undefined || c.valore === null ? 5 : c.valore);

  var gruppo = document.createElement("div");
  gruppo.className = "selettore-stelle";
  gruppo.setAttribute("role", "radiogroup");
  gruppo.setAttribute("aria-label", c.etichetta);

  var stelle = [];
  function aggiorna() {
    var quante = Math.max(1, Math.min(5, parseInt(input.value, 10) || 5));
    stelle.forEach(function (bottone, indice) {
      bottone.classList.toggle("attiva", indice < quante);
      bottone.setAttribute("aria-checked", indice + 1 === quante ? "true" : "false");
    });
  }

  for (var i = 1; i <= 5; i++) {
    (function (numero) {
      var bottone = document.createElement("button");
      bottone.type = "button";
      bottone.className = "stella";
      bottone.setAttribute("role", "radio");
      bottone.setAttribute("aria-label", numero + (numero === 1 ? " stella" : " stelle"));
      bottone.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9L12 2.6z"></path></svg>';
      bottone.addEventListener("click", function () {
        input.value = String(numero);
        aggiorna();
      });
      stelle.push(bottone);
      gruppo.appendChild(bottone);
    })(i);
  }

  gruppo.aggiorna = aggiorna;
  aggiorna();

  blocco.appendChild(etichetta);
  blocco.appendChild(input);
  blocco.appendChild(gruppo);
  return blocco;
}

function creaInterruttore(c) {
  var input = document.createElement("input");
  input.type = "checkbox";
  input.name = c.chiave;
  input.checked = Boolean(c.valore);

  var interruttore = document.createElement("span");
  interruttore.className = "interruttore";
  var cursore = document.createElement("span");
  cursore.className = "cursore";
  interruttore.appendChild(input);
  interruttore.appendChild(cursore);

  var testi = document.createElement("span");
  testi.className = "testi-toggle";
  var forte = document.createElement("strong");
  forte.textContent = c.etichetta;
  testi.appendChild(forte);
  if (c.aiuto) {
    var piccolo = document.createElement("small");
    piccolo.textContent = c.aiuto;
    testi.appendChild(piccolo);
  }

  var contenitore = document.createElement("span");
  contenitore.className = "contenitore-toggle";
  contenitore.appendChild(interruttore);
  contenitore.appendChild(testi);
  return contenitore;
}

function creaCampo(c) {
  var label = document.createElement("label");
  label.className = "campo" + (c.largo ? " campo-largo" : "");

  if (c.tipo === "stelle") {
    label.classList.add("campo-stelle");
    label.appendChild(creaSelettoreStelle(c));
    return label;
  }

  if (c.tipo === "toggle") {
    label.classList.add("campo-toggle");
    label.appendChild(creaInterruttore(c));
    return label;
  }

  var span = document.createElement("span");
  span.textContent = c.etichetta;
  label.appendChild(span);

  var input;
  if (c.tipo === "textarea") {
    input = document.createElement("textarea");
  } else if (c.tipo === "select") {
    input = document.createElement("select");
    (c.opzioni || []).forEach(function (o) {
      var opt = document.createElement("option");
      opt.value = o.valore;
      opt.textContent = o.testo;
      input.appendChild(opt);
    });
  } else {
    input = document.createElement("input");
    input.type = c.tipo;
    if (c.min !== undefined) input.min = String(c.min);
    if (c.max !== undefined) input.max = String(c.max);
  }

  input.name = c.chiave;
  if (c.placeholder) input.placeholder = c.placeholder;
  if (c.obbligatorio) input.required = true;
  if (c.tipo === "date") input.value = c.valore ? String(c.valore) : oggiISO();
  else if (c.valore !== undefined && c.valore !== null) input.value = String(c.valore);

  label.appendChild(input);
  return label;
}

function creaForm(chiave) {
  var schema = SEZIONI[chiave];
  var slot = document.getElementById("form-" + chiave);
  if (!slot || !schema) return;

  var form = document.createElement("form");
  form.className = "form-admin";
  form.setAttribute("data-schema", chiave);

  var griglia = document.createElement("div");
  griglia.className = "griglia-campi";
  schema.campi.forEach(function (c) { griglia.appendChild(creaCampo(c)); });
  form.appendChild(griglia);

  var azioni = document.createElement("div");
  azioni.className = "azioni-form";

  var salva = document.createElement("button");
  salva.type = "submit";
  salva.className = "bottone-primario";
  salva.textContent = "Aggiungi";
  azioni.appendChild(salva);

  var annulla = document.createElement("button");
  annulla.type = "button";
  annulla.className = "bottone-secondario";
  annulla.hidden = true;
  annulla.textContent = "Annulla modifica";
  azioni.appendChild(annulla);

  var ripristina = document.createElement("button");
  ripristina.type = "button";
  ripristina.className = "bottone-secondario";
  ripristina.textContent = "Ripristina default";
  ripristina.addEventListener("click", function () { ripristinaSezione(chiave); });
  azioni.appendChild(ripristina);

  form.appendChild(azioni);
  slot.appendChild(form);

  function aggiornaWidget() {
    Array.prototype.forEach.call(form.querySelectorAll(".selettore-stelle"), function (gruppo) {
      if (gruppo.aggiorna) gruppo.aggiorna();
    });
  }

  function svuota() {
    form.reset();
    form.removeAttribute("data-id");
    salva.textContent = "Aggiungi";
    annulla.hidden = true;
    schema.campi.forEach(function (c) {
      var campo = form.elements[c.chiave];
      if (!campo) return;
      if (c.tipo === "toggle") campo.checked = Boolean(c.valore);
      else if (c.tipo === "date") campo.value = c.valore ? String(c.valore) : oggiISO();
      else if (c.valore !== undefined) campo.value = String(c.valore);
    });
    aggiornaWidget();
  }

  form.ripristina = svuota;

  annulla.addEventListener("click", svuota);

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var dati = {};
    schema.campi.forEach(function (c) {
      var campo = form.elements[c.chiave];
      if (c.tipo === "toggle") {
        dati[c.chiave] = Boolean(campo && campo.checked);
        return;
      }
      var valore = campo ? String(campo.value).trim() : "";
      if (c.tipo === "number" && valore !== "") valore = Number(valore);
      dati[c.chiave] = valore;
    });

    if (dati.data) {
      var quando = Date.parse(dati.data + "T12:00:00");
      if (!isNaN(quando)) dati.timestamp = quando;
    }

    var id = form.getAttribute("data-id");
    try {
      if (id) {
        await updateDoc(doc(db, schema.collezione, id), dati);
        mostraStato("Modifica salvata.", "ok");
      } else {
        var nuovo = schema.nuovi ? schema.nuovi() : {};
        Object.keys(nuovo).forEach(function (k) {
          if (dati[k] === undefined || dati[k] === "") dati[k] = nuovo[k];
        });
        await addDoc(collection(db, schema.collezione), dati);
        mostraStato("Contenuto aggiunto.", "ok");
      }
      svuota();
      delete cacheListe[chiave];
      disegnaLista(chiave, true);
    } catch (err) {
      errore("Salvataggio non riuscito: " + (err && err.message ? err.message : err));
    }
  });

  /* usato dal pulsante "Modifica" delle liste */
  form.compila = function (id, dati) {
    schema.campi.forEach(function (c) {
      var campo = form.elements[c.chiave];
      if (!campo) return;
      var valore = dati[c.chiave];
      if (c.tipo === "toggle") {
        campo.checked = valore === true || valore === "true";
        return;
      }
      if (c.tipo === "date") {
        if (valore) campo.value = String(valore).slice(0, 10);
        else if (dati.timestamp) campo.value = new Date(Number(dati.timestamp)).toISOString().slice(0, 10);
        else campo.value = "";
        return;
      }
      campo.value = valore === undefined || valore === null ? "" : String(valore);
    });
    aggiornaWidget();
    form.setAttribute("data-id", id);
    salva.textContent = "Salva modifiche";
    annulla.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

/* ============================================================
   LISTE
   ============================================================ */
function testoBreve(testo, max) {
  var t = String(testo || "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

var cacheListe = {};

function valoreRicerca(chiave) {
  var campo = document.getElementById("ricerca-" + chiave);
  return campo ? campo.value.trim().toLowerCase() : "";
}

async function disegnaLista(chiave, forza) {
  var schema = SEZIONI[chiave];
  var contenitore = document.getElementById("lista-" + chiave);
  if (!schema || !contenitore) return;

  if (!forza && cacheListe[chiave]) {
    disegnaVoci(chiave);
    return;
  }

  contenitore.innerHTML = "";
  var attesa = document.createElement("p");
  attesa.className = "stato-vuoto";
  attesa.textContent = "Caricamento…";
  contenitore.appendChild(attesa);

  try {
    var snap = await getDocs(collection(db, schema.collezione));
    cacheListe[chiave] = snap.docs.map(function (d) {
      var dati = d.data();
      dati.__id = d.id;
      return dati;
    });

    cacheListe[chiave].sort(function (a, b) {
      if (a.ordine && b.ordine) return a.ordine - b.ordine;
      return String(schema.titolo(a)).localeCompare(String(schema.titolo(b)), "it");
    });

    disegnaVoci(chiave);
  } catch (err) {
    contenitore.innerHTML = "";
    var erroreBox = document.createElement("p");
    erroreBox.className = "stato-vuoto";
    erroreBox.textContent = "Impossibile caricare i contenuti. Controlla le regole di Firestore.";
    contenitore.appendChild(erroreBox);
    errore("Lettura " + schema.collezione + ": " + (err && err.message ? err.message : err));
  }
}

function disegnaVoci(chiave) {
  var schema = SEZIONI[chiave];
  var contenitore = document.getElementById("lista-" + chiave);
  if (!schema || !contenitore) return;

  var tutti = cacheListe[chiave] || [];
  var q = valoreRicerca(chiave);
  var elementi = q ? tutti.filter(function (d) {
    return String(schema.titolo(d)).toLowerCase().indexOf(q) !== -1;
  }) : tutti;

  contenitore.innerHTML = "";

  if (!tutti.length) {
    var elementoVuoto = document.createElement("p");
    elementoVuoto.className = "stato-vuoto";
    elementoVuoto.textContent = "Nessun contenuto: aggiungine uno con il modulo qui sopra.";
    contenitore.appendChild(elementoVuoto);
    return;
  }

  if (!elementi.length) {
    var nessunRisultato = document.createElement("p");
    nessunRisultato.className = "stato-vuoto";
    nessunRisultato.textContent = "Nessun risultato per «" + q + "».";
    contenitore.appendChild(nessunRisultato);
    return;
  }

  var form = document.querySelector('form[data-schema="' + chiave + '"]');

    elementi.forEach(function (dati) {
      var voce = document.createElement("article");
      voce.className = "voce-admin";

      var img = schema.immagine ? schema.immagine(dati) : "";
      if (img) {
        var anteprima = document.createElement("img");
        anteprima.className = "anteprima-admin";
        anteprima.src = img;
        anteprima.alt = "";
        anteprima.loading = "lazy";
        voce.appendChild(anteprima);
      }

      var testo = document.createElement("div");
      testo.className = "voce-testo";

      var titolo = document.createElement("strong");
      titolo.textContent = schema.titolo(dati);
      testo.appendChild(titolo);

      if (schema.meta) testo.appendChild(schema.meta(dati));

      var sotto = document.createElement("span");
      sotto.textContent = testoBreve(schema.sottotitolo(dati), 160);
      testo.appendChild(sotto);

      var extra = schema.extra ? schema.extra(dati) : "";
      if (extra) {
        var extraEl = document.createElement("span");
        extraEl.className = "voce-extra";
        extraEl.textContent = testoBreve(extra, 120);
        testo.appendChild(extraEl);
      }
      voce.appendChild(testo);

      var azioni = document.createElement("div");
      azioni.className = "voce-azioni";

      var modifica = document.createElement("button");
      modifica.type = "button";
      modifica.textContent = "Modifica";
      modifica.addEventListener("click", function () {
        if (form && form.compila) form.compila(dati.__id, dati);
      });
      azioni.appendChild(modifica);

      var elimina = document.createElement("button");
      elimina.type = "button";
      elimina.className = "elimina";
      elimina.textContent = "Elimina";
      elimina.addEventListener("click", async function () {
        var conferma = window.confirm("Eliminare definitivamente \u201c" + schema.titolo(dati) + "\u201d?");
        if (!conferma) return;
        try {
          await deleteDoc(doc(db, schema.collezione, dati.__id));
          mostraStato("Elemento eliminato.", "ok");
          delete cacheListe[chiave];
          disegnaLista(chiave, true);
        } catch (err) {
          errore("Eliminazione non riuscita: " + (err && err.message ? err.message : err));
        }
      });
      azioni.appendChild(elimina);

      voce.appendChild(azioni);
      contenitore.appendChild(voce);
    });
}

/* ============================================================
   IMPOSTAZIONI (colori + link)
   ============================================================ */
var formColori = $("#form-colori");
var formLink = $("#form-link");

var COLORI_DEFAULT = { viola: "#e81cff", ciano: "#40c9ff", sfondo: "#0d1117", sfondoCard: "#161b22" };
var LINK_DEFAULT = {
  instagram: "https://www.instagram.com/webnix.it",
  facebook: "",
  tiktok: "",
  whatsapp: "14132259397",
  email: "webnixit@gmail.com",
  cookiebot: "",
  pixel: ""
};

/* pacchetti creati dal pulsante "Ripristina default" della sezione Pacchetti */
var PACCHETTI_DEFAULT = [
  {
    name: "Sito Web Base",
    price: "",
    cta: "Richiedi un preventivo",
    description: "Un sito web essenziale e curato, perfetto anche per la bio di Instagram o Facebook: chi arriva capisce subito cosa fai e come contattarti.",
    mostraHome: true
  },
  {
    name: "Avvio Locale",
    price: "",
    cta: "Richiedi un preventivo",
    description: "Sito web e scheda attività su Google Maps: così chi cerca un'attività come la tua, vicino a te, trova te.",
    mostraHome: true
  },
  {
    name: "Identità & Brand",
    price: "",
    cta: "Richiedi un preventivo",
    description: "Logo, colori e grafiche coordinate per rendere il tuo brand riconoscibile ovunque, online e offline.",
    mostraHome: true
  }
];

function svuotaCampi(form, valori) {
  if (!form) return;
  Object.keys(valori).forEach(function (k) {
    if (form.elements[k]) form.elements[k].value = valori[k];
  });
}

async function creaPacchettiDefault() {
  try {
    var snap = await getDocs(collection(db, "pacchetti"));
    var esistenti = snap.docs.map(function (d) {
      return String((d.data() || {}).name || "").trim().toLowerCase();
    });
    var creati = 0;
    for (var i = 0; i < PACCHETTI_DEFAULT.length; i++) {
      var pacchetto = PACCHETTI_DEFAULT[i];
      if (esistenti.indexOf(pacchetto.name.toLowerCase()) !== -1) continue;
      var dati = Object.assign({ ordine: Date.now() + i }, pacchetto);
      await addDoc(collection(db, "pacchetti"), dati);
      creati++;
    }
    mostraStato(
      creati
        ? creati + (creati === 1 ? " pacchetto di default creato." : " pacchetti di default creati.")
        : "I pacchetti di default sono già presenti.",
      "ok"
    );
    delete cacheListe.pacchetti;
    await disegnaLista("pacchetti", true);
  } catch (err) {
    errore("Creazione pacchetti non riuscita: " + (err && err.message ? err.message : err));
  }
}

function ripristinaSezione(chiave) {
  if (chiave === "colori") {
    if (!window.confirm("Ripristinare i colori di default del sito?")) return;
    svuotaCampi(formColori, COLORI_DEFAULT);
    salvaImpostazioni("colori", Object.assign({}, COLORI_DEFAULT));
    return;
  }

  if (chiave === "link") {
    if (!window.confirm("Ripristinare i link di default del sito?")) return;
    svuotaCampi(formLink, LINK_DEFAULT);
    salvaImpostazioni("link", Object.assign({}, LINK_DEFAULT));
    return;
  }

  var testo = chiave === "pacchetti"
    ? "Ripristinare la sezione Pacchetti? Il modulo torna ai valori iniziali e vengono creati i pacchetti di default mancanti."
    : "Ripristinare il modulo ai valori iniziali?";
  if (!window.confirm(testo)) return;

  var campoRicerca = document.getElementById("ricerca-" + chiave);
  if (campoRicerca) campoRicerca.value = "";

  var form = document.querySelector('form[data-schema="' + chiave + '"]');
  if (form && form.ripristina) form.ripristina();

  if (chiave === "pacchetti") creaPacchettiDefault();
  else disegnaVoci(chiave);
}

async function caricaImpostazioni() {
  try {
    var snap = await getDoc(doc(db, "impostazioni", "sito"));
    if (!snap.exists()) return;
    var dati = snap.data() || {};

    var colori = dati.colori || {};
    if (formColori) {
      ["viola", "ciano", "sfondo", "sfondoCard"].forEach(function (k) {
        if (colori[k] && formColori.elements[k]) formColori.elements[k].value = colori[k];
      });
    }

    var link = dati.link || {};
    if (formLink) {
      ["instagram", "facebook", "tiktok", "whatsapp", "email", "cookiebot", "pixel"].forEach(function (k) {
        if (link[k] && formLink.elements[k]) formLink.elements[k].value = link[k];
      });
    }
  } catch (err) {
    errore("Impostazioni non leggibili: " + (err && err.message ? err.message : err));
  }
}

async function salvaImpostazioni(parte, dati) {
  try {
    var payload = {};
    payload[parte] = dati;
    await setDoc(doc(db, "impostazioni", "sito"), payload, { merge: true });
    mostraStato("Impostazioni salvate.", "ok");
  } catch (err) {
    errore("Salvataggio non riuscito: " + (err && err.message ? err.message : err));
  }
}

function datiForm(form) {
  var dati = {};
  Array.prototype.forEach.call(form.elements, function (campo) {
    if (!campo.name) return;
    dati[campo.name] = String(campo.value).trim();
  });
  return dati;
}

if (formColori) {
  formColori.addEventListener("submit", function (e) {
    e.preventDefault();
    salvaImpostazioni("colori", datiForm(formColori));
  });
}
if (formLink) {
  formLink.addEventListener("submit", function (e) {
    e.preventDefault();
    salvaImpostazioni("link", datiForm(formLink));
  });
}

Array.prototype.forEach.call(document.querySelectorAll("[data-default]"), function (bottone) {
  bottone.addEventListener("click", function () {
    ripristinaSezione(bottone.getAttribute("data-default"));
  });
});

/* ============================================================
   AVVIO DELLA DASHBOARD DOPO IL LOGIN
   ============================================================ */
var inizializzata = false;

async function avviaDashboard(utente) {
  if (inizializzata) return;
  inizializzata = true;

  if (emailAdmin) emailAdmin.textContent = utente.email || "";

  Object.keys(SEZIONI).forEach(function (chiave) {
    creaForm(chiave);
    var campoRicerca = document.getElementById("ricerca-" + chiave);
    if (campoRicerca) {
      campoRicerca.addEventListener("input", function () { disegnaVoci(chiave); });
    }
    disegnaLista(chiave);
  });

  await caricaImpostazioni();

  var sezioneIniziale = (window.location.hash || "").replace("#", "");
  if (sezioneIniziale && SEZIONI[sezioneIniziale]) mostraSezione(sezioneIniziale);
  else if (sezioneIniziale === "colori" || sezioneIniziale === "link") mostraSezione(sezioneIniziale);
  else mostraSezione("recensioni");
}

/* ============================================================
   ACCESSO CON GOOGLE
   ============================================================ */
if (bottoneGoogle) {
  bottoneGoogle.addEventListener("click", async function () {
    if (erroreAccesso) erroreAccesso.textContent = "";
    try {
      var provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (err) {
      var messaggio = err && err.code === "auth/unauthorized-domain"
        ? "Dominio non autorizzato: aggiungilo in Firebase → Authentication → Authorized domains."
        : "Accesso non riuscito: " + (err && err.message ? err.message : err);
      if (erroreAccesso) erroreAccesso.textContent = messaggio;
    }
  });
}

if (bottoneEsci) {
  bottoneEsci.addEventListener("click", function () {
    signOut(auth).catch(function (err) { errore("Uscita non riuscita: " + err.message); });
  });
}

if (auth) {
  onAuthStateChanged(auth, async function (utente) {
    if (!utente) {
      if (schermataAccesso) schermataAccesso.hidden = false;
      if (dashboard) dashboard.hidden = true;
      return;
    }

    var email = String(utente.email || "").toLowerCase();
    if (!ADMIN_EMAILS.length || ADMIN_EMAILS.indexOf(email) === -1) {
      if (erroreAccesso) {
        erroreAccesso.textContent = ADMIN_EMAILS.length
          ? "Account non autorizzato: " + email
          : "Nessun amministratore configurato in firebase-config.js.";
      }
      await signOut(auth);
      return;
    }

    if (schermataAccesso) schermataAccesso.hidden = true;
    if (dashboard) dashboard.hidden = false;
    avviaDashboard(utente);
  });
}
