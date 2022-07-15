var path = require('path');
var chai = require('chai');

var MochaChrome = require('mocha-chrome');

var { expect } = chai;

function test(options) {
  var url = `file://${path.join(__dirname, `${options.file}.html`)}`;

  options = {
      url,
      mocha: { colors: false },
      ignoreConsole: true,
      ignoreExceptions: true,
      ignoreResourceErrors: true,
      ...options
  };

  var runner = new MochaChrome(options);
  var result = new Promise((resolve, reject) => {
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