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

/* Traduce gli errori Firebase in istruzioni capibili. */
function descriviErrore(err) {
  var codice = err && err.code ? String(err.code) : "";
  var testo = err && err.message ? String(err.message) : String(err || "errore sconosciuto");

  if (codice === "permission-denied" || /insufficient permissions|permission_denied/i.test(testo)) {
    return "permessi Firestore insufficienti. Le regole pubblicate non consentono la scrittura: " +
      "incolla quelle di regole-firebasse.txt in Firebase → Firestore Database → Regole, premi Pubblica " +
      "e controlla che l'account collegato sia webnixit@gmail.com.";
  }
  if (codice === "unauthenticated") {
    return "sessione scaduta: esci e accedi di nuovo con Google.";
  }
  if (codice === "not-found") {
    return "percorso Firestore inesistente: verifica che il database Firestore sia stato creato nella Console Firebase.";
  }
  if (codice === "unavailable") {
    return "Firebase non raggiungibile: controlla la connessione e riprova.";
  }
  return testo;
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
      { chiave: "mostraServizi", etichetta: "Mostra in pagina Servizi", tipo: "toggle", valore: false, aiuto: "Se attivo, il progetto compare in «I nostri lavori» nella pagina Servizi." },
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
      { chiave: "img", etichetta: "Immagine di anteprima principale (URL o percorso)", tipo: "text", placeholder: "assets/pacchetti/sito-web.jpg", aiuto: "Compare sopra il testo della card, sia in home sia nella pagina Servizi. Vuoto = card senza immagine." },
      { chiave: "imgs", etichetta: "Altre immagini di anteprima", tipo: "elenco", largo: true, placeholder: "assets/pacchetti/sito-web-2.jpg", aiuto: "Una riga per immagine: si vedono cliccando l'anteprima della card, nello stesso popup del portfolio. La card continua a mostrare l'immagine principale." },
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
    },
    immagine: function (d) {
      if (d.img) return d.img;
      var righe = String(d.imgs || "").split(/\r?\n/);
      for (var i = 0; i < righe.length; i++) {
        if (righe[i].trim()) return righe[i].trim();
      }
      return "";
    }
  },

  faq: {
    collezione: "faq",
    campi: [
      { chiave: "question", etichetta: "Domanda", tipo: "text", obbligatorio: true, largo: true },
      { chiave: "icon", etichetta: "Icona Font Awesome", tipo: "text", valore: "fa-solid fa-circle-question", placeholder: "fa-solid fa-circle-question", anteprimaIcona: true },
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

/* Elenco di immagini: un input per riga, con il "+" per aggiungerne
   altre. Il valore viaggia come stringa con una riga per immagine,
   cos\u00ec Firestore e il sito continuano a leggerlo allo stesso modo. */
function creaElenco(c) {
  var contenitore = document.createElement("div");
  contenitore.className = "campo-elenco";

  var righe = document.createElement("div");
  righe.className = "elenco-righe";
  contenitore.appendChild(righe);

  var nascosto = document.createElement("input");
  nascosto.type = "hidden";
  nascosto.name = c.chiave;
  contenitore.appendChild(nascosto);

  function aggiorna() {
    var valori = [];
    Array.prototype.forEach.call(righe.querySelectorAll(".elenco-riga input"), function (riga) {
      var valore = String(riga.value || "").trim();
      if (valore) valori.push(valore);
    });
    nascosto.value = valori.join("\n");
  }

  function creaRiga(valore) {
    var riga = document.createElement("div");
    riga.className = "elenco-riga";

    var input = document.createElement("input");
    input.type = "text";
    input.value = valore || "";
    if (c.placeholder) input.placeholder = c.placeholder;
    input.setAttribute("aria-label", c.etichetta);
    input.addEventListener("input", aggiorna);
    riga.appendChild(input);

    var rimuovi = document.createElement("button");
    rimuovi.type = "button";
    rimuovi.className = "elenco-rimuovi";
    rimuovi.title = "Rimuovi questa immagine";
    rimuovi.setAttribute("aria-label", "Rimuovi questa immagine");
    var icona = document.createElement("i");
    icona.className = "fa-solid fa-xmark";
    icona.setAttribute("aria-hidden", "true");
    rimuovi.appendChild(icona);
    rimuovi.addEventListener("click", function () {
      riga.remove();
      if (!righe.querySelector(".elenco-riga")) righe.appendChild(creaRiga(""));
      aggiorna();
    });
    riga.appendChild(rimuovi);

    return riga;
  }

  function imposta(valore) {
    righe.innerHTML = "";
    String(valore === undefined || valore === null ? "" : valore)
      .split(/\r?\n/)
      .forEach(function (riga) {
        if (riga.trim()) righe.appendChild(creaRiga(riga.trim()));
      });
    if (!righe.querySelector(".elenco-riga")) righe.appendChild(creaRiga(""));
    aggiorna();
  }

  var aggiungi = document.createElement("button");
  aggiungi.type = "button";
  aggiungi.className = "elenco-aggiungi";
  var piu = document.createElement("i");
  piu.className = "fa-solid fa-plus";
  piu.setAttribute("aria-hidden", "true");
  aggiungi.appendChild(piu);
  aggiungi.appendChild(document.createTextNode(" Aggiungi immagine"));
  aggiungi.addEventListener("click", function () {
    var riga = creaRiga("");
    righe.appendChild(riga);
    aggiorna();
    var input = riga.querySelector("input");
    if (input) input.focus();
  });
  contenitore.appendChild(aggiungi);

  imposta(c.valore || "");

  /* letti dal modulo (form.elements[chiave]) */
  nascosto.imposta = imposta;
  nascosto.aggiorna = aggiorna;
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

  if (c.tipo === "elenco") {
    var titoloElenco = document.createElement("span");
    titoloElenco.textContent = c.etichetta;
    label.appendChild(titoloElenco);
    label.appendChild(creaElenco(c));
    if (c.aiuto) {
      var aiutoElenco = document.createElement("small");
      aiutoElenco.className = "campo-aiuto";
      aiutoElenco.textContent = c.aiuto;
      label.appendChild(aiutoElenco);
    }
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

  /* Icona Font Awesome: anteprima accanto al campo di testo. */
  if (c.anteprimaIcona) {
    var riga = document.createElement("div");
    riga.className = "riga-icona";

    var anteprima = document.createElement("div");
    anteprima.className = "anteprima-icona";
    var iconaAnteprima = document.createElement("i");
    iconaAnteprima.setAttribute("aria-hidden", "true");
    anteprima.appendChild(iconaAnteprima);

    riga.appendChild(input);
    riga.appendChild(anteprima);
    label.appendChild(riga);

    input.aggiornaAnteprima = function () {
      var classe = String(input.value || "").trim() || "fa-solid fa-circle-question";
      iconaAnteprima.className = classe;
      anteprima.title = classe;
    };
    input.addEventListener("input", input.aggiornaAnteprima);
    input.aggiornaAnteprima();
    return label;
  }

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
      else if (c.tipo === "elenco") {
        if (campo.imposta) campo.imposta(c.valore || "");
      }
      else if (c.tipo === "date") campo.value = c.valore ? String(c.valore) : oggiISO();
      else if (c.valore !== undefined) campo.value = String(c.valore);
      if (campo.aggiornaAnteprima) campo.aggiornaAnteprima();
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
      if (c.tipo === "elenco" && campo && campo.aggiorna) campo.aggiorna();
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
      errore("Salvataggio non riuscito: " + descriviErrore(err));
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
      if (c.tipo === "elenco") {
        if (campo.imposta) campo.imposta(valore === undefined || valore === null ? "" : String(valore));
        return;
      }
      if (c.tipo === "date") {
        if (valore) campo.value = String(valore).slice(0, 10);
        else if (dati.timestamp) campo.value = new Date(Number(dati.timestamp)).toISOString().slice(0, 10);
        else campo.value = "";
        return;
      }
      campo.value = valore === undefined || valore === null ? "" : String(valore);
      if (campo.aggiornaAnteprima) campo.aggiornaAnteprima();
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
    erroreBox.textContent = "Impossibile caricare i contenuti. " + descriviErrore(err);
    contenitore.appendChild(erroreBox);
    errore("Lettura " + schema.collezione + ": " + descriviErrore(err));
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
  video: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
  cookiebot: "",
  pixel: "",
  visibili: {
    instagram: true,
    facebook: true,
    tiktok: true,
    whatsapp: true,
    email: true,
    video: true,
    cookiebot: false,
    pixel: false
  }
};

/* palette pronte: un clic riempie i quattro campi colore */
var PALETTE = [
  {
    nome: "Webnix",
    colori: { viola: "#e81cff", ciano: "#40c9ff", sfondo: "#0d1117", sfondoCard: "#161b22" }
  },
  {
    nome: "Notte elettrica",
    colori: { viola: "#7c3aed", ciano: "#22d3ee", sfondo: "#070b12", sfondoCard: "#101827" }
  },
  {
    nome: "Tramonto",
    colori: { viola: "#ff4d6d", ciano: "#ffb703", sfondo: "#14090f", sfondoCard: "#241018" }
  },
  {
    nome: "Bosco",
    colori: { viola: "#22c55e", ciano: "#a3e635", sfondo: "#08120c", sfondoCard: "#10201a" }
  },
  {
    nome: "Ghiaccio",
    colori: { viola: "#38bdf8", ciano: "#e879f9", sfondo: "#0b1220", sfondoCard: "#141e2e" }
  },
  {
    nome: "Oceano",
    colori: { viola: "#0ea5e9", ciano: "#14b8a6", sfondo: "#04121c", sfondoCard: "#0b1f2e" }
  },
  {
    nome: "Lavanda",
    colori: { viola: "#a78bfa", ciano: "#f0abfc", sfondo: "#0f0a1a", sfondoCard: "#1a1229" }
  },
  {
    nome: "Fuoco",
    colori: { viola: "#f97316", ciano: "#facc15", sfondo: "#140b05", sfondoCard: "#241509" }
  },
  {
    nome: "Rubino",
    colori: { viola: "#e11d48", ciano: "#fb7185", sfondo: "#12060b", sfondoCard: "#241014" }
  },
  {
    nome: "Menta",
    colori: { viola: "#34d399", ciano: "#67e8f9", sfondo: "#05130f", sfondoCard: "#0c211b" }
  },
  {
    nome: "Deserto",
    colori: { viola: "#d97706", ciano: "#fcd34d", sfondo: "#14100a", sfondoCard: "#241a10" }
  },
  {
    nome: "Indaco",
    colori: { viola: "#6366f1", ciano: "#38bdf8", sfondo: "#0a0c1a", sfondoCard: "#141a2e" }
  },
  {
    nome: "Crepuscolo",
    colori: { viola: "#8b5cf6", ciano: "#f472b6", sfondo: "#0d0a16", sfondoCard: "#181226" }
  },
  {
    nome: "Acciaio",
    colori: { viola: "#94a3b8", ciano: "#38bdf8", sfondo: "#0b0f14", sfondoCard: "#151b23" }
  },
  {
    nome: "Ametista",
    colori: { viola: "#c026d3", ciano: "#8b5cf6", sfondo: "#100a14", sfondoCard: "#1c1224" }
  }
];

var CHIAVI_VISIBILI = ["instagram", "facebook", "tiktok", "whatsapp", "email", "video", "cookiebot", "pixel"];

function nomeInterruttore(chiave) {
  return chiave === "cookiebot" || chiave === "pixel" ? "attivo_" + chiave : "mostra_" + chiave;
}

function impostaToggles(visibili, link) {
  if (!formLink) return;
  visibili = visibili || {};
  link = link || {};
  ["instagram", "facebook", "tiktok", "whatsapp", "email", "video"].forEach(function (k) {
    var campo = formLink.elements["mostra_" + k];
    if (campo) campo.checked = visibili[k] !== false;
  });
  var cookie = formLink.elements["attivo_cookiebot"];
  if (cookie) {
    cookie.checked = visibili.cookiebot === undefined ? Boolean(link.cookiebot) : visibili.cookiebot === true;
  }
  var pixel = formLink.elements["attivo_pixel"];
  if (pixel) {
    pixel.checked = visibili.pixel === undefined ? Boolean(link.pixel) : visibili.pixel === true;
  }
}

function datiLink() {
  var dati = {};
  Array.prototype.forEach.call(formLink.elements, function (campo) {
    if (!campo.name) return;
    var nome = campo.name;
    for (var i = 0; i < CHIAVI_VISIBILI.length; i++) {
      if (nome === nomeInterruttore(CHIAVI_VISIBILI[i])) return;
    }
    dati[nome] = String(campo.value).trim();
  });

  var visibili = {};
  CHIAVI_VISIBILI.forEach(function (k) {
    var campo = formLink.elements[nomeInterruttore(k)];
    visibili[k] = campo ? campo.checked : true;
  });
  dati.visibili = visibili;
  return dati;
}

function creaPalette() {
  var box = document.getElementById("palette-colori");
  if (!box || !formColori) return;

  function aggiornaStato() {
    Array.prototype.forEach.call(box.querySelectorAll(".palette"), function (bottone, i) {
      var p = PALETTE[i];
      var uguale = Object.keys(p.colori).every(function (k) {
        var campo = formColori.elements[k];
        return campo && String(campo.value).toLowerCase() === p.colori[k].toLowerCase();
      });
      bottone.setAttribute("aria-pressed", uguale ? "true" : "false");
    });
  }

  box.innerHTML = "";
  PALETTE.forEach(function (p) {
    var bottone = document.createElement("button");
    bottone.type = "button";
    bottone.className = "palette";
    bottone.setAttribute("aria-pressed", "false");
    bottone.setAttribute("aria-label", "Applica la palette " + p.nome);

    var campioni = document.createElement("span");
    campioni.className = "palette-campioni";
    ["viola", "ciano", "sfondo", "sfondoCard"].forEach(function (k) {
      var campione = document.createElement("span");
      campione.style.background = p.colori[k];
      campioni.appendChild(campione);
    });

    var nome = document.createElement("span");
    nome.className = "palette-nome";
    nome.textContent = p.nome;

    bottone.appendChild(campioni);
    bottone.appendChild(nome);
    bottone.addEventListener("click", function () {
      Object.keys(p.colori).forEach(function (k) {
        if (formColori.elements[k]) formColori.elements[k].value = p.colori[k];
      });
      aggiornaStato();
      mostraStato("Palette «" + p.nome + "» caricata: premi Salva colori.", "ok");
    });
    box.appendChild(bottone);
  });

  formColori.addEventListener("input", aggiornaStato);
  aggiornaStato();
}

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
    impostaToggles(LINK_DEFAULT.visibili, LINK_DEFAULT);
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
      ["instagram", "facebook", "tiktok", "whatsapp", "email", "video", "cookiebot", "pixel"].forEach(function (k) {
        if (link[k] && formLink.elements[k]) formLink.elements[k].value = link[k];
      });
      /* video non ancora salvato: mostra il segnaposto usato dalla home,
         così un semplice "Salva link" non lo cancella */
      if (formLink.elements.video && !link.video) {
        formLink.elements.video.value = LINK_DEFAULT.video;
      }
      impostaToggles(link.visibili, link);
    }
  } catch (err) {
    errore("Impostazioni non leggibili: " + descriviErrore(err));
  }
}

