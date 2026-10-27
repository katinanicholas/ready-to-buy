// Loads the browser/Apps Script files into a Node vm context for tests and previews.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

function loadBackend(extraGlobals) {
  const ctx = vm.createContext(Object.assign({ console }, extraGlobals || {}));
  for (const f of ['backend/apps-script/Assessment.gs', 'backend/apps-script/EmailTemplates.gs', 'backend/apps-script/Code.gs']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

function loadAssessment() {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(root, 'docs/js/assessment.js'), 'utf8'), ctx);
  return ctx.Assessment;
}

module.exports = { root, loadBackend, loadAssessment };
