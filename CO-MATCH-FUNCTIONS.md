# Co-Match Platformfuncties & Algoritmische Specificatie
*Een diepgaande gids voor de visie, code-architectuur en logica van het Co-Match Ecosysteem*

Dit document bevat de volledige, gedetailleerde werking van het **Co-Match** platform, rechtstreeks gedocumenteerd op basis van de functionele code, database-relaties en vertaalbestanden. Niets is overgeslagen.

---

## 1. Wat is Co-Match? (Visie, Strategie & Doel)

### De Visie
In een oververhit huizensegment is wonen veranderd in een kille, transactionele markt. Traditionele platformen nodigen uit tot het eindeloos "kopiëren en plakken" van onpersoonlijke reacties. Het resultaat? Woningzoekers worden moedeloos van het uitblijven van reacties (ghosting), en woningaanbieders verdrinken in honderden identieke, niet-passende berichten.

**Co-Match breekt met dit model.** Co-Match is ontworpen op basis van de filosofie: **samen wonen is samen leven**. Wij matchen mensen niet uitsluitend op basis van budget, maar primair op basis van hun **Woon-DNA, leefstijl, waarden en persoonlijke vibe**.

### De Strategie
Co-Match hanteert een **veilig-eerst, dubbelblind anoniem model**. Zowel de zoeker als de aanbieder behouden de regie over hun privacy. Informatie wordt stapsgewijs ontsloten naarmate het vertrouwen en de match-score tussen beide partijen groeit. 

### Ons Doel
Het wefnemen van de ruis en stress rondom herhuisvesting door middel van:
1. **Algoritmische pre-selectie**: Geen onnodige advertenties swipen die fysiek of mentaal niet aansluiten.
2. **Eliminatie van ghosting**: Een gecontroleerde "inbox-limiet" voor aanbieders gecombineerd met gerichte matching zorgt ervoor dat iedere chat daadwerkelijk waarde heeft.
3. **Persoonlijkheid boven kapitaal**: De sfeer en compatibiliteit in huis bepalen de match-score – niet wie de snelste script of de diepste portemonnee heeft.

---

## 2. Je bent een Woningaanbieder (Huis Aanbieder)

Als aanbieder van een kamer, woning of hospita-constructie biedt Co-Match je een krachtig dashboard aan om je bezit en rust te managen.

### Aantal Woningen & Limieten
* **Gratis Limiet**: Iedere geregistreerde aanbieder mag tot **3 woningen** volledig gratis plaatsen en beheren op het platform.
* **Woningbundels (Property Bundle)**: Wil je meer dan 3 actieve objecten aanbieden? Dan kun je je limiet verhogen via een **Woningbundel**. Dit kost eenmalig **25 credits** en verhoogt je limiet met telkens **3 extra woningen** (gecontroleerd via `PropertyBundleModal`).

### De 5 Woningdoelen (Property Goals)
Bij het aanmaken of bewerken van een woning moet de aanbieder verplicht één specifiek verhuurdoel selecteren:
1. **Cohousing / Woongroep (`cohousing`)**: Je deelt de gehele leefomgeving met gelijkgestemden. Verbinding en gezamenlijke activiteiten staan hier centraal.
2. **Hospita / Inwonen (`hospita`)**: De eigenaar/hoofdbewoner woont zelf in het huis en stelt één of meerdere kamers beschikbaar aan een zoeker.
3. **Vakantiewoning / Onderhuur (`vakantie_onderhuur`)**: Tijdelijke overbrugging of onderhuur voor een kortere, afgebakende periode (minimaal 1 maand).
4. **Huisbewaring / Expat (`huisbewaring_expat`)**: Je vertrekt voor langere tijd (6+ maanden) naar het buitenland en zoekt een betrouwbare bewoner.
5. **Vrije verhuur (`vrije_verhuur`)**: Een zelfstandige, reguliere huurwoning waarbij de nadruk ligt op een stabiele, zorgeloze huurdersrelatie.