async function salvaImpostazioni(parte, dati) {
  try {
    var payload = {};
    payload[parte] = dati;
    await setDoc(doc(db, "impostazioni", "sito"), payload, { merge: true });
    mostraStato("Impostazioni salvate.", "ok");
  } catch (err) {
    errore("Salvataggio non riuscito: " + descriviErrore(err));
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
    salvaImpostazioni("link", datiLink());
  });
}

creaPalette();

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
  initModuloAdmin();

  var sezioneIniziale = (window.location.hash || "").replace("#", "");
  if (sezioneIniziale && SEZIONI[sezioneIniziale]) mostraSezione(sezioneIniziale);
  else if (sezioneIniziale === "colori" || sezioneIniziale === "link" || sezioneIniziale === "modulo") mostraSezione(sezioneIniziale);
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
/* ============================================================
   MODULO RICHIESTA BOZZA — configurazione del popup
   Documento: impostazioni/modulo-bozza
   Il sito legge lo stesso documento a ogni caricamento.
   ============================================================ */
var MODULO_DEFAULT = window.WEBNIX_MODULO_DEFAULT || {};
var configModulo = null;
var moduloAvviato = false;

function clonaModulo(valore) {
  return JSON.parse(JSON.stringify(valore || {}));
}

function fondiModulo(base, sopra) {
  if (!sopra || typeof sopra !== "object") return base;
  Object.keys(sopra).forEach(function (k) {
    var v = sopra[k];
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) base[k] = v;
    else if (typeof v === "object") base[k] = fondiModulo(base[k] && typeof base[k] === "object" ? base[k] : {}, v);
    else base[k] = v;
  });
  return base;
}

