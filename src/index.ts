import fs from 'fs/promises';
import { Plugin } from 'vite';
import { PluginBuild } from 'esbuild';
import MagicString, { SourceMap } from 'magic-string';

type ReplaceFn = (source: string, path: string) => string;
type ReplacePair = { from: RegExp | string | string[]; to: string | number };

interface Replacement {
  /**
   * for debugging purpose
   */
  id?: string | number;
  filter: RegExp | string | string[];
  replace: ReplacePair | ReplaceFn | Array<ReplacePair | ReplaceFn>;
}

interface Options extends Pick<Plugin, 'enforce' | 'apply'> {}

function escape(str: string): string {
  return str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
}

function parseReplacements(
  replacements: Replacement[],
): Array<Omit<Replacement, 'replace' | 'filter'> & { filter: RegExp; replace: ReplaceFn[] }> {
  if (!replacements || !replacements.length) return [];

  // TODO:
  // re-group replacements to ensure filter is unique

  return replacements.reduce((entries: any[], replacement) => {
    const filter =
      replacement.filter instanceof RegExp
        ? replacement.filter
        : new RegExp(
            `(${[]
              .concat(replacement.filter as any)
              .filter((i) => i)
              .map((i: string) => escape(i.trim().replace(/\\+/g, '/')))
              .join('|')})`,
          );
    let { replace = [] } = replacement;

    if (!filter) return entries;
    if (typeof replace === 'function' || !Array.isArray(replace)) {
      replace = [replace];
    }

    replace = replace.reduce((entries: ReplaceFn[], rp) => {
      if (typeof rp === 'function') return entries.concat(rp);

      const { from, to } = rp;

      if (from === undefined || to === undefined) return entries;

      return entries.concat((source) =>
        source.replace(
          from instanceof RegExp
            ? from
            : new RegExp(
                `(${[]
                  .concat(from as any)
                  .map(escape)
                  .join('|')})`,
                'g',
              ),
          String(to),
        ),
      );
    }, []);

    if (!replace.length) return entries;

    return entries.concat({ ...replacement, filter, replace });
  }, []);
}

export default function (replacements: Replacement[] = [], options: Options = {}): Plugin {
  const resolvedReplacements = parseReplacements(replacements);
  let isServe = true;
  let sourcemap = false;

  if (!resolvedReplacements.length) return {} as any;

  function replace(code: string, id: string): string;
  function replace(code: string, id: string, sourcemap: boolean): { code: string; map: SourceMap };
  function replace(
    code: string,
    id: string,
    sourcemap?: boolean,
  ): string | { code: string; map: SourceMap } {
    const replaced = resolvedReplacements.reduce((code, rp) => {
      if (!rp.filter.test(id)) return code;
      return rp.replace.reduce((text, replace) => replace(text, id), code);
    }, code);

    if (!sourcemap) return replaced;

    return {
      code: replaced,
      map: new MagicString(replaced).generateMap({ hires: true }),
    };
  }

  return {
    name: 'vite-plugin-filter-replace',
    enforce: options.enforce,
    apply: options.apply,
    config: (config, env) => {
      isServe = env.command === 'serve';
      sourcemap = !!config.build?.sourcemap;

      if (!isServe) return;

      if (!config.optimizeDeps) {
        config.optimizeDeps = {};
      }
      if (!config.optimizeDeps.esbuildOptions) {
        config.optimizeDeps.esbuildOptions = {};
      }
      if (!config.optimizeDeps.esbuildOptions.plugins) {
        config.optimizeDeps.esbuildOptions.plugins = [];
      }

      config.optimizeDeps.esbuildOptions.plugins.unshift(
        ...resolvedReplacements.map((option) => {
          return {
            name: 'vite-plugin-filter-replace' + (option.id ? `:${option.id}` : ''),
            setup(build: PluginBuild) {
              build.onLoad({ filter: option.filter, namespace: 'file' }, async ({ path }) => {
                const source = await fs.readFile(path, 'utf8');

                return {
                  loader: 'default',
                  contents: option.replace.reduce((text, replace) => replace(text, path), source),
                };
              });
            },
          };
        }),
      );

      return config;
    },
    renderChunk(code, chunk) {
      if (isServe) return null;
      return replace(code, chunk.fileName, sourcemap);
    },
    transform(code, id) {
      return replace(code, id, sourcemap);
    },
    async handleHotUpdate(ctx) {
      const defaultRead = ctx.read;
      ctx.read = async function () {
        return replace(await defaultRead(), ctx.file);
      };
    },
  };
}
