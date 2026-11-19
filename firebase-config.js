/* ============================================================
   WEBNIX — firebase-config.js
   Configurazione del progetto Firebase: webnix-a2293
   (Console Firebase → Impostazioni progetto → Le tue app → Configurazione SDK).

   La apiKey qui dentro è pubblica: serve solo al browser per parlare con
   Firebase. La sicurezza vera sta nelle regole Firestore/RTDB
   (vedi regole-firebasse.txt).

   Se apiKey e projectId restano vuoti:
   - la dashboard admin mostra un avviso di configurazione;
   - il sito continua a funzionare con i contenuti scritti nell'HTML.
   ============================================================ */
window.WEBNIX_FIREBASE = {
  apiKey: "AIzaSyCfRzLQJdhb0-uA5GvM9Px2hRwNhT_q6LA",
  authDomain: "webnix-a2293.firebaseapp.com",
  databaseURL: "https://webnix-a2293-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "webnix-a2293",
  storageBucket: "webnix-a2293.firebasestorage.app",
  messagingSenderId: "629455554950",
  appId: "1:629455554950:web:7ae6d8d93d0a09e6534407"
};

/* Account Google autorizzati ad aprire la dashboard.
   Le stesse email vanno ripetute nelle regole di Firestore. */
window.WEBNIX_ADMIN_EMAILS = ["webnixit@gmail.com"];