function percorsoModulo(obj, sentiero, valore) {
  var parti = String(sentiero).split(".");
  var nodo = obj;
  for (var i = 0; i < parti.length - 1; i++) {
    if (!nodo[parti[i]] || typeof nodo[parti[i]] !== "object") nodo[parti[i]] = {};
    nodo = nodo[parti[i]];
  }
  nodo[parti[parti.length - 1]] = valore;
}

function canaliEmail() {
  var n = (configModulo && configModulo.notifica) || {};
  var canali = [];
  if (String(((n.emailjs || {}).serviceId) || "").trim()) canali.push("EmailJS");
  return canali;
}

/* I campi di caricamento file sono stati rimossi dal modulo. */
var CAMPI_MODULO_RIMOSSI = ["allegati", "logoFile"];

function pulisciModulo(config) {
  (config.step || []).forEach(function (s) {
    if (!s || !Array.isArray(s.domande)) return;
    s.domande = s.domande.filter(function (d) {
      return !(d && CAMPI_MODULO_RIMOSSI.indexOf(d.chiave) !== -1);
    });
  });
  return config;
}

/* ---------- elementi dell'editor ---------- */
function campoEditor(nome, etichetta, valore, tipo, aiuto, onInput) {
  var label = document.createElement("label");
  label.className = "campo" + (tipo === "textarea" ? " campo-largo" : "");
  var span = document.createElement("span");
  span.textContent = etichetta;
  label.appendChild(span);

  var input;
  if (tipo === "textarea") input = document.createElement("textarea");
  else if (tipo === "select") input = document.createElement("select");
  else input = document.createElement("input");
  if (tipo !== "textarea" && tipo !== "select") input.type = tipo || "text";
  input.setAttribute("data-campo", nome);
  input.value = valore === undefined || valore === null ? "" : String(valore);
  if (tipo === "textarea") input.rows = 3;
  if (typeof onInput === "function") {
    input.addEventListener("input", function () { onInput(input.value); });
    input.addEventListener("change", function () { onInput(input.value); });
  }
  label.appendChild(input);

  if (aiuto) {
    var small = document.createElement("small");
    small.className = "aiuto-campo";
    small.textContent = aiuto;
    label.appendChild(small);
  }
  return label;
}