### Alle Registratievelden (Woningprofiel-editor)
De woningprofiel-editor in `ProviderDashboard` dwingt een rijke set velden af om de perfecte match-berekening mogelijk te maken:
* **Titel (`title`)**: Maximaal 100 tekens. Een prikkelende naam van de kamer of woning.
* **Omschrijving (`description / free_text_description`)**: Minimaal 10, maximaal 2000 tekens. Een vrije sfeerschets van de woning en de huisgenoten.
* **Huurprijs & Valuta (`price`, `priceType`, `currency`)**: Ondersteunt vaste prijzen, prijsranges of "nader te bepalen" (tbd). Ruime selectie van wereldwijde valuta's via `SUPPORTED_CURRENCIES` (EUR, GBP, USD, etc.).
* **Exacte Locatie via 3D Wereldbol (`displayLat`, `displayLng`, `city`, `country`, `neighborhood`)**: Locaties worden niet handmatig getypt met het risico op spelfouten, maar geselecteerd via de **Interactieve 3D Wereldbol** (`WorldGlobeModal`). Dit zet coördinaten direct om in de juiste kernen en wijken via reverse-geocoding, vrij van uitroeptekens en vreemde tekens.
* **Kenmerken & Voorzieningen (`features`)**:
  * *Sanitair*: Eigen of gedeelde badkamer, douche, toilet.
  * *Ligging*: Rustige straat, levendige straat, doodlopende straat, winkelstraat, drukke straat.
  * *Meubilering*: Volledig gemeubileerd (`fully`), gedeeltelijk (`partly`), of ongemeubileerd (`unfurnished`).
  * *Sleuteldata*: Beschikbaarheid per maand (`monthlyAvailability`) om gaten in bezetting te voorkomen.
  * *Faciliteiten*: Wifi-sterkte, tuin, balkon, parkeerplaats, zwembad/sauna aanwezigheid.
  * *Huisregels*: Huisdieren toegestaan (`pets: yes/no`), roken toegestaan, studenten/expats doelgroepvoorkeur.

### Inbox & Contact Beheersing (Inquiry Limits)
Om te voorkomen dat verhuurders overweldigd raken door de beruchte "tsunami aan reacties", kunnen ze in hun dashboard instellen:
* **Maximum aantal actieve reacties / chats per woning** (bijvoorbeeld max. 10 of 20 actieve chats). Zodra dit limiet is bereikt, wordt de woning automatisch tijdelijk verborgen voor nieuwe zoekers tot er chats worden afgerond of gearchiveerd.
* **Direct Pauzeren**: Met één tik zet de aanbieder de status van 'beschikbaar' op 'gepauzeerd' (`status: paused`).

### Promotie: Weekly Highlight (Wekelijkse Spotlight)
Voor **15 credits** kan een aanbieder zijn woning een week lang in de **Spotlight** zetten (`WeeklyHighlightModal`). Deze woningen verschijnen met een glanzend gouden randje bovenaan bij alle woningzoekers die in de buurt zoeken, mits er een basis match score is.

### Trust Levels (Verificatie & Betrouwbaarheid)
Woningzoekers zoeken betrouwbaarheid. Aanbieders kunnen hun **Trust Level** verhogen van niveau 1 tot en met niveau 4 via `VerificationModal`:
* **Trust Level 1 (Basis)**: E-mail en telefoonnummer geverifieerd.
* **Trust Level 2 (Brons)**: Identiteitskaart-verificatie via beveiligde upload.
* **Trust Level 3 (Zilver)**: Videoverificatie en eigendomsbewijs/kadaster-check van het adres.
* **Trust Level 4 (Goud)**: Succesvolle historische matched-verhuurdershistorie en geverifieerde externe social references.

---

## 3. De Woningzoeker (Woon-DNA & Matching)

Als zoeker is jouw reis ontworpen om stressvrij en resultaatgericht te zijn. Er zijn twee geavanceerde manieren om jouw ideale match te berekenen.

### A. De Standaard Match-Score (Gewogen algoritme)
Als de zoeker nog geen diepgaand Woon-DNA heeft ingevuld, gebruikt het platform het standaard gewogen matchingsalgoritme (`calculateMatchScore`):
1. **Woningdoel Match (Gewicht: 40%)**: Matcht de gewenste woonvorm van de zoeker (`goals`) met de woning? (Bijvoorbeeld Cohousing of Hospita).
2. **Locatie & Afstand Match (Gewicht: 25%)**: 
   * Indien coördinaten beschikbaar zijn, berekenen we de afstand hemelsbreed (`calculateDistance`). Valt de woning in de gekozen zoekstraal (bijv. 10km)? Volle 25 graden match score. Binnen 1.5x de straal? 15 graden. Binnen 2.0x? 5 graden.
   * Indien alleen steden bekend zijn: gelijke stad geeft 25 graden; gelijke land geeft 10 graden.
