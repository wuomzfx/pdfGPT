const config = require('../config');
const { askQuestion } = require('../index');

const { pdfName, questions } = config;

(async () => {
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    await askQuestion(question, pdfName);
  }
})();