function interruttoreEditor(testo, attivo, onCambia, aiuto) {
  var label = document.createElement("label");
  label.className = "campo-toggle riga-toggle-editor";
  var contenitore = document.createElement("span");
  contenitore.className = "contenitore-toggle";
  var interruttore = document.createElement("span");
  interruttore.className = "interruttore";
  var input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(attivo);
  input.addEventListener("change", function () { onCambia(input.checked); });
  var cursore = document.createElement("span");
  cursore.className = "cursore";
  interruttore.appendChild(input);
  interruttore.appendChild(cursore);

  var testi = document.createElement("span");
  testi.className = "testi-toggle";
  var forte = document.createElement("strong");
  forte.textContent = testo;
  testi.appendChild(forte);
  if (aiuto) {
    var small = document.createElement("small");
    small.textContent = aiuto;
    testi.appendChild(small);
  }

  contenitore.appendChild(interruttore);
  contenitore.appendChild(testi);
  label.appendChild(contenitore);
  return label;
}

function bottoneEditor(testo, classe, onClick) {
  var b = document.createElement("button");
  b.type = "button";
  b.className = classe || "bottone-secondario";
  b.textContent = testo;
  b.addEventListener("click", onClick);
  return b;
}

function bloccoEditor(titolo, aiuto, aperto) {
  var dettagli = document.createElement("details");
  dettagli.className = "blocco-editor";
  dettagli.open = Boolean(aperto);

  var sommario = document.createElement("summary");
  var testi = document.createElement("span");
  testi.className = "testi-blocco-editor";
  var forte = document.createElement("strong");
  forte.textContent = titolo;
  testi.appendChild(forte);
  if (aiuto) {
    var small = document.createElement("small");
    small.textContent = aiuto;
    testi.appendChild(small);
  }
  sommario.appendChild(testi);
  dettagli.appendChild(sommario);

  var corpo = document.createElement("div");
  corpo.className = "corpo-editor";
  dettagli.appendChild(corpo);
  dettagli.__corpo = corpo;
  return dettagli;
}

function aggiungiCampi(corpo, campi) {
  var griglia = document.createElement("div");
  griglia.className = "griglia-campi griglia-modulo";
  campi.forEach(function (c) {
    griglia.appendChild(campoEditor(c[0], c[1], c[2], c[3], c[4], c[5]));
  });
  corpo.appendChild(griglia);
  return griglia;
}

/* ---------- barra di riepilogo ---------- */
function disegnaBarraModulo() {
  var box = document.getElementById("barra-modulo");
  if (!box || !configModulo) return;
  box.innerHTML = "";

  var email = document.createElement("span");
  var canali = canaliEmail();
  email.className = "chip-modulo " + (canali.length ? "ok" : "attenzione");
  email.textContent = canali.length
    ? "Email attive: " + canali.join(" + ")
    : "Nessun canale email configurato";
  box.appendChild(email);

  var numStep = (configModulo.step || []).filter(function (s) { return s.attivo !== false; }).length;
  var step = document.createElement("span");
  step.className = "chip-modulo";
  step.textContent = numStep + (numStep === 1 ? " step attivo" : " step attivi");
  box.appendChild(step);

  var numPulsanti = (configModulo.pulsanti || []).filter(function (p) { return p.attivo !== false; }).length;
  var pulsanti = document.createElement("span");
  pulsanti.className = "chip-modulo";
  pulsanti.textContent = numPulsanti + (numPulsanti === 1 ? " pulsante collegato" : " pulsanti collegati");
  box.appendChild(pulsanti);

  var apri = document.createElement("a");
  apri.className = "chip-modulo chip-link";
  apri.href = "index.html";
  apri.target = "_blank";
  apri.rel = "noopener";
  apri.textContent = "Apri il sito ↗";
  box.appendChild(apri);
}

/* ---------- stato di salvataggio ---------- */
function segnaModifiche() {
  var stato = document.getElementById("stato-modulo");
  if (!stato) return;
  if (stato.classList.contains("in-salvataggio")) return;
  stato.textContent = "Modifiche non salvate";
  stato.classList.add("ha-modifiche");
}

