const path = require('path');
const resolve = require('@rollup/plugin-node-resolve').default;
const commonjs = require('@rollup/plugin-commonjs');
const css = require('rollup-plugin-css-only');


module.exports = function (karma) {
  karma.set({
    browsers: [process.env.CI ? 'ChromeHeadless' : 'Chrome'],
    browserDisconnectTolerance: 2,
    frameworks: ['mocha'],
    client: {
      runInParent: true,
      mocha: {
        timeout: 2500,
      },
    },
    files: [
      {
        pattern: 'module-global.js',
        watched: false,
      },
      {
        pattern: path.resolve(__dirname, require.resolve('expect.js/index.js')),
        watched: false,
      },
      {
        pattern: path.resolve(__dirname, require.resolve('sinon/pkg/sinon.js')),
        watched: false,
      },
      {
        pattern: path.resolve(__dirname, '**/*.test.js'),
        watched: false,
      },
      {
        pattern: '**/*',
        included: false,
        watched: false,
      },
    ],
    proxies: {
      '/spec/': '/base/spec/',
    },
    preprocessors: {
      '**/*.js': ['rollup', 'sourcemap'],
    },
    rollupPreprocessor: {
      /**
       * This is just a normal Rollup config object,
       * except that `input` is handled for you.
       */
      plugins: [
        resolve(),
        commonjs(),
        css({
          output: 'ol-touch-draw.css',
        }),
      ],
      output: {
        format: 'iife',
        name: 'olTouchDraw',
        sourcemap: 'inline',
      },
      onwarn: function(warning) {
        // Skip certain warnings

        // should intercept ... but doesn't in some rollup versions
        if ( warning.code === 'THIS_IS_UNDEFINED' ) { return; }

        // console.warn everything else
        console.warn( warning.message );
      }
    },
    reporters: ['coverage-istanbul'],
    coverageIstanbulReporter: {
      reports: ['text-summary', 'html'],
      dir: path.resolve(__dirname, '../coverage/'),
      fixWebpackSourcePaths: true,
    },
  });

  process.env.CHROME_BIN = require('puppeteer').executablePath();
};
