# vite-plugin-filter-replace [![npm](https://img.shields.io/npm/v/vite-plugin-filter-replace.svg)](https://npmjs.com/package/vite-plugin-filter-replace)

```js
// vite.config.js
import filterReplace from 'vite-plugin-filter-replace';

export default {
  plugins: [filterReplace()],
};
```

## Options

```ts
interface Replacement {
  filter: RegExp | string | string[];
  replace: Array<{
    from: RegExp | string | string[]; to: string | number; } |
    (source: string, path: string) => string
  > | ((source: string, path: string) => string)
    | { from: RegExp | string | string[]; to: string | number; };
}

interface Options {
  enforce?: 'pre' | 'post';
  apply?: 'serve' | 'build';
}
```

## Example

```ts
import vue from '@vitejs/plugin-vue';

export default {
  plugins: [
    filterReplace(
      [
        {
          filter: /\.css$/,
          replace: {
            from: /__foo__/g,
            to: 'xxx'
          },
        },
        {
          filter: /\.css$/,
          replace: [
            { from: /__bar__/g, to: 'xxx' },
          ],
        },
        {
          filter: ['node_modules/moment/dist/moment.js'],
          replace(path, source) {
            return 'some code';
          },
        },
      ]
    ),
  ],
};
```

## License

MIT