function aggiornaNotaInvio() {
  var nota = document.getElementById("nota-invio");
  if (!nota) return;
  var n = configModulo.notifica || {};
  var ej = n.emailjs || {};
  var canali = canaliEmail();
  var testi = [];

  if (canali.length) {
    testi.push("Le richieste arrivano a " + (n.emailAdmin || "l'email dell'amministratore") +
      " tramite " + canali.join(" + ") + ".");
  } else {
    testi.push("Nessun canale email attivo: compila i dati EmailJS per ricevere le richieste. Finché manca il Service ID le richieste restano solo in archivio, senza email.");
  }

  if (canali.indexOf("EmailJS") === -1 && String(ej.templateId || "").trim()) {
    testi.push("EmailJS è quasi pronto: manca il Service ID (EmailJS → Email Services, es. service_abc123).");
  }
  if (canali.indexOf("EmailJS") !== -1) {
    testi.push("Nel template «" + ej.templateId + "» usa {{messaggio}} per il testo completo della richiesta e {{consensi}} per l'elenco delle caselle con «Acconsentito» o «Non acconsentito»; sono disponibili anche {{nome}}, {{email}}, {{attivita}}, {{budget}}, {{riferimento}}, {{pagina}}, {{subject}}, {{to_email}} e {{reply_to}}. Il modello pronto è in templateemailjs.txt: incollalo in EmailJS e aggiungi il dominio del sito tra gli Allowed origins.");
  }
  nota.textContent = testi.join(" ");
}

/* ---------- editor configurazione ---------- */
function disegnaEditorModulo() {
  var box = document.getElementById("editor-modulo");
  if (!box || !configModulo) return;
  box.innerHTML = "";
  disegnaBarraModulo();

  var form = document.createElement("form");
  form.className = "form-admin form-modulo";
  form.id = "form-modulo";
  form.addEventListener("submit", function (e) { e.preventDefault(); salvaModuloConfig(); });

  var contenuti = bloccoEditor("Contenuti del popup", "Titolo, testi dei pulsanti e messaggio di conferma", true);
  aggiungiCampi(contenuti.__corpo, [
    ["titolo", "Titolo del popup", configModulo.titolo, "text"],
    ["prezzo", "Etichetta del prezzo", configModulo.prezzo, "text", "Es. «Bozza gratuita» o «Gratis»."],
    ["sottotitolo", "Sottotitolo", configModulo.sottotitolo, "textarea"],
    ["testoIntro", "Testo di introduzione (primo step)", configModulo.testoIntro, "textarea"],
    ["testoContinua", "Pulsante «Continua»", configModulo.testoContinua, "text"],
    ["testoIndietro", "Pulsante «Indietro»", configModulo.testoIndietro, "text"],
    ["testoFinale", "Pulsante finale", configModulo.testoFinale, "text"],
    ["messaggioSuccesso", "Messaggio di conferma", configModulo.messaggioSuccesso, "textarea"]
  ]);
  form.appendChild(contenuti);

  var budget = bloccoEditor("Budget", "Selettore interattivo mostrato nel modulo", false);
  aggiungiCampi(budget.__corpo, [
    ["budget.min", "Budget minimo", configModulo.budget.min, "number"],
    ["budget.max", "Budget massimo", configModulo.budget.max, "number"],
    ["budget.step", "Incremento del selettore", configModulo.budget.step, "number"],
    ["budget.valuta", "Valuta", configModulo.budget.valuta, "text"],
    ["budget.preset", "Valori rapidi", (configModulo.budget.preset || []).join(", "), "text", "Separati da virgola, es. 0, 50, 75, 100, 250, 500."],
    ["budget.testo", "Testo informativo del budget", configModulo.budget.testo, "textarea"]
  ]);
  budget.__corpo.appendChild(interruttoreEditor(
    "Il cliente può scegliere «Non ho ancora definito un budget»",
    configModulo.budget.nonDefinito !== false,
    function (v) { configModulo.budget.nonDefinito = v; }
  ));
  form.appendChild(budget);

  var aspetto = bloccoEditor("Aspetto e animazioni", "Colori, forma e tempi del popup", false);
  aggiungiCampi(aspetto.__corpo, [
    ["stile.viola", "Colore primario", configModulo.stile.viola, "color"],
    ["stile.ciano", "Colore secondario", configModulo.stile.ciano, "color"],
    ["stile.sfondo", "Sfondo del popup", configModulo.stile.sfondo, "color"],
    ["stile.raggio", "Arrotondamento (px)", configModulo.stile.raggio, "number"],
    ["stile.animazione", "Durata animazioni (ms)", configModulo.stile.animazione, "number"],
    ["stile.font", "Font (facoltativo)", configModulo.stile.font, "text", "Es. Georgia, serif. Vuoto = font del sito."]
  ]);
  form.appendChild(aspetto);

  var notifiche = bloccoEditor("Invio e notifiche", "EmailJS e webhook", false);
  configModulo.notifica.emailjs = configModulo.notifica.emailjs || {};
  var emailjs = configModulo.notifica.emailjs;
  aggiungiCampi(notifiche.__corpo, [
    ["notifica.emailAdmin", "Email amministratore", configModulo.notifica.emailAdmin, "email"],
    ["notifica.emailjs.serviceId", "EmailJS · Service ID", emailjs.serviceId, "text",
      "EmailJS → Email Services → Service ID (es. service_abc123).",
      function (v) { emailjs.serviceId = v.trim(); aggiornaNotaInvio(); disegnaBarraModulo(); }],
    ["notifica.emailjs.templateId", "EmailJS · Template ID", emailjs.templateId, "text",
      "Es. template_oafiwle.",
      function (v) { emailjs.templateId = v.trim(); aggiornaNotaInvio(); }],
    ["notifica.emailjs.publicKey", "EmailJS · Chiave pubblica", emailjs.publicKey, "text",
      "Account EmailJS → General → Public Key.",
      function (v) { emailjs.publicKey = v.trim(); aggiornaNotaInvio(); }],
    ["notifica.webhook", "Webhook notifica (facoltativo)", configModulo.notifica.webhook, "url",
      "URL che riceve un JSON a ogni richiesta (Zapier, Make, ecc.)."]
  ]);
  var nota = document.createElement("p");
  nota.className = "nota-modulo";
  nota.id = "nota-invio";
  notifiche.__corpo.appendChild(nota);
  notifiche.__corpo.appendChild(interruttoreEditor(
    "Usa EmailJS per inviare le richieste",
    emailjs.attivo !== false,
    function (v) { emailjs.attivo = v; aggiornaNotaInvio(); disegnaBarraModulo(); },
    "Unico canale di invio: senza Service ID, Template ID e chiave pubblica l'email non parte (la richiesta resta in archivio)."
  ));
  notifiche.__corpo.appendChild(interruttoreEditor(
    "Invia email di conferma al cliente",
    configModulo.notifica.emailCliente !== false,
    function (v) { configModulo.notifica.emailCliente = v; }
  ));
  form.appendChild(notifiche);

  box.appendChild(form);

  var gruppoPulsanti = bloccoEditor(
    "Pulsanti collegati al modulo",
    "Dove il popup si apre nel sito",
    false
  );
  gruppoPulsanti.__corpo.classList.add("editor-lista");
  gruppoPulsanti.__corpo.id = "editor-pulsanti";
  box.appendChild(gruppoPulsanti);

  var gruppoStep = bloccoEditor(
    "Step e domande",
    "Pagine del popup, campi e consensi",
    false
  );
  gruppoStep.__corpo.classList.add("editor-lista");
  gruppoStep.__corpo.id = "editor-step";
  box.appendChild(gruppoStep);

  var barra = document.createElement("div");
  barra.className = "barra-salva-modulo";
  var stato = document.createElement("span");
  stato.className = "stato-modulo";
  stato.id = "stato-modulo";
  stato.textContent = "Tutto salvato";
  barra.appendChild(stato);

  var azioni = document.createElement("div");
  azioni.className = "azioni-form azioni-modulo";
  azioni.appendChild(bottoneEditor("Salva configurazione", "bottone-primario", function () {
    salvaModuloConfig();
  }));
  azioni.appendChild(bottoneEditor("Ripristina default", "bottone-secondario", function () {
    if (!window.confirm("Ripristinare il modulo ai valori di default? Verranno persi testi e domande personalizzati.")) return;
    configModulo = clonaModulo(MODULO_DEFAULT);
    disegnaEditorModulo();
    salvaModuloConfig();
  }));
  barra.appendChild(azioni);
  box.appendChild(barra);

  aggiornaNotaInvio();
  disegnaEditorPulsanti();
  disegnaEditorStep();
}

