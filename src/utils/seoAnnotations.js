export const SEO_ANNOTATIONS = ['external', 'noindex', 'headings', 'alt', 'downloads']

export const seoAnnotations = actions => Object.fromEntries(SEO_ANNOTATIONS.map(name => [name, Boolean(actions?.[name])]))

export const seoAnnotationsKey = tabId => `seoAnnotations:${tabId}`
