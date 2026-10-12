/**
 * Every string and every media reference on the page.
 *
 * The ranch has not confirmed prices, opening days, qualifications or reviews.
 * None of those appear here, and the pages say so rather than implying them. Add
 * a field only when the maneggio confirms it.
 *
 * What has arrived since the first version: the official mark, a walk clip and a
 * chapter for it, five photographs of the maneggio, and the contact details. Each
 * of those arrived as an edit here and nowhere else, which is the whole reason
 * this file exists.
 *
 * One field is still marked UNCONFIRMED: the founding year. It is isolated here
 * rather than spread through the components so that confirming it is a one line
 * change and not a search.
 */

/** Deploy-base aware, so the site also works from a project subpath. */
export const media = (path: string) => `${import.meta.env.BASE_URL}media/${path}`

/* ── Assets ──────────────────────────────────────────────────────────────────
   One place where every file on the page is declared, so that handing over the
   real photographs and the real mark is an edit here and nowhere else. No component
   names a file, and no component has to change when one arrives.

   Each entry carries what the markup needs and nothing it does not: sources per
   orientation, intrinsic size, a srcSet, alternative text, a caption, a focal point,
   where the pixels came from, and a credit when there is a real photographer to
   credit. Anything absent is absent on purpose rather than filled in. */

/** How much of what is on the page is real. Drives which notices are rendered. */
export type Provenance = 'official' | 'illustrative'

/** A photograph, in one orientation. */
export interface PhotoSource {
  src: string
  srcSet?: string
  /** Intrinsic size, so the browser reserves the right box before the file lands. */
  width: number
  height: number
}

/**
 * One photograph, in every form it is used.
 *
 * `focalPoint` exists because a photograph that fills a portrait plate has to be
 * cropped, and the crop that suits a horse at a gallop is not the one that suits a
 * rider at a walk. It is a CSS object-position value, so it is declared here next to
 * the picture it belongs to rather than in the stylesheet, where the next photograph
 * would have to be matched to a selector.
 */
export interface Photo {
  /** Discriminates the two members of `GalleryItem`. See below. */
  type: 'photo'
  id: string
  alt: string
  caption: string
  /** Thumbnail and lightbox. */
  full: PhotoSource
  /** Same picture, sized down. */
  thumb: PhotoSource
  focalPoint: string
  provenance: Provenance
  /** Only when there is a real photographer to name, with their permission. */
  credit?: string
}

/**
 * The one clip in the section.
 *
 * A discriminated union rather than a `Photo` with an optional `src`, because the
 * two things differ in every field that matters rather than in one: a photograph has
 * an `alt`, a video has nothing to describe it with except what it shows; a
 * photograph has a focal point, a video is shown whole; a photograph's file is
 * requested with the page, a video's is not requested at all until somebody asks
 * to watch it. Optional fields invite the component to check for them, and this one
 * would then have to answer "what do I do when both are possible" at every step.
 *
 * `poster` is a photograph in its own right and is declared like one, because it is
 * what the section shows for the clip and it has to reserve its box, be lazy and be
 * responsive exactly as the others are. It is the only thing fetched on arrival.
 *
 * `description` rather than `alt`, because a `<video>` has no alt attribute. It
 * becomes the accessible name of the control that opens it, so it has to say what
 * happens rather than that a video exists.
 */
export interface GalleryVideo {
  type: 'video'
  id: string
  description: string
  caption: string
  /** The frame shown in the grid and before playback. */
  poster: PhotoSource
  /** Requested only when the visitor opens the clip. */
  src: string
  width: number
  height: number
  /** Seconds, declared rather than probed at runtime: the lightbox needs it to
      decide whether the clip is long enough to be worth a progress affordance and
      to label the control, and a number read off the element is unavailable until
      the file has landed. */
  duration: number
  provenance: Provenance
}

export type GalleryItem = Photo | GalleryVideo