/* ---------- pulsanti collegati ---------- */
function disegnaEditorPulsanti() {
  var box = document.getElementById("editor-pulsanti");
  if (!box || !configModulo) return;
  box.innerHTML = "";

  if (!(configModulo.pulsanti || []).length) {
    var vuoto = document.createElement("p");
    vuoto.className = "stato-vuoto";
    vuoto.textContent = "Nessun pulsante collegato: il popup si apre solo dal menu del sito.";
    box.appendChild(vuoto);
  }

  (configModulo.pulsanti || []).forEach(function (p, i) {
    var riga = document.createElement("div");
    riga.className = "editor-pulsante";

    var testi = document.createElement("div");
    testi.className = "editor-pulsante-testi";
    testi.appendChild(campoEditor("pulsante.testo." + i, "Testo del pulsante", p.testo, "text", "", function (v) { p.testo = v; }));

    var tipo = document.createElement("label");
    tipo.className = "campo";
    var spanTipo = document.createElement("span");
    spanTipo.textContent = "Azione";
    var select = document.createElement("select");
    [["modulo", "Apre il modulo"], ["link", "Porta a un'altra destinazione"]].forEach(function (o) {
      var opt = document.createElement("option");
      opt.value = o[0];
      opt.textContent = o[1];
      select.appendChild(opt);
    });
    select.value = p.tipo === "link" ? "link" : "modulo";
    select.addEventListener("change", function () { p.tipo = select.value; });
    tipo.appendChild(spanTipo);
    tipo.appendChild(select);
    testi.appendChild(tipo);

    testi.appendChild(campoEditor("pulsante.destinazione." + i, "Destinazione (per «link»)", p.destinazione, "text", "Es. chi-siamo.html#infoContactsSection", function (v) { p.destinazione = v; }));
    testi.appendChild(campoEditor("pulsante.selettore." + i, "Selettore CSS", p.selettore, "text", "Avanzato: dove applicare il pulsante nel sito.", function (v) { p.selettore = v.trim(); }));

    var azioni = document.createElement("div");
    azioni.className = "editor-pulsante-azioni";
    azioni.appendChild(interruttoreEditor("Attivo nel sito", p.attivo !== false, function (v) {
      p.attivo = v;
      disegnaBarraModulo();
    }));

    azioni.appendChild(bottoneEditor("Elimina", "elimina", function () {
      configModulo.pulsanti.splice(i, 1);
      disegnaEditorPulsanti();
      disegnaBarraModulo();
      segnaModifiche();
    }));

    riga.appendChild(testi);
    riga.appendChild(azioni);
    box.appendChild(riga);
  });

  box.appendChild(bottoneEditor("+ Aggiungi pulsante", "bottone-secondario", function () {
    configModulo.pulsanti = configModulo.pulsanti || [];
    configModulo.pulsanti.push({
      chiave: "cta" + Date.now(),
      testo: "Richiedi la tua bozza",
      tipo: "modulo",
      destinazione: "",
      attivo: true,
      selettore: ""
    });
    disegnaEditorPulsanti();
    disegnaBarraModulo();
    segnaModifiche();
  }));
}

