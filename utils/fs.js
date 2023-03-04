const { writeFileSync, readFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');

function readJsonFile(path) {
  try {
    const string = readFileSync(path).toString();
    return JSON.parse(string);
  } catch {
    return {};
  }
}

function getPdfName(pdfPath) {
  return pdfPath.split('/').pop().split('.pdf')[0];
}

function getPath(pdfName, fileName) {
  const relativeDirPath = `../knowledgeFiles/${pdfName}`;
  const dirPath = join(__dirname, relativeDirPath);
  // 文件夹初始化
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath);
  }
  return join(__dirname, `${relativeDirPath}/${fileName}.json`);
}

function writeContentTree(pdfName, docTree) {
  writeFileSync(getPath(pdfName, 'contentTree'), JSON.stringify(docTree));
}

function writeKnowledge(pdfName, knowledge) {
  writeFileSync(getPath(pdfName, 'knowledge'), JSON.stringify(knowledge));
}

function readKnowledge(pdfName) {
  return readJsonFile(getPath(pdfName, 'knowledge'));
}

function writeKnowledgeEmbeddings(pdfName, embeddings) {
  writeFileSync(
    getPath(pdfName, 'knowledgeEmbeddings'),
    JSON.stringify(embeddings),
  );
}

function readKnowledgeEmbeddings(pdfName) {
  return readJsonFile(getPath(pdfName, 'knowledgeEmbeddings'));
}

function getPdfPath(pdfName) {
  return join(__dirname, `../pdfs/${pdfName}.pdf`);
}

function writeAnswer(pdfName, question, answer) {
  const answerPath = join(__dirname, `../answerFiles/${pdfName}_answers.json`);
  if (!existsSync(answerPath)) {
    writeFileSync(answerPath, JSON.stringify({ [question]: answer }));
    return;
  }

  const answerJson = readJsonFile(answerPath);
  answerJson[question] = answer;
  writeFileSync(answerPath, JSON.stringify(answerJson));
}

module.exports = {
  getPdfPath,
  getPdfName,
  writeAnswer,
  readKnowledge,
  writeKnowledge,
  writeContentTree,
  writeKnowledgeEmbeddings,
  readKnowledgeEmbeddings,
};
