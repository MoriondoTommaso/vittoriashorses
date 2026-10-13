/**
 * The privacy notice, as data.
 *
 * The page is generated from here rather than written as markup, because almost
 * every value in it is a fact that also appears elsewhere on the site: the address,
 * the phone number, the two social profiles, the hosting provider. A notice that
 * carries its own copy of those is a notice that goes out of date the day a detail
 * changes, and it will go out of date silently — nothing fails, the page just
 * starts contradicting the site.
 *
 * So this file reads from `content.ts` and adds only what a notice needs and the
 * site does not otherwise state: the categories of data, the legal basis for each
 * purpose, the retention periods, and the rights.
 *
 * ── The structure ────────────────────────────────────────────────────────────
 *
 * Ordered as GDPR article 13 wants it, rather than as the topics happen to sit in
 * someone's head. A reader has to be able to find the controller, the purpose, the
 * legal basis and the rights without being told which section number to look under.
 * The sections are the same ones a regulator checks for, in the order it checks.
 *
 * ── What is deliberately absent ───────────────────────────────────────────────
 *
 * No cookie banner, and no consent mechanism of any kind. That is not an omission:
 * the site sets no cookies, runs no analytics, embeds nothing and writes nothing to
 * local storage, so there is no processing to consent to. A banner on a page with
 * no cookies is theatre, and the page says so in the terms a reader can act on.
 *
 * The details that would be required if that ever stops being true — a consent
 * record, a list of providers, a way to withdraw — are not written here in advance,
 * because they would describe a site that does not exist. `privacyNeedsConsent` is
 * the flag that has to be flipped when it does.
 */

import { contact, location, pendingFacts, site, social } from './content'

/**
 * Whether the site processes anything that would need consent.
 *
 * `false`, and it is derived rather than declared: it is false because there is no
 * analytics, no tracking, no embedded third party and no storage on this site. If
 * any of those ever arrives, this becomes `true`, the banner is required, and the
 * notice has to grow the sections below that a consent flow needs.
 *
 * Declared as a constant so that the check is one read rather than four greps, and
 * so that flipping it is a deliberate act.
 */
export const privacyNeedsConsent = false

export interface Section {
  id: string
  title: string
  /** One or more paragraphs. */
  body: string[]
  /** A definition list, for the sections that are a table rather than prose. */
  rows?: { term: string; detail: string }[]
  /** An external link rendered at the end of the section. */
  link?: { href: string; label: string }
}

/**
 * The sections, in article 13 order.
 *
 * Every sentence that states a fact states one that is true of this site as built.
 * The parts that depend on a confirmation the maneggio has not given are rendered
 * only once it is given, and the surrounding text is written so that it still reads
 * correctly in the meantime — an absent email address produces a sentence about
 * writing by phone, not a gap where an address should be.
 */
