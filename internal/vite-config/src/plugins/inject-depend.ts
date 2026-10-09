/**
 * https://github.com/ahwgs/vite-plugin-html-config/blob/master/src/index.ts
 */

import type {
  HtmlTagDescriptor,
  IndexHtmlTransformContext,
  PluginOption,
} from 'vite';

export interface IHTMLTag {
  [key: string]: boolean | string;
}

export type ScriptTag = Record<string, boolean | string> | string;

export interface InjectDependOptions {
  favicon?: string;
  headScripts?: ScriptTag[];
  links?: IHTMLTag[];
  metas?: IHTMLTag[];
  preHeadScripts?: ScriptTag[];
  scripts?: ScriptTag[];
  style?: string;
  title?: string;
}

export interface InjectDependPluginOptions {
  build?: boolean;
  index?: InjectDependOptions;
  pages?: {
    [key: string]: InjectDependOptions;
  };
}

const wrapContent = (
  script: any,
  injectTo: ('body' | 'body-prepend' | 'head' | 'head-prepend') & string,
): HtmlTagDescriptor => {
  let result: HtmlTagDescriptor;
  if (typeof script === 'object' && script?.src) {
    result = {
      tag: 'script',
      injectTo,
      attrs: { ...script },
    };
  } else if (typeof script === 'object' && script?.content) {
    const { content, ...attr } = script;
    result = {
      tag: 'script',
      injectTo,
      attrs: { ...attr },
      children: `${content}`,
    };
  } else {
    result = {
      tag: 'script',
      injectTo,
      children: `${script}`,
    };
  }
  return result;
};

const transformHtmlHandler = async (
  html: string,
  options: InjectDependOptions,
) => {
  const {
    favicon,
    title,
    headScripts = [],
    metas = [],
    links = [],
    style,
    scripts = [],
    preHeadScripts = [],
  } = options;

  let resultHtmlStr = html;
  const htmlResult: HtmlTagDescriptor[] = [];
  if (favicon) {
    htmlResult.push({
      tag: 'link',
      attrs: {
        rel: 'shortcut icon',
        type: 'image/x-icon',
        href: favicon,
      },
      injectTo: 'head',
    });
  }
  if (metas.length > 0) {
    metas.forEach((meta) => {
      htmlResult.push({
        tag: 'meta',
        injectTo: 'head',
        attrs: { ...meta },
      });
    });
  }
  if (links.length > 0) {
    links.forEach((meta) => {
      htmlResult.push({
        tag: 'link',
        injectTo: 'head',
        attrs: { ...meta },
      });
    });
  }
  if (style && style.length > 0) {
    htmlResult.push({
      tag: 'style',
      injectTo: 'head',
      children: `${style}`
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n'),
    });
  }
  if (title && title.length > 0) {
    resultHtmlStr = html.replace(
      /<title>(.*?)<\/title>/,
      `<title>${title}</title>`,
    );
  }
  if (headScripts.length > 0) {
    headScripts.forEach((script) => {
      htmlResult.push(wrapContent(script, 'head'));
    });
  }
  if (scripts.length > 0) {
    scripts.forEach((script) => {
      htmlResult.push(wrapContent(script, 'body'));
    });
  }
  if (preHeadScripts.length > 0) {
    preHeadScripts.forEach((script) => {
      htmlResult.push(wrapContent(script, 'head-prepend'));
    });
  }
  return {
    html: resultHtmlStr,
    tags: htmlResult,
  };
};

const matchHtmlKey = (path: string) => {
  const lastIndex = path.lastIndexOf('/');
  const filename = path.slice(Math.max(0, lastIndex + 1));
  return filename.slice(0, Math.max(0, filename.lastIndexOf('.')));
};

async function viteInjectDependPlugin(
  htmlOptions: InjectDependPluginOptions,
): Promise<PluginOption | undefined> {
  const pagesOptions = htmlOptions.pages;
  const indexOptions = htmlOptions.index;
  let pluginOptions: Record<string, InjectDependOptions> = {} as Record<
    string,
    InjectDependOptions
  >;
  if (pagesOptions) {
    pluginOptions = pagesOptions;
  } else if (indexOptions) {
    pluginOptions = {
      index: indexOptions,
    };
  }
  if (Object.entries(pluginOptions).length === 0) {
    return {} as PluginOption;
  }

  return {
    name: 'vite:inject-depend-plugin',
    enforce: 'pre',
    async transformIndexHtml(html: string, ctx: IndexHtmlTransformContext) {
      const htmlPath: string = ctx.path;
      const htmlKey: string = matchHtmlKey(htmlPath);
      const options: InjectDependOptions = pluginOptions[htmlKey] || {};
      if (!options || Object.entries(pluginOptions).length === 0) {
        return;
      }
      return await transformHtmlHandler(html, options);
    },
  } as PluginOption;
}

export { viteInjectDependPlugin };
