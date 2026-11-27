# Fuel

App personale di **alimentazione + allenamento**, pensata per iPhone e **Apple Watch**.
Usabile da chiunque (non solo in preparazione gara): l'alimentazione puo avere la
ciclizzazione dei carboidrati (giorni A/B) oppure essere un piano semplice.

> Stato: **Fase 1 - casi d'uso + dati**. L'implementazione parte dopo (vedi
> [CASI-USO.md](./CASI-USO.md)).

## A cosa serve
- **La mattina**, chiedi a Siri *"dimmi la colazione"*: in base alla data capisce se e
  giorno **A (alto)** o **B (basso)** e ti elenca tutte le alternative del pasto.
- **In palestra**, apri l'app, scegli il giorno di allenamento (G1-G4) e vedi per ogni
  esercizio immagine, serie/ripetizioni e **recupero**; aggiorni il **peso** con un tocco
  e si salva da solo.
- **Ogni mese** carichi i PDF aggiornati (alimentazione, allenamento, calendario) e i
  dati dell'app vengono rigenerati.

## Vincolo tecnico e scelta architetturale
Il computer in uso e **Windows**, senza Mac. Un'app **nativa** per Apple Watch si puo
compilare e installare **solo** con un Mac + Xcode: quindi quella strada e esclusa.

La soluzione **senza Mac**, funzionante e gratis, e doppia:

| Dispositivo | Tecnologia | Cosa fa |
|---|---|---|
| **Apple Watch** | **Comandi (Shortcuts) + Siri** | "dimmi la colazione", "cosa alleno oggi", timer recupero, log peso veloce. Gira sul Watch, senza Mac. |
| **iPhone** | **Web-app installabile (PWA)** | Esperienza completa: immagini esercizi, serie/recupero, griglia pesi che aggiorni con un tocco e si salva da sola. |

Sul Watch l'esperienza e "a menu/voce" (limite dei Comandi), non una schermata app su
misura: e il massimo ottenibile senza Mac. La parte ricca vive sull'iPhone.

Riuso previsto: immagini esercizi e impostazione della schermata pesi dall'app
**SF Training / schede-palestre** gia realizzata.

## Struttura dati (`data/`)
Tutto il contenuto dei PDF e in JSON, cosi app e Comandi leggono gli stessi dati:
- [`ciclizzazione.json`](./data/ciclizzazione.json) - regola A/B (data ancora + pattern), calcola il tipo del giorno da qualsiasi data.
- [`alimentazione.json`](./data/alimentazione.json) - pasti e alternative per Giorno A e Giorno B + note.
- [`allenamento.json`](./data/allenamento.json) - G1-G4 + complementare, con id stabili per i pesi e campo recupero.
- [`integrazione.json`](./data/integrazione.json) - integratori e dosaggi.

## Aggiornamento mensile
1. Carichi i nuovi PDF (alimentazione, allenamento, calendario) nella cartella `pdf-fonte/`.
2. Si aggiornano i file in `data/` (gli **id** degli esercizi restano stabili, cosi lo
   storico dei pesi non si perde).
3. Si aggiorna la `dataAncora`/`pattern` in `ciclizzazione.json` se cambia il calendario.

## Dove salvano i pesi
I pesi inseriti sono **tuoi** e restano sul dispositivo (iPhone) legati all'`id` esercizio;
l'aggiornamento mensile dei dati non li cancella.