3. **Budget Match (Gewicht: 20%)**: Is de huurprijs lager of gelijk aan het maximale budget van de zoeker? Volle 20 graden. Tot 120% van het budget? 10 graden. Daarboven? Geen punten.
4. **Woningtype Match (Gewicht: 15%)**: Matcht de fysiologie (appartement, kamer, studio, etc.) met de voorkeuren? Volle 15 graden.

### B. Co-Harmony Analysis (CHA / Vibe-Matching DNA)
De heilige graal van Co-Match is de **Co-Harmony Analysis** (`CoHarmonyAnalysis.tsx`). Dit is een interactieve vragenlijst die de zoeker invult op een schaal van 1 (helemaal oneens) tot 5 (helemaal eens):
* **Hygiëne & Netheid Vibe**: Belangrijkheid van een schoon huis en regelmatige schoonmaakroosters. Matcht met de staat van onderhoud van de woning.
* **Sociaal & Samenleven**: Hoeveel waarde hecht je aan gezamenlijk eten of wijntjes drinken? Matcht met het doelspecifieke groepsDNA van de woning.
* **Geluidsniveau & Rust**: Ben je een vroege vogel of nachtuil? Hecht je waarde aan totale stilte in de avond? Matcht met de straat- en omgevingsindicatoren (Rustige straat vs. Levendige/Drukke straat).
* **Voorzieningen DNA**: Hoe cruciaal zijn huisdieren, meubilair en specifieke extra's zoals tuin of balkon?

**CHA Score Berekening (`calculateCHAScore`)**:
Wanneer ingevuld, overschrijft CHA de standaard score met een uiterst strenge aftrekspecificatie:
* Je start met **100 basispunten**.
* **Locatie fout**: **-15 strafpunten**.
* **Budget overschrijding**: Tot **-40 strafpunten** (gekalibreerd op basis van de overschrijdingsfactor).
* **Woningdoel fout**: **-15 strafpunten**.
* **Vibe afwijking**: Voor elke vraag vergelijken we de score van de zoeker (1-5) met de geverifieerde waarden of berekende hashes van het aanbod. Elk punt verschil levert progressieve aftrek op om onvoldoende harmonie te filteren.

### Zoeken & Vibe-Swipen
* **Vibe-Housing (`VibeHousing.tsx`)**: Een prachtige, vloeiende, Tinder-stijl swiping interface. Je ziet foto's, de matchingsscore en een korte preview. Swipe naar rechts om interesse te tonen, of naar links om over te slaan.
* **Rustig filteren op de Kaart**: Een geordend dashboard met filters op afstand, budget en specifieke voorzieningen.

---

## 4. De Klik (Ontsluiting & Berichtsysteem)

Zodra er een match ontstaat of de zoeker een woning ziet die eruit springt, begint het proces van de "Ontsluiting" (De Klik).

### Stapsgewijze Anonieme Ontsluiting (Transparency Control)
Als zoeker zie je de woningen in eerste instantie geanonimiseerd (geen exacte straatnamen, geen concrete achternamen van de aanbieders). Om alle details te ontsluiten, kies je uit de volgende opties:

1. **Details Ontgrendelen (`VIEW_DETAILS`)**: Ontgrendelt alle verborgen foto's, specifieke huisregels, exacte wijkkaarten en aanvullende eigenschappen. Dit kost **10 credits**.
2. **AI Match-Rapport (`AI_MATCH` / `MatchReportModal`)**: Genereert een diepgaande analyse via de server-side Gemini API. Het rapport analyseert de vrije teksten en het DNA van de zoeker en verhuurder, toont de gemeenschappelijke waarden, eventuele potentiële gevoeligheden (bijv. roken of allergieën), geeft suggesties voor ijsbrekers bij het chatten, en een veiligheidsoverzicht. Dit kost **15 credits**.
3. **Volledige Ontgrendeling & Direct Contact (`UNLOCK_ALL`)**: Ontgrendelt de details, genereert het AI Match-Rapport **én** start de beveiligde chat met de aanbieder. Dit alles-in-één pakket kost **25 credits** via `InterestWorkflowModal`.

---

## 5. De Handshake (Anonieme Chat & Ontmoeting)

Nadat de chat is gestart, communiceren beide partijen in een ultra-beveiligde en rijke omgeving (`SeekerChatsModal` & `ProviderChatsModal`).

