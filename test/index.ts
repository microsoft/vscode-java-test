import testRunner = require('vscode/lib/testrunner');

testRunner.configure({
    ui: 'tdd',
    useColors: true,
});

module.exports = testRunner;