export const site = {
  name: 'Vittoria’s Horses',
  tagline: 'Addestramento e doma, lezioni di equitazione e passeggiate',
  description:
    'Addestramento e doma di cavalli, lezioni di equitazione e passeggiate a Terni. Contatta Alberto per informazioni e disponibilità.',
  locale: 'it_IT',
  privacyUrl: './privacy.html',
  /* The name, in the site's own type. It is the page's only h1, it is what a screen
     reader announces for the opening, and it is what replaces the mark if the mark
     cannot be loaded. Those three jobs are why the text stays even though the logo
     exists now: an image carrying the accessible name would leave the page with no
     name at all the day the file 404s. */
  wordmark: 'Vittoria’s Horses',
  /* UNCONFIRMED: the founding year has not been confirmed by the maneggio.
     Rendered small under the opening logo and removed with this one field. */
  established: 'Est. 2026',
  establishedConfirmed: false,
}

/**
 * The official mark.
 *
 * Two files, drawn as one shape in two inks: a white one and a black one. The
 * choice is made by the surface behind it and not by the device's theme, because
 * the two are not the same thing here. The opening sits on a darkened video, which
 * is dark in both themes, so the white mark is the only one that reads there — a
 * black logo over the opening would be a black mark on a near-black frame in the
 * light theme and nobody would find the site name at all.
 *
 * The intrinsic size is 700 by 848, which makes the mark vertical. That is the
 * single fact that shapes the layout: it cannot inherit the dimensions of the
 * typeset wordmark it replaces, it is sized by its own width, and the height
 * follows from the ratio rather than the other way round.
 *
 * No filter is used on either file. Inverting or recolouring a mark with CSS is
 * how an official logo ends up subtly wrong on a screen nobody tested, and there
 * is no layout problem here that a second file does not already solve. */
export const logo = {
  white: { src: media('logo-white.svg'), width: 700, height: 848 },
  black: { src: media('logo-black.svg'), width: 700, height: 848 },
}

export const social = {
  instagram: 'https://www.instagram.com/vittorias_ranch_/',
  instagramHandle: '@vittorias_ranch_',
  facebook: 'https://www.facebook.com/people/Vittorias-Horses/100085850094970/',
  facebookName: 'Vittoria’s Horses',
}

/**
 * Who to ask.
 *
 * One place, because a name and a number written in two components is how a page
 * ends up with two different numbers. The number is held twice on purpose: once as
 * it is read and once as a tel: URI, because the readable form contains spaces and
 * is not a URI, and building the href by stripping punctuation from the display
 * string is the kind of transformation that survives until somebody adds a
 * country code and gets a dead link.
 */
export const contact = {
  person: 'Alberto',
  phone: '+39 349 238 7355',
  phoneHref: 'tel:+393492387355',
}

/* ── The story backdrop ────────────────────────────────────────────────────
   Four moments, one continuous stage, in the order a horse moves: standing, at
   a walk, at a trot, at a gallop. Each clip exists in two orientations and each
   has a poster generated from its own first frame by scripts/build-media.mjs, so
   the poster and the clip agree.

   The order is not decoration. It is the order the gaits happen in, and a reader
   who scrolls the whole page watches the horse change speed rather than watch
   four unrelated clips replace one another. */
export type StoryMoment = 'fermo' | 'passo' | 'trotto' | 'galoppo'

/** One clip, in one orientation, with where its pixels came from. */
export type Clip = {
  src: string
  poster: string
  width: number
  height: number
  provenance: Provenance
}

export const clips: Record<StoryMoment, { desktop: Clip; mobile: Clip }> = {
  fermo: {
    desktop: {
      src: media('fermo.mp4'),
      poster: media('fermo-poster.webp'),
      width: 1280,
      height: 720,
      provenance: 'illustrative' as Provenance,
    },
    mobile: {
      src: media('fermo-mobile.mp4'),
      poster: media('fermo-poster-mobile.webp'),
      width: 720,
      height: 1280,
      provenance: 'illustrative' as Provenance,
    },
  },
  passo: {
    desktop: {
      src: media('passo.mp4'),
      poster: media('passo-poster.webp'),
      width: 1280,
      height: 720,
      provenance: 'illustrative' as Provenance,
    },
    mobile: {
      src: media('passo-mobile.mp4'),
      poster: media('passo-poster-mobile.webp'),
      width: 720,
      height: 1280,
      provenance: 'illustrative' as Provenance,
    },
  },
  trotto: {
    desktop: {
      src: media('trotto.mp4'),
      poster: media('trotto-poster.webp'),
      width: 1280,
      height: 720,
      provenance: 'illustrative' as Provenance,
    },
    mobile: {
      src: media('trotto-mobile.mp4'),
      poster: media('trotto-poster-mobile.webp'),
      width: 720,
      height: 1280,
      provenance: 'illustrative' as Provenance,
    },
  },
  galoppo: {
    desktop: {
      src: media('galoppo.mp4'),
      poster: media('galoppo-poster.webp'),
      width: 1280,
      height: 720,
      provenance: 'illustrative' as Provenance,
    },
    mobile: {
      src: media('galoppo-mobile.mp4'),
      poster: media('galoppo-poster-mobile.webp'),
      width: 720,
      height: 1280,
      provenance: 'illustrative' as Provenance,
    },
  },
}

