declare interface Window {
  __toggleTheme: () => void;
  __lang: string;
  __setLang: (lang: string) => void;
  __toggleMenu: () => void;
  __openCaptcha: () => void;
  __closeCaptcha: () => void;
  __refreshCaptcha: () => void;
  __verifyCaptcha: () => void;
  __triggerDownload: () => Promise<void>;
}