### Functies in de Handshake-Chat
* **Anonieme Chat-Basis**: Berichten worden direct heen en weer gestuurd zonder dat e-mailadressen, telefoonnummers of socialmedia-accounts openbaar worden gemaakt. Gebruikers beslissen zelf of en wanneer ze overstappen op WhatsApp of een fysieke bezichtiging.
* **Audioberichten (`AudioRecorder.tsx`)**: Geen zin om te typen? Je kunt direct gesproken audioberichten opnemen en versleuteld versturen naar de ander. Het verzenden van audioberichten kost **15 credits** per bericht om misbruik tegen te gaan en de servers te ontlasten.
* **P2P Videobellen (`VideoMeetingBanner.tsx`)**: Direct vanuit de chat een online kennismaking starten via een beveiligde, gratis video-iframe meeting room. Geen externe apps of accounts (zoals Teams of Zoom) vereist.
* **Veilige Ontmoetingsplek-Selector (`MeetingPlaceSuggester.tsx`)**: 
  Fysiek afspreken met een vreemde kan spannend zijn. In de chat is een interactieve kaart geïntegreerd. Deze berekent automatisch de coördinaten die exact halverwege de zoeker en de woning liggen, en suggereert **altijd openbare, veilige, gezellige ontmoetingsplekken** (zoals drukbezochte cafés, bibliotheken of openbare pleinen) om de eerste kennismaking in alle veiligheid te laten gelopen.

---

## 6. Het Prijsmodel & Credit-Economie

Co-Match gelooft niet in dure, maandelijkse abonnementen die automatisch incasseren terwijl je niets vindt. Ons model is gebaseerd op een eerlijke credit-economie: pay-for-what-you-use.

### Credit Kosten Overzicht (`CREDIT_COSTS`)
| Actie | Rol | Credit Kost | Omschrijving |
| :--- | :--- | :---: | :--- |
| **Woningprofiel Aanmaken** | Aanbieder | **0** | Gratis voor de eerste 3 woningen |
| **Woning Zoeken & Swipen** | Zoeker | **0** | Altijd 100% gratis |
| **Woning details ontgrendelen** | Zoeker | **10** | Unlocks alle verborgen foto's en kenmerken |
| **AI Match-Rapport genereren** | Zoeker | **15** | Diepgaand compatibiliteitsrapport via Gemini AI |
| **Chat starten (Direct Contact)** | Zoeker | **25** | Start de beveiligde anonieme chatbox |
| **Alles-in-één bundel** | Zoeker | **25** | Unlocks Details + AI Rapport + Chat direct (*Beste Deal*) |
| **Audio-spraakbericht sturen** | Iedereen | **15** | Audio opnemen en versturen in de chat |
| **Videobellen** | Iedereen | **0** | Geïntegreerd video-kennismaken is 100% gratis |
| **Property Bundle (+3 woningen)** | Aanbieder | **25** | Limiet verhogen voor meer dan 3 actieve listings |
| **Weekly Highlight (Spotlight)** | Aanbieder | **15** | Je woning een week bovenaan in de spotlight zetten |

### Credits Kopen & Verdienen
* **Starterspakket (`CREDIT_PACKAGES`)**: Voor slechts **€ 3,00** koop je een pakket van **100 credits**, ruim voldoende om met 4 verschillende top-woningen volledig in contact te komen.
* **Cadeaubox-Systeem (Giftbox & Gifting)**: Co-Match deelt geregeld gratis credits uit! Gebruikers kunnen via hun interface een interactieve **Cadeaubox** openen bij mijlpalen (zoals het voltooien van hun profiel, het bereiken van een hoge Harmony index, of via wekelijkse admin acties in `AdminGiftsDashboard`). Dit voegt direct gratis promotionele credits toe aan hun databasebalans.

---

## 7. Conclusie

Co-Match herdefinieert hoe mensen elkaar vinden om samen een thuis te bouwen. Door de kracht van AI-koppelingen (via het **AI Match-Rapport**), frictie-beheersing (via **Inquiry Limits**), betrouwbaarheidsopbouw (via **Trust Levels**), een anonieme en rijke ontmoetingsomgeving (**Handshake Chat** met ingebouwde **halverwege ontmoetingsplek-kiezer**) en een uiterst schommelvrij, transparant micro-prijsmodel stelt Co-Match de menselijke vibe altijd op de allereerste plek.

---
*Co-Match Versie: 0.2600502.1 - Gebouwd en gedocumenteerd met oog voor detail en perfectie.*
