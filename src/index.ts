import fs from 'fs';
import { Plugin } from 'vite'
import { PluginBuild } from 'esbuild';

type ReplaceFn = (path: string, source: string) => string;
type ReplacePair = { from: RegExp | string | string[]; to: string | number; };

interface Replacement {
  /**
   * for debugging purpose
   */
  id?: string | number;
  /**
   * name matching of module
   */
  filter: RegExp | string | string[];
  /**
   * esm modules which required by using `require('esm')`
   */
  replace: Array<ReplacePair | ReplaceFn> | ReplaceFn;
}

interface Options {
  /**
   * Enforce plugin invocation tier similar to webpack loaders.
   *
   * Plugin invocation order:
   * - alias resolution
   * - `enforce: 'pre'` plugins
   * - vite core plugins
   * - normal plugins
   * - vite build plugins
   * - `enforce: 'post'` plugins
   * - vite build post plugins
   */
  enforce?: 'pre' | 'post';
  /**
   * Apply the plugin only for serve or for build.
   */
  apply?: 'serve' | 'build';
}

function escape(str: string): string {
  return str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
}

function parseReplacements(replacements: Replacement[]):
  Array<Omit<Replacement, 'replace' | 'filter'> & { filter: RegExp; replace: ReplaceFn[] }> {
  if (!replacements || !replacements.length) return [];

  return replacements.reduce((entries: any[], replacement) => {
    const filter =
      replacement.filter instanceof RegExp || typeof replacement.filter === 'function'
        ? replacement.filter
        : new RegExp(
          `(${[]
            .concat(replacement.filter as any)
            .filter((i) => i)
            .map((i: string) => escape(i.trim()))
            .join('|')})`
        );
    let { replace = [] } = replacement;

    if (!filter) return entries;
    if (typeof replace === 'function') {
      replace = [replace];
    }

    replace = replace.reduce((entries: ReplaceFn[], rp) => {
      if (typeof rp === 'function') return entries.concat(rp);

      const { from, to } = rp;

      if (!from || !to) return entries;

      return entries.concat((_, source) =>
        source.replace(
          from instanceof RegExp ? from : new RegExp(`(${[].concat(from as any).map(escape).join('|')})`, 'g'),
          String(to)
        )
      );
    }, []);

    if (!replace.length) return entries;

    return entries.concat({ ...replacement, filter, replace });
  }, []);
}

export default function filterReplace(replacements: Replacement[] = [], options: Options = {}): Plugin | void {
  const resolvedReplacements = parseReplacements(replacements);

  if (!resolvedReplacements.length) return;

  return {
    name: 'vite-plugin-filter-replace',
    enforce: options.enforce,
    apply: options.apply,
    config(config, env) {
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
                const source = await fs.promises.readFile(path, 'utf8');

                return {
                  loader: 'default',
                  contents: option.replace.reduce((text, replace) => replace(path, text), source),
                };
              });
            },
          };
        })
      );

      return config;
    },
  };
}