/* ---------- step e domande ---------- */
function disegnaEditorStep() {
  var box = document.getElementById("editor-step");
  if (!box || !configModulo) return;
  box.innerHTML = "";

  if (!(configModulo.step || []).length) {
    var vuoto = document.createElement("p");
    vuoto.className = "stato-vuoto";
    vuoto.textContent = "Nessuno step: aggiungine uno per far comparire il modulo.";
    box.appendChild(vuoto);
  }

  (configModulo.step || []).forEach(function (s, i) {
    var blocco = document.createElement("details");
    blocco.className = "editor-step";
    if (i === 0) blocco.open = true;

    var sommario = document.createElement("summary");
    var numDomande = (s.domande || []).length;
    sommario.textContent = "Step " + (i + 1) + " · " + (s.titolo || "Senza titolo") +
      " (" + numDomande + (numDomande === 1 ? " domanda" : " domande") + ")";
    blocco.appendChild(sommario);

    var corpo = document.createElement("div");
    corpo.className = "editor-step-corpo";
    corpo.appendChild(campoEditor("step.titolo." + i, "Titolo dello step", s.titolo, "text", "", function (v) { s.titolo = v; }));
    corpo.appendChild(campoEditor("step.descrizione." + i, "Descrizione", s.descrizione, "textarea", "", function (v) { s.descrizione = v; }));

    var rigaAzioni = document.createElement("div");
    rigaAzioni.className = "editor-step-azioni";
    rigaAzioni.appendChild(interruttoreEditor("Step attivo", s.attivo !== false, function (v) {
      s.attivo = v;
      disegnaBarraModulo();
    }));

    rigaAzioni.appendChild(bottoneEditor("Sposta su", "bottone-secondario", function () {
      if (i === 0) return;
      var tmp = configModulo.step[i - 1];
      configModulo.step[i - 1] = configModulo.step[i];
      configModulo.step[i] = tmp;
      disegnaEditorStep();
      segnaModifiche();
    }));
    rigaAzioni.appendChild(bottoneEditor("Sposta giù", "bottone-secondario", function () {
      if (i === configModulo.step.length - 1) return;
      var tmp = configModulo.step[i + 1];
      configModulo.step[i + 1] = configModulo.step[i];
      configModulo.step[i] = tmp;
      disegnaEditorStep();
      segnaModifiche();
    }));
    rigaAzioni.appendChild(bottoneEditor("Elimina step", "elimina", function () {
      if (!window.confirm("Eliminare questo step e tutte le sue domande?")) return;
      configModulo.step.splice(i, 1);
      disegnaEditorStep();
      disegnaBarraModulo();
      segnaModifiche();
    }));
    corpo.appendChild(rigaAzioni);

    var domande = document.createElement("div");
    domande.className = "editor-domande";
    (s.domande || []).forEach(function (d, j) {
      domande.appendChild(creaEditorDomanda(s, d, i, j));
    });
    corpo.appendChild(domande);

    corpo.appendChild(bottoneEditor("+ Aggiungi domanda", "bottone-secondario", function () {
      s.domande = s.domande || [];
      s.domande.push({
        chiave: "domanda" + Date.now(),
        etichetta: "Nuova domanda",
        tipo: "testo",
        obbligatorio: false,
        placeholder: "",
        aiuto: "",
        opzioni: []
      });
      disegnaEditorStep();
      segnaModifiche();
    }));

    blocco.appendChild(corpo);
    box.appendChild(blocco);
  });

  box.appendChild(bottoneEditor("+ Aggiungi step", "bottone-secondario", function () {
    configModulo.step = configModulo.step || [];
    configModulo.step.push({
      id: "step" + Date.now(),
      titolo: "Nuovo step",
      descrizione: "",
      attivo: true,
      domande: []
    });
    disegnaEditorStep();
    disegnaBarraModulo();
    segnaModifiche();
  }));
}

