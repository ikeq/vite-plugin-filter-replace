# vite-plugin-filter-replace [![npm](https://img.shields.io/npm/v/vite-plugin-filter-replace.svg)](https://npmjs.com/package/vite-plugin-filter-replace)

Apply filename based replacements.

```ts
import vue from '@vitejs/plugin-vue';
import replace from 'vite-plugin-filter-replace';

export default {
  plugins: [
    replace(
      [
        {
          filter: /\.css$/,
          replace: {
            from: /__foo__/g,
            to: 'foo',
          },
        },
        {
          filter: /\.css$/,
          replace: [
            { from: /__foo__/g, to: 'foo' },
            { from: /__(foo)__/g, to: '$1' },
          ],
        },
        {
          filter: ['node_modules/moment/dist/moment.js'],
          replace(source, path) {
            return 'some code';
          },
        },
      ],
      { enforce: 'pre' },
    ),
  ],
};
```

## Options

```ts
function replace(replacements: Replacement[]): Plugin;
function replace(replacements: Replacement[], options: Options): Plugin;

interface Replacement {
  filter: RegExp | string | string[];
  replace: { from: RegExp | string | string[]; to: string | number };
}

interface Replacement {
  filter: RegExp | string | string[];
  replace: (source: string, path: string) => string;
}

interface Replacement {
  filter: RegExp | string | string[];
  replace: { from: RegExp | string | string[]; to: string | number }[];
}

interface Replacement {
  filter: RegExp | string | string[];
  replace: ((source: string, path: string) => string)[];
}

interface Options {
  enforce?: 'pre' | 'post';
  apply?: 'serve' | 'build';
}
```

## License

MIT