export function privacySections(): Section[] {
  const sections: Section[] = []

  /* ── 1. Titolare ──────────────────────────────────────────────────────────
     The one section that has to name a legal person. GDPR article 13(1)(a) asks
     for the identity of the controller, and for a sole trader in Italy that means
     a name and a tax identifier: "Vittoria's Horses" is a trading name, and on its
     own it does not identify anybody who can be held to this notice.

     So the identifier is here, gated on `pendingFacts.legalId`, and until it is
     confirmed the section names the trading name, the person and the address —
     which is what the site can honestly state — and says that the fiscal data is
     available on request rather than implying a completeness it does not have. */
  sections.push({
    id: 'titolare',
    title: 'Titolare del trattamento',
    body: [
      pendingFacts.legalId.confirmed
        ? `Il titolare del trattamento è ${contact.person}, che gestisce il maneggio “${site.name}”.`
        : `Il titolare del trattamento è ${contact.person}, che gestisce il maneggio “${site.name}”. I dati identificativi completi, compreso il codice fiscale e la partita IVA, sono disponibili su richiesta scrivendo ai recapiti indicati nella sezione Contatti.`,
      `Il maneggio ha sede in ${location.address}, ${location.addressRegion}.`,
    ],
  })

  /* ── 2. Categoria di dati e interessati ───────────────────────────────────
     Article 13(1) asks what is processed and about whom. On this site the honest
     answer is short: a visitor who never writes generates no data subject record
     at all, because nothing is stored and nothing is measured. */
  sections.push({
    id: 'categorie',
    title: 'Dati trattati e categorie di interessati',
    body: [
      'Questo sito non ha account, non ha moduli di raccolta dati e non conserva alcun dato di chi lo visita.',
    ],
    rows: [
      {
        term: 'Dati raccolti dal sito',
        detail:
          'Nessuno. La pagina non imposta cookie di proprio e non usa local storage, session storage, strumenti di analytics o servizi di pubblicità. Non richiede alcun consenso per essere consultata.',
      },
      {
        term: 'Dati trattati su richiesta',
        detail:
          'Chi scrive al maneggio per telefono o tramite i canali social lascia un recapito e il testo del messaggio: nome o nickname, indirizzo del social da cui ha scritto, numero di telefono se lo ha fornito, e il contenuto della richiesta.',
      },
      {
        term: 'Interessati',
        detail:
          'Le persone che contattano il maneggio per informazioni su addestramento e doma, lezioni di equitazione o passeggiate a cavallo.',
      },
      {
        term: 'Dati sensibili',
        detail:
          'Non sono richiesti e non devono essere inviati. Nessun dato che rivela convinzioni religiose, orientamento sessuale, dati relativi alla salute o dati di minori viene raccolto o trattato.',
      },
    ],
  })

  /* ── 3. Finalità e basi giuridiche ────────────────────────────────────────
     Article 13(1)(c) asks for the purposes, and 13(1)(b) for the legal basis. Each
     purpose gets its own basis, because the basis follows the purpose: answering a
     question is not the same processing as keeping a message afterwards. */
  sections.push({
    id: 'finalita',
    title: 'Finalità e basi giuridiche',
    body: [
      'Il trattamento dei dati avviene per finalità di rispondere alla richiesta e di gestire i rapporti con chi chiede informazioni sul maneggio.',
    ],
    rows: [
      {
        term: 'Rispondere a una richiesta',
        detail:
          'Base giuridica: esecuzione di misure precontrattuali su richiesta dell’interessato, ai sensi dell’articolo 6, paragrafo 1, lettera b del Regolamento (UE) 2016/679.',
      },
      {
        term: 'Conservare la conversazione',
        detail:
          'Base giuridica: adempimento di un obbligo legale, ai sensi dell’articolo 6, paragrafo 1, lettera c, per la conservazione delle comunicazioni elettroniche e per gli obblighi fiscali e contabili.',
      },
    ],
  })

  /* ── 4. I social ─────────────────────────────────────────────────────────
     Worth its own section rather than a line inside "dati raccolti", because it is
     the only part of the site where data leaves this domain. */
  sections.push({
    id: 'social',
    title: 'Canali social',
    body: [
      `I collegamenti verso Instagram (${social.instagram}) e Facebook (${social.facebook}) sono semplici collegamenti a siti esterni: il sito non vi incorporates alcun contenuto e non carica alcuno script di quei servizi.`,
      'Una volta avviata la navigazione verso un social network si applicano le policy privacy di quel servizio, che il maneggio non controlla, e la persona che scrive decide da sola di condividere quei dati con la piattaforma. Il maneggio riceve quindi soltanto i dati che la persona sceglie di inviare.',
    ],
  })

  /* ── 5. Hosting ─────────────────────────────────────────────────────────
     Already present and correct in substance. Kept, with the transfer point made
     explicit, because GitHub is a US company and article 44 is the question a
     reader with a lawyer will ask first. */
  sections.push({
    id: 'hosting',
    title: 'Hosting del sito e trasferimenti fuori dallo Spazio economico europeo',
    body: [
      'Il sito è pubblicato con GitHub Pages. Il servizio eroga file statici e, per farlo, tratta dati tecnici quali l’indirizzo IP, il tipo di browser e la data della richiesta nei propri log di servizio. Questi dati sono tecnici, non identificano la persona che naviga e non sono controllati dal maneggio.',
      'GitHub opera fuori dallo Spazio economico europeo, dove vigono il Data Privacy Framework europeo-statunitense e le Clausole contrattuali tipo della Commissione europea. La trasferizione riguarda esclusivamente i dati tecnici di cui sopra e avviene sulla base delle garanzie previste dal Regolamento.',
    ],
    link: {
      href: 'https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement',
      label: 'Informativa sulla privacy di GitHub',
    },
  })

  /* ── 6. Conservazione ────────────────────────────────────────────────────
     Article 13(1)(a) asks for a period, or for the criteria that determine it. A
     criterion is a legitimate answer and "per il tempo necessario" on its own is
     not, because it is not a criterion. */
  sections.push({
    id: 'conservazione',
    title: 'Conservazione dei dati',
    body: ['I dati raccolti per rispondere a una richiesta sono conservati per il tempo necessario a gestirla e ad adempiere agli obblighi di legge.'],
    rows: [
      {
        term: 'Richieste di informazione',
        detail:
          'Finché è necessario per rispondere e per il tempo in cui la persona può ragionevolmente chiedere una modifica, e comunque non oltre i dodici mesi dall’ultimo contatto.',
      },
      {
        term: 'Comunicazioni elettroniche e dati contabili',
        detail: 'Per il periodo previsto dalla normativa fiscale e contabile applicabile.',
      },
      {
        term: 'Dati tecnici del fornitore di hosting',
        detail: 'Per il tempo che GitHub li conserva nei propri log di servizio, secondo la propria informativa.',
      },
    ],
  })

  /* ── 7. Trasmissione a terzi ────────────────────────────────────────────── */
  sections.push({
    id: 'terzi',
    title: 'Trasmissione a terzi',
    body: [
      'I dati non vengono venduti, ceduti o messi a disposizione di terzi per fini commerciali.',
      'I dati sono accessibili ai soggetti che forniscono i servizi al maneggio: i fornitori della piattaforma di hosting e, quando la comunicazione avviene tramite social, i gestori di quelle piattaforme. Ogni fornitore tratta i dati per conto del maneggio sulla base di un accordo che gli impone di usarli solo per il servizio richiesto.',
    ],
  })

  /* ── 8. Diritti ─────────────────────────────────────────────────────────
     Article 13(2)(b) requires the right to complain to a supervisory authority to
     be named. It was missing from the previous version of this page, which is a
     required element rather than a courtesy. */
  sections.push({
    id: 'diritti',
    title: 'I tuoi diritti',
    body: [
      'Puoi chiedere in ogni momento l’accesso ai tuoi dati, la loro rettifica, la cancellazione o la limitazione del trattamento, e puoi opporti al trattamento. Puoi anche chiedere la portabilità dei dati e revocare il consenso, ove il trattamento sia basato su di esso.',
      pendingFacts.privacyEmail.confirmed
        ? `Puoi esercitare questi diritti scrivendo a ${pendingFacts.privacyEmail.value}.`
        : `Puoi esercitare questi diritti scrivendo al maneggio tramite i recapiti indicati nella sezione Contatti del sito: il telefono ${contact.phone} o un messaggio sui profili social. Se ritieni più semplice esprimere la richiesta per iscritto, puoi chiederne un recapito diretto ai medesimi contatti.`,
      'Hai inoltre il diritto di proporre reclamo al Garante per la protezione dei dati personali, con sede in Roma, in Via di Rubertosa 1, o di rivolgerti all’autorità di controllo competente nel tuo Paese di residenza. Il reclamo è gratuito e non pregiudica il resto dei diritti che puoi esercitare.',
    ],
  })

  /* ── 9. DPO ─────────────────────────────────────────────────────────────
     A statement that there is no DPO is a fact about the organisation that a reader
     can check, and its absence reads as an oversight rather than as a decision. */
  sections.push({
    id: 'dpo',
    title: 'Responsabile della protezione dei dati',
    body: [
      pendingFacts.legalId.confirmed
        ? 'Il maneggio non ha nominato un Responsabile della Protezione dei Dati. È possibile comunque rivolgere qualsiasi richiesta in materia di privacy al titolare del trattamento, ai recapiti indicati nella sezione Contatti.'
        : 'Il maneggio non ha nominato un Responsabile della Protezione dei Dati. È possibile comunque rivolgere qualsiasi richiesta in materia di privacy al titolare del trattamento, ai recapiti indicati nella sezione Contatti.',
    ],
  })

  /* ── 10. Minori ──────────────────────────────────────────────────────────
     Not strictly required by article 13, and included because a page that teaches
     children to ride has a plausible minor in its audience and silence would be
     read as permission. */
  sections.push({
    id: 'minori',
    title: 'Minori',
    body: [
      'Il sito è rivolto a persone che si avvicinano al maneggio con un proprio accompagnatore o con il consenso dei genitori. Il maneggio non raccoglie consensi trattati come dati: ogni richiesta è una conversazione, e chi la conduce verifica la presenza di un accompagnatore quando è opportuno.',
    ],
  })

  /* ── 11. Modifiche ─────────────────────────────────────────────────────── */
  sections.push({
    id: 'modifiche',
    title: 'Modifiche a questa informativa',
    body: [
      'Questa informativa viene aggiornata quando il sito introduce nuovi strumenti che richiedono trattamenti ulteriori. Ogni modifica riguarderà i dati effettivamente trattati e la data di aggiornamento qui sotto.',
    ],
  })

  return sections
}

