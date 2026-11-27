# Fuel - Casi d'uso

Documento di riferimento. Un solo utente (tu). Due superfici: **Apple Watch** (Comandi +
Siri) e **iPhone** (web-app). Da qui partiamo per implementare.

Legenda: ⌚ = Apple Watch · 📱 = iPhone · 🔁 = manutenzione.

---

## ALIMENTAZIONE

### UC-1 ⌚ "Dimmi la colazione" (Siri)
- **Trigger**: *"Ehi Siri, dimmi la colazione"*.
- **Flusso**: calcola il tipo del giorno (A/B) dalla data odierna → legge/mostra tutte le
  alternative di **Proteine / Carboidrati / Grassi** della Colazione per quel giorno.
- **Dati**: `ciclizzazione.json` (regola A/B) + `alimentazione.json` (pasto `colazione`).
- **Esito**: Siri legge ad alta voce e mostra la lista sul Watch.

### UC-2 ⌚ "Dimmi il pranzo / la cena / lo spuntino" (Siri)
- Come UC-1 ma per gli altri pasti. Stessa logica, pasto diverso.

### UC-3 ⌚ "Che giorno e oggi?" (A o B)
- **Trigger**: *"Ehi Siri, oggi e giorno alto o basso?"*
- **Esito**: risponde "Oggi e giorno B (basso)" (o A), con un riassunto dei carboidrati.

### UC-4 📱 Vedi il piano alimentare del giorno
- Apri l'app → schermata **Oggi**: tipo giorno (A/B), i 4 pasti con tutte le alternative,
  nota EAA. Pulsante per vedere **l'altro** giorno (A vs B) e il **domani**.
- **Dati**: `alimentazione.json` + `ciclizzazione.json`.

### UC-5 📱 Vedi le note e l'integrazione
- Sezione con idratazione, sale, verdure, dolcificanti, approccio + tabella integratori.
- **Dati**: `alimentazione.json` (note) + `integrazione.json`.

---

## ALLENAMENTO

### UC-6 📱 Scegli il giorno di allenamento
- Apri l'app → **Allenamento** → scegli **G1/G2/G3/G4** (li scegli tu, non dipende da A/B).
- **Dati**: `allenamento.json`.

### UC-7 📱 Esegui la scheda (immagini, serie, recupero, peso)
- Per ogni esercizio: **immagine**, nome, **serie/ripetizioni**, **recupero**, note tecniche.
- **Aggiorna il peso** con un tocco (come nelle Note): si salva da solo, resta legato
  all'`id` esercizio. Storico per settimana (come nell'app SF Training).
- **Dati**: `allenamento.json` + pesi salvati sul dispositivo.

### UC-8 📱 Lavoro complementare
- Cardio, calf, plank, crunch con volume e note.
- **Dati**: `allenamento.json` (sezione `complementare`).

### UC-9 ⌚ "Cosa alleno oggi" (Siri/Comandi)
- **Trigger**: *"Ehi Siri, cosa alleno oggi"* → scegli G1-G4 → scorri gli esercizi uno a
  uno: immagine + serie + recupero. (Versione essenziale sul Watch.)
- **Limite**: sul Watch e a menu, una schermata per esercizio.

### UC-10 ⌚ Timer di recupero
- Dentro UC-9, a fine serie avvii il **timer di recupero** (dal campo `recupero`
  dell'esercizio, se impostato) con vibrazione a fine tempo.

### UC-11 ⌚ Log rapido del peso
- Durante l'allenamento, dal Watch registri il peso di un esercizio a voce o con la ghiera;
  si sincronizza col dato sull'iPhone.
- **Limite**: la sincronizzazione Watch↔iPhone senza app nativa passa da un file condiviso
  (iCloud) - da verificare in implementazione; in alternativa il peso si inserisce
  sull'iPhone (UC-7) e il Watch resta in sola lettura.

---

## STORICO E PROGRESSI

### UC-12 📱 Vedi lo storico dei pesi
- Per esercizio, l'andamento del peso nel tempo (settimana per settimana), per vedere i
  progressi.

---

## AGGIORNAMENTO MENSILE

### UC-13 🔁 Carichi i nuovi PDF
- Metti i PDF aggiornati (alimentazione, allenamento, calendario) in `pdf-fonte/`.

### UC-14 🔁 Rigenerazione dei dati
- I file in `data/` vengono aggiornati dai nuovi PDF. Gli **id** esercizio restano stabili:
  lo **storico dei pesi non si perde**. Si aggiorna anche la regola A/B del calendario.

---

## Priorita proposta per l'implementazione
1. **UC-1** (Siri "dimmi la colazione") - il valore immediato che vuoi, e funziona subito sul Watch.
2. **UC-4 / UC-6 / UC-7** - web-app iPhone: piano del giorno + schede + pesi (riuso SF Training).
3. **UC-9 / UC-10** - allenamento essenziale sul Watch + timer recupero.
4. **UC-11 / UC-12** - log peso dal Watch + storico progressi.

## Punti aperti da decidere in implementazione
- **Sync peso Watch↔iPhone** senza app nativa: file iCloud condiviso vs peso solo da iPhone.
- **Immagini esercizi**: mappare ogni esercizio di Fuel a un'immagine della libreria gia
  usata (free-exercise-db / catalogo macchinari) oppure foto dedicate.
- **Recupero**: la maggior parte degli esercizi non ha il recupero nel PDF → lo imposti tu
  (o lo chiediamo al coach) e lo salviamo nei dati.
