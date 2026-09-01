/**
 * ZerebroKid Multi-Theme Engine — Theme Definitions.
 *
 * Design: "Choose Your World" — ZerebroKid Theme Layer doc.
 *
 * Architecture:
 *  - Only colours and image slots change per theme.
 *  - Architecture, navigation, business logic, APIs, Firebase: UNCHANGED.
 *  - 'classic' is the fallback — keeps original light violet design.
 *  - Non-classic themes (Velocity, Future City, Fantasy Quest) have their exact colors & image slot mapping.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ThemeId = 'velocity' | 'future-city' | 'fantasy-quest' | 'classic';

export interface ThemeColors {
  /** App background */
  bg: string;
  /** Primary card/surface */
  surface: string;
  /** Alternate / elevated card surface */
  surfaceAlt: string;
  /** Inner badge / small box background inside card */
  cardInner: string;
  /** Card & nav border */
  border: string;
  /** Dashed border for locked items */
  borderDashed: string;
  /** Highlight border for active/selected items */
  borderAccent: string;
  /** Primary brand / accent color */
  primary: string;
  /** Secondary accent */
  secondary: string;
  /** Third accent / tag color */
  accent: string;
  /** Success / completed green-teal */
  success: string;
  /** Primary headline text */
  text: string;
  /** Subtitle / muted text */
  mutedText: string;
  /** Secondary body text */
  textSecondary: string;
  /** Accent-tinted muted text for highlight labels */
  textAccentMuted: string;
  /** Text color rendered ON top of primary color buttons/badges */
  onPrimary: string;
  /** Text color rendered ON secondary */
  onSecondary: string;
  /** Text color rendered ON accent */
  onAccent: string;
  /** Bottom nav background */
  navBg: string;
  /** Active bottom-nav tab */
  navActive: string;
  /** Inactive bottom-nav tab */
  navInactive: string;
  /** Header banner gradient start */
  headerGradStart: string;
  /** Header banner gradient mid */
  headerGradMid: string;
  /** Header banner gradient end */
  headerGradEnd: string;
  /** Main button gradient start */
  buttonGradStart: string;
  /** Main button gradient end */
  buttonGradEnd: string;
  /** Badge background */
  badgeBg: string;
  /** Badge border */
  badgeBorder: string;
  /** True for dark themes (affects StatusBar and icons) */
  isDark: boolean;
}

export interface ThemeImages {
  /** Mission card banner (Home screen hero) */
  homeHero: any;
  /** Mathematics subject card banner */
  subjectMaths: any;
  /** Science subject card banner */
  subjectScience: any;
  /** English subject card banner */
  subjectEnglish: any;
  /** Topic detail hero banner */
  topicHeader: any;
  /** Quiz screen header banner */
  quizHeader: any;
  /** Quiz result hero banner */
  resultHeader: any;
  /** Games reward category banner */
  rewardGames: any;
  /** Videos reward category banner */
  rewardVideos: any;
  /** Offers reward category banner */
  rewardOffers: any;
  /** Claim reward card thumbnail */
  claimReward: any;
  /** Small quiz preview thumbnail */
  quizThumb: any;
  /** Reward unlock card banner */
  rewardBanner: any;
  /** Theme picker card header image */
  themeCover: any;
}

export interface ThemeColorSwatches {
  primary: string;
  secondary: string;
  tertiary: string;
  bg: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  tagline: string;
  colors: ThemeColors;
  images: ThemeImages;
  swatches: ThemeColorSwatches;
}

// ─────────────────────────────────────────────────────────────────────────────
// THEME: VELOCITY
// Neon racing · speed & adrenaline
// Primary: Cyan #00E5FF  |  Accent2: Pink #FF2E93  |  Purple: #7C4DFF
// ─────────────────────────────────────────────────────────────────────────────

