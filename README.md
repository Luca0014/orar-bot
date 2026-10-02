# Orar-bot

Verifică la ~15 minute pagina <https://iirmp.utcluj.ro/orar.html> (Licență, Cluj-Napoca, **Anul I: RI**)
și, când apare un orar nou sau PDF-ul e înlocuit, îți trimite PDF-ul pe WhatsApp.

- `check.mjs` – găsește link-ul, îl compară cu `state.json`, descarcă PDF-ul
- `notify.mjs` – trimite mesajul prin WhatsApp Cloud API (oficial, Meta)
- `.github/workflows/orar.yml` – rulează totul pe GitHub Actions, 24/7

## Configurare (o singură dată)

### 1. Aplicația Meta + numărul de WhatsApp

1. Intră pe <https://developers.facebook.com/apps> → **Create app** → caz de utilizare cu WhatsApp
   (tip **Business**). Dacă nu ai un Business Portfolio, se creează unul pe parcurs.
2. În aplicație: **WhatsApp → API Setup**. Primești un număr de test gratuit.
   - Notează **Phone number ID** (nu numărul de telefon, ci ID-ul de sub el) → `WHATSAPP_PHONE_ID`.
   - La **To**, adaugă numărul tău și confirmă-l cu codul primit pe WhatsApp → `WHATSAPP_TO`
     (cu prefix de țară, fără `+`, ex. `407xxxxxxxx`).

### 2. Șablonul de mesaj

Un număr business poate scrie primul doar cu un șablon aprobat. Creează-l în
**WhatsApp Manager → Message templates → Create template**:

| Câmp | Valoare |
| --- | --- |
| Category | **Utility** |
| Name | `orar_nou` |
| Language | **Romanian** (`ro`) |
| Header | **Media → Document** (încarcă orice PDF ca exemplu) |
| Body | textul de mai jos |

```
Notificare orar: {{1}} (RI anul I).

Fișier: {{2}}
Link: {{3}}

PDF-ul este atașat acestui mesaj.
```

Exemple pentru variabile: `S-a publicat un orar nou`, `orar_v3.pdf`, `https://iirmp.utcluj.ro/orar.html`.
Trimite la aprobare; de obicei durează câteva minute.

Dacă aprobarea întârzie, poți crea și șablonul de rezervă `orar_actualizat` (aceleași setări, corp fără
rândul `Link: {{3}}`); botul folosește primul șablon aprobat dintre cele două.

### 3. Token permanent

Token-ul din pagina API Setup expiră în 24h. Pentru unul permanent:
<https://business.facebook.com/settings> → **Users → System users** → **Add** (rol Admin) →
**Assign assets** (aplicația ta + contul WhatsApp, control total) → **Generate token** →
expirare **Never**, permisiuni `whatsapp_business_messaging` și `whatsapp_business_management`
→ `WHATSAPP_TOKEN`.

Dacă Meta cere o metodă de plată pentru mesajele-șablon, o adaugi în WhatsApp Manager;
costul e de câțiva cenți pe mesaj.

### 4. Test local (opțional)

```bash
cp .env.example .env
```

Completează `.env`, apoi:

```bash
node --env-file=.env check.mjs --test
```

Ar trebui să primești orarul curent pe WhatsApp.

### 5. GitHub

1. Creează un repo **public** pe GitHub (Actions e gratuit nelimitat doar pe repo-uri publice;
   la 5 minute, un repo privat ar depăși minutele gratuite). În repo nu ajunge nimic secret.
2. Urcă folderul acesta în repo.
3. **Settings → Secrets and variables → Actions → New repository secret**, de trei ori:
   `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TO`.
4. **Actions → Verifica orar → Run workflow**, bifează „test” ca să primești un mesaj de probă.

De aici rulează singur. GitHub poate întârzia rulările programate cu 5–15 minute în orele aglomerate.

## Dacă se schimbă ceva

- Alt an / altă specializare: `YEAR_LABEL`, `LINK_TEXT` și `FALLBACK_HREF` din `check.mjs`.
- Dacă o rulare eșuează (pagină restructurată, token invalid), GitHub îți trimite e-mail,
  iar botul reîncearcă la rularea următoare.