/* ── The five moments ──────────────────────────────────────────────────────
   The opening carries the name and nothing else. Each activity carries a title,
   one sentence, one action. Everything a visitor needs in order to write is at
   the end of the page, in one place, rather than repeated per section. */

/**
 * What a chapter's action does.
 *
 * Not decoration: the two are different kinds of link and they behave differently.
 * A phone call hands the number to the device's dialler, which is a different
 * system from the browser and cannot be reached by a `target` attribute at all;
 * opening one in a new tab is not a thing it can do. And the phrase "su Instagram"
 * is only true of one of them, so a single hard-coded suffix would tell a visitor
 * something untrue about half the page.
 */
export type Cta =
  | { label: string; href: string; kind: 'tel' }
  | { label: string; href: string; kind: 'social'; externalName: string }

export const opening = {
  /* A single line under the mark, naming what the maneggio actually does. */
  line: 'Addestramento e doma, lezioni di equitazione e passeggiate a cavallo a Terni.',
}

/* Addestramento first. It is the activity a horse owner comes for, the one the
   maneggio is known for, and the one that leads to the other two: a horse that
   trusts someone is a horse somebody can be taught on. */
export const experiences = [
  {
    id: 'addestramento',
    moment: 'passo' as StoryMoment,
    title: 'Addestramento e doma di cavalli',
    /* One sentence, and it promises a process rather than an outcome. "Un
       percorso su misura" is what a training service is; a guaranteed result in
       a fixed number of lessons is a claim nobody has made and nobody can keep. */
    text: 'Un percorso su misura, dalla fiducia al lavoro in sella.',
    cta: { label: 'Chiama Alberto', href: contact.phoneHref, kind: 'tel' } as Cta,
    /* A phone call is not a booking and the label does not pretend to be one.
       A visitor who rings gets an answer and an arrangement; nothing on this page
       promises them a place in a list. */
    tight: true,
  },
  {
    id: 'lezioni',
    moment: 'trotto' as StoryMoment,
    title: 'Lezioni di equitazione',
    text: 'Equilibrio, coordinazione e confidenza in sella. Un percorso da concordare insieme.',
    /* No "Prenota": there is no booking flow, and a button that promises one
       is worse than no button. Instagram is where the maneggio answers. */
    cta: {
      label: 'Scrivici',
      href: social.instagram,
      kind: 'social',
      externalName: 'Instagram',
    } as Cta,
  },
  {
    id: 'passeggiate',
    moment: 'galoppo' as StoryMoment,
    title: 'Passeggiate a cavallo',
    text: 'Sentieri, campagna e aria aperta. Scopri l’esperienza adatta a te.',
    cta: {
      label: 'Scrivici',
      href: social.instagram,
      kind: 'social',
      externalName: 'Instagram',
    } as Cta,
  },
]

