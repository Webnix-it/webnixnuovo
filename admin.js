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
var SEZIONI = {
  recensioni: {
    collezione: "recensioni",
    campi: [
      { chiave: "name", etichetta: "Nome cliente", tipo: "text", obbligatorio: true, placeholder: "Es. Mario Rossi" },
      { chiave: "stars", etichetta: "Stelle (1-5)", tipo: "number", min: 1, max: 5, valore: 5 },
      { chiave: "url", etichetta: "Link progetto (facoltativo)", tipo: "url", placeholder: "https://…" },
      { chiave: "text", etichetta: "Testo della recensione", tipo: "textarea", obbligatorio: true, largo: true }
    ],
    nuovi: function () { return { timestamp: Date.now(), ordine: Date.now() }; },
    titolo: function (d) { return d.name || "Senza nome"; },
    sottotitolo: function (d) {
      var n = Math.max(1, Math.min(5, parseInt(d.stars, 10) || 5));
      return "★".repeat(n) + "☆".repeat(5 - n) + " · " + (d.text || "");
    },
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
      { chiave: "link", etichetta: "Link del bottone", tipo: "url", placeholder: "https://…" },
      { chiave: "description", etichetta: "Descrizione", tipo: "textarea", largo: true }
    ],
    nuovi: function () { return { ordine: Date.now(), cta: "Richiedi un preventivo" }; },
    titolo: function (d) { return d.name || "Senza nome"; },
    sottotitolo: function (d) { return (d.price ? d.price + " · " : "") + (d.description || ""); },
    extra: function (d) { return d.link ? "Bottone: " + (d.cta || "Apri") + " → " + d.link : ""; }
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
function creaCampo(c) {
  var label = document.createElement("label");
  label.className = "campo" + (c.largo ? " campo-largo" : "");

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
  if (c.valore !== undefined && c.valore !== null) input.value = String(c.valore);

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

  form.appendChild(azioni);
  slot.appendChild(form);

  function svuota() {
    form.reset();
    form.removeAttribute("data-id");
    salva.textContent = "Aggiungi";
    annulla.hidden = true;
    schema.campi.forEach(function (c) {
      var campo = form.elements[c.chiave];
      if (campo && c.valore !== undefined) campo.value = String(c.valore);
    });
  }

  annulla.addEventListener("click", svuota);

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var dati = {};
    schema.campi.forEach(function (c) {
      var campo = form.elements[c.chiave];
      var valore = campo ? String(campo.value).trim() : "";
      if (c.tipo === "number" && valore !== "") valore = Number(valore);
      dati[c.chiave] = valore;
    });

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
      disegnaLista(chiave);
    } catch (err) {
      errore("Salvataggio non riuscito: " + (err && err.message ? err.message : err));
    }
  });

  /* usato dal pulsante "Modifica" delle liste */
  form.compila = function (id, dati) {
    schema.campi.forEach(function (c) {
      var campo = form.elements[c.chiave];
      if (campo) campo.value = dati[c.chiave] === undefined || dati[c.chiave] === null ? "" : String(dati[c.chiave]);
    });
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

async function disegnaLista(chiave) {
  var schema = SEZIONI[chiave];
  var contenitore = document.getElementById("lista-" + chiave);
  if (!schema || !contenitore) return;

  contenitore.innerHTML = "";
  var elementoVuoto = document.createElement("p");
  elementoVuoto.className = "stato-vuoto";
  elementoVuoto.textContent = "Nessun contenuto: aggiungine uno con il modulo qui sopra.";
  contenitore.appendChild(elementoVuoto);

  try {
    var snap = await getDocs(collection(db, schema.collezione));
    var elementi = snap.docs.map(function (d) {
      var dati = d.data();
      dati.__id = d.id;
      return dati;
    });

    elementi.sort(function (a, b) {
      if (a.ordine && b.ordine) return a.ordine - b.ordine;
      return String(schema.titolo(a)).localeCompare(String(schema.titolo(b)), "it");
    });

    if (!elementi.length) return;
    contenitore.innerHTML = "";

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
          disegnaLista(chiave);
        } catch (err) {
          errore("Eliminazione non riuscita: " + (err && err.message ? err.message : err));
        }
      });
      azioni.appendChild(elimina);

      voce.appendChild(azioni);
      contenitore.appendChild(voce);
    });
  } catch (err) {
    contenitore.innerHTML = "";
    var erroreBox = document.createElement("p");
    erroreBox.className = "stato-vuoto";
    erroreBox.textContent = "Impossibile caricare i contenuti. Controlla le regole di Firestore.";
    contenitore.appendChild(erroreBox);
    errore("Lettura " + schema.collezione + ": " + (err && err.message ? err.message : err));
  }
}

/* ============================================================
   IMPOSTAZIONI (colori + link)
   ============================================================ */
var formColori = $("#form-colori");
var formLink = $("#form-link");

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
      ["instagram", "facebook", "whatsapp", "email", "cookiebot", "pixel"].forEach(function (k) {
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
