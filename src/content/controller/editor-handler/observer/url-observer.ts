export class UrlObserver {
  private currentUrl: string | undefined;
  private isStarted: boolean;
  private interval: number;
  private urlChangedCallback: (url: string) => Promise<void>;

  constructor(changedCallback: (url: string) => Promise<void>, interval = 100) {
    this.currentUrl = undefined;
    this.isStarted = false;
    this.interval = interval;
    this.urlChangedCallback = changedCallback;
  }

  start() {
    if (this.isStarted) {
      return;
    }
    this.isStarted = true;
    this.checkUrl();
  }

  stop() {
    this.isStarted = false;
  }

  checkUrl() {
    window.setTimeout(() => {
      const url = window.location.href;

      if (url !== this.currentUrl) {
        this.currentUrl = url;
        this.urlChangedCallback(url);
      }
      this.checkUrl();
    }, this.interval);
  }

  getUrl() {
    return this.currentUrl;
  }
}