export const gallery = {
  id: 'galleria',
  title: 'Il maneggio',
  /* Eight photographs and one clip, in the order they are composed rather than in
     the order they were shot: the one that carries the section first, then the
     activity, then the people, then the relationship with a single horse, then an
     ordinary day, and then three more of the same. Declared through the asset
     shape rather than as loose fields, because each entry is a different size: the
     file, the srcSet, the intrinsic dimensions the browser needs to reserve the
     box, the crop, and whether the "illustrative" sentence still has to be printed
     underneath.

     The clip sits sixth, opening the last row on a wide screen and immediately
     before the still of the same horse in the same paddock. That adjacency is
     deliberate: the two are one moment, and a reader who watches one and then sees
     the other is looking at the same afternoon rather than at two unrelated
     pictures that happen to be next to each other.

     `provenance` is per item, not per section, and that is the point: the
     notice underneath is derived from the set, so swapping in one generated
     photograph among eight real ones produces a sentence about the one rather
     than a blanket claim about all of them. */
  items: [
    {
      type: 'photo',
      id: 'cavalli',
      alt: 'Un cavallo castano con una fiammata bianca al centro dell’inquadratura, vicino alla recinzione del campo; sullo sfondo cavalieri e altri cavalli.',
      caption: 'I cavalli del maneggio.',
      full: {
        src: media('gallery-cavalli-1280.webp'),
        width: 1280,
        height: 1706,
      },
      thumb: {
        src: media('gallery-cavalli-720.webp'),
        srcSet: `${media('gallery-cavalli-480.webp')} 480w, ${media('gallery-cavalli-720.webp')} 720w, ${media('gallery-cavalli-960.webp')} 960w, ${media('gallery-cavalli-1280.webp')} 1280w`,
        width: 720,
        height: 960,
      },
      /* The horse's head and the two riders behind it sit in the upper-middle of
         the frame, and the plate this cell is given is a 4:5 crop of a 3:4
         original, so the crop has to start high or the face is lost and only the
         legs remain. */
      focalPoint: '50% 42%',
      provenance: 'official',
    },
    {
      type: 'photo',
      id: 'in-campo',
      alt: 'Una persona con il casco in sella su un cavallo baio, con un’altra persona accanto che tiene le redini, sul campo di esercizio.',
      caption: 'In sella, nel campo del maneggio.',
      full: {
        src: media('gallery-in-campo-960.webp'),
        width: 960,
        height: 1280,
      },
      thumb: {
        src: media('gallery-in-campo-720.webp'),
        srcSet: `${media('gallery-in-campo-480.webp')} 480w, ${media('gallery-in-campo-720.webp')} 720w, ${media('gallery-in-campo-960.webp')} 960w`,
        width: 720,
        height: 960,
      },
      /* Both people sit in the middle third and the top of the frame is bare sky,
         so the crop starts above centre: a centred crop on this one is a field
         with two figures in it rather than two people on a horse. */
      focalPoint: '50% 46%',
      provenance: 'official',
    },
    {
      type: 'photo',
      id: 'insieme',
      alt: 'Tre persone con il casco in sella su tre cavalli, uno accanto all’altro, sotto un albero.',
      caption: 'Insieme a cavallo.',
      full: {
        src: media('gallery-insieme-720.webp'),
        width: 720,
        height: 896,
      },
      thumb: {
        src: media('gallery-insieme-720.webp'),
        srcSet: `${media('gallery-insieme-480.webp')} 480w, ${media('gallery-insieme-720.webp')} 720w`,
        width: 720,
        height: 896,
      },
      /* The three riders' heads are at the very top of the original and the
         horses' hooves at the very bottom, so this is the one photograph with no
         spare space in either direction: any crop loses a head or a hoof, which is
         why it is kept whole and given the smallest cell. */
      focalPoint: '50% 50%',
      provenance: 'official',
    },
    {
      type: 'photo',
      id: 'rapporto',
      alt: 'Una persona abbraccia la testa di un cavallo baio, di sera, con le luci del maneggio accese dietro di lei.',
      caption: 'Il rapporto con il cavallo.',
      full: {
        src: media('gallery-rapporto-960.webp'),
        width: 960,
        height: 1280,
      },
      thumb: {
        src: media('gallery-rapporto-720.webp'),
        srcSet: `${media('gallery-rapporto-480.webp')} 480w, ${media('gallery-rapporto-720.webp')} 720w, ${media('gallery-rapporto-960.webp')} 960w`,
        width: 720,
        height: 960,
      },
      /* The embrace runs from the top third to the middle and the lower half is
         gravel, so the crop is pulled up onto the two of them. */
      focalPoint: '50% 34%',
      provenance: 'official',
    },
    {
      type: 'photo',
      id: 'giornata',
      alt: 'Due persone a piedi accompagnano un cavallo su un campo di terra, sotto un cielo azzurro con nuvole.',
      caption: 'Una giornata al maneggio.',
      full: {
        src: media('gallery-giornata-1280.webp'),
        width: 1280,
        height: 1706,
      },
      thumb: {
        src: media('gallery-giornata-720.webp'),
        srcSet: `${media('gallery-giornata-480.webp')} 480w, ${media('gallery-giornata-720.webp')} 720w, ${media('gallery-giornata-960.webp')} 960w, ${media('gallery-giornata-1280.webp')} 1280w`,
        width: 720,
        height: 960,
      },
      /* The sky is two thirds of the original and the people and the horse sit
         in the lower third against the shadow of the trees, so the crop has to
         start low. Centred here would be a photograph of the sky. */
      focalPoint: '50% 62%',
      provenance: 'official',
    },
    {
      type: 'video',
      id: 'volo',
      description:
        'Una bambina con il casco, in piedi sul dorso di un cavallo bianco con le braccia aperte, mentre un adulto la sostiene vicino alla sella. Poi scende e il cavallo resta fermo al sole.',
      caption: 'Sul dorso del cavallo.',
      poster: {
        src: media('gallery-volo-480.webp'),
        srcSet: `${media('gallery-volo-480.webp')} 480w`,
        width: 480,
        height: 852,
      },
      /* 576x1024 and thirteen seconds. It is not a fifth story moment and is not
         going to become one: the stage is 16:9 on every desktop, so a portrait
         clip there is pillarboxed or cropped out of shape. Here the frame is the
         clip's own shape and it is fetched only when somebody chooses it. */
      src: media('gallery-volo.mp4'),
      width: 576,
      height: 1024,
      duration: 13,
      provenance: 'official',
    },
    {
      type: 'photo',
      id: 'in-lembo',
      alt: 'Una persona con il casco appoggiata al collo di un cavallo bianco, al sole, con le colline e un altro cavallo sullo sfondo.',
      caption: 'In confidenza col cavallo.',
      full: {
        src: media('gallery-in-lembo-1280.webp'),
        width: 1280,
        height: 1706,
      },
      thumb: {
        src: media('gallery-in-lembo-720.webp'),
        srcSet: `${media('gallery-in-lembo-480.webp')} 480w, ${media('gallery-in-lembo-720.webp')} 720w, ${media('gallery-in-lembo-960.webp')} 960w, ${media('gallery-in-lembo-1280.webp')} 1280w`,
        width: 720,
        height: 960,
      },
      /* The horse's head and the rider's helmet are both in the upper middle and
         the sky is a third of the frame above them, so the crop starts high. This is
         the still of the same afternoon as the clip above it, and it shares its
         horse, its light and its paddock. */
      focalPoint: '50% 40%',
      provenance: 'official',
    },
    {
      type: 'photo',
      id: 'carezza',
      alt: 'Una bambina accarezza la testa di un cavallo grigio, al chiuso, in un corridoio del maneggio.',
      caption: 'Una carezza.',
      full: {
        src: media('gallery-carezza-960.webp'),
        width: 960,
        height: 1280,
      },
      thumb: {
        src: media('gallery-carezza-720.webp'),
        srcSet: `${media('gallery-carezza-480.webp')} 480w, ${media('gallery-carezza-720.webp')} 720w, ${media('gallery-carezza-960.webp')} 960w`,
        width: 720,
        height: 960,
      },
      /* Her face and the horse's head are both in the middle of the frame and the
         top is wall and doorway, so the crop starts above centre to keep the two
         of them together. */
      focalPoint: '50% 44%',
      provenance: 'official',
    },
    {
      type: 'photo',
      id: 'serata',
      alt: 'Due bambine con il casco e la giacca protettiva ricevono aiuto per mettere la sella, di sera, mentre dei cavalli passano sullo stesso vialetto illuminato.',
      caption: 'Una sera al maneggio.',
      full: {
        src: media('gallery-serata-1280.webp'),
        width: 1280,
        height: 1706,
      },
      thumb: {
        src: media('gallery-serata-720.webp'),
        srcSet: `${media('gallery-serata-480.webp')} 480w, ${media('gallery-serata-720.webp')} 720w, ${media('gallery-serata-960.webp')} 960w, ${media('gallery-serata-1280.webp')} 1280w`,
        width: 720,
        height: 960,
      },
      /* The two children are in the lower half and the top third is a crowd and a
         lit tower, so the crop starts below centre. Pulled up, this cell would be
         mostly bystanders, which is the opposite of what the photograph is about. */
      focalPoint: '50% 54%',
      provenance: 'official',
    },
  ] as GalleryItem[],
  /* Only printed while at least one item still needs it. See galleryNotice. */
  notice:
    'Queste immagini sono illustrazioni generate con AI e non fotografano il ranch. Sul profilo Instagram del maneggio trovi le fotografie reali.',
}