function creaEditorDomanda(step, domanda, i, j) {
  var riga = document.createElement("div");
  riga.className = "editor-domanda";

  var testa = document.createElement("div");
  testa.className = "editor-domanda-testa";

  var tipo = document.createElement("select");
  [
    ["testo", "Testo"],
    ["testo-lungo", "Testo lungo"],
    ["email", "Email"],
    ["scelta", "Scelta singola"],
    ["multipla", "Scelta multipla"],
    ["si-no", "Sì / No"],
    ["selettore", "Selettore"],
    ["file", "Caricamento file"],
    ["budget", "Budget"],
    ["consenso", "Checkbox"],
    ["nota", "Nota informativa"]
  ].forEach(function (o) {
    var opt = document.createElement("option");
    opt.value = o[0];
    opt.textContent = o[1];
    tipo.appendChild(opt);
  });
  tipo.value = domanda.tipo || "testo";
  testa.appendChild(tipo);

  var etichetta = document.createElement("input");
  etichetta.type = "text";
  etichetta.className = "editor-etichetta-domanda";
  etichetta.value = domanda.etichetta || domanda.testo || "";
  etichetta.placeholder = "Etichetta della domanda";
  testa.appendChild(etichetta);

  riga.appendChild(testa);

  var corpo = document.createElement("div");
  corpo.className = "editor-domanda-corpo";
  corpo.hidden = true;

  var chiave = document.createElement("input");
  chiave.type = "text";
  chiave.value = domanda.chiave || "";
  chiave.placeholder = "chiave_univoca";
  chiave.className = "editor-chiave";
  chiave.addEventListener("input", function () { domanda.chiave = chiave.value.trim(); });
  corpo.appendChild(chiave);

  var obbligatorio = document.createElement("label");
  obbligatorio.className = "editor-check";
  var check = document.createElement("input");
  check.type = "checkbox";
  check.checked = domanda.obbligatorio === true;
  check.addEventListener("change", function () { domanda.obbligatorio = check.checked; });
  obbligatorio.appendChild(check);
  obbligatorio.appendChild(document.createTextNode("Obbligatoria"));
  corpo.appendChild(obbligatorio);

  var opzioni = document.createElement("textarea");
  opzioni.placeholder = "Una opzione per riga: valore | testo | icona";
  opzioni.value = (domanda.opzioni || []).map(function (o) {
    return [o.valore, o.testo, o.icona].filter(Boolean).join(" | ");
  }).join("\n");
  opzioni.className = "editor-opzioni";
  opzioni.addEventListener("input", function () {
    domanda.opzioni = opzioni.value.split("\n").map(function (linea) {
      var parti = linea.split("|").map(function (x) { return x.trim(); });
      if (!parti[0]) return null;
      return { valore: parti[0], testo: parti[1] || parti[0], icona: parti[2] || "" };
    }).filter(Boolean);
  });
  corpo.appendChild(opzioni);

  var placeholder = document.createElement("input");
  placeholder.type = "text";
  placeholder.value = domanda.placeholder || "";
  placeholder.placeholder = "Testo suggerito nel campo";
  placeholder.addEventListener("input", function () { domanda.placeholder = placeholder.value; });
  corpo.appendChild(placeholder);

  var aiuto = document.createElement("input");
  aiuto.type = "text";
  aiuto.value = domanda.aiuto || "";
  aiuto.placeholder = "Testo di aiuto sotto il campo";
  aiuto.addEventListener("input", function () { domanda.aiuto = aiuto.value; });
  corpo.appendChild(aiuto);

  var mostraSe = document.createElement("input");
  mostraSe.type = "text";
  mostraSe.value = domanda.mostraSe || "";
  mostraSe.placeholder = "Mostra se: chiave=valore (es. attivita=Altro)";
  mostraSe.addEventListener("input", function () { domanda.mostraSe = mostraSe.value.trim(); });
  corpo.appendChild(mostraSe);

  var nota = document.createElement("input");
  nota.type = "text";
  nota.value = domanda.testo || "";
  nota.placeholder = "Testo della nota (solo per tipo «Nota»)";
  nota.addEventListener("input", function () { domanda.testo = nota.value; });
  corpo.appendChild(nota);

  var linkTesto = document.createElement("input");
  linkTesto.type = "text";
  linkTesto.value = (domanda.link && domanda.link.testo) || "";
  linkTesto.placeholder = "Testo del link (es. Privacy Policy)";
  linkTesto.addEventListener("input", function () {
    domanda.link = domanda.link || {};
    domanda.link.testo = linkTesto.value;
  });
  corpo.appendChild(linkTesto);

  var linkUrl = document.createElement("input");
  linkUrl.type = "text";
  linkUrl.value = (domanda.link && domanda.link.url) || "";
  linkUrl.placeholder = "URL del link (es. privacy-policy.html)";
  linkUrl.addEventListener("input", function () {
    domanda.link = domanda.link || {};
    domanda.link.url = linkUrl.value;
  });
  corpo.appendChild(linkUrl);

  var azioni = document.createElement("div");
  azioni.className = "editor-domanda-azioni";
  azioni.appendChild(bottoneEditor("Elimina domanda", "elimina", function () {
    step.domande.splice(j, 1);
    disegnaEditorStep();
    segnaModifiche();
  }));
  corpo.appendChild(azioni);

  testa.addEventListener("click", function (e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    corpo.hidden = !corpo.hidden;
  });

  tipo.addEventListener("change", function () {
    domanda.tipo = tipo.value;
    corpo.hidden = false;
  });
  etichetta.addEventListener("input", function () {
    if (domanda.tipo === "nota") domanda.testo = etichetta.value;
    else domanda.etichetta = etichetta.value;
  });

  riga.appendChild(corpo);
  return riga;
}

/* ---------- salvataggio ---------- */
function raccogliFormModulo() {
  var form = document.getElementById("form-modulo");
  if (!form || !configModulo) return;
  form.querySelectorAll("[data-campo]").forEach(function (input) {
    var nome = input.getAttribute("data-campo");
    var valore = String(input.value).trim();
    if (nome === "budget.preset") {
      configModulo.budget.preset = valore.split(",").map(function (x) {
        return Number(String(x).replace(/[^\d.-]/g, ""));
      }).filter(function (n) { return Number.isFinite(n); });
      return;
    }
    if (nome === "stile.raggio" || nome === "stile.animazione" || nome === "budget.min" || nome === "budget.max" || nome === "budget.step") {
      percorsoModulo(configModulo, nome, Number(valore) || 0);
      return;
    }
    percorsoModulo(configModulo, nome, valore);
  });
}

async function salvaModuloConfig() {
  if (!configModulo) return;
  raccogliFormModulo();
  var stato = document.getElementById("stato-modulo");
  if (stato) {
    stato.textContent = "Salvataggio in corso…";
    stato.classList.add("in-salvataggio");
    stato.classList.remove("ha-modifiche");
  }
  try {
    await setDoc(doc(db, "impostazioni", "modulo-bozza"), configModulo);
    if (stato) {
      stato.textContent = "Tutto salvato";
      stato.classList.remove("in-salvataggio", "ha-modifiche");
    }
    disegnaBarraModulo();
    aggiornaNotaInvio();
    mostraStato("Modulo salvato: il sito lo usa al prossimo caricamento.", "ok");
  } catch (err) {
    if (stato) {
      stato.textContent = "Salvataggio non riuscito";
      stato.classList.remove("in-salvataggio");
      stato.classList.add("ha-modifiche");
    }
    errore("Salvataggio modulo non riuscito: " + descriviErrore(err));
  }
}

/* ---------- avvio sezione ---------- */
function initModuloAdmin() {
  if (moduloAvviato) return;
  moduloAvviato = true;

  var editor = document.getElementById("editor-modulo");
  if (editor) {
    editor.addEventListener("input", segnaModifiche);
    editor.addEventListener("change", segnaModifiche);
  }
  caricaModuloAdmin();
}

async function caricaModuloAdmin() {
  try {
    var snap = await getDoc(doc(db, "impostazioni", "modulo-bozza"));
    configModulo = pulisciModulo(fondiModulo(clonaModulo(MODULO_DEFAULT), snap.exists() ? snap.data() : {}));
  } catch (err) {
    configModulo = pulisciModulo(clonaModulo(MODULO_DEFAULT));
    errore("Modulo non leggibile: " + descriviErrore(err));
  }
  disegnaEditorModulo();
}
