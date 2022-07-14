const path = require('path');
const chai = require('chai');

const MochaChrome = require('mocha-chrome');

const { expect } = chai;

function test(options) {
  const url = `file://${path.join(__dirname, `${options.file}.html`)}`;

  options = {
      url,
      mocha: { colors: false },
      ignoreConsole: true,
      ignoreExceptions: true,
      ignoreResourceErrors: true,
      ...options
  };

  const runner = new MochaChrome(options);
  const result = new Promise((resolve, reject) => {
    runner.on('ended', (stats) => {
      resolve(stats);
    });

    runner.on('failure', (message) => {
      reject(message);
    });
  });

  (async function() {
    await runner.connect();
    await runner.run();
  })();

  return result;
}

describe('Browser client tests', () => {
  it('Unit Tests', () =>
    test({ file: 'unit' }).then(({ passes, failures }) => {
      expect(passes).to.equal(13);
      expect(failures).to.equal(0);
    }));
  it('Integration Tests', () =>
     test({ file: 'integration' }).then(({ passes, failures }) => {
      expect(passes).to.equal(18);
      expect(failures).to.equal(0);
    })
  );
});