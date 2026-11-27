// Configurazione Fuel.
// I pesi vengono salvati in cloud (Supabase) cosi iPhone e Apple Watch
// vedono gli stessi valori. Finche questi campi sono vuoti, l'app funziona
// comunque salvando i pesi solo su questo dispositivo (localStorage).
window.FUEL_CONFIG = {
  // Da compilare dopo aver creato il progetto Supabase (vedi supabase/README.md):
  supabaseUrl: "",      // es. "https://xxxx.supabase.co"
  supabaseAnonKey: "",  // la chiave anon (pubblica)
  // Identificativo del proprietario dei pesi (personale). Lascialo cosi.
  owner: "cinzia"
};
