/**
 * What the demo account studies. Real material a learner in India might carry,
 * so the screens a visitor sees look like use rather than placeholder text.
 * `startDaysAgo` staggers when each subject was taken up, which is what gives
 * the heatmap and the forecast their shape.
 */
export interface DemoDeck {
  readonly title: string;
  readonly description: string;
  readonly color: string;
  readonly startDaysAgo: number;
  readonly cards: ReadonlyArray<readonly [front: string, back: string]>;
}

export const DEMO_DECKS: readonly DemoDeck[] = [
  {
    title: 'Indian Polity',
    description: 'Constitution, fundamental rights, Parliament',
    color: 'slate',
    startDaysAgo: 180,
    cards: [
      ['Which Part of the Constitution contains the Fundamental Rights?', 'Part III, Articles 12 to 35'],
      ['Which article guarantees equality before the law?', 'Article 14'],
      ['Which article abolishes untouchability?', 'Article 17'],
      ['What does Article 19(1)(a) protect?', 'Freedom of speech and expression'],
      ['Which article protects life and personal liberty?', 'Article 21'],
      ['Which article makes education a fundamental right for ages 6 to 14?', 'Article 21A'],
      ['Which article did Ambedkar call the heart and soul of the Constitution?', 'Article 32, the right to constitutional remedies'],
      ['Which amendment added the Fundamental Duties?', 'The 42nd Amendment, 1976'],
      ['How many Fundamental Duties are there now?', 'Eleven'],
      ['Which article defines the State for the purposes of Part III?', 'Article 12'],
      ['What is the maximum strength of the Lok Sabha?', '550 members'],
      ['Who presides over a joint sitting of Parliament?', 'The Speaker of the Lok Sabha'],
      ['Which article provides for the impeachment of the President?', 'Article 61'],
      ['What is the minimum age to become President of India?', '35 years'],
      ['Which schedule deals with anti defection?', 'The Tenth Schedule'],
      ['Which case established the basic structure doctrine?', 'Kesavananda Bharati v. State of Kerala, 1973'],
    ],
  },
  {
    title: 'Cell Biology',
    description: 'Organelles, respiration, photosynthesis',
    color: 'moss',
    startDaysAgo: 150,
    cards: [
      ['Where does the Krebs cycle take place?', 'In the mitochondrial matrix'],
      ['What molecule joins oxaloacetate to form citrate?', 'Acetyl CoA'],
      ['How many NADH are produced per turn of the Krebs cycle?', 'Three'],
      ['Which enzyme fixes carbon in the Calvin cycle?', 'RuBisCO'],
      ['Where do the light dependent reactions occur?', 'In the thylakoid membranes'],
      ['What are the folds of the inner mitochondrial membrane called?', 'Cristae'],
      ['How is mitochondrial DNA inherited?', 'Maternally'],
      ['Which organelle packages proteins for secretion?', 'The Golgi apparatus'],
      ['What is the site of protein synthesis?', 'Ribosomes'],
      ['Which phase of mitosis lines chromosomes up at the equator?', 'Metaphase'],
      ['What do C4 plants separate to reduce photorespiration?', 'Initial CO2 capture from the Calvin cycle, in space'],
      ['What is the net ATP gain from glycolysis?', 'Two ATP per glucose'],
    ],
  },
  {
    title: 'Spanish Basics',
    description: 'Everyday words and phrases',
    color: 'teal',
    startDaysAgo: 110,
    cards: [
      ['to remember', 'recordar'],
      ['to forget', 'olvidar'],
      ['yesterday', 'ayer'],
      ['tomorrow', 'mañana'],
      ['always', 'siempre'],
      ['never', 'nunca'],
      ['the library', 'la biblioteca'],
      ['the knowledge', 'el conocimiento'],
      ['I would like', 'me gustaría'],
      ['Where is the station?', '¿Dónde está la estación?'],
      ['It is late', 'Es tarde'],
      ['slowly', 'despacio'],
      ['to learn', 'aprender'],
      ['the week', 'la semana'],
    ],
  },
  {
    title: 'Computer Networks',
    description: 'Layers, protocols, the path of a packet',
    color: 'amber',
    startDaysAgo: 130,
    cards: [
      ['Which layer of the OSI model does IP work at?', 'The network layer, layer 3'],
      ['What does TCP add on top of IP?', 'Reliable, ordered delivery with retransmission'],
      ['Which port does HTTPS use by default?', '443'],
      ['What does DNS translate?', 'Names into IP addresses'],
      ['What are the three steps of the TCP handshake?', 'SYN, SYN ACK, ACK'],
      ['What does ARP resolve?', 'An IP address to a MAC address on the local network'],
      ['How many bits are in an IPv6 address?', '128'],
      ['What does a subnet mask of /24 leave for hosts?', 'The last 8 bits, 254 usable addresses'],
      ['Why is UDP used for live video?', 'A late packet is useless, so retransmitting it only adds delay'],
      ['What does NAT let a home network do?', 'Share one public address among many devices'],
      ['What does TLS provide?', 'Encryption, integrity and server authentication'],
      ['What is the default gateway?', 'The router a host sends traffic to when the destination is off its subnet'],
    ],
  },
  {
    title: 'System Design',
    description: 'Trade offs worth remembering',
    color: 'clay',
    startDaysAgo: 60,
    cards: [
      ['What does the CAP theorem force you to choose between during a partition?', 'Consistency or availability'],
      ['Why is cursor pagination preferred over offset?', 'Offset skips or repeats rows when data shifts underneath the reader'],
      ['What makes a request idempotent?', 'Repeating it has the same effect as making it once'],
      ['What problem does refresh token rotation with reuse detection solve?', 'A stolen refresh token cannot outlive the real session'],
      ['What is the N+1 query problem?', 'One query for a list, then one more per item in it'],
      ['Why hash passwords with argon2id rather than SHA 256?', 'It is memory hard, so guessing is expensive even on GPUs'],
      ['What does a row lock with NOWAIT do when the row is held?', 'Fails at once instead of waiting'],
      ['What is an append only log good for?', 'State can be rebuilt by replaying it'],
      ['What does a CDN cache?', 'Responses close to the reader, so repeat requests skip the origin'],
      ['What is backpressure?', 'A slow consumer telling a fast producer to slow down'],
    ],
  },
];
