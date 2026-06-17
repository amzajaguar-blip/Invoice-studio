export const it = {
  // Navigation
  dashboard: "Dashboard",
  invoices: "Fatture",
  clients: "Clienti",
  settings: "Impostazioni",
  // Actions
  newInvoice: "Nuova Fattura",
  newClient: "Nuovo Cliente",
  scan: "Scansiona",
  save: "Salva",
  cancel: "Annulla",
  delete: "Elimina",
  edit: "Modifica",
  // Status
  draft: "Bozza",
  sent: "Inviata",
  paid: "Pagata",
  overdue: "Scaduta",
  cancelled: "Annullata",
  // Messages
  noInvoices: "Nessuna fattura ancora",
  noClients: "Nessun cliente ancora",
  savedSuccess: "Salvato ✓",
  deletedSuccess: "Eliminato ✓",
  errorNetwork: "Errore di rete. Riprova.",
  // Settings
  language: "Lingua",
  notifications: "Notifiche",
  account: "Account",
  logout: "Esci",
  deleteAccount: "Elimina account",
  // Currency
  currency: "Valuta",
};

export type TranslationKeys = keyof typeof it;
