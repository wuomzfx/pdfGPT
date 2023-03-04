const { encode } = require('gpt-3-encoder');
const ddot = require('@stdlib/blas/base/ddot');

const { buildQuestionEmbedding } = require('./embedding');
const { readKnowledgeEmbeddings, readKnowledge, writeAnswer } = require('./fs');
const { askInsQuestion } = require('./ai');

function getKnowledge({
  questionEmbedding,
  knowledgeEmbeddings,
  knowledgeList,
}) {
  const kList = knowledgeEmbeddings
    .map((knowledge, index) => {
      const x = new Float64Array(questionEmbedding);
      const y = new Float64Array(knowledge);
      return {
        index,
        ddot: ddot(x.length, x, 1, y, 1),
        knowledge: knowledgeList[index],
      };
    })
    .sort((a, b) => b.ddot - a.ddot)
    .filter(k => k.ddot > 0.8);

  let tokens = 0;
  const enoughTokenList = kList.filter(k => {
    tokens += encode(k.knowledge).length;
    return tokens < 3000;
  });

  return enoughTokenList.map(({ knowledge }) => knowledge).join('\n');
}

async function ask(question, pdfName) {
  const questionEmbedding = await buildQuestionEmbedding(question, pdfName);
  const knowledgeEmbeddings = readKnowledgeEmbeddings(pdfName);
  const knowledgeList = readKnowledge(pdfName);

  const knowledge = getKnowledge({
    questionEmbedding,
    knowledgeEmbeddings,
    knowledgeList,
  });
  const answer = await askInsQuestion({ question, knowledge });
  writeAnswer(pdfName, question, answer);
  return answer;
}

module.exports = ask;