/* Whether the "these are illustrations" sentence still has to appear under the
   photographs. It is derived from the set rather than switched by hand, so that
   swapping in a fifth real photograph removes the claim about all of them instead
   of leaving a notice that denies the pictures directly above it. */
export const galleryNotice =
  gallery.items.some((item) => item.provenance !== 'official') ? gallery.notice : null

/* ── What has to be declared ───────────────────────────────────────────────
   The notice under the closing, derived from the assets rather than written once.

   The photographs, the gallery clip and the four backdrop clips are three separate
   questions and they get answered separately: the gallery is entirely real, and a
   page that said "the videos are illustrations" directly under a real clip of the
   maneggio would be contradicting the picture above the words. So the wording names
   which videos it means — the ones in the background — and each clause appears if
   and only if its own set still needs it. */
export const mediaNotice =
  [
    Object.values(clips).some((set) =>
      [set.desktop, set.mobile].some((clip) => clip.provenance !== 'official'),
    ) && 'I video di sfondo illustrano le attività: non sono riprese del maneggio.',
  ]
    .filter(Boolean)
    .join(' ')

/* ── The closing ───────────────────────────────────────────────────────────
   Title, one action, the confirmed contacts, the position, then the small print.
   Everything a visitor needs in order to write is here, once. */
export const closing = {
  id: 'contatti',
  title: 'Vieni a conoscerci',
  text: 'Raccontaci che cosa ti piacerebbe provare. Ti rispondiamo con i dettagli sulle attività e sulla disponibilità.',
  cta: {
    label: 'Scrivici',
    href: social.instagram,
    kind: 'social',
    externalName: 'Instagram',
  } as Cta,
  /* The telephone before the social profiles, not after. It is the only route on
     this page that reaches a person directly, and a visitor who came to ask about
     a horse should not have to scroll past two platforms to find it. */
  links: [
    { label: 'Telefono', value: contact.phone, href: contact.phoneHref, external: false },
    { label: 'Instagram', value: social.instagramHandle, href: social.instagram, external: true },
    { label: 'Facebook', value: social.facebookName, href: social.facebook, external: true },
  ] as {
    label: string
    value: string
    href: string
    /** Whether it opens another application or another tab, which the visible
        label says out loud for anyone who cannot see the icon change. */
    external: boolean
  }[],
  location: {
    confirmed: true,
    address: 'Strada di Sabione 129, Terni',
    /* The link the maneggio supplied, not a search for its address.
       A search URL and a place URL are not the same thing: the first is a search
       that returns whatever the engine decides, the second is a point somebody
       stood on. And a third-party embed would load a map, a script and a
       consent banner on a page that is otherwise entirely first-party, to draw a
       link that already works. */
    mapsUrl: 'https://maps.app.goo.gl/ZrxD5R7oRXE6e89V7?g_st=ic',
    mapsLabel: 'Apri Google Maps',
  },
  /* The questions the old page gave two full sections. They are useful, so they
     stay, as one disclosure that a visitor opens if they want it rather than
     two sections they have to scroll past to reach the contact details. */
  info: {
    id: 'prima-di-venire',
    title: 'Informazioni utili',
    lead: 'Per risponderti meglio, raccontaci che cosa vorresti fare, la tua esperienza e quando vorresti partecipare. Un messaggio non conferma una prenotazione.',
    items: [
      {
        question: 'Come richiedo informazioni?',
        answer:
          'Puoi chiamare Alberto al +39 349 238 7355 oppure scrivere su Instagram. Ti rispondiamo con informazioni e disponibilità.',
      },
      {
        question: 'Posso partecipare se non ho mai montato?',
        answer:
          'Raccontaci la tua esperienza. Il maneggio valuterà quale attività è adatta alla tua situazione e alla disponibilità dei cavalli.',
      },
      {
        question: 'Posso prenotare dal sito?',
        answer:
          'Il sito raccoglie le informazioni sulle attività. Le richieste e gli accordi si gestiscono direttamente con Alberto, per telefono o per messaggio.',
      },
      {
        question: 'Le immagini mostrano il maneggio?',
        answer:
          'Le fotografie e il video della sezione “Il maneggio” sono reali. I video di sfondo illustrano le attività.',
      },
    ],
  },
}