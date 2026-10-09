Vittoria’s Horses
Specifica definitiva per la creazione del sito web
Versione 1.0 · Landing page responsive · Lingua italiana
Concept
Un sito fotografico a scorrimento verticale, con uno stile western contemporaneo e una palette verde ranch.
Il visitatore deve percepire l’atmosfera del mondo equestre, scoprire le attività e trovare facilmente il modo di contattare Vittoria’s Horses.
La struttura prende ispirazione dalla progressione per sezioni di Genefold (https://www.genefold.ai/), adattandola a un maneggio: fotografie grandi, contenuti brevi, composizioni differenti e contatti accessibili durante il percorso.
1. Obiettivi e ambito
Obiettivo principale
Generare richieste di informazioni per:
- lezioni di equitazione;
- passeggiate a cavallo;
- visite e altre attività effettivamente offerte dal maneggio.
La conversione principale è il contatto, non la prenotazione automatica.
Pubblico
Persone interessate all’equitazione, potenziali allievi e visitatori della zona. L’idoneità delle attività per principianti, bambini o famiglie deve essere indicata soltanto dopo conferma del maneggio.
Prima versione
Realizzare:
- una landing page completa;
- una pagina Privacy basata sui trattamenti effettivi;
- navigazione interna tramite ancore;
- menu mobile;
- galleria fotografica;
- FAQ;
- contatti telefonici e social;
- collegamento WhatsApp se confermato.
La dinamicità deriva da interazioni e transizioni leggere. Contenuti e contatti sono aggiornabili tramite dati Jekyll.
2. Protocollo di design
L’implementazione deve seguire AGENTS.md e la skill frontend-ui-engineering fornita.
Area	Decisione
Obiettivo e pubblico	Far comprendere l’offerta e facilitare il contatto
Direzione	Western contemporaneo, fotografico, verde come unico accento
Struttura	Percorso verticale con attività, racconto, galleria, FAQ e contatti
Interazione e movimento	Scroll naturale, feedback brevi, comparsa discreta delle sezioni
Accessibilità	Tastiera, focus, contrasto AA, responsive e movimento ridotto
Il carattere western deve emergere da tipografia, immagini e dettagli compositivi. Evitare decorazioni pervasive, texture pesanti e icone usate come riempitivo.
3. Sistema visivo
3.1 Palette
Usare variabili CSS semantiche condivise.
Token	Tema chiaro	Tema scuro
--bg	#F4F5F5	#171B1D
--surface	#FAFAFA	#22282B
--text	#202629	#F4F5F5
--text-muted	#535E64	#B8C1C5
--accent	#285943	#8DBA99
--on-accent	#FAFAFA	#171B1D
Il verde è l’unico accento dell’interfaccia. Le fotografie mantengono i propri colori naturali.
I temi seguono prefers-color-scheme, senza necessità di un selettore manuale nella prima versione. Ogni tema rimane coerente lungo l’intera pagina.
Gli abbinamenti principali sono già stati verificati:
- testo principale: contrasto superiore a 14:1;
- testo secondario: almeno 6,10:1 negli abbinamenti controllati;
- testo dei pulsanti: almeno 7,74:1;
- link verdi: almeno 6,84:1 sulle superfici previste.
Bordi funzionali, focus e testi sulle fotografie devono essere verificati durante l’implementazione. Preferire OKLCH per la definizione dei colori, mantenendo i valori approvati come riferimento.
3.2 Tipografia
- Titoli: Roboto Slab, peso 700.
- Testi e interfaccia: Geist, pesi 400–600.
- Font ospitati localmente in WOFF2, con font-display: swap.
- Fallback leggibili e dimensioni fluide tramite clamp().
Roboto Slab richiama le insegne western; Geist rende contemporanei e leggibili i contenuti.
Elemento	Desktop	Mobile
H1	64–80 px	38–46 px
H2	40–52 px	30–36 px
Corpo	18 px	16–18 px
Interlinea del corpo circa 1,6; paragrafi con larghezza massima di 60–65 caratteri.
Un solo H1. Sezioni H2 e attività H3, senza salti di livello.
3.3 Layout e geometria
- Contenitore massimo: 1280 px.
- Scala di spaziatura: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 px.
- Margini mobile: 24 px, ridotti a 16 px sui display più stretti.
- Margini desktop: 48–64 px.
- Spaziatura delle sezioni: 64 px mobile, 96–128 px desktop.
- Pulsanti: raggio 4 px.
- Superfici funzionali: raggio massimo 8 px.
- Fotografie prevalentemente rettangolari.
- Ombre assenti o molto leggere, solo quando utili alla gerarchia.
Evitare tre card identiche affiancate, sfondi beige, gradienti decorativi e contenitori arrotondati per ogni contenuto.
4. Architettura della landing
Navigazione
Header
Hero
Attività
Il ranch
Passeggiate nella natura
Galleria
FAQ
Contatti
Footer
Ancore principali:
#inizio
#attivita
#ranch
#galleria
#faq
#contatti
4.1 Header
Desktop
- Nome o logo a sinistra.
- Link: Attività, Il ranch, Galleria, Contatti.
- CTA: Scrivici.
- Altezza indicativa 72 px.
- Posizione sticky e sfondo solido leggibile.
Mobile
- Nome o logo.
- Pulsante menu.
- Pannello espandibile sotto l’header.
Se il logo originale non è disponibile, usare temporaneamente il nome tipografico “Vittoria’s Horses”. Un’eventuale variante verde del logo richiede approvazione.
4.2 Hero
Funzione: presentare subito atmosfera, attività e contatto.
Copy proposto:
Il tuo tempo,  
a cavallo.

Lezioni di equitazione e passeggiate per vivere il mondo di Vittoria’s Horses.
Azioni:
- Scrivici: contatto principale.
- Scopri le attività: ancora a #attivita.
Desktop: fotografia panoramica con soggetto prevalentemente a destra e testo allineato a sinistra. Applicare una velatura localizzata per garantire leggibilità.
Mobile: ritaglio dedicato; se la fotografia non offre spazio leggibile, collocare il testo su una superficie solida.
L’altezza prossima al viewport è un obiettivo visivo, non un vincolo. Su schermi bassi o con testo ingrandito il contenuto deve crescere senza tagli. Nessun overflow: hidden sul contenitore del testo.
4.3 Attività
Titolo:
Come vuoi vivere il ranch?
Due blocchi distinti:
Lezioni di equitazione
- fotografia pertinente;
- descrizione breve;
- destinatari e modalità confermati;
- CTA Scrivici con messaggio relativo alle lezioni.
Passeggiate a cavallo
- fotografia su un sentiero;
- descrizione breve;
- durata e requisiti, quando confermati;
- CTA Scrivici con messaggio relativo alle passeggiate.
Desktop: composizione asimmetrica 7/5 con CSS Grid.
Mobile: una colonna, nell’ordine immagine, titolo, descrizione e azione.
Non inserire prezzi, livelli, età o disponibilità inventati.
4.4 Il ranch
Titolo:
Conosci Vittoria’s Horses.
Testo di circa 60–90 parole, approvato dal maneggio, su:
- storia;
- persone;
- approccio al rapporto con i cavalli;
- caratteristiche del luogo.
Desktop: composizione editoriale con testo e fotografia, eventualmente accompagnata da un dettaglio secondario.
Mobile: contenuti impilati, senza sovrapposizioni.
Finché mancano immagini autentiche, utilizzare dettagli atmosferici generici. Non associare fotografie stock ai nomi dello staff.
4.5 Passeggiate nella natura
Titolo:
Cambia passo.
Una fotografia panoramica e un testo di massimo 25 parole dedicato all’esperienza delle passeggiate, seguito da Scrivici.
Questa sezione costituisce una pausa visiva, senza ripetere il layout delle attività.
Su mobile il testo va fuori dalla fotografia se il contrasto non è sufficiente. Non descrivere luoghi stock come percorsi del maneggio.
4.6 Galleria
Titolo:
Il mondo del cavallo.
Per la prima versione, selezionare 5–6 fotografie generiche coerenti. Dopo la sostituzione con immagini autentiche, il titolo può diventare La vita al ranch.
Desktop: mosaico CSS Grid con una fotografia dominante.
Mobile: sequenza orizzontale manuale con scroll-snap, parte della fotografia successiva visibile e controlli precedente/successivo.
- Nessun autoplay.
- Nessuna lightbox nella prima versione.
- Foto non cliccabili se non svolgono un’azione.
- Link finale: Seguici su Instagram.
La galleria deve rimanere esplorabile senza JavaScript.
4.7 FAQ
Titolo:
Prima di salire in sella.
Usare <details> e <summary> nativi.
Domande candidate:
- Posso partecipare se non ho mai montato?
- Come richiedo una lezione?
- Cosa devo indossare?
- Quanto dura una passeggiata?
- Cosa succede in caso di maltempo?
- Sono previste attività per bambini?
Pubblicare esclusivamente le domande con risposta confermata. Nessuna animazione dell’altezza e nessun accordion personalizzato.
4.8 Contatti
Titolo:
Ci vediamo al ranch.
Presentare:
- indirizzo verificato;
- modalità e giorni di accesso;
- telefono cliccabile;
- CTA Scrivici;
- link Indicazioni stradali;
- Instagram e Facebook.
Desktop: informazioni e immagine di supporto.
Mobile: contatti e azioni prima dell’immagine.
Il numero 349 238 7355, visibile nello screenshot Instagram, deve essere confermato prima della pubblicazione. L’uso di WhatsApp richiede conferma separata.
Comportamento di Scrivici:
- WhatsApp confermato: apre la conversazione con messaggio precompilato;
- WhatsApp non confermato: porta a #contatti, dove è disponibile il telefono.
Messaggio generale:
Ciao, vorrei informazioni sulle attività di Vittoria’s Horses.
Le richieste specifiche includono lezioni o passeggiate. L’interfaccia non deve suggerire che l’apertura della chat confermi una prenotazione.
4.9 Footer
Includere:
- nome o logo;
- denominazione legale verificata;
- contatti essenziali;
- social;
- Privacy.
Il collegamento al registro sportivo e le affiliazioni possono comparire soltanto dopo verifica. Nessun badge istituzionale non confermato.
5. Fotografie e asset
Istruzione operativa
Per la prima versione utilizzare fotografie generiche dal web, selezionate da fonti come Unsplash o Pexels e con licenza verificata per il singolo asset.
Cercare:
- cavalli al pascolo;
- equitazione in ambiente naturale;
- passeggiate;
- selle e dettagli western;
- recinti e paesaggi rurali.
Scaricare gli asset nel progetto, registrarne fonte e licenza, ottimizzarli e servirli localmente. Evitare hotlink, immagini casuali e screenshot dei social.
Le foto devono essere coerenti per luce e trattamento. Non devono rappresentare implicitamente strutture, staff o cavalli appartenenti al maneggio.
Durante l’uso di immagini stock, inserire una nota discreta:
Immagini illustrative. Le fotografie del maneggio saranno disponibili prossimamente.
Prevedere:
- AVIF/WebP con fallback quando necessario;
- srcset e sizes;
- dimensioni dichiarate;
- ritagli desktop/mobile;
- priorità per la hero;
- lazy loading per le immagini successive.
6. Interazioni e movimento
Elemento	Comportamento	Durata	Motivazione
Sezioni	Opacità e traslazione verticale di 12 px, una sola volta	240 ms	Accompagnare la lettura
Pulsanti	Pressione scale(0.98)	120 ms	Confermare l’interazione
Menu mobile	Breve transizione di opacità	180 ms	Comunicare apertura e chiusura
Ancore	Scroll nativo fluido quando consentito	Gestita dal browser	Collegare navigazione e contenuto
Galleria	Scorrimento manuale	Nessun automatismo	Lasciare il controllo al visitatore
Easing: cubic-bezier(0.16, 1, 0.3, 1).
Regole:
- animare soltanto transform e opacity;
- hover solo con (hover: hover);
- nessun parallax, scroll hijacking o movimento continuo;
- con prefers-reduced-motion: reduce, contenuti immediatamente visibili e scroll non animato;
- nessun contenuto nascosto se JavaScript o IntersectionObserver non sono disponibili.
7. Accessibilità e stati
Accessibilità
- Link iniziale Vai al contenuto.
- Landmark header, nav, main, footer.
- Elementi nativi per link e pulsanti.
- Target touch minimo 44 × 44 px.
- Focus chiaramente visibile.
- Contrasto WCAG AA.
- scroll-margin-top per evitare titoli nascosti dall’header.
- Alt descrittivi per immagini informative; alt="" per quelle decorative.
- Nessuna informazione comunicata soltanto dal colore.
Menu mobile
- Pulsante con aria-expanded e aria-controls.
- Contenuti chiusi esclusi dalla tabulazione.
- Escape chiude e restituisce il focus al pulsante.
- Selezione di un’ancora: chiude il menu e porta il focus al titolo della sezione.
- Nessun focus trap: il pannello non è modale.
- Senza JavaScript, i link di navigazione restano disponibili.
Galleria
Controlli con etichette accessibili, ad esempio Foto precedente e Foto successiva, disabilitati agli estremi. Nessuna intercettazione globale dei tasti freccia.
Stati e fallback
- Immagini in caricamento: spazio riservato, senza skeleton animati.
- Immagine mancante: layout stabile e informazioni preservate.
- Sezioni facoltative prive di contenuti: omesse.
- JavaScript disabilitato: contenuti, contatti e FAQ funzionanti.
- WhatsApp non utilizzabile: telefono disponibile nella stessa area.
- Dati mancanti: segnalati nella bozza, mai pubblicati come placeholder.
8. Implementazione tecnica
Stack
Jekyll + HTML semantico + CSS nativo + JavaScript leggero, con pubblicazione su GitHub Pages.
Usare la base già presente nel progetto. Non introdurre framework frontend o librerie di animazione per le funzionalità descritte.
Struttura indicativa
_config.yml
index.html
privacy.html
_data/
  ranch.yml
assets/
  css/
    site.css
  js/
    site.js
  fonts/
  images/
    SOURCES.md
ranch.yml contiene:
- nome e contatti;
- indirizzo;
- link social;
- attività;
- FAQ;
- informazioni legali confermate.
SOURCES.md registra origine, autore e licenza delle immagini.
Il JavaScript gestisce esclusivamente menu, focus, controlli della galleria e comparsa delle sezioni. Utilizzare progressive enhancement e IntersectionObserver.
Verificare l’URL effettivo di pubblicazione e configurare url, baseurl e percorsi degli asset di conseguenza.
9. SEO, privacy e prestazioni
SEO
- Documento con lang="it".
- Titolo: Vittoria’s Horses | Lezioni di equitazione e passeggiate a cavallo.
- Description breve e aderente alle attività confermate.
- Comune aggiunto dopo verifica.
- Canonical, Open Graph e immagine di condivisione.
- Sitemap e dati strutturati con sole informazioni verificate.
- Nessuna recensione, valutazione o statistica inventata.
Privacy
Per la prima versione:
- immagini e font locali;
- social tramite link;
- indicazioni stradali tramite link esterno;
- nessun embed social, mappa incorporata o analytics.
La pagina Privacy descrive il funzionamento effettivo del sito. Un eventuale sistema di consenso va introdotto quando vengono aggiunti strumenti che lo richiedono.
Prestazioni
Obiettivi:
- LCP < 2,5 s;
- CLS < 0,1;
- INP < 200 ms.
Ridurre peso delle immagini, varianti dei font e JavaScript. Evitare video automatici e dipendenze non necessarie.
10. Verifica e criteri di accettazione
Controlli obbligatori
- Build Jekyll completata.
- Nessun errore JavaScript o asset mancante.
- Link e contatti corretti.
- Layout verificato a 320, 390, 768, 1024 e 1440 px.
- Test con zoom al 200%.
- Navigazione completa da tastiera.
- Controllo della struttura con screen reader.
- Test di entrambi i temi.
- Test con movimento ridotto e JavaScript disabilitato.
- Controllo accessibilità con axe o strumento equivalente.
- Lighthouse su mobile.
Dopo l’implementazione caricare:
- impeccable per audit e polish;
- review-animations per la revisione del movimento.
Accettazione finale
Il sito è pronto quando:
1. Attività e contatto principale sono comprensibili all’apertura.
2. Non presenta overflow o contenuti tagliati.
3. Menu, FAQ e galleria sono accessibili.
4. Focus e testi sono leggibili in entrambi i temi.
5. Il contenuto rimane disponibile senza JavaScript.
6. Le fotografie stock sono dichiarate illustrative.
7. Contatti, condizioni delle attività e dati legali sono verificati.
8. Non contiene placeholder o informazioni inventate.
Risultato atteso: una landing verde ranch, fotografica e riconoscibile, con carattere western e un percorso semplice dalla scoperta delle attività al contatto con Vittoria’s Horses.