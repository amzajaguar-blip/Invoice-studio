import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# === CONFIGURAZIONE ===
GMAIL_USER = "jollystrike41@gmail.com"
GMAIL_APP_PASSWORD = "xxxx xxxx xxxx xxxx"  # <-- App Password Gmail

TESTERS = [
    "amzajaguar@gmail.com",
    "carusosprite@gmail.com",
    "cipollaorto@gmail.com",
    "elfaker275@gmail.com",
    "giancolamassimo48@gmail.com",
    "lorenzofiamma21@gmail.com",
    "orocoro6@gmail.com",
    "patrickpalla08@gmail.com",
    "rattosbatto@gmail.com",
    "scaldo671@gmail.com",
    "solesoleggiat@gmail.com",
    "tarikmarik660@gmail.com",
]

SUBJECT = "Sei invitato a testare InvoiceStudio (beta)"

BODY = """\
Ciao,

sei stato selezionato come tester per InvoiceStudio — l'app per la fatturazione freelancer italiana.

Clicca il link qui sotto per installare la versione beta:
https://play.google.com/store/apps/details?id=com.Invoice_Studio.myapp

Passaggi:
1. Apri il link dal tuo dispositivo Android
2. Accetta l'invito al programma di test
3. Installa l'app tramite Play Store

Qualsiasi feedback è benvenuto — rispondi pure a questa email.

Grazie per il tuo supporto!
Il team InvoiceStudio
"""

# === INVIO ===
def send_emails():
    print(f"Connessione a Gmail come {GMAIL_USER}...")
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        print("Login OK\n")
        for recipient in TESTERS:
            msg = MIMEMultipart()
            msg["From"] = GMAIL_USER
            msg["To"] = recipient
            msg["Subject"] = SUBJECT
            msg.attach(MIMEText(BODY, "plain", "utf-8"))
            server.sendmail(GMAIL_USER, recipient, msg.as_string())
            print(f"  ✓ Inviata a {recipient}")
    print(f"\nDone — {len(TESTERS)} email inviate.")

if __name__ == "__main__":
    send_emails()
