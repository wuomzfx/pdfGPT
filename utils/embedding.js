const { createEmbeddingWithCache } = require('./ai');
const { writeKnowledgeEmbeddings } = require('./fs');

async function buildKnowledgeEmbeddings(knowledge, pdfName) {
  const embeddings = [];
  for (let index = 0; index < knowledge.length; index++) {
    if (!embeddings[index]) {
      const embedding = await createEmbeddingWithCache(knowledge[index], pdfName);
      embeddings[index] = embedding;
      console.log('createEmbedding success', index);
    }
  }
  writeKnowledgeEmbeddings(pdfName, embeddings);
  return embeddings;
}

async function buildQuestionEmbedding(question, pdfName) {
  const embedding = await createEmbeddingWithCache(question, pdfName);
  // console.log('createQuestionEmbedding success:', question);

  return embedding;
}

module.exports = { buildKnowledgeEmbeddings, buildQuestionEmbedding };
