/* ============================================================
   WEBNIX — moduli-extra.js
   Tre popup, tutti con lo stesso telaio e gli stessi stili del
   modulo bozza (classi .wb-* di modulo-bozza.css): stessa card,
   stessi campi, stessi passi a cascata e stessa casella di
   consenso animata. Cambia solo il contenuto:

     1) ASSISTENZA (assistenza.html): scelta del canale (email,
        WhatsApp, Instagram) e, per l'email, modulo a passi con
        tipologia, cosa riguarda, descrizione e consensi.

     2) DOMANDA (faq.html): "Hai una domanda?" — argomento,
        domanda, dati e consensi.

     3) DIAGNOSI (chi-siamo.html): domande guidate sull'attività
        (sito, logo, social, esigenze) per capire da dove partire.

   Le credenziali EmailJS arrivano da modulo-config.js
   (window.WEBNIX_MODULO_DEFAULT.notifica.emailjs): nessuna chiave
   duplicata qui dentro. JavaScript puro, nessuna dipendenza.
   ============================================================ */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var EMAIL = "webnixit@gmail.com";
  var WHATSAPP = "https://wa.me/14132259397?text=" +
    encodeURIComponent("Ciao Webnix! Ho bisogno di assistenza.");
  var INSTAGRAM = "https://www.instagram.com/webnix.it";

  /* ============================================================
     UTILITÀ
     ============================================================ */
  function crea(tag, classe, testo) {
    var n = document.createElement(tag);
    if (classe) n.className = classe;
    if (testo !== undefined && testo !== null) n.textContent = testo;
    return n;
  }

  function configEmail() {
    var modulo = window.WEBNIX_MODULO_DEFAULT || {};
    var c = (modulo.notifica || {}).emailjs || {};
    return {
      serviceId: String(c.serviceId || "").trim(),
      templateId: String(c.templateId || "").trim(),
      publicKey: String(c.publicKey || "").trim(),
      admin: (modulo.notifica || {}).emailAdmin || EMAIL,
      attivo: c.attivo !== false
    };
  }

  function inviaEmail(parametri) {
    var c = configEmail();
    if (!c.attivo || !c.serviceId || !c.templateId || !c.publicKey) {
      return Promise.reject(new Error("EmailJS non configurato"));
    }
    return fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: c.serviceId,
        template_id: c.templateId,
        user_id: c.publicKey,
        template_params: parametri
      })
    }).then(function (res) {
      if (res.ok) return true;
      return res.text().then(function (motivo) {
        throw new Error("HTTP " + res.status + (motivo ? " — " + motivo.trim() : ""));
      });
    });
  }

  function riferimento(prefisso) {
    return prefisso + "-" + String(Date.now()).slice(-6);
  }

  /* Il gradiente del brand serve alla casella di consenso animata e al
     segno di conferma: se il modulo bozza non è ancora passato, lo creiamo. */
  function aggiungiGradienti(radice) {
    if (document.getElementById("wb-brand-grad")) return;
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "wb-defs");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.innerHTML =
      '<defs>' +
      '<linearGradient id="wb-brand-grad" x1="0" y1="1" x2="1" y2="0">' +
      '<stop offset="0%" class="wb-stop-a"></stop>' +
      '<stop offset="100%" class="wb-stop-b"></stop>' +
      '</linearGradient>' +
      '<linearGradient id="wb-grad" x1="0" y1="1" x2="1" y2="0">' +
      '<stop offset="0%" class="wb-stop-a"></stop>' +
      '<stop offset="100%" class="wb-stop-b"></stop>' +
      '</linearGradient>' +
      '</defs>';
    /* sempre nel body: dentro un popup nascosto i gradienti non vengono disegnati */
    document.body.appendChild(svg);
  }

  function asterisco() {
    var s = crea("span", "wb-obbligo", "*");
    s.setAttribute("aria-hidden", "true");
    return s;
  }

  /* ============================================================
     CAMPI (identici a quelli del modulo bozza)
     ============================================================ */
  function campoTesto(nome, etichetta, tipo, o) {
    o = o || {};
    var box = crea("fieldset", "wb-domanda");
    var label = crea("label", "wb-etichetta", etichetta);
    label.setAttribute("for", "wbx-" + nome);
    if (o.obbligatorio) label.appendChild(asterisco());
    box.appendChild(label);

    var input = tipo === "area" ? crea("textarea", "wb-area") : crea("input", "wb-campo");
    input.id = "wbx-" + nome;
    input.name = nome;
    if (tipo === "area") input.rows = o.righe || 5;
    else input.type = tipo || "text";
    if (o.segno) input.placeholder = o.segno;
    if (o.obbligatorio) input.setAttribute("required", "");
    if (o.aiuto) input.setAttribute("aria-describedby", "wbx-aiuto-" + nome);
    box.appendChild(input);

    if (o.aiuto) {
      var aiuto = crea("p", "wb-aiuto", o.aiuto);
      aiuto.id = "wbx-aiuto-" + nome;
      box.appendChild(aiuto);
    }
    box.appendChild(crea("span", "wb-errore", "Compila questo campo per continuare."));
    return box;
  }

  function campoTendina(nome, etichetta, voci, o) {
    o = o || {};
    var box = crea("fieldset", "wb-domanda");
    var label = crea("label", "wb-etichetta", etichetta);
    label.setAttribute("for", "wbx-" + nome);
    if (o.obbligatorio) label.appendChild(asterisco());
    box.appendChild(label);

    var sel = crea("select", "wb-select");
    sel.id = "wbx-" + nome;
    sel.name = nome;
    var vuota = crea("option", "", o.segno || "Seleziona…");
    vuota.value = "";
    sel.appendChild(vuota);
    voci.forEach(function (v) {
      var opzione = crea("option", "", v);
      opzione.value = v;
      sel.appendChild(opzione);
    });
    if (o.obbligatorio) sel.setAttribute("required", "");
    box.appendChild(sel);
    return box;
  }

  /* Card di scelta: una sola (radio) o più di una (checkbox) */
  function campoScelte(nome, etichetta, voci, multiplo, obbligatorio) {
    var box = crea("fieldset", "wb-domanda");
    if (obbligatorio) box.setAttribute("data-obbligatorio", "si");
    var legenda = crea("legend", "wb-etichetta", etichetta);
    if (obbligatorio) legenda.appendChild(asterisco());
    box.appendChild(legenda);

    var griglia = crea("div", "wb-opzioni");
    voci.forEach(function (v, i) {
      var label = crea("label", "wb-opzione" + (multiplo ? " wb-opzione-multi" : ""));
      var input = crea("input");
      input.type = multiplo ? "checkbox" : "radio";
      input.name = nome;
      input.value = v;
      input.id = "wbx-" + nome + "-" + i;
      if (multiplo) input.setAttribute("data-multiplo", "si");
      label.appendChild(input);
      label.appendChild(crea("span", "wb-testo-scelta", v));
      label.appendChild(crea("span", "wb-segno"));
      griglia.appendChild(label);
    });
    box.appendChild(griglia);
    box.appendChild(crea("span", "wb-errore", "Scegli un'opzione per continuare."));
    return box;
  }

  /* Casella di consenso animata: stesso tratto disegnato del modulo bozza */
  function campoConsenso(nome, etichetta, link, obbligatorio) {
    var box = crea("div", "wb-domanda wb-domanda-consenso");
    var label = crea("label", "wb-consenso");

    var input = crea("input");
    input.type = "checkbox";
    input.name = nome;
    if (obbligatorio) input.setAttribute("required", "");

    /* casella animata: il tratto si disegna con i colori del brand */
    var icona = document.createElementNS(NS, "svg");
    icona.setAttribute("class", "wb-consenso-icona");
    icona.setAttribute("viewBox", "0 0 64 64");
    icona.setAttribute("aria-hidden", "true");
    icona.setAttribute("focusable", "false");
    var percorso = document.createElementNS(NS, "path");
    percorso.setAttribute("class", "wb-consenso-path");
    percorso.setAttribute("d", "M 0 16 V 56 A 8 8 90 0 0 8 64 H 56 A 8 8 90 0 0 64 56 V 8 A 8 8 90 0 0 56 0 H 8 A 8 8 90 0 0 0 8 V 16 L 32 48 L 64 16 V 8 A 8 8 90 0 0 56 0 H 8 A 8 8 90 0 0 0 8 V 56 A 8 8 90 0 0 8 64 H 56 A 8 8 90 0 0 64 56 V 16");
    percorso.setAttribute("pathLength", "575.0541381835938");
    icona.appendChild(percorso);

    var testo = crea("span", "wb-consenso-testo", etichetta);
    if (link && link.url) {
      testo.appendChild(document.createTextNode(" "));
      var a = crea("a", "", link.testo || "Informativa");
      a.href = link.url;
      a.target = "_blank";
      a.rel = "noopener";
      testo.appendChild(a);
    }

    label.appendChild(input);
    label.appendChild(icona);
    label.appendChild(testo);
    box.appendChild(label);
    return box;
  }

  function consensi() {
    return [
      campoConsenso(
        "privacy",
        "Acconsento al trattamento dei miei dati personali secondo quanto indicato nell'Informativa sulla Privacy Policy.",
        { testo: "Privacy Policy", url: "privacy-policy.html" },
        true
      ),
      campoConsenso(
        "termini",
        "Ho letto e accetto i Termini e Condizioni e la Privacy Policy.",
        { testo: "Termini e Condizioni", url: "termini-condizioni.html" },
        true
      ),
      campoConsenso(
        "marketing",
        "Desidero ricevere aggiornamenti e proposte Webnix (facoltativo).",
        null,
        false
      )
    ];
  }

  function righeConsensi(dati) {
    return [
      "• Privacy Policy — " + (dati.privacy ? "Acconsentito" : "Non acconsentito"),
      "• Termini e Condizioni — " + (dati.termini ? "Acconsentito" : "Non acconsentito"),
      "• Aggiornamenti Webnix — " + (dati.marketing ? "Sì" : "No")
    ].join("\n");
  }

  function raccogli(form) {
    var dati = {};
    var multipli = {};
    Array.prototype.forEach.call(form.querySelectorAll("input, select, textarea"), function (c) {
      if (!c.name) return;
      if (c.type === "checkbox") {
        if (c.getAttribute("data-multiplo") === "si") {
          if (!multipli[c.name]) multipli[c.name] = [];
          if (c.checked) multipli[c.name].push(c.value);
        } else {
          dati[c.name] = c.checked;
        }
        return;
      }
      if (c.type === "radio") {
        if (c.checked) dati[c.name] = c.value;
        return;
      }
      dati[c.name] = String(c.value || "").trim();
    });
    Object.keys(multipli).forEach(function (k) {
      dati[k] = multipli[k].join(", ");
    });
    return dati;
  }

  /* ============================================================
     WIZARD — telaio identico al modulo bozza
     ============================================================ */
  function creaWizard(o) {
    var radice = crea("div", "wbx");
    radice.id = o.id;
    radice.hidden = true;
    aggiungiGradienti(radice);

    var sfondo = crea("div", "wb-sfondo");

    var card = crea("div", "wb-card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", o.id + "-titolo");

    /* testata */
    var testa = crea("header", "wb-testa");
    var testi = crea("div", "wb-testa-testi");
    testi.appendChild(crea("span", "wb-occhiello", o.occhiello));
    var titolo = crea("h2", "wb-titolo-extra", o.titolo);
    titolo.id = o.id + "-titolo";
    testi.appendChild(titolo);
    testi.appendChild(crea("p", "wb-sottotitolo", o.sottotitolo));

    var chiudiBtn = crea("button", "wb-chiudi");
    chiudiBtn.type = "button";
    chiudiBtn.setAttribute("aria-label", "Chiudi");
    chiudiBtn.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';

    testa.appendChild(testi);
    testa.appendChild(chiudiBtn);

    /* avanzamento */
    var avanzamento = crea("div", "wb-avanzamento");
    var barra = crea("div", "wb-barra");
    var riempimento = crea("span", "wb-barra-riempimento");
    barra.appendChild(riempimento);
    var passoTesto = crea("p", "wb-passo", "");
    avanzamento.appendChild(barra);
    avanzamento.appendChild(passoTesto);

    /* corpo */
    var corpo = crea("div", "wb-corpo");
    var form = crea("form", "wb-form");
    form.id = o.id + "-form";
    form.setAttribute("novalidate", "");

    var blocchi = o.passi.map(function (passo, i) {
      var blocco = crea("div", "wb-step");
      blocco.hidden = i !== 0;
      if (passo.titolo) blocco.appendChild(crea("h3", "wb-step-titolo", passo.titolo));
      if (passo.descrizione) blocco.appendChild(crea("p", "wb-step-descrizione", passo.descrizione));
      passo.campi.forEach(function (campo) { blocco.appendChild(campo); });
      form.appendChild(blocco);
      return blocco;
    });

    /* piede */
    var piede = crea("div", "wb-piede");
    var indietro = crea("button", "wb-indietro", "Indietro");
    indietro.type = "button";
    indietro.hidden = true;
    var avanti = crea("button", "wb-avanti");
    avanti.type = "submit";
    avanti.setAttribute("form", form.id);
    piede.appendChild(indietro);
    piede.appendChild(avanti);

    /* pannello iniziale alternativo (scelta del canale, assistenza) */
    var pannello = null;
    if (o.canali) {
      pannello = crea("div", "wbx-canali-pannello");
      pannello.appendChild(crea("p", "wbx-avviso", o.canali.testo));
      pannello.appendChild(o.canali.nodo);
      corpo.appendChild(pannello);
      corpo.appendChild(form);
      form.hidden = true;
      avanzamento.hidden = true;
      piede.hidden = true;
    } else {
      corpo.appendChild(form);
    }

    card.appendChild(testa);
    card.appendChild(avanzamento);
    card.appendChild(corpo);
    card.appendChild(piede);
    radice.appendChild(sfondo);
    radice.appendChild(card);
    document.body.appendChild(radice);

    /* ---------- stato ---------- */
    var indice = 0;
    var finito = false;
    var inCorso = false;
    var aperto = false;
    var fuocoPrecedente = null;

    function aggiornaPiede() {
      indietro.hidden = indice === 0;
      avanti.disabled = inCorso;
      var ultimo = indice === blocchi.length - 1;
      avanti.innerHTML =
        '<span>' + (ultimo ? (o.testoInvia || "Invia") : (o.testoContinua || "Continua")) + '</span>' +
        '<i class="fa-solid fa-arrow-right wb-freccia" aria-hidden="true"></i>';
    }

    function mostra(i, direzione) {
      indice = i;
      blocchi.forEach(function (b, n) {
        b.hidden = n !== i;
        if (n === i) {
          b.setAttribute("data-direzione", direzione === "indietro" ? "indietro" : "avanti");
          b.style.animation = "none";
          /* forza il riavvio dell'animazione del passo */
          void b.offsetWidth;
          b.style.animation = "";
        }
      });
      riempimento.style.width = (((i + 1) / blocchi.length) * 100).toFixed(2) + "%";
      passoTesto.textContent = "Passo " + (i + 1) + " di " + blocchi.length;
      aggiornaPiede();
      corpo.scrollTop = 0;
    }

    function validaPasso(blocco) {
      var ok = true;
      var primo = null;

      Array.prototype.forEach.call(blocco.querySelectorAll(".wb-domanda"), function (box) {
        var errore = false;

        Array.prototype.forEach.call(
          box.querySelectorAll("input.wb-campo, textarea.wb-area, select.wb-select"),
          function (c) {
            if (c.hasAttribute("required") && !String(c.value || "").trim()) {
              errore = true;
              if (!primo) primo = c;
            }
          }
        );

        if (box.getAttribute("data-obbligatorio") === "si") {
          var scelte = box.querySelector(".wb-opzioni input:checked");
          if (!scelte) {
            errore = true;
            if (!primo) primo = box.querySelector(".wb-opzioni input");
          }
        }

        var consenso = box.querySelector(".wb-consenso");
        if (consenso) {
          var check = consenso.querySelector("input");
          if (check && check.hasAttribute("required") && !check.checked) {
            errore = true;
            consenso.classList.add("wb-non-valido");
            if (!primo) primo = check;
          } else {
            consenso.classList.remove("wb-non-valido");
          }
        }

        box.classList.toggle("wb-non-valida", errore);
        if (errore) ok = false;
      });

      if (!ok && primo) {
        try { primo.focus({ preventScroll: false }); } catch (e) { /* ignora */ }
      }
      return ok;
    }

    function erroreInvio() {
      var vecchio = form.querySelector(".wb-errore-invio");
      if (vecchio) vecchio.remove();
      var box = crea("div", "wb-errore-invio");
      var testoTxt = crea("span", "wb-errore-testo");
      testoTxt.appendChild(document.createTextNode(
        "Invio non riuscito. Riprova tra poco oppure scrivici su "
      ));
      var wa = crea("a", "", "WhatsApp");
      wa.href = WHATSAPP;
      wa.target = "_blank";
      wa.rel = "noopener";
      testoTxt.appendChild(wa);
      testoTxt.appendChild(document.createTextNode(": i dati inseriti restano qui."));
      box.appendChild(testoTxt);
      form.insertBefore(box, form.firstChild);
      form.scrollIntoView({ block: "nearest" });
    }

    function successo(rif, titoloTxt, testoTxt) {
      finito = true;
      card.classList.add("wb-finito");
      corpo.innerHTML = "";

      var box = crea("div", "wb-successo");
      var anello = crea("span", "wb-successo-anello");
      anello.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.6l4.6 4.6L20 6.6"></path></svg>';
      box.appendChild(anello);
      box.appendChild(crea("h3", "", titoloTxt));
      box.appendChild(crea("p", "", testoTxt));

      var chiudiSuccesso = crea("button", "wb-avanti", "Chiudi");
      chiudiSuccesso.type = "button";
      chiudiSuccesso.addEventListener("click", chiudi);
      box.appendChild(chiudiSuccesso);
      box.appendChild(crea("p", "wb-successo-rif", "Riferimento " + rif));
      corpo.appendChild(box);
    }

    function reset() {
      finito = false;
      inCorso = false;
      card.classList.remove("wb-finito");
      corpo.innerHTML = "";
      if (pannello) {
        corpo.appendChild(pannello);
        pannello.hidden = false;
      }
      corpo.appendChild(form);
      form.reset();
      form.hidden = !!pannello;
      avanzamento.hidden = !!pannello;
      piede.hidden = !!pannello;
      [".wb-scelta", ".wb-attivo", ".wb-non-valida", ".wb-non-valido"].forEach(function (sel) {
        Array.prototype.forEach.call(form.querySelectorAll(sel), function (n) {
          n.classList.remove(sel.slice(1));
        });
      });
      mostra(0, "avanti");
    }

    function invia() {
      var dati = raccogli(form);
      var rif = riferimento(o.prefisso || "WEB");

      inCorso = true;
      aggiornaPiede();
      avanti.innerHTML = '<span>Invio in corso…</span>';
      var vecchio = form.querySelector(".wb-errore-invio");
      if (vecchio) vecchio.remove();

      inviaEmail({
        subject: o.oggetto(dati, rif),
        to_email: configEmail().admin,
        from_name: dati.nome || "",
        reply_to: dati.email || "",
        nome: dati.nome || "",
        email: dati.email || "",
        telefono: dati.telefono || "",
        attivita: o.attivita(dati),
        budget: dati.budget || "—",
        riferimento: rif,
        pagina: location.pathname + location.search,
        consensi: righeConsensi(dati),
        messaggio: o.componi(dati, rif)
      }).then(function () {
        inCorso = false;
        successo(rif, o.titoloSuccesso, o.testoSuccesso(dati));
      }).catch(function (err) {
        console.warn("[Webnix " + o.id + "]", err && err.message ? err.message : err);
        inCorso = false;
        aggiornaPiede();
        erroreInvio();
      });
    }

    function apri() {
      if (finito) reset();
      fuocoPrecedente = document.activeElement;
      radice.hidden = false;
      aperto = true;
      document.body.classList.add("wb-blocco-scroll");
      card.classList.remove("wb-chiusura");
      try { chiudiBtn.focus({ preventScroll: true }); } catch (e) { /* ignora */ }
    }

    function chiudi() {
      if (!aperto) return;
      card.classList.add("wb-chiusura");
      window.setTimeout(function () {
        radice.hidden = true;
        aperto = false;
        card.classList.remove("wb-chiusura");
        document.body.classList.remove("wb-blocco-scroll");
        if (fuocoPrecedente && typeof fuocoPrecedente.focus === "function") {
          try { fuocoPrecedente.focus({ preventScroll: true }); } catch (e) { /* ignora */ }
        }
      }, 300);
    }

    function mostraModulo() {
      if (pannello) pannello.hidden = true;
      form.hidden = false;
      avanzamento.hidden = false;
      piede.hidden = false;
      mostra(0, "avanti");
      var primo = form.querySelector(".wb-campo, .wb-opzione input");
      if (primo) {
        try { primo.focus({ preventScroll: true }); } catch (e) { /* ignora */ }
      }
    }

    /* ---------- eventi ---------- */
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (inCorso) return;
      if (!validaPasso(blocchi[indice])) return;
      if (indice < blocchi.length - 1) {
        mostra(indice + 1, "avanti");
        return;
      }
      invia();
    });

    form.addEventListener("change", function (e) {
      var c = e.target;
      var scelta = c.closest(".wb-opzione");
      if (scelta) {
        if (c.type === "radio") {
          Array.prototype.forEach.call(
            form.querySelectorAll('.wb-opzione input[name="' + c.name + '"]'),
            function (i) {
              i.closest(".wb-opzione").classList.toggle("wb-scelta", i.checked);
            }
          );
        } else {
          scelta.classList.toggle("wb-scelta", c.checked);
        }
        scelta.closest(".wb-domanda").classList.remove("wb-non-valida");
      }
      var consenso = c.closest(".wb-consenso");
      if (consenso) {
        consenso.classList.toggle("wb-attivo", c.checked);
        if (c.checked) consenso.classList.remove("wb-non-valido");
      }
      var domanda = c.closest(".wb-domanda");
      if (domanda && c.value) domanda.classList.remove("wb-non-valida");
    });

    indietro.addEventListener("click", function () {
      if (indice > 0) mostra(indice - 1, "indietro");
    });
    chiudiBtn.addEventListener("click", chiudi);
    sfondo.addEventListener("click", chiudi);

    document.addEventListener("keydown", function (e) {
      if (!aperto) return;
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        chiudi();
        return;
      }
      if (e.key !== "Tab") return;
      var focalizzabili = card.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])'
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

    aggiornaPiede();
    mostra(0, "avanti");

    return {
      radice: radice,
      apri: apri,
      chiudi: chiudi,
      mostraModulo: mostraModulo
    };
  }

  /* ============================================================
     1) ASSISTENZA
     ============================================================ */
  function avviaAssistenza(trigger) {
    var canali = crea("div", "wbx-canali");

    var aEmail = crea("button", "wbx-canale");
    aEmail.type = "button";
    aEmail.innerHTML = '<i class="fa-solid fa-envelope" aria-hidden="true"></i>' +
      '<span><strong>Email</strong><small>Compila il modulo di assistenza</small></span>';

    var aWa = crea("a", "wbx-canale");
    aWa.href = WHATSAPP;
    aWa.target = "_blank";
    aWa.rel = "noopener";
    aWa.innerHTML = '<i class="fa-brands fa-whatsapp" aria-hidden="true"></i>' +
      '<span><strong>WhatsApp</strong><small>Scrivici in chat, subito</small></span>';

    var aIg = crea("a", "wbx-canale");
    aIg.setAttribute("data-canale-fisso", "instagram");
    aIg.href = INSTAGRAM;
    aIg.target = "_blank";
    aIg.rel = "noopener";
    aIg.innerHTML = '<i class="fa-brands fa-instagram" aria-hidden="true"></i>' +
      '<span><strong>Instagram</strong><small>Messaggio diretto su @webnix.it</small></span>';

    canali.appendChild(aEmail);
    canali.appendChild(aWa);
    canali.appendChild(aIg);

    var wizard = creaWizard({
      id: "wbx-assistenza",
      occhiello: "Assistenza",
      titolo: "Come vuoi parlarci?",
      sottotitolo: "Scegli il canale che preferisci: ti rispondiamo entro un giorno lavorativo.",
      canali: {
        testo: "Raccontaci cosa non va o cosa ti serve: più dettagli ci dai, prima possiamo aiutarti.",
        nodo: canali
      },
      passi: [
        {
          titolo: "Cosa ti serve?",
          descrizione: "Indica il tipo di richiesta e l'area del progetto.",
          campi: [
            campoScelte("tipo", "Tipologia della richiesta", [
              "Bug o errore sul sito",
              "Modifica di testi, foto o prezzi",
              "Problema con dominio o hosting",
              "Nuovo progetto o preventivo",
              "Domanda generica",
              "Altro"
            ], false, true),
            campoScelte("riguarda", "Cosa riguarda? (puoi sceglierne più di una)", [
              "Sito web", "Logo e grafica", "Social", "Email e moduli", "Altro"
            ], true, false)
          ]
        },
        {
          titolo: "Raccontaci il problema",
          descrizione: "Più dettagli ci dai, prima possiamo aiutarti.",
          campi: [
            campoTesto("messaggio", "Spiega il problema o fai la tua domanda", "area", {
              obbligatorio: true,
              righe: 6,
              segno: "Es. Sul sito la pagina contatti non invia il modulo da ieri…"
            })
          ]
        },
        {
          titolo: "Come possiamo risponderti",
          descrizione: "Ti rispondiamo entro un giorno lavorativo.",
          campi: [
            campoTesto("nome", "Nome e cognome", "text", { obbligatorio: true, segno: "Es. Mario Rossi" }),
            campoTesto("email", "Email", "email", { obbligatorio: true, segno: "nome@email.it" }),
            campoTesto("telefono", "Telefono o WhatsApp (facoltativo)", "tel", { segno: "+39…" })
          ].concat(consensi())
        }
      ],
      testoContinua: "Continua",
      testoInvia: "Invia la richiesta",
      prefisso: "ASS",
      oggetto: function (dati, rif) {
        return "Richiesta di assistenza — " + (dati.nome || "senza nome") + " (" + rif + ")";
      },
      attivita: function (dati) {
        return "Assistenza — " + (dati.tipo || "generica");
      },
      componi: function (dati, rif) {
        return [
          "RICHIESTA DI ASSISTENZA — WEBNIX",
          "Riferimento: " + rif,
          "Ricevuta il: " + new Date().toLocaleString("it-IT"),
          "Pagina: " + location.pathname + location.search,
          "",
          "TIPOLOGIA: " + (dati.tipo || "—"),
          "RIGUARDA: " + (dati.riguarda || "—"),
          "TELEFONO: " + (dati.telefono || "—"),
          "",
          "MESSAGGIO",
          dati.messaggio || "—",
          "",
          "CONSENSI",
          righeConsensi(dati)
        ].join("\n");
      },
      titoloSuccesso: "Richiesta inviata!",
      testoSuccesso: function (dati) {
        return "Abbiamo ricevuto la tua richiesta di assistenza: ti rispondiamo entro un giorno lavorativo all'indirizzo " +
          (dati.email || "indicato") + ".";
      }
    });

    aEmail.addEventListener("click", wizard.mostraModulo);
    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      wizard.apri();
    });
  }

  /* ============================================================
     2) DOMANDA (FAQ)
     ============================================================ */
  function avviaDomanda(trigger) {
    var wizard = creaWizard({
      id: "wbx-domanda",
      occhiello: "Contatti",
      titolo: "Hai una domanda?",
      sottotitolo: "Scrivicela qui: ti rispondiamo entro un giorno lavorativo.",
      passi: [
        {
          titolo: "Di cosa si tratta?",
          descrizione: "Così la giriamo subito alla persona giusta.",
          campi: [
            campoScelte("argomento", "Argomento", [
              "Sito web", "Logo e grafica", "Social", "Prezzi e pacchetti", "Assistenza", "Altro"
            ], false, true)
          ]
        },
        {
          titolo: "Scrivi la tua domanda",
          descrizione: "Nessun gergo tecnico: scrivi come ti viene.",
          campi: [
            campoTesto("messaggio", "La tua domanda", "area", {
              obbligatorio: true,
              righe: 6,
              segno: "Es. Quanto tempo serve per avere online un sito con menu e prenotazioni?"
            })
          ]
        },
        {
          titolo: "Dove possiamo risponderti",
          descrizione: "Ti rispondiamo entro un giorno lavorativo.",
          campi: [
            campoTesto("nome", "Nome e cognome", "text", { obbligatorio: true, segno: "Es. Mario Rossi" }),
            campoTesto("email", "Email", "email", { obbligatorio: true, segno: "nome@email.it" }),
            campoTesto("telefono", "Telefono o WhatsApp (facoltativo)", "tel", { segno: "+39…" })
          ].concat(consensi())
        }
      ],
      testoContinua: "Continua",
      testoInvia: "Invia la domanda",
      prefisso: "DOM",
      oggetto: function (dati, rif) {
        return "Domanda dal sito — " + (dati.nome || "senza nome") + " (" + rif + ")";
      },
      attivita: function (dati) {
        return "Domanda — " + (dati.argomento || "generica");
      },
      componi: function (dati, rif) {
        return [
          "DOMANDA DAL SITO — WEBNIX",
          "Riferimento: " + rif,
          "Ricevuta il: " + new Date().toLocaleString("it-IT"),
          "Pagina: " + location.pathname + location.search,
          "",
          "ARGOMENTO: " + (dati.argomento || "—"),
          "TELEFONO: " + (dati.telefono || "—"),
          "",
          "DOMANDA",
          dati.messaggio || "—",
          "",
          "CONSENSI",
          righeConsensi(dati)
        ].join("\n");
      },
      titoloSuccesso: "Domanda inviata!",
      testoSuccesso: function (dati) {
        return "Grazie " + (dati.nome || "") +
          ": ti rispondiamo entro un giorno lavorativo all'indirizzo " + (dati.email || "indicato") + ".";
      }
    });

    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      wizard.apri();
    });
  }

  /* ============================================================
     3) DIAGNOSI (Chi Siamo)
     ============================================================ */
  function avviaDiagnosi(trigger) {
    var wizard = creaWizard({
      id: "wbx-diagnosi",
      occhiello: "Modulo gratuito",
      titolo: "Facciamo il punto sulla tua attività",
      sottotitolo: "Sei domande veloci: ci bastano per capire da dove partire.",
      passi: [
        {
          titolo: "La tua attività",
          descrizione: "Così capiamo subito di che settore hai bisogno.",
          campi: [
            campoTesto("attivita", "Che attività hai?", "text", {
              obbligatorio: true,
              segno: "Es. bar, studio di fisioterapia, negozio di abbigliamento…"
            })
          ]
        },
        {
          titolo: "Il tuo sito web",
          descrizione: "Se c'è già, lo guardiamo con occhi onesti.",
          campi: [
            campoScelte("sito", "Hai già un sito web?", [
              "No, non ce l'ho", "Sì, ma va rifatto", "Sì, ed è aggiornato"
            ], false, false)
          ]
        },
        {
          titolo: "I tuoi social",
          descrizione: "Dove sei già presente oggi.",
          campi: [
            campoScelte("social", "Quali social usi? (anche più di uno)", [
              "Instagram", "Facebook", "TikTok", "LinkedIn", "Google Business", "Nessuno"
            ], true, false)
          ]
        },
        {
          titolo: "Il tuo logo",
          descrizione: "Se non ce l'hai possiamo occuparcene noi.",
          campi: [
            campoScelte("logo", "Hai un logo?", [
              "Sì", "No", "Sì, ma vorrei rifarlo"
            ], false, true)
          ]
        },
        {
          titolo: "Cosa ti serve",
          descrizione: "Scegli quello che ti interessa, anche più di uno.",
          campi: [
            campoScelte("servizi", "Di cosa hai bisogno? (anche più di uno)", [
              "Sito web", "Logo", "Grafica", "Social", "Restyling"
            ], true, true)
          ]
        },
        {
          titolo: "Dove possiamo risponderti",
          descrizione: "Ti rispondiamo entro un giorno lavorativo con un'analisi della tua presenza online.",
          campi: [
            campoTesto("nome", "Nome e cognome", "text", { obbligatorio: true, segno: "Es. Mario Rossi" }),
            campoTesto("email", "Email", "email", { obbligatorio: true, segno: "nome@email.it" }),
            campoTesto("telefono", "Telefono o WhatsApp (facoltativo)", "tel", { segno: "+39…" }),
            campoTesto("messaggio", "Vuoi aggiungere qualcosa?", "area", {
              righe: 4,
              segno: "Es. apro a settembre e vorrei essere pronto su Google…"
            })
          ].concat(consensi())
        }
      ],
      testoContinua: "Continua",
      testoInvia: "Invia il modulo gratuito",
      prefisso: "DIA",
      oggetto: function (dati, rif) {
        return "Modulo gratuito — " + (dati.nome || "senza nome") + " (" + rif + ")";
      },
      attivita: function (dati) {
        return dati.attivita || "";
      },
      componi: function (dati, rif) {
        return [
          "MODULO GRATUITO — DIAGNOSI ATTIVITÀ",
          "Riferimento: " + rif,
          "Ricevuta il: " + new Date().toLocaleString("it-IT"),
          "Pagina: " + location.pathname + location.search,
          "",
          "ATTIVITÀ: " + (dati.attivita || "—"),
          "LOGO: " + (dati.logo || "—"),
          "SITO WEB: " + (dati.sito || "—"),
          "SOCIAL: " + (dati.social || "—"),
          "SERVIZI: " + (dati.servizi || "—"),
          "TELEFONO: " + (dati.telefono || "—"),
          "",
          "MESSAGGIO",
          dati.messaggio || "—",
          "",
          "CONSENSI",
          righeConsensi(dati)
        ].join("\n");
      },
      titoloSuccesso: "Richiesta inviata!",
      testoSuccesso: function (dati) {
        return "Grazie " + (dati.nome || "") +
          ": ti rispondiamo entro un giorno lavorativo con un'analisi della tua presenza online.";
      }
    });

    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      wizard.apri();
    });
  }

  /* ============================================================
     AVVIO
     ============================================================ */
  function avvia() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-wbx-assistenza]"), avviaAssistenza);
    Array.prototype.forEach.call(document.querySelectorAll("[data-wbx-domanda]"), avviaDomanda);
    Array.prototype.forEach.call(document.querySelectorAll("[data-wbx-diagnosi]"), avviaDiagnosi);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", avvia);
  } else {
    avvia();
  }
})();
