const { getPdfName } = require('./utils/fs');
const { buildDocTreeFromPdf } = require('./utils/pdf');
const { buildKnowledgeFromDocTree } = require('./utils/tree');
const { buildKnowledgeEmbeddings } = require('./utils/embedding');
const ask = require('./utils/ask');

async function loadingPdf(pdfPath) {
  const pdfName = getPdfName(pdfPath);
  // 构建内容树
  const docTree = await buildDocTreeFromPdf(pdfPath);
  // const fs = require('fs');
  // fs.writeFileSync('./temp.json', JSON.stringify(docTree))
  // 构建知识库
  const knowledge = await buildKnowledgeFromDocTree(docTree, pdfName);
  // // 构建知识库向量
  await buildKnowledgeEmbeddings(knowledge, pdfName);
}

async function askQuestion(question, pdfName) {
  console.log(`AI 正在努力回答您的问题『${question}』，请稍作等待...\n`);
  const answer = await ask(question, pdfName);
  console.log(`您的问题『${question}』回答如下：\n==========\n${answer}\n==========\n`);
  return answer;
}

module.exports = {
  loadingPdf,
  askQuestion,
};
