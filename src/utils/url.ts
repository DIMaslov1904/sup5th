export const cleanUrl = (url: string) => {
  return url.replace("https://", "").replace("http://", "");
};

export const getDomain = (url: string) => {
  try {
    return new URL("https://" + cleanUrl(url)).host;
  } catch (_) {
    return url;
  }
};
