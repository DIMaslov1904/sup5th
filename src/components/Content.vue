<template>
  <div class="content">
    <slot />
  </div>
</template>
<style lang="scss">
.content {
  font-size: 16px;
  font-weight: 500;
  line-height: 1.6;

  b,
  strong {
    font-weight: bold;
  }

  i {
    font-style: italic;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-weight: 800;
    margin-top: 24px;
    margin-bottom: 16px;
  }

  h1 {
    font-size: 20px;
  }

  h2 {
    font-size: 18px;
  }

  h3,
  h4,
  h5,
  h6 {
    font-size: 16px;
  }

  li:has(> *:first-child:is(h1, h2, h3, h4, h5, h6)) {
    --counter-weight: 800;
  }

  li:has(> *:first-child:is(h1)) {
    --counter-size: 20px;
  }

  li:has(> *:first-child:is(h2)) {
    --counter-size: 18px;
  }

  li:has(> *:first-child:is(h3, h4, h5, h6)) {
    --counter-size: 16px;
  }

  img,
  ol,
  ul,
  figure,
  blockquote {
    margin: 24px 0;
  }

  p {
    font-size: inherit;
    line-height: inherit;
    margin-bottom: 12px;
  }

  video,
  iframe,
  pre,
  img {
    display: block;
    max-width: 100%;
    border-radius: 16px;
  }

  figure {
    img {
      display: flex;
      margin: 0;
    }

    figcaption {
      margin-top: 12px;
    }
  }

  a {
    color: var(--color-link-view-default-typo-base);
    cursor: pointer;
    transition-property: text-decoration-color, color;
    transition-duration: 0.2s;
    outline-color: var(--color-control-view-action-focused);
    text-decoration: underline;
    text-underline-offset: 0.1em;
    -webkit-text-decoration-color: color-mix(
      in oklab,
      currentColor 30%,
      transparent
    );
    text-decoration-color: color-mix(in oklab, currentColor 30%, transparent);

    &:hover {
      -webkit-text-decoration-color: currentColor;
      text-decoration-color: currentColor;
    }

    &[href*="tel:"],
    &[href*="mailto:"] {
      white-space: nowrap;
    }

    &[href*=".pdf"],
    &[href*=".docx"],
    &[href*=".doc"],
    &[href*=".pptx"],
    &[href*=".xls"],
    &[href*=".xlsx"],
    &[href*=".txt"] {
      display: inline-flex;
      align-items: center;
      gap: 8px;

      &:before {
        content: "";
        flex-shrink: 0;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='https://www.w3.org/2000/svg' width='33' height='33' viewBox='0 0 33 33' fill='none'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M7.16667 1.375H21.0523L28.5 8.82272V28.0417C28.5 29.5144 27.3061 30.7083 25.8333 30.7083H7.16667C5.69391 30.7083 4.5 29.5144 4.5 28.0417V4.04167C4.5 2.56891 5.69391 1.375 7.16667 1.375ZM17.8359 4.03906H7.16406V28.0391H25.8307V12.0443H20.5026C19.0298 12.0443 17.8359 10.8504 17.8359 9.3776V4.03906ZM20.5026 4.59655V9.3776H25.2837L20.5026 4.59655ZM11.1641 22.7057V20.0391H19.1641V22.7057H11.1641ZM11.1641 14.7109V17.3776H21.8307V14.7109H11.1641Z' fill='%23042C4D'/%3E%3C/svg%3E");
        background-size: contain;
        background-repeat: no-repeat;
        width: 32px;
        height: 32px;
      }
    }
  }

  ol,
  ul {
    font-size: inherit;
    line-height: inherit;
    list-style-type: none;
    padding: 0;
    display: grid;
    gap: 16px;

    li {
      position: relative;
      margin-bottom: 4px;

      &:last-of-type {
        margin-bottom: 0;
      }

      &:before {
        position: relative;
        left: 0;
      }

      & > *:first-child {
        display: inline;
      }

      ol,
      ul {
        margin: 8px 0;
      }
    }
  }

  ol {
    list-style: none;
    counter-reset: li;

    p {
      margin-top: 12px;
    }

    & > li {
      --counter-weight: 600;
      --counter-size: inherit;

      &:before {
        counter-increment: li;
        content: counters(li, ".") ". ";
        top: 0;
        font-weight: var(--counter-weight);
        font-size: var(--counter-size);
      }
    }

    li {
      ol > li {
        padding-left: 3.5ch;
        margin-left: -2ch;

        ol > li {
          padding-left: 5ch;
          margin-left: -3ch;

          ol > li {
            padding-left: 6ch;
            margin-left: -4ch;

            ol > li {
              padding-left: 7.5ch;
              margin-left: -5ch;

              ol > li {
                padding-left: 9ch;
                margin-left: -6ch;

                ol > li {
                  padding-left: 10.5ch;
                  margin-left: -7ch;
                }
              }
            }
          }
        }
      }
    }
  }

  ul {
    li {
      padding-left: 2em;

      &:before {
        content: "— ";
        font-size: inherit;
        line-height: inherit;
        top: 0;
      }
    }
  }

  table {
    border-collapse: collapse;
    border-spacing: 0;
    border: 0;
    font-weight: inherit;

    thead,
    tr th {
      font-weight: 400;
      font-size: inherit;
      vertical-align: top;
    }

    thead,
    tr {
      text-align: left;
    }

    td,
    th {
      padding: 16px 16px 16px 0;
      border-bottom: 1px solid #bbb;
      vertical-align: top;

      &:last-child {
        padding-right: 0;
      }

      p {
        margin-bottom: 0.5em;
        font-weight: 500;

        &:last-child {
          margin-bottom: 0;
        }
      }
    }
  }

  div:has(> table) {
    --can-scroll: 0;
    --can-scroll-r: 1;

    width: calc(100% + var(--container-padding-x) * 2 * var(--can-scroll));

    position: relative;
    margin: 24px 0;
    margin-left: calc(-1 * var(--container-padding-x) * var(--can-scroll));
    animation: detect-scroll;
    animation-timeline: scroll(self x);
    overflow-x: auto;

    background:
      linear-gradient(90deg, white 30%, rgba(0 0 0 / 0)),
      linear-gradient(90deg, rgba(0 0 0 / 0), white 70%) 0 100%,
      radial-gradient(farthest-side at -50% 35%, black, rgba(255 255 255 / 0)),
      radial-gradient(farthest-side at 150% 35%, black, rgba(255 255 255 / 0)) 0
        100%;
    background-repeat: no-repeat;
    background-position:
      top left,
      top right,
      top left,
      top right;
    background-size:
      32px 100%,
      32px 100%,
      16px 140%,
      16px 140%;
    background-attachment: local, local, scroll, scroll;

    table {
      margin: 0 calc(var(--container-padding-x) * var(--can-scroll));
    }
  }

  *:first-child {
    margin-top: 0;
  }

  *:not(h1):last-child {
    margin-bottom: 0;

    img {
      margin-bottom: 0;
    }
  }

  blockquote {
    position: relative;
    background-color: var(--color-content-inverse);
    border-radius: var(--border-radius);
    padding: 24px;
    padding-left: 72px;
    padding-right: 24px;

    &:before {
      content: "";
      position: absolute;
      top: 24px;
      left: 24px;
      width: 32px;
      height: 32px;
      background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='https://www.w3.org/2000/svg' width='32' height='33' fill='none'%3e%3cpath fill='%23042C4D' d='M7 24.117v-4.184c0-1.258.228-2.555.683-3.89a16.592 16.592 0 0 1 1.93-3.832c.811-1.218 1.712-2.249 2.701-3.094l3.77 2.24a22.586 22.586 0 0 0-1.9 3.86c-.514 1.356-.771 2.918-.771 4.686v4.214H7Zm9.916 0v-4.184c0-1.258.227-2.555.682-3.89a16.595 16.595 0 0 1 1.93-3.832c.812-1.218 1.712-2.249 2.702-3.094l3.77 2.24a22.586 22.586 0 0 0-1.9 3.86c-.515 1.356-.772 2.918-.772 4.686v4.214h-6.412Z'/%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-size: contain;
    }

    *:first-child {
      margin-top: 0;
    }

    *:last-child {
      margin-bottom: 0;
    }
  }

  pre {
    overflow: hidden;
  }

  div:has(> a > img) {
    margin-bottom: 12px;
  }

  figure {
    display: inline-block;
  }

  .gallary_scroll {
    padding-bottom: 6px;
    margin-bottom: 6px;
  }

  .gallary {
    display: flex;
    gap: var(--grid-guttet);

    a {
      max-width: 400px;
      flex: 1 1 200px;
      aspect-ratio: 16/10;
    }

    img {
      width: 100%;
    }

    &:not(.gallary_scroll) {
      flex-wrap: wrap;
    }

    &.gallary_scroll {
      overflow-x: auto;

      a {
        flex: 1 0 200px;
      }

      img {
        min-width: 200px;
      }
    }
  }
}

body.content {
  .gallary {
    border: 1px dashed goldenrod;
    padding: 16px;

    a {
      border: 1px dashed red;
    }
  }

  .gallary_scroll {
    border: 1px dashed gray;
    padding: 16px;

    a {
      border: 1px dashed red;
    }
  }
}
</style>