const velocity: ThemeDefinition = {
  id: 'velocity',
  name: 'Velocity',
  tagline: 'Neon racing · speed & adrenaline',
  colors: {
    bg: '#0A0716',
    surface: '#140E28',
    surfaceAlt: '#161033',
    cardInner: '#1B1436',
    border: '#2A2148',
    borderDashed: '#3A2C63',
    borderAccent: '#00E5FF',
    primary: '#00E5FF',
    secondary: '#7C4DFF',
    accent: '#FF2E93',
    success: '#34E7B5',
    text: '#FFFFFF',
    mutedText: '#8E86AD',
    textSecondary: '#C9C2E0',
    textAccentMuted: '#7BE9FF',
    onPrimary: '#0A0716',
    onSecondary: '#FFFFFF',
    onAccent: '#FFFFFF',
    navBg: '#120C24',
    navActive: '#00E5FF',
    navInactive: '#6E6690',
    headerGradStart: '#12224A',
    headerGradMid: '#1B0E3A',
    headerGradEnd: '#0A0716',
    buttonGradStart: '#00E5FF',
    buttonGradEnd: '#7C4DFF',
    badgeBg: 'rgba(0,229,255,0.16)',
    badgeBorder: 'rgba(0,229,255,0.36)',
    isDark: true,
  },
  images: {
    homeHero: require('../assets/themes/img01.png'),
    subjectMaths: require('../assets/themes/img04.png'),
    subjectScience: require('../assets/themes/img03.png'),
    subjectEnglish: require('../assets/themes/img18.png'),
    topicHeader: require('../assets/themes/img18.png'),
    quizHeader: require('../assets/themes/img12.png'),
    resultHeader: require('../assets/themes/img06.png'),
    rewardGames: require('../assets/themes/img15.png'),
    rewardVideos: require('../assets/themes/img14.png'),
    rewardOffers: require('../assets/themes/img19.png'),
    claimReward: require('../assets/themes/img13.png'),
    quizThumb: require('../assets/themes/img05.png'),
    rewardBanner: require('../assets/themes/img16.png'),
    themeCover: require('../assets/themes/img01.png'),
  },
  swatches: {
    primary: '#00E5FF',
    secondary: '#FF2E93',
    tertiary: '#7C4DFF',
    bg: '#0A0716',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// THEME: FUTURE CITY
// Skylines · holograms · tomorrow
// Primary: Cyan #22D3EE  |  Green: #34E7B5  |  Gold: #F59E0B
// ─────────────────────────────────────────────────────────────────────────────

const futureCity: ThemeDefinition = {
  id: 'future-city',
  name: 'Future City',
  tagline: 'Skylines · holograms · tomorrow',
  colors: {
    bg: '#050C18',
    surface: '#0C1626',
    surfaceAlt: '#081321',
    cardInner: '#132538',
    border: '#1B2C42',
    borderDashed: '#24405E',
    borderAccent: '#22D3EE',
    primary: '#22D3EE',
    secondary: '#34E7B5',
    accent: '#F59E0B',
    success: '#4ADE80',
    text: '#FFFFFF',
    mutedText: '#7C93AD',
    textSecondary: '#BFD3E6',
    textAccentMuted: '#7DD3FC',
    onPrimary: '#050C18',
    onSecondary: '#04222A',
    onAccent: '#04222A',
    navBg: '#0A1320',
    navActive: '#22D3EE',
    navInactive: '#5C7590',
    headerGradStart: '#0E2340',
    headerGradMid: '#0A1830',
    headerGradEnd: '#050C18',
    buttonGradStart: '#22D3EE',
    buttonGradEnd: '#34E7B5',
    badgeBg: 'rgba(34,211,238,0.16)',
    badgeBorder: 'rgba(34,211,238,0.36)',
    isDark: true,
  },
  images: {
    homeHero: require('../assets/themes/img09.png'),
    subjectMaths: require('../assets/themes/img10.png'),
    subjectScience: require('../assets/themes/img07.png'),
    subjectEnglish: require('../assets/themes/img11.png'),
    topicHeader: require('../assets/themes/img09.png'),
    quizHeader: require('../assets/themes/img12.png'),
    resultHeader: require('../assets/themes/img10.png'),
    rewardGames: require('../assets/themes/img11.png'),
    rewardVideos: require('../assets/themes/img07.png'),
    rewardOffers: require('../assets/themes/img08.png'),
    claimReward: require('../assets/themes/img14.png'),
    quizThumb: require('../assets/themes/img13.png'),
    rewardBanner: require('../assets/themes/img10.png'),
    themeCover: require('../assets/themes/img09.png'),
  },
  swatches: {
    primary: '#22D3EE',
    secondary: '#34E7B5',
    tertiary: '#F59E0B',
    bg: '#050C18',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// THEME: FANTASY QUEST
// Castles · magic · adventure
// Primary: Gold #FFB020  |  Green: #4ADE80  |  Purple: #8B5CF6
// ─────────────────────────────────────────────────────────────────────────────

const fantasyQuest: ThemeDefinition = {
  id: 'fantasy-quest',
  name: 'Fantasy Quest',
  tagline: 'Castles · magic · adventure',
  colors: {
    bg: '#100C1E',
    surface: '#1A142C',
    surfaceAlt: '#140F26',
    cardInner: '#241C3C',
    border: '#302748',
    borderDashed: '#3F3360',
    borderAccent: '#FFB020',
    primary: '#FFB020',
    secondary: '#8B5CF6',
    accent: '#4ADE80',
    success: '#4ADE80',
    text: '#FFFFFF',
    mutedText: '#A398BF',
    textSecondary: '#D9CFEB',
    textAccentMuted: '#FFD79A',
    onPrimary: '#100C1E',
    onSecondary: '#FFFFFF',
    onAccent: '#2A1A00',
    navBg: '#16112A',
    navActive: '#FFB020',
    navInactive: '#7A6E96',
    headerGradStart: '#241934',
    headerGradMid: '#1A1030',
    headerGradEnd: '#100C1E',
    buttonGradStart: '#FFB020',
    buttonGradEnd: '#8B5CF6',
    badgeBg: 'rgba(255,176,32,0.16)',
    badgeBorder: 'rgba(255,176,32,0.36)',
    isDark: true,
  },
  images: {
    homeHero: require('../assets/themes/img16.png'),
    subjectMaths: require('../assets/themes/img17.png'),
    subjectScience: require('../assets/themes/img20.png'),
    subjectEnglish: require('../assets/themes/img16.png'),
    topicHeader: require('../assets/themes/img20.png'),
    quizHeader: require('../assets/themes/img20.png'),
    resultHeader: require('../assets/themes/img16.png'),
    rewardGames: require('../assets/themes/img17.png'),
    rewardVideos: require('../assets/themes/img20.png'),
    rewardOffers: require('../assets/themes/img16.png'),
    claimReward: require('../assets/themes/img17.png'),
    quizThumb: require('../assets/themes/img20.png'),
    rewardBanner: require('../assets/themes/img20.png'),
    themeCover: require('../assets/themes/img20.png'),
  },
  swatches: {
    primary: '#FFB020',
    secondary: '#4ADE80',
    tertiary: '#8B5CF6',
    bg: '#100C1E',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// THEME: CLASSIC
// The original light violet design — default.
// ─────────────────────────────────────────────────────────────────────────────

const classic: ThemeDefinition = {
  id: 'classic',
  name: 'ZerebroKid Classic',
  tagline: 'The original light violet design · default',
  colors: {
    bg: '#F5F5FB',
    surface: '#FFFFFF',
    surfaceAlt: '#F0EFFC',
    cardInner: '#EDE6FF',
    border: '#E8E8F2',
    borderDashed: '#D0C8F0',
    borderAccent: '#6D3BFF',
    primary: '#6D3BFF',
    secondary: '#7C4DFF',
    accent: '#FF7A1A',
    success: '#12B76A',
    text: '#14142B',
    mutedText: '#6B6B85',
    textSecondary: '#33334D',
    textAccentMuted: '#8B62FF',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onAccent: '#FFFFFF',
    navBg: '#FFFFFF',
    navActive: '#6D3BFF',
    navInactive: '#A9A9C0',
    headerGradStart: '#6D3BFF',
    headerGradMid: '#5C2EE0',
    headerGradEnd: '#4E24E0',
    buttonGradStart: '#7C4DFF',
    buttonGradEnd: '#4E24E0',
    badgeBg: '#EDE6FF',
    badgeBorder: '#D0C8F0',
    isDark: false,
  },
  images: {
    homeHero: require('../assets/home-target.png'),
    subjectMaths: require('../assets/home-target.png'),
    subjectScience: require('../assets/home-target.png'),
    subjectEnglish: require('../assets/home-target.png'),
    topicHeader: require('../assets/home-target.png'),
    quizHeader: require('../assets/home-quiz.png'),
    resultHeader: require('../assets/home-target.png'),
    rewardGames: require('../assets/home-games.png'),
    rewardVideos: require('../assets/home-videos.png'),
    rewardOffers: require('../assets/home-offers.png'),
    claimReward: require('../assets/home-gift.png'),
    quizThumb: require('../assets/home-quiz.png'),
    rewardBanner: require('../assets/home-gift.png'),
    themeCover: require('../assets/home-target.png'),
  },
  swatches: {
    primary: '#6D3BFF',
    secondary: '#12B76A',
    tertiary: '#FF7A1A',
    bg: '#F5F5FB',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  velocity,
  'future-city': futureCity,
  'fantasy-quest': fantasyQuest,
  classic,
};

export const DEFAULT_THEME_ID: ThemeId = 'classic';