/** Escaped text, because a notice is prose that may contain a quote mark. */
const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The notice as HTML.
 *
 * Escaped rather than interpolated raw: every string here comes from
 * `content.ts`, which today holds only hand-written Italian prose, but the point
 * of a generator is that the next value does not have to be prose. One field with
 * an apostrophe in the wrong place would otherwise produce a page with broken
 * markup in the middle of a legal notice, which is the worst possible place for it.
 *
 * `target="_blank"` on the external link carries `rel="noopener noreferrer"`
 * because the rest of the site does, and a notice page is not the place to be the
 * one link that hands a new tab a handle on its opener.
 */
export function privacyHtml(indent = '        '): string {
  return privacySections()
    .map((section) => {
      const body = section.body
        .map((paragraph) => `${indent}  <p class="mt-3 leading-relaxed text-muted">${escape(paragraph)}</p>`)
        .join('\n')

      const rows = section.rows
        ? `\n${indent}  <dl class="mt-5 space-y-5">\n${section.rows
            .map(
              (row) =>
                `${indent}    <div>\n${indent}      <dt class="font-semibold text-ink">${escape(row.term)}</dt>\n${indent}      <dd class="mt-1 leading-relaxed text-muted">${escape(row.detail)}</dd>\n${indent}    </div>`,
            )
            .join('\n')}\n${indent}  </dl>`
        : ''

      const link = section.link
        ? `\n${indent}  <p class="mt-3">\n${indent}    <a\n${indent}      class="prose-link"\n${indent}      href="${escape(section.link.href)}"\n${indent}      target="_blank"\n${indent}      rel="noopener noreferrer"\n${indent}      >${escape(section.link.label)}</a\n${indent}    >\n${indent}  </p>`
        : ''

      /* The `id` on the heading, not the section: it is the thing a link names and
         the thing a screen reader announces as the heading for the block, and an id
         on a section with no label to match it would be an anchor to nothing. */
      return [
        `${indent}<section aria-labelledby="${section.id}">`,
        `${indent}  <h2 id="${section.id}" class="text-[1.5rem] leading-snug">${escape(section.title)}</h2>`,
        `${body}${rows}${link}`,
        `${indent}</section>`,
      ].join('\n')
    })
    .join('\n\n')
}