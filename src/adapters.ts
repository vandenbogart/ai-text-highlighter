export interface SiteAdapter {
  matches(hostname: string): boolean;
  textElements(root: ParentNode): HTMLElement[];
}

const xAdapter: SiteAdapter = {
  matches: (hostname) =>
    ["x.com", "twitter.com"].some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    ),
  textElements: (root) => [
    ...root.querySelectorAll<HTMLElement>('article [data-testid="tweetText"]'),
  ],
};

export const adapters: SiteAdapter[] = [xAdapter];
