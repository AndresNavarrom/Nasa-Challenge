// Credits page (ui/Credits.tsx): every resource the project uses, taken from the
// team's reference sheet "referencias_formato_NASA_revisado.xlsx" (column A is the
// link text, column B the link). Review notes of the sheet are not shown.
//
// Kept free of React so it can be tested in Node.

export interface Credit {
  /** Link text, as written in the sheet. */
  text: string;
  url: string;
}

export interface CreditGroup {
  id: string;
  title: string;
  items: readonly Credit[];
}

export const CREDIT_GROUPS: readonly CreditGroup[] = [
  {
    id: "nasa",
    title: "NASA data and resources",
    items: [
      { text: "“Cosmic Echoes” Audio Activation – NASA Scientific Visualization Studio (video CosmicEchoes.mp4)", url: "https://svs.gsfc.nasa.gov/vis/a010000/a014900/a014983/CosmicEchoes.mp4" },
      { text: "27 Storms: Arlene to Zeta – NASA/Goddard Space Flight Center Scientific Visualization Studio", url: "https://svs.gsfc.nasa.gov/3354/" },
      { text: "Leveraging NASA Research to Safeguard the U.S. East Coast from Hurricanes – NASA's Goddard Space Flight Center", url: "https://svs.gsfc.nasa.gov/14369/" },
      { text: "Pursuit of Light – NASA/Goddard Space Flight Center", url: "https://svs.gsfc.nasa.gov/10958/" },
      { text: "GEDI L3 Gridded Land Surface Metrics V3 (altura del dosel, ORNL DAAC)", url: "https://www.earthdata.nasa.gov/data/catalog/ornl-cloud-gedi-l3-landsurface-metrics-v3-2525-3" },
      { text: "MERRA-2 M2T1NXAER V5.12.4 (aerosoles, humo de incendios, GES DISC)", url: "https://disc.gsfc.nasa.gov/datasets/M2T1NXAER_5.12.4/summary" },
      { text: "OCO-2 GEOS Level 3 Daily CO2 V10r (CO2 atmosférico, GES DISC)", url: "https://disc.gsfc.nasa.gov/datasets/OCO2_GEOS_L3CO2_DAY_10r/summary" },
      { text: "NASA SVS 5011: Lightning Events Detected from the ISS 2017-2023 (LIS)", url: "https://svs.gsfc.nasa.gov/5011" },
      { text: "NASA SVS 4950: GEDI Forest Height (relleno de zonas sin medición)", url: "https://svs.gsfc.nasa.gov/4950" },
      { text: "NASA Earthdata (portal de descarga y login)", url: "https://www.earthdata.nasa.gov/" },
      { text: "NASA Space Apps Challenge: The Earth Information Jukebox", url: "https://www.spaceappschallenge.org/" },
      { text: "Fotografía del río Amazonas – NASA Image and Video Library (iss074e0492148)", url: "https://images.nasa.gov/details/iss074e0492148" },
      { text: "Amazon River in the Atlantic Ocean – NASA Earth Observatory (Jesse Allen)", url: "https://science.nasa.gov/earth/earth-observatory/amazon-river-in-the-atlantic-ocean-7021/" },
    ],
  },
  {
    id: "sounds",
    title: "Sounds",
    items: [
      { text: "Huge Thunder Crack [XY + MS] – -CASK- (Freesound, CC BY 4.0)", url: "https://freesound.org/people/-CASK-/sounds/732992/" },
      { text: "Thunder Claps, Single Clap 10 – PNMCarrieRailfan (Freesound, CC BY-NC 4.0)", url: "https://freesound.org/people/PNMCarrieRailfan/sounds/682355/" },
      { text: "steam.WAV – JustineOu (Freesound, CC0)", url: "https://freesound.org/people/JustineOu/sounds/672248/" },
      { text: "Aves y una lluvia ligera con truenos en la mañana Matera (Birds and light rain with thunder in the morning in Matera) – Guillermo_de_La_Matera (Freesound, CC BY 4.0)", url: "https://freesound.org/people/Guillermo_de_La_Matera/sounds/796448/" },
      { text: "Aves y una suave brisa en la mañana Matera (Birds and a gentle breeze in the morning in Matera) – Guillermo_de_La_Matera (Freesound, CC BY 4.0)", url: "https://freesound.org/people/Guillermo_de_La_Matera/sounds/797588/" },
      { text: "Jungle Meets Ocean - Pulau Seram, Indonesia – RTB45 (Freesound, CC BY 4.0)", url: "https://freesound.org/people/RTB45/sounds/257822/" },
      { text: "insecto_Lacandon2.wav – nicotep (Freesound, CC0)", url: "https://freesound.org/people/nicotep/sounds/619554/" },
      { text: "caldo hirviendo [boiling soup] – AntonioZozobra (Freesound, CC0)", url: "https://freesound.org/people/AntonioZozobra/sounds/464649/" },
      { text: "Ambient_nature_tropical.wav – Chuchita (Freesound, CC0)", url: "https://freesound.org/people/Chuchita/sounds/528578/" },
      { text: "Sylvia Atricapilla. SelvaLAMAwav – UrbanSoundBcn (Freesound, CC BY-NC 3.0)", url: "https://freesound.org/people/UrbanSoundBcn/sounds/395898/" },
      { text: "Myiopsitta monachus - SelvaLAMA14.wav – UrbanSoundBcn (Freesound, CC BY-NC 3.0)", url: "https://freesound.org/people/UrbanSoundBcn/sounds/384526/" },
      { text: "Selva.wav – universildo (Freesound, CC0)", url: "https://freesound.org/people/universildo/sounds/151776/" },
      { text: "river Waal 1236PM 211010_0317.wav – klankbeeld (Freesound, CC BY 4.0)", url: "https://freesound.org/people/klankbeeld/sounds/625646/" },
      { text: "River Teign upstream from Teign Gorge, with early spring birds – Philip_Goddard (Freesound, CC BY-NC 4.0)", url: "https://freesound.org/people/Philip_Goddard/sounds/700445/" },
      { text: "Flauta de Amolador - Lisboa 01-08-2021 - Flute Sound in Lisbon – hcv242 (Freesound, CC0)", url: "https://freesound.org/people/hcv242/sounds/581728/" },
      { text: "tambor mexica.wav – XiscoVar (Freesound, CC0)", url: "https://freesound.org/people/XiscoVar/sounds/482884/" },
      { text: "Large Bamboo Maraca – JarredGibb (Freesound, CC0)", url: "https://freesound.org/people/JarredGibb/sounds/263884/" },
      { text: "MUSCShake_Maracas, Shake_Nicholas Judy_TDC – designerschoice (Freesound, CC BY 4.0)", url: "https://freesound.org/people/designerschoice/sounds/809135/" },
      { text: "Macaw Squawks – loganzsound (Freesound, CC0)", url: "https://freesound.org/people/loganzsound/sounds/875522/" },
      { text: "Toucan Bird Croaking Sound – Alejpix (Freesound, CC BY-NC 4.0)", url: "https://freesound.org/people/Alejpix/sounds/785613/" },
      { text: "Toucans - Keel-billed Toucan – TheKingOfGeeks360 (Freesound, CC0)", url: "https://freesound.org/people/TheKingOfGeeks360/sounds/845715/" },
      { text: "bulldozer.wav – jasonlee3071 (Freesound, CC0)", url: "https://freesound.org/people/jasonlee3071/sounds/688611/" },
      { text: "Tree Chainsawed Drops.m4a – RutgerMuller (Freesound, CC0)", url: "https://freesound.org/people/RutgerMuller/sounds/535352/" },
      { text: "old fallen tree stepping.wav – KrystianPawlowski (Freesound, CC0)", url: "https://freesound.org/people/KrystianPawlowski/sounds/584893/" },
      { text: "tree bark stepping cracking.wav – KrystianPawlowski (Freesound, CC0)", url: "https://freesound.org/people/KrystianPawlowski/sounds/584889/" },
      { text: "Storm200408.mp3 – csengeri (Freesound, CC BY 4.0)", url: "https://freesound.org/people/csengeri/sounds/27247/" },
      { text: "Amazonian Dolphins – felix.blume (Freesound, CC0)", url: "https://freesound.org/people/felix.blume/sounds/408555/" },
      { text: "oceanwaves-10.wav – Rmutt (Freesound, CC0)", url: "https://freesound.org/people/Rmutt/sounds/156598/" },
      { text: "Female alligator bellow and juveniles answer, SMNWR – KevinSonger (Freesound, CC BY 4.0)", url: "https://freesound.org/people/KevinSonger/sounds/689966/" },
    ],
  },
  {
    id: "map-data",
    title: "Map data",
    items: [
      { text: "Natural Earth I with Shaded Relief and Water (imagen base del planeta)", url: "https://www.naturalearthdata.com/downloads/10m-raster-data/10m-natural-earth-1/" },
      { text: "Natural Earth Admin 0 Countries 1:50m (regiones del mundo)", url: "https://www.naturalearthdata.com/downloads/50m-cultural-vectors/" },
    ],
  },
  {
    id: "code",
    title: "Open-source code and tools",
    items: [
      { text: "three.js", url: "https://threejs.org/" },
      { text: "React Three Fiber", url: "https://github.com/pmndrs/react-three-fiber" },
      { text: "React", url: "https://react.dev/" },
      { text: "GSAP", url: "https://gsap.com/" },
      { text: "driver.js (tutorial guiado)", url: "https://driverjs.com/" },
      { text: "Tailwind CSS", url: "https://tailwindcss.com/" },
      { text: "Vite", url: "https://vite.dev/" },
      { text: "Fontsource: Inter, Sora y JetBrains Mono (licencia OFL)", url: "https://fontsource.org/" },
      { text: "Axum (servidor local en Rust)", url: "https://github.com/tokio-rs/axum" },
      { text: "Docker", url: "https://www.docker.com/" },
    ],
  },
  {
    id: "other",
    title: "Other references (not NASA)",
    items: [
      { text: "Understanding Rivers – National Geographic Education", url: "https://education.nationalgeographic.org/resource/understanding-rivers/" },
      { text: "Informe especial: el lado oscuro del turismo de fauna salvaje en el Amazonas – National Geographic Latinoamérica", url: "https://www.nationalgeographicla.com/animales/2018/12/informe-especial-el-lado-oscuro-del-turismo-de-fauna-salvaje-en-el-amazonas" },
      { text: "Imagen (2019-07-21) – Pixnio", url: "https://pixnio.com/free-images/2019/07/21/2019-07-21-18-56-18-576x324.jpg" },
      { text: "Imagen – Flickr (3897727717)", url: "https://live.staticflickr.com/2438/3897727717_6c8ec155ca_b.jpg" },
      { text: "Rainforests, Explained – National Geographic Education", url: "https://education.nationalgeographic.org/resource/rainforests-explained/" },
      { text: "Why deforestation matters—and what we can do to stop it – National Geographic", url: "https://www.nationalgeographic.com/environment/article/deforestation" },
      { text: "Imagen (2018-06-21) – Pixnio", url: "https://pixnio.com/free-images/2018/06/21/2018-06-21-20-58-42-1152x922.jpg" },
      { text: "Imagen – Google Imágenes (miniatura; origen por identificar)", url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSuwiPTgH-7nOsgyk9UFvaY7XF8xTJ8m9SRXzkIlx9LAraMIwjUEHox3NOY&s=10" },
      { text: "Rising Dryness, Storms Speed Amazon Forest Biomass Cycle – Scienmag", url: "https://scienmag.com/wp-content/uploads/2026/05/Rising-Dryness-Storms-Speed-Amazon-Forest-Biomass-Cycle-1778686114.jpg" },
    ],
  },
];

/** The site of a link without "www." ("svs.gsfc.nasa.gov"), shown under each credit. */
export function creditHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Every credit, all groups together. */
export function allCredits(): Credit[] {
  return CREDIT_GROUPS.flatMap((group) => group.items);
}
