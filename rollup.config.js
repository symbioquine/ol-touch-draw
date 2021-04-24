import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import serve from 'rollup-plugin-serve';
import livereload from 'rollup-plugin-livereload';
import pkg from './package.json';
import css from 'rollup-plugin-css-only'

const production = !process.env.ROLLUP_WATCH;

export default [
  // browser-friendly UMD build
  {
    input: 'src/index.js',
    output: {
      name: 'olTouchDraw',
      file: pkg.browser,
      format: 'umd',
      exports: 'named',
    },
    plugins: [
      resolve(),
      commonjs(),
      css({
        output: 'ol-touch-draw.css',
      }),
      !production && serve({
        contentBase: ['dist', 'static']
      }),
      !production && livereload({
        watch: ['dist', 'static']
      })
    ],
    onwarn: function(warning) {
      // Skip certain warnings

      // should intercept ... but doesn't in some rollup versions
      if ( warning.code === 'THIS_IS_UNDEFINED' ) { return; }

      // console.warn everything else
      console.warn( warning.message );
    }

  },

  // CommonJS (for Node) and ES module (for bundlers) build.
  // (We could have three entries in the configuration array
  // instead of two, but it's quicker to generate multiple
  // builds from a single configuration where possible, using
  // an array for the `output` option, where we can specify
  // `file` and `format` for each target)
  {
    input: 'src/index.js',
    external: [
      /ol\/.*/
    ],
    plugins: [
      css({
        output: false,
      }),
    ],
    output: [
      { file: pkg.main, format: 'cjs', exports: 'named' },
      { file: pkg.module, format: 'es', exports: 'named' }
    ]
  }
];
